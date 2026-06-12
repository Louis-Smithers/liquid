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
