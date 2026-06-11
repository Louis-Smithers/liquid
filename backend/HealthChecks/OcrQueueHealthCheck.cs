using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Smithers.API.Data;

namespace Smithers.API.HealthChecks;

/// <summary>
/// Watches the document-intake pipeline for backlog/stall signals (OCR itself runs in-process via
/// Tesseract, so there is no external endpoint to ping). Degrades when:
///  - upload batches are stuck in "Staging" well past their expiry (staging cleanup may be stalled), or
///  - the import review queue backlog exceeds a configurable threshold.
/// Thresholds: HealthMonitor:OcrStuckBatchMinutes (default 30), HealthMonitor:OcrQueueBacklogThreshold (default 25).
/// </summary>
public class OcrQueueHealthCheck : IHealthCheck
{
    private readonly AppDbContext _db;
    private readonly int _backlogThreshold;
    private readonly TimeSpan _stuckAfter;

    public OcrQueueHealthCheck(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _backlogThreshold = config.GetValue<int?>("HealthMonitor:OcrQueueBacklogThreshold") ?? 25;
        var minutes = config.GetValue<int?>("HealthMonitor:OcrStuckBatchMinutes") ?? 30;
        _stuckAfter = TimeSpan.FromMinutes(minutes);
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var cutoff = DateTimeOffset.UtcNow - _stuckAfter;

            var pendingBacklog = await _db.ImportReviewQueue
                .CountAsync(q => q.ReviewStatus == "Pending", cancellationToken);

            var stuckBatches = await _db.UploadBatches
                .CountAsync(b => b.Status == "Staging" && b.ExpiresAt < cutoff, cancellationToken);

            var data = new Dictionary<string, object>
            {
                ["pendingReviewQueue"] = pendingBacklog,
                ["stuckStagingBatches"] = stuckBatches
            };

            if (stuckBatches > 0)
                return HealthCheckResult.Degraded(
                    $"{stuckBatches} upload batch(es) stuck in Staging >{_stuckAfter.TotalMinutes:n0}m past expiry — staging cleanup may be stalled.",
                    data: data);

            if (pendingBacklog >= _backlogThreshold)
                return HealthCheckResult.Degraded(
                    $"Import review backlog is high ({pendingBacklog} pending, threshold {_backlogThreshold}).",
                    data: data);

            return HealthCheckResult.Healthy($"{pendingBacklog} pending review item(s).", data);
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("OCR queue check failed (database error).", ex);
        }
    }
}
