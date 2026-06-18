using PDFtoImage;
using SkiaSharp;
using Tesseract;

namespace Smithers.API.Services;

/// <summary>
/// Tesseract-backed OCR (eng+fra). PDFs are rendered to a 300-DPI image via PDFium first;
/// image uploads are normalized to PNG via SkiaSharp. This is the shared OCR layer used by
/// both the single-file scan path (OcrService) and the batch pipeline (OcrPipelineService),
/// and is also where a future vision model would slot in alongside the text output.
/// </summary>
public class DocumentOcrService : IDocumentOcr
{
    private readonly IConfiguration _config;

    public DocumentOcrService(IConfiguration config) => _config = config;

    public OcrOutput Run(byte[] bytes, string? contentType = null, string? fileName = null)
    {
        var png = ToPng(bytes, contentType, fileName);

        var tessdata = _config["Tesseract:DataPath"]
                       ?? Path.Combine(AppContext.BaseDirectory, "tessdata");

        using var engine = new TesseractEngine(tessdata, "eng+fra", EngineMode.Default);
        using var pix = Pix.LoadFromMemory(png);
        using var page = engine.Process(pix);

        var text = page.GetText() ?? "";
        var words = new List<OcrWord>();

        using var iter = page.GetIterator();
        iter.Begin();
        do
        {
            if (!iter.TryGetBoundingBox(PageIteratorLevel.Word, out var r)) continue;
            var w = iter.GetText(PageIteratorLevel.Word);
            if (string.IsNullOrWhiteSpace(w)) continue;

            words.Add(new OcrWord(
                w.Trim(),
                Math.Round((decimal)r.X1 / pix.Width, 6),
                Math.Round((decimal)r.Y1 / pix.Height, 6),
                Math.Round((decimal)r.Width / pix.Width, 6),
                Math.Round((decimal)r.Height / pix.Height, 6),
                iter.GetConfidence(PageIteratorLevel.Word)));
        } while (iter.Next(PageIteratorLevel.Word));

        return new OcrOutput(text, words, png);
    }

    /// <summary>Render/normalize any supported input to PNG bytes that Tesseract can read.</summary>
    private static byte[] ToPng(byte[] bytes, string? contentType, string? fileName)
    {
        if (IsPdf(bytes, contentType, fileName))
        {
            using var bitmap = Conversion.ToImage(bytes, page: 0, options: new RenderOptions(Dpi: 300));
            using var encoded = bitmap.Encode(SKEncodedImageFormat.Png, 100);
            return encoded.ToArray();
        }

        // Image upload (JPEG/PNG/etc): decode and re-encode to PNG so Leptonica gets a
        // consistent format regardless of the source codec.
        using var img = SKBitmap.Decode(bytes)
            ?? throw new InvalidOperationException("Unsupported or corrupt image file.");
        using var pngEncoded = img.Encode(SKEncodedImageFormat.Png, 100);
        return pngEncoded.ToArray();
    }

    private static bool IsPdf(byte[] bytes, string? contentType, string? fileName)
    {
        if (contentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) == true) return true;
        if (fileName?.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) == true) return true;
        // "%PDF" magic bytes.
        return bytes.Length >= 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46;
    }
}
