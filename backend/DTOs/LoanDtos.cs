namespace Smithers.API.DTOs;

// ── Read DTOs ──────────────────────────────────────────────────────────────

public record LoanDto(
    Guid Id,
    string LenderName,
    string BorrowerName,
    string? Guarantors,
    string? Address,
    decimal Principal,
    decimal InterestRate,
    DateOnly StartDate,
    string? Notes,
    DateTimeOffset CreatedAt,
    List<LoanPaymentDto> Payments
);

public record LoanPaymentDto(
    Guid Id,
    Guid LoanId,
    DateOnly PaymentDate,
    decimal PaymentAmount,
    decimal? OverrideInterest,
    decimal? OverridePrincipal,
    string? Notes,
    DateTimeOffset CreatedAt
);

// One computed row in the loan table (mirrors the PDF columns A–F)
public record LoanTableRowDto(
    DateOnly Date,
    int Days,                  // Days since previous event
    decimal OpeningBalance,    // A
    decimal PaymentReceived,   // B  (0 if no payment on this date)
    decimal Interest,          // E  (daily compound: rate/365 × days × opening)
    decimal Principal,         // C = B − E
    decimal ClosingBalance,    // D = A − C  (equivalently A + E − B)
    Guid? PaymentId,           // non-null when a LoanPayment row drives this row
    bool IsOverride            // true if interest or principal was manually set
);

// Summary DTO returned when listing all loans
public record LoanSummaryDto(
    Guid Id,
    string LenderName,
    string BorrowerName,
    string? Guarantors,
    decimal Principal,
    decimal InterestRate,
    DateOnly StartDate,
    decimal CurrentBalance,    // latest closing balance from computed table
    decimal TotalInterest,     // sum of all accrued interest rows
    int PaymentCount
);

// Full loan + computed table (used for detail view + PDF)
public record LoanTableDto(
    LoanDto Loan,
    List<LoanTableRowDto> Rows,
    decimal TotalInterestAccrued,
    decimal CurrentBalance
);

// ── Write DTOs ─────────────────────────────────────────────────────────────

public record CreateLoanDto(
    string BorrowerName,
    string? LenderName,
    string? Guarantors,
    string? Address,
    decimal Principal,
    decimal InterestRate,
    DateOnly StartDate,
    string? Notes
);

public record UpdateLoanDto(
    string? LenderName = null,
    string? BorrowerName = null,
    string? Guarantors = null,
    string? Address = null,
    decimal? Principal = null,
    decimal? InterestRate = null,
    DateOnly? StartDate = null,
    string? Notes = null
);

public record AddLoanPaymentDto(
    DateOnly PaymentDate,
    decimal PaymentAmount,
    decimal? OverrideInterest = null,
    decimal? OverridePrincipal = null,
    string? Notes = null
);

public record UpdateLoanPaymentDto(
    DateOnly? PaymentDate = null,
    decimal? PaymentAmount = null,
    decimal? OverrideInterest = null,
    decimal? OverridePrincipal = null,
    string? Notes = null,
    bool ClearOverrideInterest = false,
    bool ClearOverridePrincipal = false
);
