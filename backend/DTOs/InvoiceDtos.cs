namespace Smithers.API.DTOs;

public record InvoiceDto(
    string InvoiceId,
    string OriginalInvoice,
    DateOnly Date,
    string LiquidClient,
    Guid DebtorId,
    string DebtorName,
    decimal Amount,
    string Status,
    bool Archived,
    string? DocumentPath,
    DateTimeOffset CreatedTime,
    DateTimeOffset? UpdatedAt,
    string? Notes = null,
    string? ScheduleNumber = null,
    int FileCount = 0,
    bool Flagged = false,
    string? FlagReason = null,
    DateTimeOffset? FlagTimestamp = null,
    int? Terms = null,
    DateTimeOffset? ProcessedTime = null,
    bool Verified = false
);

public record InvoicePageDto(
    IEnumerable<InvoiceDto> Items,
    string? NextCursorTime,      // ISO-8601 created_time of last item
    string? NextCursorId         // invoice_id of last item
);

public record UpdateInvoiceStatusDto(string Status);

public record AgingDebtorRowDto(
    string DebtorName,
    decimal Current,
    decimal Days31To60,
    decimal Days61To90,
    decimal Over90,
    decimal Total
);

public record AgingClientReportDto(
    string Shortcode,
    string? CadenceName,
    IEnumerable<AgingDebtorRowDto> Debtors
);
