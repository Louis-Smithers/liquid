using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class InvoiceService : IInvoiceService
{
    private readonly AppDbContext _context;

    public InvoiceService(AppDbContext context)
    {
        _context = context;
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
        return await _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.LiquidClient == shortcode)
            .OrderByDescending(p => p.Date)
            .Select(p => ToDto(p))
            .ToListAsync();
    }

    public async Task<IEnumerable<InvoiceDto>> GetByDebtorAsync(Guid debtorId)
    {
        return await _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.DebtorId == debtorId)
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

        return p is null ? null : ToDto(p);
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

        var invoices = await _context.Invoices
            .Include(p => p.Client)
            .Include(p => p.Debtor)
            .Where(p => includedStatuses.Contains(p.Status) && !p.Archived)
            .ToListAsync();

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
