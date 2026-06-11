using System.Net.Http.Json;

namespace Smithers.API.Services;

/// <summary>
/// Posts health alerts to a Discord channel via an incoming webhook (one HTTP POST, no bot /
/// gateway connection to keep alive). Each alert becomes an embed; Discord allows up to 10 per
/// message. No-ops silently when no webhook URL is configured so dev/test runs stay quiet.
/// </summary>
public class DiscordNotifier : IAlertNotifier
{
    private readonly HttpClient _http;
    private readonly string _webhookUrl;
    private readonly ILogger<DiscordNotifier> _logger;

    public DiscordNotifier(HttpClient http, IConfiguration config, ILogger<DiscordNotifier> logger)
    {
        _http = http;
        _webhookUrl = config["Discord:WebhookUrl"] ?? "";
        _logger = logger;
    }

    public async Task SendAsync(IReadOnlyList<HealthAlert> alerts, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_webhookUrl) || alerts.Count == 0) return;

        var embeds = alerts.Take(10).Select(a => new
        {
            title = $"{Emoji(a.Level)} {a.Component} — {a.Level}",
            description = a.Detail,
            color = Color(a.Level),
            timestamp = DateTimeOffset.UtcNow.ToString("o")
        }).ToArray();

        var payload = new { username = "Smithers Health", embeds };

        try
        {
            var resp = await _http.PostAsJsonAsync(_webhookUrl, payload, ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Discord webhook returned {Status}", resp.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to post Discord health alert.");
        }
    }

    private static int Color(AlertLevel level) => level switch
    {
        AlertLevel.Recovered => 0x2ECC71, // green
        AlertLevel.Degraded => 0xF1C40F,  // amber
        _ => 0xE74C3C                       // red
    };

    private static string Emoji(AlertLevel level) => level switch
    {
        AlertLevel.Recovered => "✅",
        AlertLevel.Degraded => "⚠️",
        _ => "🔴"
    };
}
