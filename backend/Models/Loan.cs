using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class Loan
{
    public Guid Id { get; set; }

    [Required]
    public string LenderName { get; set; } = "Liquid Capital WGP Inc.";

    [Required]
    public string BorrowerName { get; set; } = null!;

    public string? Guarantors { get; set; }
    public string? Address { get; set; }

    public decimal Principal { get; set; }

    // Annual interest rate as a decimal (e.g. 0.18 for 18%)
    public decimal InterestRate { get; set; }

    public DateOnly StartDate { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? CreatedBy { get; set; }

    public ICollection<LoanPayment> Payments { get; set; } = new List<LoanPayment>();
}
