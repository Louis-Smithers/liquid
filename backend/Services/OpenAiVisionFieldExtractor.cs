using System.Text;
using System.Text.Json;

namespace Smithers.API.Services;

/// <summary>
/// OpenAI vision-backed field extraction. Sends the rendered page image alongside the raw
/// OCR text to a multimodal chat model (gpt-4o by default) — the image lets the model
/// recover fields that garbled OCR text alone would miss. Defensive about non-JSON/wrapped
/// responses; returns null on any failure (missing key, request error, unparseable response)
/// so the caller can fall back to a text-only provider.
/// </summary>
public class OpenAiVisionFieldExtractor : ILlmFieldExtractor
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<OpenAiVisionFieldExtractor> _logger;

    public OpenAiVisionFieldExtractor(HttpClient http, IConfiguration config, ILogger<OpenAiVisionFieldExtractor> logger)
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
            _logger.LogInformation("OpenAI:ApiKey not configured; skipping vision extraction.");
            return null;
        }
        if (pageImagePng == null || pageImagePng.Length == 0)
        {
            _logger.LogInformation("No page image available; skipping vision extraction.");
            return null;
        }

        var model = _config["OpenAI:Model"] ?? "gpt-4o";
        var text = rawOcrText.Length > 12000 ? rawOcrText[..12000] : rawOcrText;
        var imageDataUrl = $"data:image/png;base64,{Convert.ToBase64String(pageImagePng)}";

        var payload = new
        {
            model,
            temperature = 0,
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new { role = "system", content = InvoiceExtractionShared.SystemPrompt },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new { type = "text", text = $"OCR TEXT:\n\n{text}" },
                        new { type = "image_url", image_url = new { url = imageDataUrl } }
                    }
                }
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
                _logger.LogWarning("Vision LLM response was not JSON: {Content}", InvoiceExtractionShared.Truncate(content));

            return extracted;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Vision extraction failed.");
            return null;
        }
    }
}
