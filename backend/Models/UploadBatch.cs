namespace Smithers.API.Models;

public class UploadBatch
{
    public Guid Id { get; set; }
    public Guid CreatedBy { get; set; }
    public string? ClientShortcode { get; set; }      // set once known/chosen
    public string Status { get; set; } = "Staging";    // Staging | Committed | Abandoned
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }       // CreatedAt + TTL (e.g. 1h)
    public List<StagedDocument> Documents { get; set; } = new();
}
