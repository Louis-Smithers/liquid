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

public record ImportQueuePageDto(
    IEnumerable<ImportQueueItemDto> Items,
    long? NextCursor  // null means no more pages
);

public record ResolveQueueDto(
    string Shortcode,
    Guid DebtorId
);

public record DebtorMappingDto(
    string RawDebtorName,
    Guid DebtorId
);

public record ResolveGroupDto(
    string ClientName,       // raw client name from queue (used to find the items)
    string Shortcode,        // real client shortcode to map to
    IEnumerable<DebtorMappingDto> DebtorMappings
);

public record ResolveGroupResultDto(
    int Resolved,
    int Skipped            // items where the debtor name had no mapping provided
);

public record DismissQueueDto(
    string? Notes
);
