using System.Text;
using System.Text.Json;

namespace Smithers.API.Services;

/// <summary>
/// OpenAI text-only field extraction. Sends raw OCR text to gpt-4o-mini and asks for a
/// strict JSON object of invoice fields with per-field confidence. Defensive about non-JSON
/// or wrapped responses; on any failure returns null so the caller can fall back. Text-only —
/// the optional page image is ignored here (see <see cref="OpenAiVisionFieldExtractor"/> for
/// the multimodal path).
/// </summary>
public class LlmFieldExtractor : ILlmFieldExtractor
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<LlmFieldExtractor> _logger;

    public LlmFieldExtractor(HttpClient http, IConfiguration config, ILogger<LlmFieldExtractor> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<ExtractedInvoice?> ExtractAsync(string rawOcrText, byte[]? pageImagePng = null, CancellationToken ct = default)
    {
        var apiKey = _config["OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("OpenAI:ApiKey not configured; skipping LLM extraction.");
            return null;
        }

        var text = rawOcrText.Length > 12000 ? rawOcrText[..12000] : rawOcrText;

        var payload = new
        {
            model = "gpt-4o-mini",
            temperature = 0,
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new { role = "system", content = InvoiceExtractionShared.SystemPrompt },
                new { role = "user", content = $"OCR TEXT:\n\n{text}" }
            }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        req.Headers.Add("Authorization", $"Bearer {apiKey}");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            using var res = await _http.SendAsync(req, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenAI returned {Status}: {Body}", res.StatusCode, InvoiceExtractionShared.Truncate(body));
                return null;
            }

            using var doc = JsonDocument.Parse(body);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content)) return null;

            var extracted = InvoiceExtractionShared.ParseExtraction(content);
            if (extracted == null)
                _logger.LogWarning("LLM response was not JSON: {Content}", InvoiceExtractionShared.Truncate(content));

            return extracted;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LLM extraction failed.");
            return null;
        }
    }
}
