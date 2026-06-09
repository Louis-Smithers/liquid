namespace Smithers.API.DTOs;

public record ImportQueueItemDto(
    long Id,           // SERIAL integer from n8n
    string? RunId,     // TEXT run identifier e.g. "run-1717000000-abc"
    string? ClientName,
    string? DebtorName,
    string? InvoiceNumber,
    string? InvoiceDate,
    decimal? Amount,
    string? AllDebtors,
    int? TotalInvoices,
    decimal? TotalAmount,
    string ReviewStatus,
    string? Notes,
    DateTimeOffset? ResolvedAt,
    DateTimeOffset? CreatedAt
);

public record ResolveQueueDto(
    string Shortcode,
    Guid DebtorId
);

public record DismissQueueDto(
    string? Notes
);
