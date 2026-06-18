namespace Smithers.API.Services;

/// <summary>One extracted field: the value (null if absent) and the model's 0–1 confidence.</summary>
public record ExtractedField(string? Value, decimal Confidence);

/// <summary>Structured invoice fields extracted from raw OCR text by the LLM.</summary>
public record ExtractedInvoice(
    ExtractedField InvoiceNumber,
    ExtractedField InvoiceDate,
    ExtractedField Amount,
    ExtractedField PoNumber,
    ExtractedField VendorName,
    ExtractedField BillToName);

/// <summary>
/// Maps raw OCR text (and, when available, the rendered page image) to structured invoice
/// fields via an LLM. Replaces the layout-specific regex parser so extraction generalizes
/// across invoice formats. Returns null when the model is unavailable/misconfigured or the
/// call fails so callers can fall back gracefully (e.g. to a text-only provider, then regex).
/// </summary>
public interface ILlmFieldExtractor
{
    Task<ExtractedInvoice?> ExtractAsync(string rawOcrText, byte[]? pageImagePng = null, CancellationToken ct = default);
}
