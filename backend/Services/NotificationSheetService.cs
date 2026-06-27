using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class NotificationSheetService : INotificationSheetService
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public NotificationSheetService(AppDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IEnumerable<NotificationSheetDto>> GetHistoryByClientAsync(string shortcode)
    {
        var sheets = await _context.NotificationSheets
            .Include(s => s.Items).ThenInclude(i => i.Invoice).ThenInclude(i => i.Debtor)
            .Where(s => s.ClientShortcode == shortcode)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return sheets.Select(MapToDto);
    }

    public async Task<IEnumerable<NotificationSheetDto>> GetAllVisibleAsync(Guid userId)
    {
        var sheets = await _context.NotificationSheets
            .Include(s => s.Items).ThenInclude(i => i.Invoice).ThenInclude(i => i.Debtor)
            .Where(s => s.IsShared || s.CreatedBy == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return sheets.Select(MapToDto);
    }

    public async Task<NotificationSheetDto?> GetActiveDraftForClientAsync(string clientShortcode, Guid userId)
    {
        var sheet = await _context.NotificationSheets
            .Include(s => s.Items).ThenInclude(i => i.Invoice).ThenInclude(i => i.Debtor)
            .Where(s => s.ClientShortcode == clientShortcode && s.Status == "Draft" && (s.IsShared || s.CreatedBy == userId))
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        return sheet == null ? null : MapToDto(sheet);
    }

    public async Task<NotificationSheetDto?> GetByIdAsync(Guid id)
    {
        var sheet = await _context.NotificationSheets
            .Include(s => s.Items).ThenInclude(i => i.Invoice).ThenInclude(i => i.Debtor)
            .FirstOrDefaultAsync(s => s.Id == id);

        return sheet == null ? null : MapToDto(sheet);
    }

    public async Task<NotificationSheetDto> CreateAsync(CreateNotificationSheetDto dto, Guid userId)
    {
        var sheet = new NotificationSheet
        {
            Id = Guid.NewGuid(),
            ClientShortcode = dto.ClientShortcode,
            Status = "Draft",
            IsShared = dto.IsShared,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = userId
        };

        _context.NotificationSheets.Add(sheet);
        await _context.SaveChangesAsync();

        return MapToDto(sheet);
    }

    public async Task<NotificationSheetItemDto> AddItemAsync(Guid sheetId, AddNsQueueItemDto dto)
    {
        var sheet = await _context.NotificationSheets.FindAsync(sheetId);
        if (sheet == null) throw new ArgumentException("Sheet not found");

        var invoice = await _context.Invoices.Include(i => i.Debtor).FirstOrDefaultAsync(i => i.InvoiceId == dto.InvoiceId);
        if (invoice == null) throw new ArgumentException("Invoice not found");

        if (invoice.LiquidClient != sheet.ClientShortcode)
            throw new ArgumentException("Invoice belongs to a different client");

        var exists = await _context.NotificationSheetItems.AnyAsync(i => i.NotificationSheetId == sheetId && i.InvoiceId == dto.InvoiceId);
        if (exists) throw new ArgumentException("Invoice already in queue");

        var item = new NotificationSheetItem
        {
            Id = Guid.NewGuid(),
            NotificationSheetId = sheetId,
            InvoiceId = dto.InvoiceId,
            IncludedAmount = dto.IncludedAmount,
            OverrideInitialFee = dto.OverrideInitialFee,
            OverrideReserveFee = dto.OverrideReserveFee,
            Invoice = invoice
        };

        _context.NotificationSheetItems.Add(item);
        await _context.SaveChangesAsync();

        return new NotificationSheetItemDto
        {
            Id = item.Id,
            NotificationSheetId = item.NotificationSheetId,
            InvoiceId = item.InvoiceId,
            InvoiceNumber = invoice.OriginalInvoice,
            DebtorName = invoice.DebtorName ?? invoice.Debtor?.Name ?? "Unknown",
            Date = new DateTimeOffset(invoice.Date, TimeOnly.MinValue, TimeSpan.Zero),
            IncludedAmount = item.IncludedAmount,
            OverrideInitialFee = item.OverrideInitialFee,
            OverrideReserveFee = item.OverrideReserveFee,
            HasDocument = !string.IsNullOrEmpty(invoice.DocumentPath)
        };
    }

    public async Task<bool> RemoveItemAsync(Guid sheetId, Guid itemId)
    {
        var item = await _context.NotificationSheetItems.FirstOrDefaultAsync(i => i.NotificationSheetId == sheetId && i.Id == itemId);
        if (item == null) return false;

        _context.NotificationSheetItems.Remove(item);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateAsync(Guid sheetId, UpdateNotificationSheetDto dto, Guid userId)
    {
        var sheet = await _context.NotificationSheets.FindAsync(sheetId);
        if (sheet == null) return false;

        if (dto.IsShared.HasValue) sheet.IsShared = dto.IsShared.Value;
        if (dto.Status != null) sheet.Status = dto.Status;
        if (dto.Notes != null) sheet.Notes = dto.Notes;
        if (dto.InitialFeePercent.HasValue) sheet.InitialFeePercent = dto.InitialFeePercent.Value;
        if (dto.ReserveFeePercent.HasValue) sheet.ReserveFeePercent = dto.ReserveFeePercent.Value;
        if (dto.OtherFee.HasValue) sheet.OtherFee = dto.OtherFee.Value;
        if (dto.CashReservesToRelease.HasValue) sheet.CashReservesToRelease = dto.CashReservesToRelease.Value;
        if (dto.ReservesToHoldBack.HasValue) sheet.ReservesToHoldBack = dto.ReservesToHoldBack.Value;
        if (dto.OtherAdjustments.HasValue) sheet.OtherAdjustments = dto.OtherAdjustments.Value;
        if (dto.AdvanceAmount.HasValue) sheet.AdvanceAmount = dto.AdvanceAmount.Value;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid sheetId, Guid userId)
    {
        var sheet = await _context.NotificationSheets.FindAsync(sheetId);
        if (sheet == null) return false;

        if (sheet.CreatedBy != userId) throw new UnauthorizedAccessException("Only the creator can delete this sheet.");
        if (sheet.Status != "Draft") throw new InvalidOperationException("Only drafts can be deleted.");

        _context.NotificationSheets.Remove(sheet);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<int> GetDraftItemCountAsync(Guid userId)
    {
        return await _context.NotificationSheets
            .Where(s => s.Status == "Draft" && (s.IsShared || s.CreatedBy == userId))
            .SelectMany(s => s.Items)
            .CountAsync();
    }

    public async Task<NotificationSheetDto> GetOrCreateClientDraftAsync()
    {
        var shortcode = _currentUser.ClientShortcode
            ?? throw new UnauthorizedAccessException("No client shortcode on token.");

        var sheet = await _context.NotificationSheets
            .Include(s => s.Items).ThenInclude(i => i.Invoice).ThenInclude(i => i.Debtor)
            .Where(s => s.ClientShortcode == shortcode && s.Status == "Draft")
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        if (sheet != null) return MapToDto(sheet);

        sheet = new NotificationSheet
        {
            Id = Guid.NewGuid(),
            ClientShortcode = shortcode,
            Status = "Draft",
            IsShared = false,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.NotificationSheets.Add(sheet);
        await _context.SaveChangesAsync();
        return MapToDto(sheet);
    }

    public async Task<NotificationSheetItemDto> ClientAddItemAsync(string invoiceId, decimal includedAmount)
    {
        var shortcode = _currentUser.ClientShortcode
            ?? throw new UnauthorizedAccessException("No client shortcode on token.");

        var invoice = await _context.Invoices.Include(i => i.Debtor).FirstOrDefaultAsync(i => i.InvoiceId == invoiceId)
            ?? throw new ArgumentException("Invoice not found.");
        if (invoice.LiquidClient != shortcode)
            throw new UnauthorizedAccessException("Invoice does not belong to your account.");

        var draft = await GetOrCreateClientDraftAsync();
        var sheetId = draft.Id;

        var exists = await _context.NotificationSheetItems.AnyAsync(i => i.NotificationSheetId == sheetId && i.InvoiceId == invoiceId);
        if (exists) throw new ArgumentException("Invoice already in queue.");

        var item = new NotificationSheetItem
        {
            Id = Guid.NewGuid(),
            NotificationSheetId = sheetId,
            InvoiceId = invoiceId,
            IncludedAmount = includedAmount,
            Invoice = invoice
        };
        _context.NotificationSheetItems.Add(item);
        await _context.SaveChangesAsync();

        return new NotificationSheetItemDto
        {
            Id = item.Id,
            NotificationSheetId = item.NotificationSheetId,
            InvoiceId = item.InvoiceId,
            InvoiceNumber = invoice.OriginalInvoice,
            DebtorName = invoice.DebtorName ?? invoice.Debtor?.Name ?? "Unknown",
            Date = new DateTimeOffset(invoice.Date, TimeOnly.MinValue, TimeSpan.Zero),
            IncludedAmount = item.IncludedAmount,
            HasDocument = !string.IsNullOrEmpty(invoice.DocumentPath)
        };
    }

    public async Task<bool> ClientRemoveItemAsync(Guid sheetId, Guid itemId)
    {
        var shortcode = _currentUser.ClientShortcode
            ?? throw new UnauthorizedAccessException("No client shortcode on token.");

        var sheet = await _context.NotificationSheets.FindAsync(sheetId);
        if (sheet == null || sheet.ClientShortcode != shortcode) return false;

        var item = await _context.NotificationSheetItems.FirstOrDefaultAsync(i => i.NotificationSheetId == sheetId && i.Id == itemId);
        if (item == null) return false;

        _context.NotificationSheetItems.Remove(item);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ClientSubmitForReviewAsync()
    {
        var shortcode = _currentUser.ClientShortcode
            ?? throw new UnauthorizedAccessException("No client shortcode on token.");

        var sheet = await _context.NotificationSheets
            .Where(s => s.ClientShortcode == shortcode && s.Status == "Draft")
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        if (sheet == null) return false;
        if (!await _context.NotificationSheetItems.AnyAsync(i => i.NotificationSheetId == sheet.Id))
            throw new InvalidOperationException("Cannot submit an empty queue.");

        sheet.SubmittedForReviewByClient = true;
        await _context.SaveChangesAsync();
        return true;
    }

    internal static NotificationSheetDto MapToDto(NotificationSheet sheet)
    {
        var totalAmount = sheet.Items.Sum(i => i.IncludedAmount);
        var itemCount = sheet.Items.Count;
        var displayId = sheet.Id.ToString()[..8];
        var displayName = $"{sheet.ClientShortcode} - {sheet.CreatedAt:yyyy-MM-dd} - {totalAmount:C0} - {displayId}";

        return new NotificationSheetDto
        {
            Id = sheet.Id,
            ClientShortcode = sheet.ClientShortcode,
            Status = sheet.Status,
            IsShared = sheet.IsShared,
            CreatedAt = sheet.CreatedAt,
            CreatedBy = sheet.CreatedBy,
            DisplayName = displayName,
            TotalAmount = totalAmount,
            ItemCount = itemCount,
            InitialFeePercent = sheet.InitialFeePercent,
            ReserveFeePercent = sheet.ReserveFeePercent,
            TotalFee = sheet.TotalFee,
            TotalReserve = sheet.TotalReserve,
            OtherFee = sheet.OtherFee,
            CashReservesToRelease = sheet.CashReservesToRelease,
            ReservesToHoldBack = sheet.ReservesToHoldBack,
            OtherAdjustments = sheet.OtherAdjustments,
            AdvanceAmount = sheet.AdvanceAmount,
            Notes = sheet.Notes,
            SubmittedForReviewByClient = sheet.SubmittedForReviewByClient,
            Items = sheet.Items.Select(i => new NotificationSheetItemDto
            {
                Id = i.Id,
                NotificationSheetId = i.NotificationSheetId,
                InvoiceId = i.InvoiceId,
                InvoiceNumber = i.Invoice?.OriginalInvoice ?? "",
                DebtorName = i.Invoice?.DebtorName ?? i.Invoice?.Debtor?.Name ?? "",
                Date = i.Invoice != null ? new DateTimeOffset(i.Invoice.Date, TimeOnly.MinValue, TimeSpan.Zero) : DateTimeOffset.MinValue,
                IncludedAmount = i.IncludedAmount,
                OverrideInitialFee = i.OverrideInitialFee,
                OverrideReserveFee = i.OverrideReserveFee,
                HasDocument = i.Invoice != null && !string.IsNullOrEmpty(i.Invoice.DocumentPath)
            }).ToList(),
            GcsNsObjectPath = sheet.GcsNsObjectPath,
            GcsIntakeObjectPath = sheet.GcsIntakeObjectPath
        };
    }
}
