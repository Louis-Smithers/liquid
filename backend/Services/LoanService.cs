using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class LoanService : ILoanService
{
    private readonly AppDbContext _db;

    public LoanService(AppDbContext db) => _db = db;

    // ── Public API ─────────────────────────────────────────────────────────

    public async Task<List<LoanSummaryDto>> GetAllAsync()
    {
        var loans = await _db.Loans
            .Include(l => l.Payments)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return loans.Select(l =>
        {
            var rows = ComputeRows(l);
            var currentBalance = rows.Count > 0 ? rows[^1].ClosingBalance : l.Principal;
            var totalInterest = rows.Sum(r => r.Interest);
            return new LoanSummaryDto(
                l.Id, l.LenderName, l.BorrowerName, l.Guarantors,
                l.Principal, l.InterestRate, l.StartDate,
                currentBalance, totalInterest, l.Payments.Count);
        }).ToList();
    }

    public async Task<LoanTableDto?> GetTableAsync(Guid id)
    {
        var loan = await _db.Loans
            .Include(l => l.Payments)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (loan is null) return null;

        var rows = ComputeRows(loan);
        var currentBalance = rows.Count > 0 ? rows[^1].ClosingBalance : loan.Principal;
        var totalInterest = rows.Sum(r => r.Interest);

        return new LoanTableDto(ToDto(loan), rows, totalInterest, currentBalance);
    }

    public async Task<LoanDto> CreateAsync(CreateLoanDto dto, Guid createdBy)
    {
        var loan = new Loan
        {
            Id = Guid.NewGuid(),
            LenderName = dto.LenderName ?? "Liquid Capital WGP Inc.",
            BorrowerName = dto.BorrowerName,
            Guarantors = dto.Guarantors,
            Address = dto.Address,
            Principal = dto.Principal,
            InterestRate = dto.InterestRate,
            StartDate = dto.StartDate,
            Notes = dto.Notes,
            CreatedBy = createdBy,
        };
        _db.Loans.Add(loan);
        await _db.SaveChangesAsync();
        return ToDto(loan);
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateLoanDto dto)
    {
        var loan = await _db.Loans.FindAsync(id);
        if (loan is null) return false;

        if (dto.LenderName is not null) loan.LenderName = dto.LenderName;
        if (dto.BorrowerName is not null) loan.BorrowerName = dto.BorrowerName;
        if (dto.Guarantors is not null) loan.Guarantors = dto.Guarantors;
        if (dto.Address is not null) loan.Address = dto.Address;
        if (dto.Principal is not null) loan.Principal = dto.Principal.Value;
        if (dto.InterestRate is not null) loan.InterestRate = dto.InterestRate.Value;
        if (dto.StartDate is not null) loan.StartDate = dto.StartDate.Value;
        if (dto.Notes is not null) loan.Notes = dto.Notes;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var loan = await _db.Loans.FindAsync(id);
        if (loan is null) return false;
        _db.Loans.Remove(loan);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<LoanPaymentDto> AddPaymentAsync(Guid loanId, AddLoanPaymentDto dto)
    {
        var payment = new LoanPayment
        {
            Id = Guid.NewGuid(),
            LoanId = loanId,
            PaymentDate = dto.PaymentDate,
            PaymentAmount = dto.PaymentAmount,
            OverrideInterest = dto.OverrideInterest,
            OverridePrincipal = dto.OverridePrincipal,
            Notes = dto.Notes,
        };
        _db.LoanPayments.Add(payment);
        await _db.SaveChangesAsync();
        return ToPaymentDto(payment);
    }

    public async Task<bool> UpdatePaymentAsync(Guid loanId, Guid paymentId, UpdateLoanPaymentDto dto)
    {
        var payment = await _db.LoanPayments
            .FirstOrDefaultAsync(p => p.Id == paymentId && p.LoanId == loanId);
        if (payment is null) return false;

        if (dto.PaymentDate is not null) payment.PaymentDate = dto.PaymentDate.Value;
        if (dto.PaymentAmount is not null) payment.PaymentAmount = dto.PaymentAmount.Value;
        if (dto.ClearOverrideInterest) payment.OverrideInterest = null;
        else if (dto.OverrideInterest is not null) payment.OverrideInterest = dto.OverrideInterest;
        if (dto.ClearOverridePrincipal) payment.OverridePrincipal = null;
        else if (dto.OverridePrincipal is not null) payment.OverridePrincipal = dto.OverridePrincipal;
        if (dto.Notes is not null) payment.Notes = dto.Notes;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletePaymentAsync(Guid loanId, Guid paymentId)
    {
        var payment = await _db.LoanPayments
            .FirstOrDefaultAsync(p => p.Id == paymentId && p.LoanId == loanId);
        if (payment is null) return false;
        _db.LoanPayments.Remove(payment);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Computation ────────────────────────────────────────────────────────

    // Builds the full amortisation table matching the PDF layout.
    // Row 0 is always the loan start date (opening balance = principal, no payment).
    // Subsequent rows are driven by payment events sorted by date.
    // Interest = annualRate / 365 × days × openingBalance  (daily compound per PDF).
    // ClosingBalance = OpeningBalance + Interest − PaymentReceived
    // Principal repaid = PaymentReceived − Interest  (column C in PDF = B − E)
    public static List<LoanTableRowDto> ComputeRows(Loan loan)
    {
        var rows = new List<LoanTableRowDto>();

        // Opening row — no payment, no interest yet
        rows.Add(new LoanTableRowDto(
            Date: loan.StartDate,
            Days: 0,
            OpeningBalance: loan.Principal,
            PaymentReceived: 0,
            Interest: 0,
            Principal: 0,
            ClosingBalance: loan.Principal,
            PaymentId: null,
            IsOverride: false));

        var payments = loan.Payments
            .OrderBy(p => p.PaymentDate)
            .ToList();

        decimal runningBalance = loan.Principal;

        foreach (var payment in payments)
        {
            var prevDate = rows[^1].Date;
            var days = payment.PaymentDate.DayNumber - prevDate.DayNumber;
            if (days < 0) days = 0;

            var autoInterest = Math.Round(runningBalance * loan.InterestRate / 365m * days, 2);
            var interest = payment.OverrideInterest ?? autoInterest;

            // Auto-principal = payment − interest; can be overridden
            var autoPrincipal = payment.PaymentAmount - interest;
            var principal = payment.OverridePrincipal ?? autoPrincipal;

            // ClosingBalance = OpeningBalance + Interest − PaymentReceived
            // (matches PDF: balance goes UP by interest, DOWN by payment)
            var closing = runningBalance + interest - payment.PaymentAmount;
            closing = Math.Round(closing, 2);

            rows.Add(new LoanTableRowDto(
                Date: payment.PaymentDate,
                Days: days,
                OpeningBalance: runningBalance,
                PaymentReceived: payment.PaymentAmount,
                Interest: interest,
                Principal: Math.Round(principal, 2),
                ClosingBalance: closing,
                PaymentId: payment.Id,
                IsOverride: payment.OverrideInterest.HasValue || payment.OverridePrincipal.HasValue));

            runningBalance = closing;
        }

        return rows;
    }

    // ── Mappers ────────────────────────────────────────────────────────────

    private static LoanDto ToDto(Loan l) => new(
        l.Id, l.LenderName, l.BorrowerName, l.Guarantors, l.Address,
        l.Principal, l.InterestRate, l.StartDate, l.Notes, l.CreatedAt,
        l.Payments.OrderBy(p => p.PaymentDate).Select(ToPaymentDto).ToList());

    private static LoanPaymentDto ToPaymentDto(LoanPayment p) => new(
        p.Id, p.LoanId, p.PaymentDate, p.PaymentAmount,
        p.OverrideInterest, p.OverridePrincipal, p.Notes, p.CreatedAt);
}
