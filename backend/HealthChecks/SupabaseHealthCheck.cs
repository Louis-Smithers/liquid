using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Smithers.API.HealthChecks;

/// <summary>
/// Probes Supabase reachability by GETting the public OIDC discovery document — the same endpoint
/// JWT validation relies on, so a failure here also explains auth outages. No auth header needed.
/// </summary>
public class SupabaseHealthCheck : IHealthCheck
{
    private readonly HttpClient _http;
    private readonly string _url;

    public SupabaseHealthCheck(IHttpClientFactory httpFactory, IConfiguration config)
    {
        _http = httpFactory.CreateClient();
        _url = config["Supabase:Url"]?.TrimEnd('/') ?? "";
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_url))
            return HealthCheckResult.Healthy("Supabase URL not configured; check skipped.");

        try
        {
            using var req = new HttpRequestMessage(
                HttpMethod.Get, $"{_url}/auth/v1/.well-known/openid-configuration");
            var resp = await _http.SendAsync(req, cancellationToken);

            return resp.IsSuccessStatusCode
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy($"Supabase returned {(int)resp.StatusCode} {resp.StatusCode}.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Supabase unreachable.", ex);
        }
    }
}
