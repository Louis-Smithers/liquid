namespace Smithers.API.Services;

/// <summary>A single OCR'd word with its normalized (0–1) bounding box and Tesseract confidence (0–100).</summary>
public record OcrWord(string Text, decimal X, decimal Y, decimal W, decimal H, float Conf);

/// <summary>
/// Full-page OCR result: linearized text, per-word boxes, and the normalized page image
/// (PNG bytes, same image the bboxes are relative to) for a downstream vision model.
/// </summary>
public record OcrOutput(string Text, IReadOnlyList<OcrWord> Words, byte[] PageImagePng);

/// <summary>
/// Raw OCR over a document, independent of how fields are later extracted. Handles both
/// PDFs (page 1 rendered via PDFium) and image uploads (JPEG/PNG) so callers don't have to
/// care about the source format. Field extraction (regex or LLM) is a separate concern.
/// </summary>
public interface IDocumentOcr
{
    /// <param name="bytes">Raw file bytes.</param>
    /// <param name="contentType">MIME type if known (e.g. "application/pdf", "image/jpeg").</param>
    /// <param name="fileName">Original file name, used as a fallback type hint.</param>
    OcrOutput Run(byte[] bytes, string? contentType = null, string? fileName = null);
}
