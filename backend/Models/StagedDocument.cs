namespace Smithers.API.Models;

public class StagedDocument
{
    public Guid Id { get; set; }
    public Guid BatchId { get; set; }
    public UploadBatch Batch { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string StoragePath { get; set; } = null!;   // invoices-staging/{batchId}/{file}
    public string OcrStatus { get; set; } = "Pending";  // Pending | Processing | Ready | Failed
    public string? RawText { get; set; }                // full OCR text dump
    public string? ParsedFieldsJson { get; set; }       // serialized parsed fields + bbox + confidence
    public string? MatchJson { get; set; }              // client/debtor match candidates
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
