using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Smithers.API.Models;

[Index(nameof(Shortcode), IsUnique = true)]
public class Client
{
    public Guid Id { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Shortcode { get; set; } = null!;
    
    public string? CadenceName { get; set; }
    
    public bool Active { get; set; } = true;
    
    public bool Dnc { get; set; } = false;

    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? PostalCode { get; set; }
    public string? Language { get; set; }

    public decimal? ReserveRate { get; set; }
    public decimal? DiscountRate { get; set; }
    public string? Address { get; set; }
    public string? Contact { get; set; }
}
