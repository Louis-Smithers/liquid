using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class AdminService : IAdminService
{
    private readonly AppDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly IClientService _clientService;

    public AdminService(AppDbContext context, IConfiguration config, HttpClient httpClient, IClientService clientService)
    {
        _context = context;
        _httpClient = httpClient;
        _clientService = clientService;
        
        var supabaseUrl = config["Supabase:Url"]?.TrimEnd('/');
        var serviceRoleKey = config["Supabase:ServiceRoleKey"];
        
        if (!string.IsNullOrEmpty(supabaseUrl))
        {
            _httpClient.BaseAddress = new Uri(supabaseUrl);
        }
        
        if (!string.IsNullOrEmpty(serviceRoleKey))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", serviceRoleKey);
            _httpClient.DefaultRequestHeaders.Add("apikey", serviceRoleKey);
        }
    }

    public async Task<UserAccessRequest> SubmitAccessRequestAsync(SubmitRequestDto dto)
    {
        var request = new UserAccessRequest
        {
            Email = dto.Email,
            UsernameWanted = dto.UsernameWanted,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Status = "Pending"
        };

        _context.UserAccessRequests.Add(request);
        await _context.SaveChangesAsync();
        return request;
    }

    public async Task<IEnumerable<UserAccessRequest>> GetAccessRequestsAsync()
    {
        return await _context.UserAccessRequests
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> ApproveRequestAsync(Guid requestId, string tempPassword, string role, string? clientShortcode)
    {
        var request = await _context.UserAccessRequests.FindAsync(requestId);
        if (request == null || request.Status != "Pending") return false;

        if (role == "client" && string.IsNullOrWhiteSpace(clientShortcode))
            return false;

        object appMetadata = BuildAppMetadata(role, clientShortcode);

        var payload = new
        {
            email = request.Email,
            password = tempPassword,
            email_confirm = true,
            app_metadata = appMetadata,
            user_metadata = new { first_name = request.FirstName, last_name = request.LastName, username = request.UsernameWanted }
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync("/auth/v1/admin/users", content);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"Supabase Admin API Error: {error}");
            return false;
        }

        request.Status = "Approved";
        request.ReviewedAt = DateTimeOffset.UtcNow;
        
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DenyRequestAsync(Guid requestId)
    {
        var request = await _context.UserAccessRequests.FindAsync(requestId);
        if (request == null || request.Status != "Pending") return false;

        request.Status = "Denied";
        request.ReviewedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ResetPasswordAsync(string supabaseUserId, string tempPassword)
    {
        var getResponse = await _httpClient.GetAsync($"/auth/v1/admin/users/{supabaseUserId}");
        if (!getResponse.IsSuccessStatusCode) return false;

        var userJson = await getResponse.Content.ReadAsStringAsync();
        var userDoc = JsonDocument.Parse(userJson);
        var appMetadata = new Dictionary<string, object>();
        
        if (userDoc.RootElement.TryGetProperty("app_metadata", out var amElement) && amElement.ValueKind == JsonValueKind.Object)
        {
            appMetadata = JsonSerializer.Deserialize<Dictionary<string, object>>(amElement.GetRawText()) ?? new Dictionary<string, object>();
        }
        appMetadata["must_change_password"] = true;

        var payload = new
        {
            password = tempPassword,
            app_metadata = appMetadata
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PutAsync($"/auth/v1/admin/users/{supabaseUserId}", content);

        return response.IsSuccessStatusCode;
    }

    public async Task<bool> ClearMustChangePasswordAsync(string supabaseUserId)
    {
        var getResponse = await _httpClient.GetAsync($"/auth/v1/admin/users/{supabaseUserId}");
        if (!getResponse.IsSuccessStatusCode) return false;

        var userJson = await getResponse.Content.ReadAsStringAsync();
        var userDoc = JsonDocument.Parse(userJson);
        var appMetadata = new Dictionary<string, object>();

        if (userDoc.RootElement.TryGetProperty("app_metadata", out var amElement) && amElement.ValueKind == JsonValueKind.Object)
        {
            appMetadata = JsonSerializer.Deserialize<Dictionary<string, object>>(amElement.GetRawText()) ?? new Dictionary<string, object>();
        }
        appMetadata["must_change_password"] = false;

        var payload = new { app_metadata = appMetadata };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PutAsync($"/auth/v1/admin/users/{supabaseUserId}", content);

        return response.IsSuccessStatusCode;
    }

    public async Task<IEnumerable<UserSummaryDto>> ListUsersAsync()
    {
        var response = await _httpClient.GetAsync("/auth/v1/admin/users?per_page=1000");
        if (!response.IsSuccessStatusCode) return Enumerable.Empty<UserSummaryDto>();

        var json = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(json);

        var users = new List<UserSummaryDto>();
        var usersEl = doc.RootElement.TryGetProperty("users", out var u) ? u : doc.RootElement;

        foreach (var user in usersEl.EnumerateArray())
        {
            var id = user.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? "" : "";
            var email = user.TryGetProperty("email", out var emailEl) ? emailEl.GetString() ?? "" : "";
            var createdAt = user.TryGetProperty("created_at", out var caEl) ? caEl.GetString() : null;

            string role = "staff";
            string? clientShortcode = null;
            string? firstName = null;
            string? lastName = null;

            if (user.TryGetProperty("app_metadata", out var am) && am.ValueKind == JsonValueKind.Object)
            {
                if (am.TryGetProperty("role", out var roleEl)) role = roleEl.GetString() ?? "staff";
                if (am.TryGetProperty("client_shortcode", out var csEl)) clientShortcode = csEl.GetString();
            }
            if (user.TryGetProperty("user_metadata", out var um) && um.ValueKind == JsonValueKind.Object)
            {
                if (um.TryGetProperty("first_name", out var fnEl)) firstName = fnEl.GetString();
                if (um.TryGetProperty("last_name", out var lnEl)) lastName = lnEl.GetString();
            }

            users.Add(new UserSummaryDto
            {
                Id = id,
                Email = email,
                Role = role,
                ClientShortcode = clientShortcode,
                FirstName = firstName,
                LastName = lastName,
                CreatedAt = createdAt
            });
        }

        return users;
    }

    public async Task<bool> CreateUserAsync(CreateUserDto dto)
    {
        var clientShortcode = dto.ClientShortcode;

        if (dto.Role == "client" && dto.NewClient != null)
        {
            var created = await _clientService.CreateAsync(dto.NewClient);
            clientShortcode = created.Shortcode;
        }

        var payload = new
        {
            email = dto.Email,
            password = dto.TempPassword,
            email_confirm = true,
            app_metadata = BuildAppMetadata(dto.Role, clientShortcode),
            user_metadata = new { first_name = dto.FirstName, last_name = dto.LastName }
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync("/auth/v1/admin/users", content);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"Supabase Admin API Error: {error}");
        }
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> UpdateUserAsync(string supabaseUserId, UpdateUserDto dto)
    {
        var getResponse = await _httpClient.GetAsync($"/auth/v1/admin/users/{supabaseUserId}");
        if (!getResponse.IsSuccessStatusCode) return false;

        var userJson = await getResponse.Content.ReadAsStringAsync();
        var userDoc = JsonDocument.Parse(userJson);
        var appMetadata = new Dictionary<string, object>();

        if (userDoc.RootElement.TryGetProperty("app_metadata", out var amElement) && amElement.ValueKind == JsonValueKind.Object)
            appMetadata = JsonSerializer.Deserialize<Dictionary<string, object>>(amElement.GetRawText()) ?? new Dictionary<string, object>();

        appMetadata["role"] = dto.Role;
        if (dto.Role == "client" && dto.ClientShortcode != null)
            appMetadata["client_shortcode"] = dto.ClientShortcode;
        else
            appMetadata.Remove("client_shortcode");

        var payload = new
        {
            app_metadata = appMetadata,
            user_metadata = new { first_name = dto.FirstName, last_name = dto.LastName }
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PutAsync($"/auth/v1/admin/users/{supabaseUserId}", content);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> DeleteUserAsync(string supabaseUserId)
    {
        var response = await _httpClient.DeleteAsync($"/auth/v1/admin/users/{supabaseUserId}");
        return response.IsSuccessStatusCode;
    }

    private static object BuildAppMetadata(string role, string? clientShortcode)
    {
        if (role == "client")
            return new { role = "client", client_shortcode = clientShortcode, must_change_password = true };
        return new Dictionary<string, object> { ["role"] = role, ["must_change_password"] = true };
    }
}
