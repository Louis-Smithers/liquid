namespace Smithers.API.Services;

/// <summary>
/// Tries OpenAI vision extraction first (best accuracy when an image + key are available),
/// then falls back to the OpenRouter text-only extractor. Callers (OcrService,
/// OcrPipelineService) depend only on <see cref="ILlmFieldExtractor"/> and don't need to know
/// which provider actually answered.
/// </summary>
public class CompositeFieldExtractor : ILlmFieldExtractor
{
    private readonly OpenAiVisionFieldExtractor _vision;
    private readonly LlmFieldExtractor _text;

    public CompositeFieldExtractor(OpenAiVisionFieldExtractor vision, LlmFieldExtractor text)
    {
        _vision = vision;
        _text = text;
    }

    public async Task<ExtractedInvoice?> ExtractAsync(string rawOcrText, byte[]? pageImagePng = null, CancellationToken ct = default)
    {
        var visionResult = await _vision.ExtractAsync(rawOcrText, pageImagePng, ct);
        if (visionResult != null) return visionResult;

        return await _text.ExtractAsync(rawOcrText, pageImagePng, ct);
    }
}
