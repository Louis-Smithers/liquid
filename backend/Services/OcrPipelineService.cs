using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;
using System.Text.Json;
using System.Text.RegularExpressions;
using PDFtoImage;
using SkiaSharp;
using Tesseract;

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

        // Add to the active Draft sheet for this client (create if none).
        var sheet = await _context.NotificationSheets
            .FirstOrDefaultAsync(n => n.ClientShortcode == dto.ClientShortcode && n.Status == "Draft"
                                   && (n.IsShared || n.CreatedBy == userId));
        if (sheet == null)
        {
            sheet = new NotificationSheet
            {
                Id = Guid.NewGuid(),
                ClientShortcode = dto.ClientShortcode,
                Status = "Draft",
                CreatedAt = now,
                CreatedBy = userId
            };
            _context.NotificationSheets.Add(sheet);
        }

        _context.NotificationSheetItems.Add(new NotificationSheetItem
        {
            Id = Guid.NewGuid(),
            NotificationSheetId = sheet.Id,
            InvoiceId = invoiceId,
            IncludedAmount = dto.Amount
        });

        await _context.SaveChangesAsync();
        return new ConfirmResultDto(invoiceId, sheet.Id);
    }

    // ---- OCR worker ------------------------------------------------------

    private async Task ProcessOcrTaskAsync(Guid docId, byte[] pdfBytes)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var doc = await context.StagedDocuments.FindAsync(docId);
        if (doc == null) return;

        doc.OcrStatus = "Processing";
        await context.SaveChangesAsync();

        try
        {
            var (text, words) = RunOcr(pdfBytes);
            var fields = ParsePaneVita(text, words);
            var matches = await MatchAsync(context, text);

            doc.RawText = text.Length > 20000 ? text[..20000] : text;
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

    private record WordBox(string Text, decimal X, decimal Y, decimal W, decimal H, float Conf);

    /// <summary>
    /// Renders page 1 of the PDF to a 300-DPI image (PDFium) and runs Tesseract (eng+fra),
    /// returning the full page text plus per-word normalized bounding boxes.
    /// </summary>
    private (string text, List<WordBox> words) RunOcr(byte[] pdfBytes)
    {
        using var bitmap = Conversion.ToImage(pdfBytes, page: 0, options: new RenderOptions(Dpi: 300));
        using var encoded = bitmap.Encode(SKEncodedImageFormat.Png, 100);
        var png = encoded.ToArray();

        var tessdata = _config["Tesseract:DataPath"]
                       ?? Path.Combine(AppContext.BaseDirectory, "tessdata");

        using var engine = new TesseractEngine(tessdata, "eng+fra", EngineMode.Default);
        using var pix = Pix.LoadFromMemory(png);
        using var page = engine.Process(pix);

        var text = page.GetText() ?? "";
        var words = new List<WordBox>();

        using var iter = page.GetIterator();
        iter.Begin();
        do
        {
            if (!iter.TryGetBoundingBox(PageIteratorLevel.Word, out var r)) continue;
            var w = iter.GetText(PageIteratorLevel.Word);
            if (string.IsNullOrWhiteSpace(w)) continue;

            words.Add(new WordBox(
                w.Trim(),
                Math.Round((decimal)r.X1 / pix.Width, 6),
                Math.Round((decimal)r.Y1 / pix.Height, 6),
                Math.Round((decimal)r.Width / pix.Width, 6),
                Math.Round((decimal)r.Height / pix.Height, 6),
                iter.GetConfidence(PageIteratorLevel.Word)));
        } while (iter.Next(PageIteratorLevel.Word));

        return (text, words);
    }

    // ---- Pane Vita field parser (Phase 1 layout only) --------------------

    private static List<ParsedFieldDto> ParsePaneVita(string text, List<WordBox> words)
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

    private static ParsedFieldDto MakeField(string name, string? value, List<WordBox> words)
    {
        if (string.IsNullOrEmpty(value))
            return new ParsedFieldDto(name, null, 0m, 1, null, null, null, null);

        // Match against word boxes by alphanumeric content so punctuation/grouping differs
        // don't block a hit (e.g. value "8181.00" vs OCR word "8,181.00").
        static string AlphaNum(string s) => new string(s.Where(char.IsLetterOrDigit).ToArray());
        var needle = AlphaNum(value);
        var wb = needle.Length == 0
            ? null
            : words.FirstOrDefault(w => AlphaNum(w.Text).Contains(needle));
        if (wb == null)
            return new ParsedFieldDto(name, value, 0.5m, 1, null, null, null, null);

        return new ParsedFieldDto(name, value, Math.Round((decimal)wb.Conf / 100m, 2), 1, wb.X, wb.Y, wb.W, wb.H);
    }

    // ---- Client / debtor matching ----------------------------------------

    private static async Task<MatchCandidatesDto> MatchAsync(AppDbContext context, string text)
    {
        var lines = text.Replace("\r", "").Split('\n')
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .ToArray();

        // Vendor = the issuing company (top of invoice = Liquid's client).
        var vendorName = lines.FirstOrDefault(l => Regex.IsMatch(l, "[A-Za-z]{3,}")) ?? "";

        // Bill-To = the party billed (the debtor).
        string billToName = "";
        for (int i = 0; i < lines.Length - 1; i++)
        {
            if (Regex.IsMatch(lines[i], @"bill\s*to", RegexOptions.IgnoreCase))
            {
                billToName = lines[i + 1];
                break;
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
