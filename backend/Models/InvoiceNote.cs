using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class InvoiceNote
{
    public Guid Id { get; set; }

    [Required]
    public string InvoiceId { get; set; } = null!;
    public Invoice Invoice { get; set; } = null!;

    [Required]
    public string Text { get; set; } = null!;

    public Guid? CreatedBy { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
