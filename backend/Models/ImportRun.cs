using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class ImportRun
{
    public Guid Id { get; set; }
    
    public DateTimeOffset RunDate { get; set; } = DateTimeOffset.UtcNow;
    
    public string? SourceFile { get; set; }
    
    public string Status { get; set; } = "Completed";
    
    public int RowCount { get; set; }
    
    public int Matched { get; set; }
    
    public int Unmatched { get; set; }
}
