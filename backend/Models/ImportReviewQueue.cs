namespace Smithers.API.Models;

/// <summary>
/// Holds invoice rows from the n8n import that could NOT be matched to a known client.
/// n8n inserts these using:
///   INSERT INTO import_review_queue
///     (run_id, run_timestamp, client_name, debtor_name, invoice_number, invoice_date,
///      amount, all_debtors, total_invoices, total_amount)
///
/// Schema deliberately matches what n8n writes — run_id is TEXT (not a UUID FK),
/// and id is an auto-increment integer (SERIAL), not a UUID.
/// </summary>
public class ImportReviewQueue
{
    /// <summary>Auto-increment integer PK — matches n8n's CREATE TABLE IF NOT EXISTS definition.</summary>
    public long Id { get; set; }

    /// <summary>n8n run identifier string e.g. "run-1717000000000-abc123de".</summary>
    public string RunId { get; set; } = null!;

    /// <summary>ISO timestamp of when the n8n run executed.</summary>
    public DateTimeOffset RunTimestamp { get; set; }

    /// <summary>Raw client name from the Excel report that did not match any known client.</summary>
    public string ClientName { get; set; } = null!;

    /// <summary>Raw debtor name from the Excel report.</summary>
    public string? DebtorName { get; set; }

    /// <summary>Raw invoice number from the Excel report.</summary>
    public string? InvoiceNumber { get; set; }

    /// <summary>Raw date string from the Excel report (may be an Excel serial or ISO string).</summary>
    public string? InvoiceDate { get; set; }

    /// <summary>Invoice amount from the Excel report.</summary>
    public decimal? Amount { get; set; }

    /// <summary>Comma-separated list of all debtor names seen under this unknown client in the run.</summary>
    public string? AllDebtors { get; set; }

    /// <summary>Total number of invoices for this unknown client in the run.</summary>
    public int? TotalInvoices { get; set; }

    /// <summary>Total CAD amount for this unknown client in the run.</summary>
    public decimal? TotalAmount { get; set; }

    /// <summary>Review status: Pending | Resolved | Dismissed.</summary>
    public string ReviewStatus { get; set; } = "Pending";

    /// <summary>Human-entered notes when resolving or dismissing.</summary>
    public string? Notes { get; set; }

    /// <summary>Supabase user ID of the ops person who resolved/dismissed this item.</summary>
    public Guid? ResolvedBy { get; set; }

    public DateTimeOffset? ResolvedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
