using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;
using System.Net.Http.Headers;

namespace Smithers.API.Services;

public class OcrService : IOcrService
{
    private readonly AppDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly IDocumentOcr _documentOcr;
    private readonly ILlmFieldExtractor _llm;
    private readonly string _supabaseUrl;
    private readonly string _serviceRoleKey;

    public OcrService(
        AppDbContext context,
        IConfiguration config,
        HttpClient httpClient,
        IDocumentOcr documentOcr,
        ILlmFieldExtractor llm)
    {
        _context = context;
        _httpClient = httpClient;
        _documentOcr = documentOcr;
        _llm = llm;
        _supabaseUrl = config["Supabase:Url"]?.TrimEnd('/') ?? "";
        _serviceRoleKey = config["Supabase:ServiceRoleKey"] ?? "";
    }

    private async Task<string?> UploadToSupabaseStorageAsync(IFormFile file, string bucket, string path)
    {
        if (string.IsNullOrEmpty(_supabaseUrl) || string.IsNullOrEmpty(_serviceRoleKey)) return null;

        var requestUrl = $"{_supabaseUrl}/storage/v1/object/{bucket}/{path}";
        var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);

        using var content = new StreamContent(file.OpenReadStream());
        if (file.ContentType != null)
        {
            content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
        }
        request.Content = content;

        var response = await _httpClient.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            return $"{bucket}/{path}";
        }

        var error = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Supabase Storage Error: {error}");
        return null;
    }

    // Bytes-based variant for content we generate ourselves (e.g. the rasterized PDF-page-1
    // preview PNG) rather than receiving as an IFormFile.
    private async Task<string?> UploadBytesToSupabaseStorageAsync(byte[] bytes, string bucket, string path, string contentType)
    {
        if (string.IsNullOrEmpty(_supabaseUrl) || string.IsNullOrEmpty(_serviceRoleKey)) return null;

        var requestUrl = $"{_supabaseUrl}/storage/v1/object/{bucket}/{path}";
        var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);

        using var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        request.Content = content;

        var response = await _httpClient.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            return $"{bucket}/{path}";
        }

        var error = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Supabase Storage Error: {error}");
        return null;
    }

    public async Task<(bool Success, string? Error, string? DocumentPath)> UploadAndExtractAsync(
        IFormFile file, string invoiceId)
    {
        if (file is null || file.Length == 0)
            return (false, "File is empty.", null);

        var invoice = await _context.Invoices.FindAsync(invoiceId);
        if (invoice is null)
            return (false, "Invoice not found.", null);

        var path = $"{invoiceId}/{file.FileName}";
        var documentPath = await UploadToSupabaseStorageAsync(file, "invoices", path);
        if (documentPath == null) documentPath = $"invoices/{path}";

        invoice.DocumentPath = documentPath;

        // Custom Adobe PDF Extract parsing logic scaffold
        var ocrResult = new InvoiceOcrResult
        {
            InvoiceId = invoiceId,
            FieldName = "invoice_number",
            ExtractedValue = invoice.OriginalInvoice,
            Confidence = 0.95m,
            PageNumber = 1,
            BboxX = 0.1m,
            BboxY = 0.1m,
            BboxWidth = 0.2m,
            BboxHeight = 0.05m
        };

        _context.InvoiceOcrResults.Add(ocrResult);
        await _context.SaveChangesAsync();

        return (true, null, documentPath);
    }

    public async Task<OcrScanResultDto> ScanAsync(IFormFile file)
    {
        var fileId = Guid.NewGuid();
        var path = $"{fileId}-{file.FileName}";

        // Read bytes once so we can both upload the raw file and run OCR on it.
        byte[] bytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            bytes = ms.ToArray();
        }

        var documentPath = await UploadToSupabaseStorageAsync(file, "invoices-raw", path)
                           ?? $"invoices-raw/{path}";

        OcrFieldDto[] fields;
        string? previewPath = null;
        try
        {
            // Tesseract (PDF or image) -> raw text -> LLM field extraction (vision-first, text fallback).
            var ocr = _documentOcr.Run(bytes, file.ContentType, file.FileName);
            var llm = await _llm.ExtractAsync(ocr.Text, ocr.PageImagePng);

            fields = llm != null
                ? new[]
                {
                    MakeField("invoiceNumber", llm.InvoiceNumber, ocr.Words),
                    MakeField("invoiceDate", llm.InvoiceDate, ocr.Words),
                    MakeField("amount", llm.Amount, ocr.Words),
                    MakeField("poNumber", llm.PoNumber, ocr.Words),
                    MakeField("vendorName", llm.VendorName, ocr.Words),
                }
                // LLM unavailable (no key / API down): return empty low-confidence fields so
                // the reviewer fills them in manually rather than trusting fabricated values.
                : EmptyFields();

            // Cache the already-rasterized page-1 PNG as a lightweight preview so the review UI
            // doesn't have to download/render the full original PDF. The original stays at
            // documentPath (used as Invoice.DocumentPath on confirm, and by the Intake PDF merge).
            var previewFileName = $"{fileId}-preview.png";
            previewPath = await UploadBytesToSupabaseStorageAsync(ocr.PageImagePng, "invoices-raw", previewFileName, "image/png");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"OCR scan failed for {file.FileName}: {ex.Message}");
            fields = EmptyFields();
        }

        return new OcrScanResultDto(documentPath, previewPath ?? documentPath, fields);
    }

    // Recovers a bbox for the field by matching its extracted value back to a Tesseract word
    // box, mirroring the bbox-recovery used by the batch pipeline (OcrWordMatch).
    private static OcrFieldDto MakeField(string name, ExtractedField field, IReadOnlyList<OcrWord> words)
    {
        if (string.IsNullOrEmpty(field.Value))
            return new OcrFieldDto(name, null, field.Confidence);

        var wb = OcrWordMatch.FindWord(field.Value, words);
        return wb == null
            ? new OcrFieldDto(name, field.Value, field.Confidence)
            : new OcrFieldDto(name, field.Value, field.Confidence, wb.X, wb.Y, wb.W, wb.H);
    }

    private static OcrFieldDto[] EmptyFields() => new[]
    {
        new OcrFieldDto("invoiceNumber", null, 0m),
        new OcrFieldDto("invoiceDate", null, 0m),
        new OcrFieldDto("amount", null, 0m),
        new OcrFieldDto("poNumber", null, 0m),
        new OcrFieldDto("vendorName", null, 0m),
    };

    public async Task<(string? InvoiceId, Guid? NotificationSheetId)> ConfirmAndCreateInvoiceAsync(OcrConfirmDto dto, Guid reviewedBy)
    {
        Guid debtorId;
        if (dto.DebtorId.HasValue)
        {
            debtorId = dto.DebtorId.Value;
        }
        else if (!string.IsNullOrEmpty(dto.NewDebtorName))
        {
            var debtor = new Debtor
            {
                Id = Guid.NewGuid(),
                Name = dto.NewDebtorName,
                Group = "Review",
                Email = null,
                Phone = null
            };
            _context.Debtors.Add(debtor);
            debtorId = debtor.Id;
        }
        else
        {
            return (null, null); // Must have debtor
        }

        var invoice = new Invoice
        {
            InvoiceId = $"OCR-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
            LiquidClient = dto.ClientShortcode,
            DebtorId = debtorId,
            OriginalInvoice = dto.InvoiceNumber,
            Date = dto.InvoiceDate,
            Amount = dto.Amount,
            Status = "Pending",
            DocumentPath = dto.RawDocumentPath,
            Source = "OCR",
            CreatedTime = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Invoices.Add(invoice);
        await _context.SaveChangesAsync();

        Guid? nsItemId = null;
        if (dto.AddToNsQueue)
        {
            var activeSheet = await _context.NotificationSheets
                .FirstOrDefaultAsync(n => n.ClientShortcode == dto.ClientShortcode && n.Status == "Draft");

            var sheet = activeSheet;
            if (sheet == null)
            {
                sheet = new NotificationSheet
                {
                    Id = Guid.NewGuid(),
                    ClientShortcode = dto.ClientShortcode,
                    Status = "Draft",
                    CreatedAt = DateTimeOffset.UtcNow,
                    IsShared = false
                };
                _context.NotificationSheets.Add(sheet);
            }

            var item = new NotificationSheetItem
            {
                Id = Guid.NewGuid(),
                NotificationSheetId = sheet.Id,
                InvoiceId = invoice.InvoiceId,
                IncludedAmount = dto.Amount
            };
            _context.NotificationSheetItems.Add(item);
            await _context.SaveChangesAsync();
            nsItemId = sheet.Id;
        }

        return (invoice.InvoiceId, nsItemId);
    }

    public async Task<IEnumerable<OcrResultDto>> GetResultsAsync(string invoiceId)
    {
        return await _context.InvoiceOcrResults
            .Where(r => r.InvoiceId == invoiceId)
            .Select(r => new OcrResultDto(
                r.Id, r.InvoiceId, r.FieldName, r.ExtractedValue, r.Confidence,
                r.PageNumber, r.BboxX, r.BboxY, r.BboxWidth, r.BboxHeight,
                r.ConfirmedValue, r.Reviewed, r.ReviewedAt
            ))
            .ToListAsync();
    }

    public async Task<bool> ConfirmValueAsync(Guid resultId, string confirmedValue, Guid reviewedBy)
    {
        var result = await _context.InvoiceOcrResults.FindAsync(resultId);
        if (result is null) return false;

        result.ConfirmedValue = confirmedValue;
        result.Reviewed = true;
        result.ReviewedBy = reviewedBy;
        result.ReviewedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }
}
