using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class InvoiceService : IInvoiceService
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public InvoiceService(AppDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    private static InvoiceDto ToDto(Invoice p) => new(
        p.InvoiceId,
        p.OriginalInvoice,
        p.Date,
        p.LiquidClient,
        p.DebtorId,
        p.Debtor?.Name ?? string.Empty,
        p.Amount,
        p.Status,
        p.Archived,
        p.DocumentPath,
        p.CreatedTime,
        p.UpdatedAt,
        p.Notes,
        p.ScheduleNumber,
        p.FileCount,
        p.Flagged,
        p.FlagReason,
        p.FlagTimestamp,
        p.Terms,
        p.ProcessedTime,
        p.Verified
    );

    public async Task<IEnumerable<InvoiceDto>> GetByClientAsync(string shortcode)
    {
        if (_currentUser.IsClient && shortcode != _currentUser.ClientShortcode)
            return Enumerable.Empty<InvoiceDto>();

        return await _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.LiquidClient == shortcode)
            .OrderByDescending(p => p.Date)
            .Select(p => ToDto(p))
            .ToListAsync();
    }

    public async Task<IEnumerable<InvoiceDto>> GetByDebtorAsync(Guid debtorId)
    {
        var query = _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.DebtorId == debtorId);

        if (_currentUser.IsClient)
            query = query.Where(p => p.LiquidClient == _currentUser.ClientShortcode);

        return await query
            .OrderByDescending(p => p.Date)
            .Select(p => ToDto(p))
            .ToListAsync();
    }

    public async Task<InvoiceDto?> GetByIdAsync(string invoiceId)
    {
        var p = await _context.Invoices
            .Include(p => p.Client)
            .Include(p => p.Debtor)
            .FirstOrDefaultAsync(p => p.InvoiceId == invoiceId);

        if (p is null) return null;

        if (_currentUser.IsClient && p.LiquidClient != _currentUser.ClientShortcode)
            return null;

        return ToDto(p);
    }

    public async Task<bool> UpdateStatusAsync(string invoiceId, string status)
    {
        var invoice = await _context.Invoices.FirstOrDefaultAsync(p => p.InvoiceId == invoiceId);
        if (invoice is null) return false;

        invoice.Status = status;
        invoice.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<AgingClientReportDto>> GetAgingReportAsync()
    {
        var includedStatuses = new[] { "Pre-Verified", "Unverified", "OA", "ON" };
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var query = _context.Invoices
            .Include(p => p.Client)
            .Include(p => p.Debtor)
            .Where(p => includedStatuses.Contains(p.Status) && !p.Archived);

        if (_currentUser.IsClient)
            query = query.Where(p => p.LiquidClient == _currentUser.ClientShortcode);

        var invoices = await query.ToListAsync();

        return invoices
            .GroupBy(p => p.Client.Shortcode)
            .Select(clientGroup => new AgingClientReportDto(
                clientGroup.Key,
                clientGroup.First().Client.CadenceName,
                clientGroup
                    .GroupBy(p => p.Debtor.Name)
                    .Select(debtorGroup =>
                    {
                        int DaysOld(Invoice p) => today.DayNumber - p.Date.DayNumber;
                        return new AgingDebtorRowDto(
                            debtorGroup.Key,
                            debtorGroup.Where(p => DaysOld(p) <= 30).Sum(p => p.Amount),
                            debtorGroup.Where(p => DaysOld(p) > 30 && DaysOld(p) <= 60).Sum(p => p.Amount),
                            debtorGroup.Where(p => DaysOld(p) > 60 && DaysOld(p) <= 90).Sum(p => p.Amount),
                            debtorGroup.Where(p => DaysOld(p) > 90).Sum(p => p.Amount),
                            debtorGroup.Sum(p => p.Amount)
                        );
                    }).ToList()
            )).ToList();
    }
}
