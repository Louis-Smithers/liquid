using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class ImportQueueService : IImportQueueService
{
    private readonly AppDbContext _context;

    public ImportQueueService(AppDbContext context)
    {
        _context = context;
    }

    private static ImportQueueItemDto ToDto(ImportReviewQueue q) => new(
        q.Id, q.RunId, q.ClientName, q.DebtorName,
        q.InvoiceNumber, q.InvoiceDate, q.Amount,
        q.AllDebtors, q.TotalInvoices, q.TotalAmount,
        q.ReviewStatus, q.Notes, q.ResolvedAt, q.CreatedAt
    );

    public async Task<ImportQueuePageDto> GetPendingAsync(long? cursor, int pageSize)
    {
        var query = _context.ImportReviewQueue
            .Where(q => q.ReviewStatus == "Pending");

        // Cursor: fetch items with id < cursor (descending id order)
        if (cursor.HasValue)
            query = query.Where(q => q.Id < cursor.Value);

        var items = await query
            .OrderByDescending(q => q.Id)
            .Take(pageSize + 1)
            .Select(q => ToDto(q))
            .ToListAsync();

        long? nextCursor = null;
        if (items.Count > pageSize)
        {
            items.RemoveAt(items.Count - 1);
            nextCursor = items[^1].Id;
        }

        return new ImportQueuePageDto(items, nextCursor);
    }

    public async Task<(bool Success, string? Error, InvoiceDto? CreatedInvoice)> ResolveAsync(
        long id, ResolveQueueDto dto, Guid resolvedBy)
    {
        var queueItem = await _context.ImportReviewQueue.FindAsync(id);
        if (queueItem is null || queueItem.ReviewStatus != "Pending")
            return (false, "Invalid or already-processed queue item.", null);

        var client = await _context.Clients.FirstOrDefaultAsync(c => c.Shortcode == dto.Shortcode);
        if (client is null) return (false, "Client not found.", null);

        var debtor = await _context.Debtors.FindAsync(dto.DebtorId);
        if (debtor is null) return (false, "Debtor not found.", null);

        // Parse the invoice date from the raw string n8n wrote (may be ISO or Excel serial)
        var invoiceDate = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!string.IsNullOrEmpty(queueItem.InvoiceDate) &&
            DateOnly.TryParse(queueItem.InvoiceDate, out var parsed))
            invoiceDate = parsed;

        var invoice = new Invoice
        {
            InvoiceId = $"{dto.Shortcode}_{queueItem.InvoiceNumber}",
            OriginalInvoice = queueItem.InvoiceNumber ?? "UNKNOWN",
            Date = invoiceDate,
            DebtorId = dto.DebtorId,
            DebtorName = debtor.Name,
            LiquidClient = dto.Shortcode,
            Amount = queueItem.Amount ?? 0,
            Status = "Pre-Verified"
        };

        _context.Invoices.Add(invoice);

        queueItem.ReviewStatus = "Resolved";
        queueItem.ResolvedBy = resolvedBy;
        queueItem.ResolvedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        var created = new InvoiceDto(
            invoice.InvoiceId, invoice.OriginalInvoice, invoice.Date,
            invoice.LiquidClient, invoice.DebtorId, debtor.Name,
            invoice.Amount, invoice.Status, invoice.Archived,
            invoice.DocumentPath, invoice.CreatedTime, invoice.UpdatedAt
        );

        return (true, null, created);
    }

    public async Task<(bool Success, string? Error, ResolveGroupResultDto? Result)> ResolveGroupAsync(
        ResolveGroupDto dto, Guid resolvedBy)
    {
        // Resolve the target client: either an existing shortcode or a new client to create.
        string shortcode;
        if (dto.NewClient is not null)
        {
            var newShortcode = dto.NewClient.Shortcode?.Trim();
            if (string.IsNullOrEmpty(newShortcode))
                return (false, "New client shortcode is required.", null);

            if (await _context.Clients.AnyAsync(c => c.Shortcode == newShortcode))
                return (false, $"A client with shortcode '{newShortcode}' already exists.", null);

            _context.Clients.Add(new Smithers.API.Models.Client
            {
                Id = Guid.NewGuid(),
                Shortcode = newShortcode,
                CadenceName = dto.NewClient.CadenceName ?? "",
                Active = true,
                Dnc = false
            });
            shortcode = newShortcode;
        }
        else
        {
            if (string.IsNullOrEmpty(dto.Shortcode))
                return (false, "Select a client or create a new one.", null);

            var client = await _context.Clients.FirstOrDefaultAsync(c => c.Shortcode == dto.Shortcode);
            if (client is null) return (false, "Client not found.", null);
            shortcode = dto.Shortcode;
        }

        // Build debtor lookup from the existing-debtor mappings
        var existingDebtorIds = dto.DebtorMappings
            .Where(m => m.DebtorId.HasValue)
            .Select(m => m.DebtorId!.Value)
            .Distinct()
            .ToList();
        var debtors = await _context.Debtors
            .Where(d => existingDebtorIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id);

        // Create any new debtors requested (mapping has a NewDebtorName and no DebtorId),
        // keyed by raw name so each mapping resolves to the debtor it asked for.
        var newDebtorByRawName = new Dictionary<string, Smithers.API.Models.Debtor>();
        foreach (var mapping in dto.DebtorMappings)
        {
            if (mapping.DebtorId.HasValue) continue;
            var newName = mapping.NewDebtorName?.Trim();
            if (string.IsNullOrEmpty(newName)) continue;

            var debtor = new Smithers.API.Models.Debtor
            {
                Id = Guid.NewGuid(),
                Name = newName,
                CadenceName = newName,
                Group = "Review",
                Active = true,
                Dnc = false
            };
            _context.Debtors.Add(debtor);
            newDebtorByRawName[mapping.RawDebtorName.Trim().ToLower()] = debtor;
        }

        var mappingByRawName = dto.DebtorMappings
            .ToDictionary(m => m.RawDebtorName.Trim().ToLower(), m => m);

        var items = await _context.ImportReviewQueue
            .Where(q => q.ClientName == dto.ClientName && q.ReviewStatus == "Pending")
            .ToListAsync();

        var now = DateTimeOffset.UtcNow;
        int resolved = 0, skipped = 0;

        foreach (var item in items)
        {
            var rawDebtor = (item.DebtorName ?? "").Trim().ToLower();
            if (!mappingByRawName.TryGetValue(rawDebtor, out var mapping))
            {
                skipped++;
                continue;
            }

            // Resolve the effective debtor: existing one, or a freshly-created one.
            Smithers.API.Models.Debtor? debtor = null;
            if (mapping.DebtorId.HasValue)
                debtors.TryGetValue(mapping.DebtorId.Value, out debtor);
            else
                newDebtorByRawName.TryGetValue(rawDebtor, out debtor);

            if (debtor is null)
            {
                skipped++;
                continue;
            }

            var invoiceDate = DateOnly.FromDateTime(DateTime.UtcNow);
            if (!string.IsNullOrEmpty(item.InvoiceDate) &&
                DateOnly.TryParse(item.InvoiceDate, out var parsed))
                invoiceDate = parsed;

            // Deduplicate: skip if invoice already exists
            var invoiceId = $"{shortcode}_{item.InvoiceNumber}";
            if (await _context.Invoices.AnyAsync(i => i.InvoiceId == invoiceId))
            {
                item.ReviewStatus = "Resolved";
                item.ResolvedBy = resolvedBy;
                item.ResolvedAt = now;
                resolved++;
                continue;
            }

            _context.Invoices.Add(new Invoice
            {
                InvoiceId = invoiceId,
                OriginalInvoice = item.InvoiceNumber ?? "UNKNOWN",
                Date = invoiceDate,
                DebtorId = debtor.Id,
                DebtorName = debtor.Name,
                LiquidClient = shortcode,
                Amount = item.Amount ?? 0,
                Status = "Pre-Verified"
            });

            item.ReviewStatus = "Resolved";
            item.ResolvedBy = resolvedBy;
            item.ResolvedAt = now;
            resolved++;
        }

        await _context.SaveChangesAsync();
        return (true, null, new ResolveGroupResultDto(resolved, skipped));
    }

    public async Task<(bool Success, string? Error)> DismissAsync(
        long id, DismissQueueDto dto, Guid resolvedBy)
    {
        var queueItem = await _context.ImportReviewQueue.FindAsync(id);
        if (queueItem is null || queueItem.ReviewStatus != "Pending")
            return (false, "Invalid or already-processed queue item.");

        queueItem.ReviewStatus = "Dismissed";
        queueItem.ResolvedBy = resolvedBy;
        queueItem.ResolvedAt = DateTimeOffset.UtcNow;
        if (!string.IsNullOrEmpty(dto.Notes))
            queueItem.Notes = dto.Notes;

        await _context.SaveChangesAsync();
        return (true, null);
    }
}
