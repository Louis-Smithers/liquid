using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class SubmitRequestDto
{
    public required string Email { get; set; }
    public required string UsernameWanted { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
}

public class UserSummaryDto
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "staff";
    public string? ClientShortcode { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? CreatedAt { get; set; }
}

public class CreateUserDto
{
    public required string Email { get; set; }
    public required string TempPassword { get; set; }
    public required string Role { get; set; }
    public string? ClientShortcode { get; set; }
    public CreateClientDto? NewClient { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}

public class UpdateUserDto
{
    public required string Role { get; set; }
    public string? ClientShortcode { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}

public interface IAdminService
{
    Task<UserAccessRequest> SubmitAccessRequestAsync(SubmitRequestDto dto);
    Task<IEnumerable<UserAccessRequest>> GetAccessRequestsAsync();
    Task<bool> ApproveRequestAsync(Guid requestId, string tempPassword, string role, string? clientShortcode);
    Task<bool> DenyRequestAsync(Guid requestId);
    Task<bool> ResetPasswordAsync(string supabaseUserId, string tempPassword);
    Task<bool> ClearMustChangePasswordAsync(string supabaseUserId);
    Task<IEnumerable<UserSummaryDto>> ListUsersAsync();
    Task<bool> CreateUserAsync(CreateUserDto dto);
    Task<bool> UpdateUserAsync(string supabaseUserId, UpdateUserDto dto);
    Task<bool> DeleteUserAsync(string supabaseUserId);
}
