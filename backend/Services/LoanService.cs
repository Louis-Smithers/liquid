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

    // Cursor pagination ordered newest-created first, mirroring InvoiceService.GetPageAsync.
    // The frontend drives Prev/Next by keeping its own stack of (cursorTime, cursorId) pairs —
    // this only ever needs to page forward from a given cursor.
    public async Task<LoanPageDto> GetPageAsync(DateTimeOffset? cursorTime, Guid? cursorId, int pageSize)
    {
        var query = _db.Loans.Include(l => l.Payments).AsQueryable();

        if (cursorTime.HasValue && cursorId.HasValue)
            query = query.Where(l =>
                l.CreatedAt < cursorTime.Value ||
                (l.CreatedAt == cursorTime.Value && l.Id.CompareTo(cursorId.Value) < 0));

        var loans = await query
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .Take(pageSize + 1)
            .ToListAsync();

        var hasMore = loans.Count > pageSize;
        if (hasMore) loans.RemoveAt(loans.Count - 1);

        var items = loans.Select(ToSummaryDto).ToList();

        return new LoanPageDto(
            items,
            hasMore ? loans[^1].CreatedAt.ToString("O") : null,
            hasMore ? loans[^1].Id.ToString() : null,
            cursorTime.HasValue);
    }

    // Portfolio-wide totals, independent of the paginated list above.
    public async Task<LoanTotalsDto> GetTotalsAsync()
    {
        var loans = await _db.Loans.Include(l => l.Payments).ToListAsync();

        var totalPrincipal = loans.Sum(l => l.Principal);
        var totalOutstanding = loans.Sum(l =>
        {
            var rows = ComputeRows(l);
            return rows.Count > 0 ? rows[^1].ClosingBalance : l.Principal;
        });

        return new LoanTotalsDto(totalPrincipal, totalOutstanding);
    }

    private static LoanSummaryDto ToSummaryDto(Loan l)
    {
        var rows = ComputeRows(l);
        var currentBalance = rows.Count > 0 ? rows[^1].ClosingBalance : l.Principal;
        var totalInterest = rows.Sum(r => r.Interest);
        return new LoanSummaryDto(
            l.Id, l.LenderName, l.BorrowerName, l.Guarantors,
            l.Principal, l.InterestRate, l.StartDate, l.TermMonths, l.StartDate.AddMonths(l.TermMonths),
            l.Frequency, l.CustomIntervalDays,
            currentBalance, totalInterest, l.Payments.Count);
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
            TermMonths = dto.TermMonths,
            Frequency = dto.Frequency,
            CustomIntervalDays = dto.CustomIntervalDays,
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
    // Subsequent rows are driven by a merged timeline of:
    //   - interest-accrual dates, spaced per the loan's Frequency, running from the start
    //     date through its fixed maturity date (StartDate + TermMonths), and
    //   - payment events.
    // The schedule is fixed at loan creation (TermMonths + Frequency) — no more guessing
    // how long the loan runs or how often it accrues. Once a real payment lands on one of
    // those dates, that row uses the real payment instead of the projection, and every row
    // after it recomputes from the actual numbers — the table is always rebuilt from scratch
    // from the stored payments, so this happens automatically.
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

        var maturityDate = loan.StartDate.AddMonths(loan.TermMonths);

        var paymentsByDate = loan.Payments
            .OrderBy(p => p.PaymentDate)
            .GroupBy(p => p.PaymentDate)
            .ToDictionary(g => g.Key, g => g.Last());

        var eventDates = new SortedSet<DateOnly>(AccrualDates(loan.StartDate, maturityDate, loan.Frequency, loan.CustomIntervalDays));
        eventDates.Add(maturityDate); // always close the table out exactly at term end
        foreach (var date in paymentsByDate.Keys) eventDates.Add(date);

        decimal runningBalance = loan.Principal;
        var prevDate = loan.StartDate;

        foreach (var date in eventDates)
        {
            var days = date.DayNumber - prevDate.DayNumber;
            if (days <= 0) continue;

            var hasPayment = paymentsByDate.TryGetValue(date, out var payment);
            var paymentAmount = hasPayment ? payment!.PaymentAmount : 0m;

            var autoInterest = Math.Round(runningBalance * loan.InterestRate / 365m * days, 2);
            var interest = hasPayment ? (payment!.OverrideInterest ?? autoInterest) : autoInterest;

            // Auto-principal = payment − interest; can be overridden on payment rows.
            // Pure accrual rows have no payment, so principal is negative (balance grows).
            var autoPrincipal = paymentAmount - interest;
            var principal = hasPayment ? (payment!.OverridePrincipal ?? autoPrincipal) : autoPrincipal;

            // ClosingBalance = OpeningBalance + Interest − PaymentReceived
            // (matches PDF: balance goes UP by interest, DOWN by payment)
            var closing = Math.Round(runningBalance + interest - paymentAmount, 2);

            rows.Add(new LoanTableRowDto(
                Date: date,
                Days: days,
                OpeningBalance: runningBalance,
                PaymentReceived: paymentAmount,
                Interest: interest,
                Principal: Math.Round(principal, 2),
                ClosingBalance: closing,
                PaymentId: hasPayment ? payment!.Id : null,
                IsOverride: hasPayment && (payment!.OverrideInterest.HasValue || payment!.OverridePrincipal.HasValue)));

            runningBalance = closing;
            prevDate = date;
        }

        return rows;
    }

    // Accrual dates strictly after startDate, through endDateInclusive (the loan's maturity
    // date), spaced according to the loan's fixed compounding Frequency.
    // "Custom" reuses the same fixed-day-interval math as Weekly/BiWeekly — customIntervalDays
    // is just whatever day count the New Loan form converted "every X days/weeks" into.
    private static IEnumerable<DateOnly> AccrualDates(DateOnly startDate, DateOnly endDateInclusive, string frequency, int? customIntervalDays)
    {
        return frequency switch
        {
            "Weekly" => FixedDayAccrualDates(startDate, endDateInclusive, 7),
            "BiWeekly" => FixedDayAccrualDates(startDate, endDateInclusive, 14),
            "Quarterly" => MonthlyAnniversaryAccrualDates(startDate, endDateInclusive, monthStep: 3),
            "Custom" => FixedDayAccrualDates(startDate, endDateInclusive, customIntervalDays ?? 30),
            _ => MonthlyAnniversaryAccrualDates(startDate, endDateInclusive, monthStep: 1),
        };
    }

    // Every `intervalDays` days after startDate, through endDateInclusive.
    private static IEnumerable<DateOnly> FixedDayAccrualDates(DateOnly startDate, DateOnly endDateInclusive, int intervalDays)
    {
        var date = startDate.AddDays(intervalDays);
        while (date <= endDateInclusive)
        {
            yield return date;
            date = date.AddDays(intervalDays);
        }
    }

    // Anniversaries of startDate's day-of-month, every `monthStep` months, strictly after
    // startDate, through endDateInclusive. Short months clamp to the last day of that month
    // (e.g. a 31st start posts on the 28th/29th/30th).
    private static IEnumerable<DateOnly> MonthlyAnniversaryAccrualDates(DateOnly startDate, DateOnly endDateInclusive, int monthStep)
    {
        var targetDay = startDate.Day;
        var monthsAhead = monthStep;

        while (true)
        {
            var firstOfMonth = startDate.AddMonths(monthsAhead).AddDays(-(startDate.Day - 1));
            var daysInMonth = DateTime.DaysInMonth(firstOfMonth.Year, firstOfMonth.Month);
            var day = Math.Min(targetDay, daysInMonth);
            var date = new DateOnly(firstOfMonth.Year, firstOfMonth.Month, day);

            if (date > endDateInclusive) yield break;

            yield return date;
            monthsAhead += monthStep;
        }
    }

    // ── Mappers ────────────────────────────────────────────────────────────

    private static LoanDto ToDto(Loan l) => new(
        l.Id, l.LenderName, l.BorrowerName, l.Guarantors, l.Address,
        l.Principal, l.InterestRate, l.StartDate, l.TermMonths, l.StartDate.AddMonths(l.TermMonths),
        l.Frequency, l.CustomIntervalDays, l.Notes, l.CreatedAt,
        l.Payments.OrderBy(p => p.PaymentDate).Select(ToPaymentDto).ToList());

    private static LoanPaymentDto ToPaymentDto(LoanPayment p) => new(
        p.Id, p.LoanId, p.PaymentDate, p.PaymentAmount,
        p.OverrideInterest, p.OverridePrincipal, p.Notes, p.CreatedAt);
}
