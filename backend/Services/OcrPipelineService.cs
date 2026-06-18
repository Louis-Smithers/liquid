using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Smithers.API.Services;

public class OcrPipelineService : IOcrPipelineService
{
    private readonly AppDbContext _context;
    private readonly ISupabaseStorage _storage;
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _config;

    public OcrPipelineService(
        AppDbContext context,
        ISupabaseStorage storage,
        IServiceProvider serviceProvider,
        IConfiguration config)
    {
        _context = context;
        _storage = storage;
        _serviceProvider = serviceProvider;
        _config = config;
    }

    // ---- Batch lifecycle -------------------------------------------------

    public async Task<UploadBatchDto> CreateBatchAsync(Guid userId)
    {
        var batch = new UploadBatch
        {
            Id = Guid.NewGuid(),
            CreatedBy = userId,
            Status = "Staging",
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        };
        _context.UploadBatches.Add(batch);
        await _context.SaveChangesAsync();
        return Map(batch);
    }

    public async Task<UploadBatchDto> AddFilesAsync(Guid batchId, IFormFileCollection files, Guid userId)
    {
        var batch = await _context.UploadBatches.FindAsync(batchId)
            ?? throw new KeyNotFoundException("Batch not found.");
        if (batch.CreatedBy != userId)
            throw new UnauthorizedAccessException("You do not have access to this batch.");

        // Read bytes synchronously while the request (and its file streams) are alive,
        // then hand them to the fire-and-forget OCR task.
        var pending = new List<(Guid docId, byte[] bytes)>();

        foreach (var file in files)
        {
            var docId = Guid.NewGuid();
            var path = $"{batchId}/{docId}-{file.FileName}";

            byte[] bytes;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms);
                bytes = ms.ToArray();
            }

            var storagePath = await _storage.UploadAsync(file, "invoices-staging", path)
                              ?? $"invoices-staging/{path}";

            _context.StagedDocuments.Add(new StagedDocument
            {
                Id = docId,
                BatchId = batchId,
                FileName = file.FileName,
                StoragePath = storagePath,
                OcrStatus = "Pending",
                CreatedAt = DateTimeOffset.UtcNow
            });
            pending.Add((docId, bytes));
        }
        await _context.SaveChangesAsync();

        // Simple fire-and-forget per file (no hosted job queue per the plan).
        foreach (var (docId, bytes) in pending)
            _ = Task.Run(() => ProcessOcrTaskAsync(docId, bytes));

        var reloaded = await LoadBatchAsync(batchId);
        return Map(reloaded);
    }

    public async Task<UploadBatchDto> GetBatchAsync(Guid batchId, Guid userId)
    {
        var batch = await LoadBatchAsync(batchId);
        if (userId != Guid.Empty && batch.CreatedBy != userId)
            throw new UnauthorizedAccessException("You do not have access to this batch.");
        return Map(batch);
    }

    public async Task<(byte[] Bytes, string FileName)?> GetDocumentFileAsync(Guid batchId, Guid docId, Guid userId)
    {
        var doc = await _context.StagedDocuments
            .Include(d => d.Batch)
            .FirstOrDefaultAsync(d => d.Id == docId && d.BatchId == batchId)
            ?? throw new KeyNotFoundException("Document not found.");

        if (doc.Batch.CreatedBy != userId)
            throw new UnauthorizedAccessException("You do not have access to this batch.");

        var bytes = await _storage.DownloadAsync(doc.StoragePath);
        return bytes is null ? null : (bytes, doc.FileName);
    }

    public async Task<bool> DiscardBatchAsync(Guid batchId, Guid userId)
    {
        var batch = await LoadBatchAsync(batchId);
        if (batch.CreatedBy != userId)
            throw new UnauthorizedAccessException("You do not have access to this batch.");

        foreach (var doc in batch.Documents)
            await _storage.DeleteAsync(doc.StoragePath);

        batch.Status = "Abandoned";
        await _context.SaveChangesAsync();
        return true;
    }

    // ---- Confirm ---------------------------------------------------------

    public async Task<ConfirmResultDto> ConfirmDocumentAsync(Guid batchId, Guid docId, ConfirmDocDto dto, Guid userId)
    {
        var doc = await _context.StagedDocuments
            .Include(d => d.Batch)
            .FirstOrDefaultAsync(d => d.Id == docId && d.BatchId == batchId)
            ?? throw new KeyNotFoundException("Document not found.");

        if (doc.Batch.CreatedBy != userId)
            throw new UnauthorizedAccessException("You do not have access to this batch.");

        var invoiceId = $"{dto.ClientShortcode}_{dto.InvoiceNumber}";

        // Duplicate guard (matches the (LiquidClient, OriginalInvoice) unique index).
        if (await _context.Invoices.AnyAsync(i => i.InvoiceId == invoiceId))
            throw new InvalidOperationException($"Invoice '{invoiceId}' already exists.");

        // Client: create-if-missing (the "IF NO" branch — client verified by the user first).
        var clientExists = await _context.Clients.AnyAsync(c => c.Shortcode == dto.ClientShortcode);
        if (!clientExists)
        {
            if (!dto.CreateClient)
                throw new InvalidOperationException(
                    $"Client '{dto.ClientShortcode}' does not exist. Verify and create it first (set createClient).");

            _context.Clients.Add(new Client
            {
                Id = Guid.NewGuid(),
                Shortcode = dto.ClientShortcode,
                Active = true
            });
        }

        // Debtor: existing id, or create new.
        Guid debtorId;
        string? debtorName;
        if (dto.DebtorId.HasValue)
        {
            debtorId = dto.DebtorId.Value;
            debtorName = await _context.Debtors
                .Where(d => d.Id == debtorId)
                .Select(d => d.Name)
                .FirstOrDefaultAsync();
            if (debtorName == null)
                throw new InvalidOperationException("Selected debtor does not exist.");
        }
        else if (!string.IsNullOrWhiteSpace(dto.NewDebtorName))
        {
            var debtor = new Debtor { Id = Guid.NewGuid(), Name = dto.NewDebtorName, Group = "Review" };
            _context.Debtors.Add(debtor);
            debtorId = debtor.Id;
            debtorName = debtor.Name;
        }
        else
        {
            throw new InvalidOperationException("A debtor (existing id or new name) is required.");
        }

        var now = DateTimeOffset.UtcNow;
        var invoice = new Invoice
        {
            InvoiceId = invoiceId,
            LiquidClient = dto.ClientShortcode,
            DebtorId = debtorId,
            DebtorName = debtorName,          // denormalized snapshot
            OriginalInvoice = dto.InvoiceNumber,
            Date = dto.InvoiceDate,
            Amount = dto.Amount,
            Status = "Pre-Verified",          // human-reviewed at confirm time
            Verified = true,
            DocumentPath = doc.StoragePath,
            Notes = dto.Notes,
            Source = "OCR",
            CreatedTime = now,
            ProcessedTime = now,
            UpdatedAt = now
        };
        _context.Invoices.Add(invoice);

        // Persist the confirmed OCR fields (with bbox) onto InvoiceOcrResult.
        if (!string.IsNullOrEmpty(doc.ParsedFieldsJson))
        {
            var fields = JsonSerializer.Deserialize<ParsedFieldDto[]>(doc.ParsedFieldsJson);
            if (fields != null)
            {
                foreach (var f in fields)
                {
                    _context.InvoiceOcrResults.Add(new InvoiceOcrResult
                    {
                        InvoiceId = invoiceId,
                        FieldName = f.FieldName,
                        ExtractedValue = f.Value,
                        ConfirmedValue = f.Value,
                        Confidence = f.Confidence,
                        PageNumber = f.Page,
                        BboxX = f.BboxX,
                        BboxY = f.BboxY,
                        BboxWidth = f.BboxWidth,
                        BboxHeight = f.BboxHeight,
                        Reviewed = true,
                        ReviewedBy = userId,
                        ReviewedAt = now
                    });
                }
            }
        }

        await _context.SaveChangesAsync();
        return new ConfirmResultDto(invoiceId);
    }

    // ---- OCR worker ------------------------------------------------------

    private async Task ProcessOcrTaskAsync(Guid docId, byte[] fileBytes)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var documentOcr = scope.ServiceProvider.GetRequiredService<IDocumentOcr>();
        var llmExtractor = scope.ServiceProvider.GetRequiredService<ILlmFieldExtractor>();

        var doc = await context.StagedDocuments.FindAsync(docId);
        if (doc == null) return;

        doc.OcrStatus = "Processing";
        await context.SaveChangesAsync();

        try
        {
            // Shared OCR handles both PDF and image uploads (fileName is the type hint).
            var ocr = documentOcr.Run(fileBytes, contentType: null, fileName: doc.FileName);
            var llm = await llmExtractor.ExtractAsync(ocr.Text, ocr.PageImagePng);
            var fields = BuildParsedFields(ocr, llm);
            var matches = await MatchAsync(context, ocr.Text, llm?.VendorName.Value, llm?.BillToName.Value);

            doc.RawText = ocr.Text.Length > 20000 ? ocr.Text[..20000] : ocr.Text;
            doc.ParsedFieldsJson = JsonSerializer.Serialize(fields);
            doc.MatchJson = JsonSerializer.Serialize(matches);
            doc.OcrStatus = "Ready";
        }
        catch (Exception ex)
        {
            doc.OcrStatus = "Failed";
            doc.Error = ex.Message;
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Maps OCR output to parsed fields. Prefers the LLM extraction (confidence comes from the
    /// model; bbox is recovered by matching the value back to a Tesseract word box). Falls back
    /// to the legacy layout-specific regex parser when the LLM is unavailable.
    /// </summary>
    private static List<ParsedFieldDto> BuildParsedFields(OcrOutput ocr, ExtractedInvoice? llm)
    {
        if (llm == null)
            return ParsePaneVita(ocr.Text, ocr.Words);

        return new List<ParsedFieldDto>
        {
            MakeField("invoiceNumber", llm.InvoiceNumber, ocr.Words),
            MakeField("date", llm.InvoiceDate, ocr.Words),
            MakeField("amount", llm.Amount, ocr.Words),
            MakeField("poNumber", llm.PoNumber, ocr.Words),
        };
    }

    // ---- Pane Vita field parser (legacy regex fallback) ------------------

    private static List<ParsedFieldDto> ParsePaneVita(string text, IReadOnlyList<OcrWord> words)
    {
        // Pane Vita layout is tabular: Tesseract linearizes it so a label ("Invoice #",
        // "P.O. Number") and its value end up on DIFFERENT lines. So we don't rely on
        // "label then value on the same line"; instead we exploit the distinctive digit
        // widths of this layout — invoice # is a standalone 6-digit number, PO is a
        // standalone 10-digit number — anchored near their labels, with a doc-wide
        // fallback. \b boundaries keep us from matching substrings of longer runs (account
        // numbers) or shorter ones (a 5-digit ZIP code, which previously leaked through).

        // Invoice number: a 6-digit run, preferring one shortly after an "Invoice" anchor.
        string? invoiceNumber = null;
        int invoiceIdx = -1;
        var invAnchor = Regex.Match(text, @"invoice\s*#?", RegexOptions.IgnoreCase);
        if (invAnchor.Success)
        {
            var window = text.Substring(invAnchor.Index, Math.Min(160, text.Length - invAnchor.Index));
            var m = Regex.Match(window, @"\b(\d{6})\b");
            if (m.Success) { invoiceNumber = m.Groups[1].Value; invoiceIdx = invAnchor.Index + m.Index; }
        }
        if (invoiceNumber == null)
        {
            var m = Regex.Match(text, @"\b(\d{6})\b");
            if (m.Success) { invoiceNumber = m.Groups[1].Value; invoiceIdx = m.Index; }
        }

        // Date: the M/D/Y occurrence nearest the invoice number (the header "Date" box),
        // so we prefer the invoice date over the ship date elsewhere on the page.
        string? date = null;
        var dateMatches = Regex.Matches(text, @"\b(\d{1,2}/\d{1,2}/\d{2,4})\b").Cast<Match>().ToList();
        if (dateMatches.Count > 0)
        {
            var chosen = invoiceIdx >= 0
                ? dateMatches.OrderBy(m => Math.Abs(m.Index - invoiceIdx)).First()
                : dateMatches[0];
            date = DateTime.TryParse(chosen.Groups[1].Value, out var dt)
                ? dt.ToString("yyyy-MM-dd")
                : chosen.Groups[1].Value;
        }

        // Amount: largest currency value on the page (the Pane Vita Total is the max).
        decimal best = -1m;
        string? amount = null;
        foreach (Match m in Regex.Matches(text, @"([\d]{1,3}(?:,\d{3})*\.\d{2})"))
        {
            if (decimal.TryParse(m.Groups[1].Value.Replace(",", ""), out var d) && d > best)
            {
                best = d;
                amount = d.ToString("0.00");
            }
        }

        // PO number: a 10-digit run, preferring one shortly after a "P.O." anchor.
        string? po = null;
        var poAnchor = Regex.Match(text, @"P\.?\s*O\.?", RegexOptions.IgnoreCase);
        if (poAnchor.Success)
        {
            var window = text.Substring(poAnchor.Index, Math.Min(200, text.Length - poAnchor.Index));
            var m = Regex.Match(window, @"\b(\d{10})\b");
            if (m.Success) po = m.Groups[1].Value;
        }
        if (po == null)
        {
            var m = Regex.Match(text, @"\b(\d{10})\b");
            if (m.Success) po = m.Groups[1].Value;
        }

        return new List<ParsedFieldDto>
        {
            MakeField("invoiceNumber", invoiceNumber, words),
            MakeField("date", date, words),
            MakeField("amount", amount, words),
            MakeField("poNumber", po, words),
        };
    }

    // LLM-sourced field: value + confidence come from the model; bbox is recovered by matching
    // the value back to a Tesseract word box (null bbox if no match).
    private static ParsedFieldDto MakeField(string name, ExtractedField field, IReadOnlyList<OcrWord> words)
    {
        if (string.IsNullOrEmpty(field.Value))
            return new ParsedFieldDto(name, null, 0m, 1, null, null, null, null);

        var conf = Math.Round(field.Confidence, 2);
        var wb = OcrWordMatch.FindWord(field.Value, words);
        return wb == null
            ? new ParsedFieldDto(name, field.Value, conf, 1, null, null, null, null)
            : new ParsedFieldDto(name, field.Value, conf, 1, wb.X, wb.Y, wb.W, wb.H);
    }

    // Regex-fallback field: confidence is derived from the matched word box (legacy behaviour).
    private static ParsedFieldDto MakeField(string name, string? value, IReadOnlyList<OcrWord> words)
    {
        if (string.IsNullOrEmpty(value))
            return new ParsedFieldDto(name, null, 0m, 1, null, null, null, null);

        var wb = OcrWordMatch.FindWord(value, words);
        if (wb == null)
            return new ParsedFieldDto(name, value, 0.5m, 1, null, null, null, null);

        return new ParsedFieldDto(name, value, Math.Round((decimal)wb.Conf / 100m, 2), 1, wb.X, wb.Y, wb.W, wb.H);
    }

    // ---- Client / debtor matching ----------------------------------------

    private static async Task<MatchCandidatesDto> MatchAsync(
        AppDbContext context, string text, string? vendorHint = null, string? billToHint = null)
    {
        var lines = text.Replace("\r", "").Split('\n')
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .ToArray();

        // Vendor = the issuing company (top of invoice = Liquid's client). Prefer the LLM's
        // reading; fall back to the first text line.
        var vendorName = !string.IsNullOrWhiteSpace(vendorHint)
            ? vendorHint
            : lines.FirstOrDefault(l => Regex.IsMatch(l, "[A-Za-z]{3,}")) ?? "";

        // Bill-To = the party billed (the debtor). Prefer the LLM's reading; fall back to the
        // line following a "Bill To" label.
        string billToName = billToHint ?? "";
        if (string.IsNullOrWhiteSpace(billToName))
        {
            for (int i = 0; i < lines.Length - 1; i++)
            {
                if (Regex.IsMatch(lines[i], @"bill\s*to", RegexOptions.IgnoreCase))
                {
                    billToName = lines[i + 1];
                    break;
                }
            }
        }

        var clients = await context.Clients
            .Select(c => new { c.Id, c.Shortcode, c.CadenceName })
            .ToListAsync();
        var debtors = await context.Debtors
            .Select(d => new { d.Id, d.Name })
            .ToListAsync();

        var clientMatches = clients
            .Select(c => new ClientMatch(
                c.Id.ToString(), c.Shortcode, c.CadenceName ?? c.Shortcode,
                Math.Max(Similarity(vendorName, c.Shortcode), Similarity(vendorName, c.CadenceName))))
            .Where(m => m.Score >= 0.4m)
            .OrderByDescending(m => m.Score)
            .Take(3)
            .ToArray();

        var debtorMatches = debtors
            .Select(d => new DebtorMatch(d.Id, d.Name, Similarity(billToName, d.Name)))
            .Where(m => m.Score >= 0.4m)
            .OrderByDescending(m => m.Score)
            .Take(3)
            .ToArray();

        return new MatchCandidatesDto(clientMatches, debtorMatches);
    }

    private static decimal Similarity(string? a, string? b)
    {
        var na = Normalize(a);
        var nb = Normalize(b);
        if (na.Length == 0 || nb.Length == 0) return 0m;
        var dist = Levenshtein(na, nb);
        var max = Math.Max(na.Length, nb.Length);
        return Math.Round(1m - (decimal)dist / max, 2);
    }

    private static string Normalize(string? s) =>
        new string((s ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static int Levenshtein(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (int j = 0; j <= b.Length; j++) d[0, j] = j;
        for (int i = 1; i <= a.Length; i++)
            for (int j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
            }
        return d[a.Length, b.Length];
    }

    // ---- Helpers ---------------------------------------------------------

    private async Task<UploadBatch> LoadBatchAsync(Guid id) =>
        await _context.UploadBatches.Include(b => b.Documents).FirstOrDefaultAsync(b => b.Id == id)
        ?? throw new KeyNotFoundException("Batch not found.");

    private static UploadBatchDto Map(UploadBatch batch)
    {
        var docs = batch.Documents.Select(d => new StagedDocDto(
            d.Id,
            d.FileName,
            d.StoragePath,
            d.OcrStatus,
            string.IsNullOrEmpty(d.ParsedFieldsJson)
                ? Array.Empty<ParsedFieldDto>()
                : JsonSerializer.Deserialize<ParsedFieldDto[]>(d.ParsedFieldsJson)!,
            string.IsNullOrEmpty(d.MatchJson)
                ? new MatchCandidatesDto(Array.Empty<ClientMatch>(), Array.Empty<DebtorMatch>())
                : JsonSerializer.Deserialize<MatchCandidatesDto>(d.MatchJson)!,
            d.Error
        )).ToList();

        return new UploadBatchDto(batch.Id, batch.Status, batch.ExpiresAt, docs);
    }
}
