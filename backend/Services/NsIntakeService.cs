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

    public NsIntakeService(AppDbContext db, ISupabaseStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<SubmitNsResultDto> GenerateAndStoreAsync(Guid sheetId)
    {
        var sheet = await _db.NotificationSheets
            .Include(s => s.Items)
            .ThenInclude(i => i.Invoice)
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

        var pdfBytes = BuildPdf(images);
        
        var uploadPath = await _storage.UploadBytesAsync(pdfBytes, "application/pdf", "ns-intake", $"{sheetId}.pdf");
        
        if (uploadPath != null)
        {
            sheet.IntakeDocumentPath = uploadPath;
            sheet.IntakeGeneratedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            
            return new SubmitNsResultDto 
            { 
                IntakeGenerated = true, 
                MergedInvoiceCount = mergedCount, 
                MissingDocumentInvoiceNumbers = missing 
            };
        }
        
        return new SubmitNsResultDto 
        { 
            IntakeGenerated = false, 
            MergedInvoiceCount = mergedCount, 
            MissingDocumentInvoiceNumbers = missing,
            Message = "storage not configured; intake available via on-the-fly download"
        };
    }

    public async Task<byte[]?> GetOrGenerateAsync(Guid sheetId)
    {
        var sheet = await _db.NotificationSheets.FindAsync(sheetId);
        if (sheet != null && !string.IsNullOrEmpty(sheet.IntakeDocumentPath))
        {
            var bytes = await _storage.DownloadAsync(sheet.IntakeDocumentPath);
            if (bytes != null) return bytes;
        }
        
        // If not found or not stored, regenerate on the fly
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
