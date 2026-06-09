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
    private readonly string _supabaseUrl;
    private readonly string _serviceRoleKey;

    public OcrService(AppDbContext context, IConfiguration config, HttpClient httpClient)
    {
        _context = context;
        _httpClient = httpClient;
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
        var documentPath = await UploadToSupabaseStorageAsync(file, "invoices-raw", path);
        if (documentPath == null) documentPath = $"invoices-raw/{path}";

        // --- ADOBE PDF EXTRACT SDK SCAFFOLDING ---
        // To fully implement this, you would use Adobe.DocumentServices.PDFTools.
        // var credentials = Credentials.ServiceAccountCredentialsBuilder()
        //     .WithClientId("YOUR_CLIENT_ID")
        //     .WithClientSecret("YOUR_CLIENT_SECRET")
        //     .WithPrivateKey("PRIVATE_KEY")
        //     .WithOrganizationId("ORG_ID")
        //     .WithAccountId("ACCOUNT_ID")
        //     .Build();
        // var executionContext = ExecutionContext.Create(credentials);
        // var extractPdfOperation = ExtractPDFOperation.CreateNew();
        // ... set inputs and execute ...
        // Parse the resulting structural JSON to map to OcrFieldDto.

        // Scaffold custom parsing logic (Mocked for now)
        var fields = new[]
        {
            new OcrFieldDto("invoiceNumber", $"INV-{fileId.ToString().Substring(0, 6)}", 0.90m),
            new OcrFieldDto("invoiceDate", DateTime.UtcNow.ToString("yyyy-MM-dd"), 0.95m),
            new OcrFieldDto("amount", "0.00", 0.50m), // Low confidence to trigger UI
            new OcrFieldDto("clientShortcode", "TEST", 0.85m),
            new OcrFieldDto("vendorName", "Vendor", 0.80m)
        };

        return new OcrScanResultDto(documentPath, fields);
    }

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
