namespace Smithers.API.DTOs;

public record ClientDto(
    string Shortcode, 
    string? CadenceName, 
    bool Active, 
    bool Dnc,
    string? Email = null,
    string? Phone = null,
    string? Notes = null,
    string? City = null,
    string? Province = null,
    string? PostalCode = null,
    string? Language = null,
    decimal? ReserveRate = null,
    decimal? DiscountRate = null,
    string? Address = null,
    string? Contact = null
);

public record UpdateClientDto(
    string? CadenceName, 
    bool? Active, 
    bool? Dnc,
    string? Email,
    string? Phone,
    string? Notes,
    string? City,
    string? Province,
    string? PostalCode,
    string? Language,
    decimal? ReserveRate,
    decimal? DiscountRate,
    string? Address,
    string? Contact
);

public record CreateClientDto(
    string Shortcode, 
    string? CadenceName, 
    bool Active = true, 
    bool Dnc = false,
    string? Email = null,
    string? Phone = null,
    string? Notes = null,
    string? City = null,
    string? Province = null,
    string? PostalCode = null,
    string? Language = null,
    decimal? ReserveRate = null,
    decimal? DiscountRate = null,
    string? Address = null,
    string? Contact = null
);

public record ClientSummaryAgingDto(
    decimal D30,
    decimal D60,
    decimal D90,
    decimal D120,
    decimal Over120
);

public record ClientSummaryDebtorDto(
    Guid Id,
    string Name,
    int InvoiceCount,
    decimal TotalAmount,
    ClientSummaryAgingDto Aging
);

public record ClientSummaryDto(
    decimal TotalAmount,
    int OpenCount,
    decimal VerifiedPercent,
    decimal VerifiedAmount,
    ClientSummaryAgingDto Aging,
    IEnumerable<ClientSummaryDebtorDto> Debtors
);
