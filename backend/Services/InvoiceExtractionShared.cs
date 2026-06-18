using System.Text.Json;
using System.Text.Json.Serialization;

namespace Smithers.API.Services;

/// <summary>
/// Shared prompt + response parsing for invoice field extraction, used by both the
/// text-only OpenRouter extractor (<see cref="LlmFieldExtractor"/>) and the OpenAI vision
/// extractor (<see cref="OpenAiVisionFieldExtractor"/>) so the schema/rules and defensive
/// JSON handling stay identical across providers.
/// </summary>
public static class InvoiceExtractionShared
{
    public const string SystemPrompt = """
        You are an invoice data extraction engine. You are given the raw OCR text of a single
        invoice page (and, when available, an image of the page). Extract the fields below and
        return ONLY strict JSON — no markdown, no code fences, no commentary.

        Schema:
        {
          "invoiceNumber": { "value": string|null, "confidence": number },
          "invoiceDate":   { "value": string|null, "confidence": number },
          "amount":        { "value": string|null, "confidence": number },
          "poNumber":      { "value": string|null, "confidence": number },
          "vendorName":    { "value": string|null, "confidence": number },
          "billToName":    { "value": string|null, "confidence": number }
        }

        Rules:
        - invoiceDate must be ISO format yyyy-MM-dd. If the date is ambiguous, do your best and
          lower the confidence.
        - amount is the invoice total / amount due as a plain decimal string with no currency
          symbol and no thousands separators (e.g. "8181.00").
        - vendorName is the company that ISSUED the invoice (top of the document).
        - billToName is the party being billed (the "Bill To" / "Sold To" party).
        - confidence is your 0.0–1.0 certainty for that field. Use below 0.8 when the OCR text
          is garbled, ambiguous, or the field is missing.
        - If the image and the OCR text disagree, trust the image — OCR text can be garbled.
        - If a field is absent, set value to null and confidence to 0.
        """;

    public static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    /// <summary>Model may wrap JSON in prose or ``` fences; grab the outermost {...}.</summary>
    public static string? ExtractJsonObject(string s)
    {
        var start = s.IndexOf('{');
        var end = s.LastIndexOf('}');
        return (start < 0 || end <= start) ? null : s.Substring(start, end - start + 1);
    }

    public static string Truncate(string s, int max = 500) => s.Length > max ? s[..max] : s;

    public static ExtractedInvoice? ParseExtraction(string content)
    {
        var json = ExtractJsonObject(content);
        if (json == null) return null;

        var parsed = JsonSerializer.Deserialize<RawExtraction>(json, JsonOpts);
        if (parsed == null) return null;

        return new ExtractedInvoice(
            parsed.InvoiceNumber.ToField(),
            parsed.InvoiceDate.ToField(),
            parsed.Amount.ToField(),
            parsed.PoNumber.ToField(),
            parsed.VendorName.ToField(),
            parsed.BillToName.ToField());
    }

    public record RawField(string? Value, decimal Confidence)
    {
        public ExtractedField ToField() =>
            new(string.IsNullOrWhiteSpace(Value) ? null : Value.Trim(), Confidence);
    }

    public class RawExtraction
    {
        public RawField InvoiceNumber { get; set; } = new(null, 0);
        public RawField InvoiceDate { get; set; } = new(null, 0);
        public RawField Amount { get; set; } = new(null, 0);
        public RawField PoNumber { get; set; } = new(null, 0);
        public RawField VendorName { get; set; } = new(null, 0);
        public RawField BillToName { get; set; } = new(null, 0);
    }
}
