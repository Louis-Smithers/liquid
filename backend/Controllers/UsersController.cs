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
        var role = dto.Role ?? "staff";
        if (role != "staff" && role != "client" && role != "external" && role != "admin")
            return BadRequest("Role must be 'staff', 'client', 'external', or 'admin'.");
        var result = await _adminService.ApproveRequestAsync(id, dto.TempPassword, role, dto.ClientShortcode);
        if (!result) return BadRequest("Could not approve request. If role is 'client', a valid client shortcode is required.");
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

    // User CRUD (admin only)
    [HttpGet("admin/users")]
    [Authorize]
    public async Task<IActionResult> ListUsers()
    {
        if (!IsAdmin()) return Forbid();
        var users = await _adminService.ListUsersAsync();
        return Ok(users);
    }

    [HttpPost("admin/users")]
    [Authorize]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        if (!IsAdmin()) return Forbid();
        if (dto.Role != "staff" && dto.Role != "client" && dto.Role != "external" && dto.Role != "admin")
            return BadRequest("Role must be 'staff', 'client', 'external', or 'admin'.");
        if (dto.Role == "client")
        {
            if (dto.NewClient != null)
            {
                if (string.IsNullOrWhiteSpace(dto.NewClient.Shortcode))
                    return BadRequest("New client shortcode is required.");
                if (string.IsNullOrWhiteSpace(dto.NewClient.CadenceName))
                    return BadRequest("New client name is required.");
            }
            else if (string.IsNullOrWhiteSpace(dto.ClientShortcode))
            {
                return BadRequest("Either an existing client shortcode or a new client definition is required for the client role.");
            }
        }
        var result = await _adminService.CreateUserAsync(dto);
        if (!result) return BadRequest("Could not create user.");
        return Ok(new { message = "User created." });
    }

    [HttpPut("admin/users/{userId}")]
    [Authorize]
    public async Task<IActionResult> UpdateUser(string userId, [FromBody] UpdateUserDto dto)
    {
        if (!IsAdmin()) return Forbid();
        if (dto.Role != "staff" && dto.Role != "client" && dto.Role != "external" && dto.Role != "admin")
            return BadRequest("Role must be 'staff', 'client', 'external', or 'admin'.");
        if (dto.Role == "client" && string.IsNullOrWhiteSpace(dto.ClientShortcode))
            return BadRequest("Client shortcode is required for client role.");
        var result = await _adminService.UpdateUserAsync(userId, dto);
        if (!result) return BadRequest("Could not update user.");
        return Ok(new { message = "User updated." });
    }

    [HttpDelete("admin/users/{userId}")]
    [Authorize]
    public async Task<IActionResult> DeleteUser(string userId)
    {
        if (!IsAdmin()) return Forbid();
        var result = await _adminService.DeleteUserAsync(userId);
        if (!result) return BadRequest("Could not delete user.");
        return Ok(new { message = "User deleted." });
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
                    return true;
            }
            catch { }
        }

        var roleClaim = User.FindFirst("role")?.Value;
        if (roleClaim == "admin") return true;

        var customRoleClaim = User.FindFirst("user_role")?.Value;
        if (customRoleClaim == "admin") return true;

        return false;
    }
}

public class ApproveRequestDto
{
    public required string TempPassword { get; set; }
    public string? Role { get; set; }
    public string? ClientShortcode { get; set; }
}

public class ResetPasswordDto
{
    public required string TempPassword { get; set; }
}
