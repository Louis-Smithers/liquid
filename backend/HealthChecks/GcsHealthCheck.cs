using Microsoft.Extensions.Diagnostics.HealthChecks;
using Smithers.API.Services;

namespace Smithers.API.HealthChecks;

/// <summary>
/// Confirms the configured GCS bucket is reachable with the service-account credential.
/// Reports Healthy (skipped) when GCS isn't configured so non-GCS deployments don't alert.
/// </summary>
public class GcsHealthCheck : IHealthCheck
{
    private readonly IGcsService _gcs;

    public GcsHealthCheck(IGcsService gcs) => _gcs = gcs;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (!_gcs.Configured)
            return HealthCheckResult.Healthy("GCS not configured; check skipped.");

        return await _gcs.CheckAccessAsync(cancellationToken)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("GCS bucket unreachable or access denied.");
    }
}
