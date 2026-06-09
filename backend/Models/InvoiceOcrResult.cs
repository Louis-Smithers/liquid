using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Smithers.API.Models;

public class InvoiceOcrResult
{
    public Guid Id { get; set; }
    
    [Required]
    public string InvoiceId { get; set; } = null!;
    public Invoice Invoice { get; set; } = null!;
    
    [Required]
    public string FieldName { get; set; } = null!;
    
    public string? ExtractedValue { get; set; }
    
    public string? ConfirmedValue { get; set; }
    
    [Column(TypeName = "numeric(5,4)")]
    public decimal? Confidence { get; set; }
    
    public int PageNumber { get; set; } = 1;
    
    [Column(TypeName = "numeric(8,6)")]
    public decimal? BboxX { get; set; }
    
    [Column(TypeName = "numeric(8,6)")]
    public decimal? BboxY { get; set; }
    
    [Column(TypeName = "numeric(8,6)")]
    public decimal? BboxWidth { get; set; }
    
    [Column(TypeName = "numeric(8,6)")]
    public decimal? BboxHeight { get; set; }
    
    public bool Reviewed { get; set; } = false;
    
    public Guid? ReviewedBy { get; set; }
    
    public DateTimeOffset? ReviewedAt { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
