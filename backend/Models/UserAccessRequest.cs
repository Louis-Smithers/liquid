using System;

namespace Smithers.API.Models;

public class UserAccessRequest
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public required string UsernameWanted { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    
    public string Status { get; set; } = "Pending";
    
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewedBySupabaseId { get; set; }
}
