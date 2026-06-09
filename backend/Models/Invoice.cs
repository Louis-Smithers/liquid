using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Smithers.API.Models;

/// <summary>
/// Represents a purchased/factored invoice — the central table in Smithers.
/// PK is a composite string: '{shortcode}_{original_invoice_number}'
/// The 'debtor_name' column is a denormalized snapshot written by n8n at import time
/// (since n8n upserts inline; the FK debtor_id carries the relational truth).
/// </summary>
[Index(nameof(LiquidClient), nameof(OriginalInvoice), IsUnique = true)]
public class Invoice
{
    [Key]
    public string InvoiceId { get; set; } = null!; // '{shortcode}_{original_invoice}'

    [Required]
    public string OriginalInvoice { get; set; } = null!;

    public DateOnly Date { get; set; }

    public Guid DebtorId { get; set; }
    public Debtor Debtor { get; set; } = null!;

    /// <summary>Denormalized debtor name snapshot written by n8n at import. Use Debtor.Name for display.</summary>
    public string? DebtorName { get; set; }

    [Required]
    public string LiquidClient { get; set; } = null!;
    public Client Client { get; set; } = null!;

    public decimal Amount { get; set; }

    [Required]
    public string Status { get; set; } = null!;

    public bool Archived { get; set; } = false;

    public string? DocumentPath { get; set; }

    public DateTimeOffset CreatedTime { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? UpdatedAt { get; set; }

    public string? Notes { get; set; }
    public string? ScheduleNumber { get; set; }
    public int FileCount { get; set; } = 0;
    public bool Flagged { get; set; } = false;
    public string? FlagReason { get; set; }
    public DateTimeOffset? FlagTimestamp { get; set; }
    public int? Terms { get; set; }
    public DateTimeOffset? ProcessedTime { get; set; }
    public bool Verified { get; set; } = false;
}
