namespace Smithers.API.DTOs;

public record OcrFieldDto(string FieldName, string? ExtractedValue, decimal Confidence);
public record OcrScanResultDto(string RawDocumentPath, OcrFieldDto[] Fields);
public record OcrConfirmDto(string RawDocumentPath, string InvoiceNumber, DateOnly InvoiceDate, decimal Amount, string ClientShortcode, Guid? DebtorId, string? NewDebtorName, bool AddToNsQueue, string? Notes);

public record OcrResultDto(
    Guid Id,
    string InvoiceId,
    string FieldName,
    string? ExtractedValue,
    decimal? Confidence,
    int PageNumber,
    decimal? BboxX,
    decimal? BboxY,
    decimal? BboxWidth,
    decimal? BboxHeight,
    string? ConfirmedValue,
    bool Reviewed,
    DateTimeOffset? ReviewedAt
);

public record UploadPdfDto(string InvoiceId);
public record ConfirmOcrValueDto(string ConfirmedValue);

public record UploadBatchDto(Guid Id, string Status, DateTimeOffset ExpiresAt, List<StagedDocDto> Documents);
public record StagedDocDto(Guid Id, string FileName, string StoragePath, string OcrStatus, ParsedFieldDto[] Fields, MatchCandidatesDto Match, string? Error);
public record ParsedFieldDto(string FieldName, string? Value, decimal Confidence, int Page, decimal? BboxX, decimal? BboxY, decimal? BboxWidth, decimal? BboxHeight);
public record ClientMatch(string Id, string Shortcode, string Name, decimal Score);
public record DebtorMatch(Guid Id, string Name, decimal Score);
public record MatchCandidatesDto(ClientMatch[] Clients, DebtorMatch[] Debtors);
public record ConfirmDocDto(string InvoiceNumber, DateOnly InvoiceDate, decimal Amount, string ClientShortcode, bool CreateClient, Guid? DebtorId, string? NewDebtorName, string? PoRef, string? Notes);
public record ConfirmResultDto(string InvoiceId, Guid? NotificationSheetId);
