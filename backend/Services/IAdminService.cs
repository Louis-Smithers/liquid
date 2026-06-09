using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class SubmitRequestDto
{
    public required string Email { get; set; }
    public required string UsernameWanted { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
}

public interface IAdminService
{
    Task<UserAccessRequest> SubmitAccessRequestAsync(SubmitRequestDto dto);
    Task<IEnumerable<UserAccessRequest>> GetAccessRequestsAsync();
    Task<bool> ApproveRequestAsync(Guid requestId, string tempPassword);
    Task<bool> DenyRequestAsync(Guid requestId);
    Task<bool> ResetPasswordAsync(string supabaseUserId, string tempPassword);
    Task<bool> ClearMustChangePasswordAsync(string supabaseUserId);
}
