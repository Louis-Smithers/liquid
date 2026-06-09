using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class NotificationSheetItem
{
    public Guid Id { get; set; }
    
    public Guid NotificationSheetId { get; set; }
    public NotificationSheet NotificationSheet { get; set; } = null!;
    
    [Required]
    public string InvoiceId { get; set; } = null!;
    public Invoice Invoice { get; set; } = null!;
    
    public decimal IncludedAmount { get; set; }
    
    public decimal? OverrideInitialFee { get; set; }
    public decimal? OverrideReserveFee { get; set; }
}
