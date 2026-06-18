namespace Smithers.API.Services;

/// <summary>
/// Shared bbox-recovery logic: finds the Tesseract word box whose alphanumeric content
/// contains a given extracted value, so punctuation/grouping differences (e.g. "8181.00"
/// vs OCR'd "8,181.00") don't block a match. Used by both the legacy scan path
/// (<see cref="OcrService"/>) and the batch pipeline (<see cref="OcrPipelineService"/>).
/// </summary>
public static class OcrWordMatch
{
    public static OcrWord? FindWord(string value, IReadOnlyList<OcrWord> words)
    {
        var needle = AlphaNum(value);
        return needle.Length == 0
            ? null
            : words.FirstOrDefault(w => AlphaNum(w.Text).Contains(needle));
    }

    private static string AlphaNum(string s) => new(s.Where(char.IsLetterOrDigit).ToArray());
}
