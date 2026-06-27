using System.ComponentModel.DataAnnotations;

namespace Smithers.API.DTOs;

public class BrokerSubmissionDto
{
    public Guid Id { get; set; }
    public string SubmittedBySupabaseId { get; set; } = null!;
    public string CompanyName { get; set; } = null!;
    public string? ContactName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? BusinessNumber { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = null!;
    public string? StaffNote { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class CreateBrokerSubmissionDto
{
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
}

public class UpdateBrokerStatusDto
{
    [Required]
    public string Status { get; set; } = null!;
    public string? StaffNote { get; set; }
}
