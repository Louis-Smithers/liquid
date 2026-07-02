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

    private static InvoiceDto ToDto(Invoice p, bool isProcessed = false, bool onAnyNs = false, string? onNsId = null) => new(
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
        p.Verified,
        p.Source,
        isProcessed,
        onAnyNs,
        onNsId
    );

    // An invoice is "Processed" once it's on a Notification Sheet that has actually been
    // Submitted — sitting in a Draft queue doesn't count. Import-sourced (DebAging report)
    // invoices are always Processed regardless of NS status; only OCR-scanned invoices can be
    // genuinely Unprocessed.
    private async Task<HashSet<string>> GetProcessedInvoiceIdsAsync(IEnumerable<string> invoiceIds) =>
        (await _context.NotificationSheetItems
            .Where(i => invoiceIds.Contains(i.InvoiceId) && i.NotificationSheet.Status == "Submitted")
            .Select(i => i.InvoiceId)
            .Distinct()
            .ToListAsync())
        .ToHashSet();

    private static bool IsProcessed(Invoice p, HashSet<string> submittedIds) =>
        p.Source == "Import" || submittedIds.Contains(p.InvoiceId);

    // Membership on ANY Notification Sheet (Draft or Submitted). Used to lock an invoice from
    // being added to a second NS while it's still sitting on a Draft (which IsProcessed ignores).
    // Maps invoiceId -> the NS id it's already on (first match wins if somehow on more than one).
    private async Task<Dictionary<string, string>> GetOnAnyNsInvoiceIdsAsync(IEnumerable<string> invoiceIds) =>
        (await _context.NotificationSheetItems
            .Where(i => invoiceIds.Contains(i.InvoiceId))
            .Select(i => new { i.InvoiceId, NsId = i.NotificationSheetId.ToString() })
            .ToListAsync())
        .GroupBy(x => x.InvoiceId)
        .ToDictionary(g => g.Key, g => g.First().NsId);

    private static InvoiceNoteDto ToNoteDto(InvoiceNote n) => new(n.Id, n.InvoiceId, n.Text, n.CreatedBy, n.CreatedAt);

    public async Task<InvoicePageDto> GetPageAsync(
        string? search, string? status,
        DateTimeOffset? cursorTime, string? cursorId,
        int pageSize,
        string? client = null, Guid? debtorId = null)
    {
        var query = _context.Invoices
            .Include(p => p.Debtor)
            .AsQueryable();

        if (_currentUser.IsClient)
            query = query.Where(p => p.LiquidClient == _currentUser.ClientShortcode);

        if (!string.IsNullOrWhiteSpace(client))
            query = query.Where(p => p.LiquidClient == client);

        if (debtorId.HasValue)
            query = query.Where(p => p.DebtorId == debtorId.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(p =>
                p.OriginalInvoice.ToLower().Contains(q) ||
                p.DebtorName.ToLower().Contains(q) ||
                p.LiquidClient.ToLower().Contains(q));
        }

        // Cursor: items older than (cursorTime, cursorId)
        if (cursorTime.HasValue && cursorId != null)
            query = query.Where(p =>
                p.CreatedTime < cursorTime.Value ||
                (p.CreatedTime == cursorTime.Value && string.Compare(p.InvoiceId, cursorId) < 0));

        var entities = await query
            .OrderByDescending(p => p.CreatedTime)
            .ThenByDescending(p => p.InvoiceId)
            .Take(pageSize + 1)
            .ToListAsync();

        var submittedIds = await GetProcessedInvoiceIdsAsync(entities.Select(p => p.InvoiceId));
        var onAnyNsIds = await GetOnAnyNsInvoiceIdsAsync(entities.Select(p => p.InvoiceId));
        var items = entities.Select(p =>
        {
            onAnyNsIds.TryGetValue(p.InvoiceId, out var nsId);
            return ToDto(p, IsProcessed(p, submittedIds), nsId != null, nsId);
        }).ToList();

        string? nextCursorTime = null;
        string? nextCursorId = null;
        if (items.Count > pageSize)
        {
            items.RemoveAt(items.Count - 1);
            nextCursorTime = items[^1].CreatedTime.ToString("O");
            nextCursorId = items[^1].InvoiceId;
        }

        return new InvoicePageDto(items, nextCursorTime, nextCursorId);
    }

    public async Task<IEnumerable<InvoiceDto>> GetByClientAsync(string shortcode)
    {
        if (_currentUser.IsClient && shortcode != _currentUser.ClientShortcode)
            return Enumerable.Empty<InvoiceDto>();

        var entities = await _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.LiquidClient == shortcode)
            .OrderByDescending(p => p.Date)
            .ToListAsync();

        var submittedIds = await GetProcessedInvoiceIdsAsync(entities.Select(p => p.InvoiceId));
        var onAnyNsIds = await GetOnAnyNsInvoiceIdsAsync(entities.Select(p => p.InvoiceId));
        return entities.Select(p =>
        {
            onAnyNsIds.TryGetValue(p.InvoiceId, out var nsId);
            return ToDto(p, IsProcessed(p, submittedIds), nsId != null, nsId);
        });
    }

    public async Task<IEnumerable<InvoiceDto>> GetByDebtorAsync(Guid debtorId)
    {
        var query = _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.DebtorId == debtorId);

        if (_currentUser.IsClient)
            query = query.Where(p => p.LiquidClient == _currentUser.ClientShortcode);

        var entities = await query
            .OrderByDescending(p => p.Date)
            .ToListAsync();

        var submittedIds = await GetProcessedInvoiceIdsAsync(entities.Select(p => p.InvoiceId));
        return entities.Select(p => ToDto(p, IsProcessed(p, submittedIds)));
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

        var isSubmitted = await _context.NotificationSheetItems
            .AnyAsync(i => i.InvoiceId == invoiceId && i.NotificationSheet.Status == "Submitted");
        return ToDto(p, p.Source == "Import" || isSubmitted);
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

    public async Task<IEnumerable<InvoiceNoteDto>> GetNotesAsync(string invoiceId)
    {
        return await _context.InvoiceNotes
            .Where(n => n.InvoiceId == invoiceId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => ToNoteDto(n))
            .ToListAsync();
    }

    public async Task<InvoiceNoteDto?> AddNoteAsync(string invoiceId, string text, Guid userId)
    {
        var exists = await _context.Invoices.AnyAsync(p => p.InvoiceId == invoiceId);
        if (!exists) return null;

        var note = new InvoiceNote
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            Text = text,
            CreatedBy = userId,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.InvoiceNotes.Add(note);
        await _context.SaveChangesAsync();
        return ToNoteDto(note);
    }

    public async Task<int> AddNotesBulkAsync(IEnumerable<string> invoiceIds, string text, Guid userId)
    {
        var ids = invoiceIds.Distinct().ToList();
        var validIds = await _context.Invoices
            .Where(p => ids.Contains(p.InvoiceId))
            .Select(p => p.InvoiceId)
            .ToListAsync();

        var now = DateTimeOffset.UtcNow;
        foreach (var id in validIds)
        {
            _context.InvoiceNotes.Add(new InvoiceNote
            {
                Id = Guid.NewGuid(),
                InvoiceId = id,
                Text = text,
                CreatedBy = userId,
                CreatedAt = now
            });
        }
        await _context.SaveChangesAsync();
        return validIds.Count;
    }
}
