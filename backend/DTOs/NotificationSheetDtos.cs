using System.ComponentModel.DataAnnotations;

namespace Smithers.API.DTOs;

public class NotificationSheetDto
{
    public Guid Id { get; set; }
    public string ClientShortcode { get; set; } = null!;
    public string Status { get; set; } = null!;
    public bool IsShared { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    
    public string DisplayName { get; set; } = null!;
    public decimal TotalAmount { get; set; }
    public int ItemCount { get; set; }

    public decimal InitialFeePercent { get; set; }
    public decimal ReserveFeePercent { get; set; }
    public decimal TotalFee { get; set; }
    public decimal TotalReserve { get; set; }
    public decimal OtherFee { get; set; }
    public decimal CashReservesToRelease { get; set; }
    public decimal ReservesToHoldBack { get; set; }
    public decimal OtherAdjustments { get; set; }
    public decimal AdvanceAmount { get; set; }
    public string? Notes { get; set; }

    public List<NotificationSheetItemDto> Items { get; set; } = new();
}

public class NotificationSheetItemDto
{
    public Guid Id { get; set; }
    public Guid NotificationSheetId { get; set; }
    public string InvoiceId { get; set; } = null!;
    public string InvoiceNumber { get; set; } = null!;
    public string DebtorName { get; set; } = null!;
    public DateTimeOffset Date { get; set; }
    public decimal IncludedAmount { get; set; }
    public decimal? OverrideInitialFee { get; set; }
    public decimal? OverrideReserveFee { get; set; }
}

public class CreateNotificationSheetDto
{
    [Required]
    public string ClientShortcode { get; set; } = null!;
    public bool IsShared { get; set; } = true;
}

public class AddNsQueueItemDto
{
    [Required]
    public string InvoiceId { get; set; } = null!;
    public decimal IncludedAmount { get; set; }
    public decimal? OverrideInitialFee { get; set; }
    public decimal? OverrideReserveFee { get; set; }
}

public class UpdateNotificationSheetDto
{
    public bool? IsShared { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }

    public decimal? InitialFeePercent { get; set; }
    public decimal? ReserveFeePercent { get; set; }
    public decimal? OtherFee { get; set; }
    public decimal? CashReservesToRelease { get; set; }
    public decimal? ReservesToHoldBack { get; set; }
    public decimal? OtherAdjustments { get; set; }
    public decimal? AdvanceAmount { get; set; }
}
