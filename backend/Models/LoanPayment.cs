using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class LoanPayment
{
    public Guid Id { get; set; }

    public Guid LoanId { get; set; }
    public Loan Loan { get; set; } = null!;

    public DateOnly PaymentDate { get; set; }

    // The amount actually received from the borrower on this date
    public decimal PaymentAmount { get; set; }

    // When set, overrides the auto-calculated interest for this period
    public decimal? OverrideInterest { get; set; }

    // When set, overrides the auto-calculated principal repaid for this period
    public decimal? OverridePrincipal { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
