using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class BrokerSubmission
{
    public Guid Id { get; set; }

    [Required]
    public string SubmittedBySupabaseId { get; set; } = null!;

    [Required, MaxLength(200)]
    public string CompanyName { get; set; } = null!;

    [MaxLength(200)]
    public string? ContactName { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(50)]
    public string? Phone { get; set; }

    [MaxLength(50)]
    public string? BusinessNumber { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    public string? Notes { get; set; }

    // Status: Submitted | InReview | NeedsInfo | Approved | Rejected
    [MaxLength(20)]
    public string Status { get; set; } = "Submitted";

    public string? StaffNote { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
