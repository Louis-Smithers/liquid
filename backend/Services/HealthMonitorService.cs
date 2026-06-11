using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Smithers.API.Services;

/// <summary>
/// Polls the registered health checks on an interval and fires an alert only when a component's
/// status *changes* (Healthy→Down, Down→Recovered, etc.) — so a sustained outage produces one
/// "down" message and one "recovered" message, not a stream every cycle. Mirrors the
/// <see cref="StagingCleanupService"/> BackgroundService pattern.
/// </summary>
public class HealthMonitorService : BackgroundService
{
    private readonly HealthCheckService _healthChecks;
    private readonly IServiceProvider _services;
    private readonly ILogger<HealthMonitorService> _logger;
    private readonly TimeSpan _interval;

    // Last seen status per check name. Absent == assume Healthy, so a component that is already
    // down at startup still alerts on the first poll, while a healthy startup stays quiet.
    private readonly Dictionary<string, HealthStatus> _lastStatus = new();

    public HealthMonitorService(
        HealthCheckService healthChecks,
        IServiceProvider services,
        IConfiguration config,
        ILogger<HealthMonitorService> logger)
    {
        _healthChecks = healthChecks;
        _services = services;
        _logger = logger;
        var seconds = config.GetValue<int?>("HealthMonitor:IntervalSeconds") ?? 60;
        _interval = TimeSpan.FromSeconds(Math.Max(10, seconds));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HealthMonitor poll failed.");
            }
            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task PollAsync(CancellationToken ct)
    {
        var report = await _healthChecks.CheckHealthAsync(ct);

        var alerts = new List<HealthAlert>();
        foreach (var (name, entry) in report.Entries)
        {
            var previous = _lastStatus.GetValueOrDefault(name, HealthStatus.Healthy);
            if (entry.Status == previous) continue;

            var level = entry.Status switch
            {
                HealthStatus.Healthy => AlertLevel.Recovered,
                HealthStatus.Degraded => AlertLevel.Degraded,
                _ => AlertLevel.Down
            };
            var detail = entry.Description
                         ?? entry.Exception?.Message
                         ?? entry.Status.ToString();

            alerts.Add(new HealthAlert(name, level, detail));
            _lastStatus[name] = entry.Status;
        }

        if (alerts.Count == 0) return;

        foreach (var a in alerts)
            _logger.LogInformation("Health transition: {Component} -> {Level} ({Detail})", a.Component, a.Level, a.Detail);

        // Notifier is a typed HttpClient (transient); resolve per-poll from a scope rather than
        // capturing it in this singleton.
        using var scope = _services.CreateScope();
        var notifier = scope.ServiceProvider.GetRequiredService<IAlertNotifier>();
        await notifier.SendAsync(alerts, ct);
    }
}
