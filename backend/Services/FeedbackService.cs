using System.Net.Http.Json;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

/// <summary>
/// Posts user feedback / bug reports to a Discord channel via an incoming webhook (one HTTP POST,
/// no bot/gateway). Mirrors <see cref="DiscordNotifier"/> but on its own webhook so feedback and
/// health alerts land in separate channels. No-ops silently when no webhook is configured so the
/// submit still "succeeds" from the user's perspective during dev/test.
/// </summary>
public class FeedbackService : IFeedbackService
{
    private readonly HttpClient _http;
    private readonly string _webhookUrl;
    private readonly ILogger<FeedbackService> _logger;

    public FeedbackService(HttpClient http, IConfiguration config, ILogger<FeedbackService> logger)
    {
        _http = http;
        // Falls back to the shared health webhook if a dedicated feedback one isn't set yet.
        _webhookUrl = config["Discord:FeedbackWebhookUrl"]
                      ?? config["Discord:WebhookUrl"]
                      ?? "";
        _logger = logger;
    }

    public async Task SendAsync(SubmitFeedbackDto feedback, string? userEmail, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_webhookUrl)) return;

        var category = string.IsNullOrWhiteSpace(feedback.Category) ? "Feedback" : feedback.Category!.Trim();

        var fields = new List<object>
        {
            new { name = "From", value = string.IsNullOrWhiteSpace(userEmail) ? "Unknown" : userEmail, inline = true },
            new { name = "Category", value = category, inline = true },
        };
        if (!string.IsNullOrWhiteSpace(feedback.PageUrl))
            fields.Add(new { name = "Page", value = feedback.PageUrl, inline = false });

        var embed = new
        {
            title = $"{Emoji(category)} {category}",
            description = Truncate(feedback.Message, 4000),
            color = Color(category),
            fields,
            timestamp = DateTimeOffset.UtcNow.ToString("o")
        };

        var payload = new { username = "Smithers Feedback", embeds = new[] { embed } };

        try
        {
            var resp = await _http.PostAsJsonAsync(_webhookUrl, payload, ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Feedback Discord webhook returned {Status}", resp.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to post feedback to Discord.");
        }
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];

    private static int Color(string category) => category.ToLowerInvariant() switch
    {
        "bug" => 0xE74C3C,      // red
        "feature" => 0x9B59B6,  // purple
        _ => 0x3498DB           // blue
    };

    private static string Emoji(string category) => category.ToLowerInvariant() switch
    {
        "bug" => "🐞",
        "feature" => "✨",
        _ => "💬"
    };
}
