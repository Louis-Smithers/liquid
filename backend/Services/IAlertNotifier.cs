namespace Smithers.API.Services;

/// <summary>Severity of a health-state transition, drives colour/emoji in the notification.</summary>
public enum AlertLevel { Down, Degraded, Recovered }

/// <summary>A single component's health-state change, ready to be rendered to a channel.</summary>
public record HealthAlert(string Component, AlertLevel Level, string Detail);

/// <summary>
/// Transport-agnostic sink for health alerts. <see cref="DiscordNotifier"/> is the default
/// implementation (webhook); a Slack or bot sender can be swapped in without touching the monitor.
/// </summary>
public interface IAlertNotifier
{
    Task SendAsync(IReadOnlyList<HealthAlert> alerts, CancellationToken ct = default);
}
