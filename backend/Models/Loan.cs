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

    // Fixed at creation; not editable afterward. Total length of the loan, in months.
    public int TermMonths { get; set; }

    // Fixed at creation; not editable afterward. How often interest compounds (gets posted
    // into the balance) — NOT a payment schedule, payments can land on any date.
    // One of: "Monthly", "BiWeekly", "Weekly", "Quarterly", "Custom".
    public string Frequency { get; set; } = "Monthly";

    // Only set when Frequency == "Custom". Number of days between compounding events.
    // The "New Loan" UI collects this as "every X days/weeks" and converts weeks to days
    // before saving, so storage and accrual math only ever deal in days.
    public int? CustomIntervalDays { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? CreatedBy { get; set; }

    public ICollection<LoanPayment> Payments { get; set; } = new List<LoanPayment>();
}
