using System.ComponentModel.DataAnnotations;

namespace Smithers.API.Models;

public class Debtor
{
    public Guid Id { get; set; }
    
    [Required]
    public string Name { get; set; } = null!;
    
    public string? CadenceName { get; set; }
    
    public string Group { get; set; } = "Review";
    
    public Guid? RedirectId { get; set; }
    public Debtor? Redirect { get; set; }
    
    public bool Active { get; set; } = true;
    
    public bool Dnc { get; set; } = false;
    public string? Contact { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? PostalCode { get; set; }
    public string? Notes { get; set; }
    public string? Language { get; set; }
    public string? PreferredContactMethod { get; set; }
}
