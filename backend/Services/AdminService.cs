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

    public AdminService(AppDbContext context, IConfiguration config, HttpClient httpClient)
    {
        _context = context;
        _httpClient = httpClient;
        
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

    public async Task<bool> ApproveRequestAsync(Guid requestId, string tempPassword)
    {
        var request = await _context.UserAccessRequests.FindAsync(requestId);
        if (request == null || request.Status != "Pending") return false;

        var payload = new
        {
            email = request.Email,
            password = tempPassword,
            email_confirm = true,
            app_metadata = new { role = "user", must_change_password = true },
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

        var payload = new
        {
            app_metadata = appMetadata
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PutAsync($"/auth/v1/admin/users/{supabaseUserId}", content);

        return response.IsSuccessStatusCode;
    }
}
