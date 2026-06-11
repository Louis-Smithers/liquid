using Microsoft.EntityFrameworkCore;
using PDFtoImage;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SkiaSharp;
using Smithers.API.Data;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

public class NsIntakeService : INsIntakeService
{
    private readonly AppDbContext _db;
    private readonly ISupabaseStorage _storage;
    private readonly IGcsService _gcs;
    private readonly INsPdfService _pdfService;

    public NsIntakeService(AppDbContext db, ISupabaseStorage storage, IGcsService gcs, INsPdfService pdfService)
    {
        _db = db;
        _storage = storage;
        _gcs = gcs;
        _pdfService = pdfService;
    }

    private static (string ns, string intake) BuildObjectPaths(string shortcode, DateTimeOffset createdAt, string shortId)
    {
        var datePart = createdAt.ToLocalTime().ToString("MM-dd-yy");
        var folder = $"{shortcode}/{shortcode} {datePart}";
        return ($"{folder}/NS-{shortId}.pdf", $"{folder}/Invoice intake-{shortId}.pdf");
    }

    public async Task<SubmitNsResultDto> GenerateAndStoreAsync(Guid sheetId)
    {
        var sheet = await _db.NotificationSheets
            .Include(s => s.Items)
            .ThenInclude(i => i.Invoice)
            .ThenInclude(i => i.Debtor)
            .FirstOrDefaultAsync(s => s.Id == sheetId);

        if (sheet == null)
        {
            return new SubmitNsResultDto { Message = "Sheet not found" };
        }

        var missing = new List<string>();
        var images = new List<(string caption, byte[] png)>();

        var orderedItems = sheet.Items
            .OrderBy(i => i.Invoice.DebtorName)
            .ThenBy(i => i.Invoice.OriginalInvoice)
            .ToList();

        int mergedCount = 0;

        foreach (var item in orderedItems)
        {
            if (string.IsNullOrEmpty(item.Invoice.DocumentPath))
            {
                missing.Add(item.Invoice.OriginalInvoice);
                continue;
            }

            var bytes = await _storage.DownloadAsync(item.Invoice.DocumentPath);
            if (bytes == null || bytes.Length == 0)
            {
                missing.Add(item.Invoice.OriginalInvoice);
                continue;
            }

            mergedCount++;
            var caption = $"{item.Invoice.DebtorName} — Invoice {item.Invoice.OriginalInvoice}";

            // Detect PDF
            if (bytes.Length > 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46)
            {
                // Is PDF
                var skImages = Conversion.ToImages(bytes, options: new(Dpi: 150));
                foreach (var skImage in skImages)
                {
                    var pngBytes = skImage.Encode(SKEncodedImageFormat.Png, 90).ToArray();
                    images.Add((caption, pngBytes));
                }
            }
            else
            {
                // Is Image
                images.Add((caption, bytes));
            }
        }

        var intakePdfBytes = BuildPdf(images);
        
        var sheetDto = NotificationSheetService.MapToDto(sheet);
        var nsPdfBytes = _pdfService.GenerateScheduleOfAccounts(sheetDto);
        
        var shortId = sheetId.ToString()[..8];
        var (nsPath, intakePath) = BuildObjectPaths(sheet.ClientShortcode, sheet.CreatedAt, shortId);

        var gcsNsObjectPath = await _gcs.UploadAsync(nsPdfBytes, "application/pdf", nsPath);
        var gcsIntakeObjectPath = await _gcs.UploadAsync(intakePdfBytes, "application/pdf", intakePath);
        
        if (gcsNsObjectPath != null || gcsIntakeObjectPath != null)
        {
            sheet.GcsNsObjectPath = gcsNsObjectPath;
            sheet.GcsIntakeObjectPath = gcsIntakeObjectPath;
            await _db.SaveChangesAsync();
        }
        
        return new SubmitNsResultDto 
        { 
            IntakeGenerated = true, 
            MergedInvoiceCount = mergedCount, 
            MissingDocumentInvoiceNumbers = missing,
            GcsNsObjectPath = gcsNsObjectPath,
            GcsIntakeObjectPath = gcsIntakeObjectPath,
            GcsUploadMessage = _gcs.Configured ? null : "GCS not configured"
        };
    }

    public async Task<byte[]?> GetOrGenerateAsync(Guid sheetId)
    {
        var sheetFull = await _db.NotificationSheets
            .Include(s => s.Items)
            .ThenInclude(i => i.Invoice)
            .FirstOrDefaultAsync(s => s.Id == sheetId);

        if (sheetFull == null) return null;
        
        var images = new List<(string caption, byte[] png)>();
        var orderedItems = sheetFull.Items
            .OrderBy(i => i.Invoice.DebtorName)
            .ThenBy(i => i.Invoice.OriginalInvoice)
            .ToList();

        foreach (var item in orderedItems)
        {
            if (string.IsNullOrEmpty(item.Invoice.DocumentPath)) continue;
            
            var bytes = await _storage.DownloadAsync(item.Invoice.DocumentPath);
            if (bytes == null || bytes.Length == 0) continue;

            var caption = $"{item.Invoice.DebtorName} — Invoice {item.Invoice.OriginalInvoice}";

            if (bytes.Length > 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46)
            {
                var skImages = Conversion.ToImages(bytes, options: new(Dpi: 150));
                foreach (var skImage in skImages)
                {
                    var pngBytes = skImage.Encode(SKEncodedImageFormat.Png, 90).ToArray();
                    images.Add((caption, pngBytes));
                }
            }
            else
            {
                images.Add((caption, bytes));
            }
        }
        
        return BuildPdf(images);
    }

    private byte[] BuildPdf(List<(string caption, byte[] png)> images)
    {
        var document = Document.Create(container =>
        {
            if (images.Count == 0)
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.Letter);
                    page.Margin(1, Unit.Centimetre);
                    page.Content().AlignCenter().AlignMiddle().Text("No documents available").FontSize(20);
                });
                return;
            }

            foreach (var img in images)
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.Letter);
                    page.Margin(1, Unit.Centimetre);
                    
                    page.Header()
                        .PaddingBottom(10)
                        .Text(img.caption)
                        .FontSize(10)
                        .FontColor(Colors.Grey.Medium);
                        
                    page.Content().Image(img.png).FitArea();
                });
            }
        });

        return document.GeneratePdf();
    }
}
