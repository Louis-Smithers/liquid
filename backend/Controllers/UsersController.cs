using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api")]
public class UsersController : ControllerBase
{
    private readonly IAdminService _adminService;

    public UsersController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpPost("users/requests")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitAccessRequest(SubmitRequestDto dto)
    {
        var request = await _adminService.SubmitAccessRequestAsync(dto);
        return Ok(new { message = "Access request submitted.", id = request.Id });
    }

    [HttpGet("admin/requests")]
    [Authorize]
    public async Task<IActionResult> GetAccessRequests()
    {
        if (!IsAdmin()) return Forbid();
        var requests = await _adminService.GetAccessRequestsAsync();
        return Ok(requests);
    }

    [HttpPatch("admin/requests/{id:guid}/approve")]
    [Authorize]
    public async Task<IActionResult> ApproveRequest(Guid id, [FromBody] ApproveRequestDto dto)
    {
        if (!IsAdmin()) return Forbid();
        var result = await _adminService.ApproveRequestAsync(id, dto.TempPassword);
        if (!result) return BadRequest("Could not approve request.");
        return Ok(new { message = "Request approved." });
    }

    [HttpPatch("admin/requests/{id:guid}/deny")]
    [Authorize]
    public async Task<IActionResult> DenyRequest(Guid id)
    {
        if (!IsAdmin()) return Forbid();
        var result = await _adminService.DenyRequestAsync(id);
        if (!result) return BadRequest("Could not deny request.");
        return Ok(new { message = "Request denied." });
    }

    [HttpPost("admin/users/{userId}/reset-password")]
    [Authorize]
    public async Task<IActionResult> ResetPassword(string userId, [FromBody] ResetPasswordDto dto)
    {
        if (!IsAdmin()) return Forbid();
        var result = await _adminService.ResetPasswordAsync(userId, dto.TempPassword);
        if (!result) return BadRequest("Could not reset password.");
        return Ok(new { message = "Password reset successfully." });
    }

    [HttpPost("users/me/clear-must-change-password")]
    [Authorize]
    public async Task<IActionResult> ClearMustChangePassword()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();
        
        var result = await _adminService.ClearMustChangePasswordAsync(userId);
        if (!result) return BadRequest("Could not update user metadata.");
        return Ok(new { message = "Must change password flag cleared." });
    }

    private string? GetUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    }

    private bool IsAdmin()
    {
        var appMetadataClaim = User.FindFirst("app_metadata")?.Value;
        if (appMetadataClaim != null)
        {
            try
            {
                var doc = JsonDocument.Parse(appMetadataClaim);
                if (doc.RootElement.TryGetProperty("role", out var roleElement) && roleElement.GetString() == "admin")
                {
                    return true;
                }
            }
            catch { }
        }
        
        var roleClaim = User.FindFirst("role")?.Value;
        if (roleClaim == "admin") return true;

        var customRoleClaim = User.FindFirst("user_role")?.Value; // Fallback
        if (customRoleClaim == "admin") return true;

        return false;
    }
}

public class ApproveRequestDto
{
    public required string TempPassword { get; set; }
}

public class ResetPasswordDto
{
    public required string TempPassword { get; set; }
}
