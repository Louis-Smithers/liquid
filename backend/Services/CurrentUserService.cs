using System.Security.Claims;
using System.Text.Json;

namespace Smithers.API.Services;

public interface ICurrentUserService
{
    string? UserId { get; }
    string Role { get; }
    bool IsAdmin { get; }
    bool IsClient { get; }
    string? ClientShortcode { get; }
}

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public string? UserId =>
        User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? User?.FindFirstValue("sub");

    public string Role
    {
        get
        {
            var appMetadata = ParseAppMetadata();
            if (appMetadata != null &&
                appMetadata.TryGetValue("role", out var roleEl) &&
                ((JsonElement)roleEl).ValueKind == JsonValueKind.String)
            {
                return ((JsonElement)roleEl).GetString() ?? "user";
            }

            return User?.FindFirstValue("role") ?? "user";
        }
    }

    public bool IsAdmin => Role == "admin";
    public bool IsClient => Role == "client";

    public string? ClientShortcode
    {
        get
        {
            var appMetadata = ParseAppMetadata();
            if (appMetadata != null &&
                appMetadata.TryGetValue("client_shortcode", out var scEl) &&
                ((JsonElement)scEl).ValueKind == JsonValueKind.String)
            {
                return ((JsonElement)scEl).GetString();
            }

            return null;
        }
    }

    private Dictionary<string, object>? ParseAppMetadata()
    {
        var claim = User?.FindFirstValue("app_metadata");
        if (string.IsNullOrEmpty(claim)) return null;

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(claim);
        }
        catch
        {
            return null;
        }
    }
}
