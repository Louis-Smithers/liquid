using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class NotificationSheet
{
    public Guid Id { get; set; }
    
    [Required]
    public string ClientShortcode { get; set; } = null!;
    public Client Client { get; set; } = null!;
    
    public string Status { get; set; } = "Draft";
    public bool IsShared { get; set; } = true;
    
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? CreatedBy { get; set; }

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
    
    public ICollection<NotificationSheetItem> Items { get; set; } = new List<NotificationSheetItem>();
}
