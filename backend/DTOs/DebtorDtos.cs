namespace Smithers.API.DTOs;

public record DebtorDto(
    Guid Id,
    string Name,
    string? CadenceName,
    string? Group,
    bool Active,
    bool Dnc,
    string? Contact = null,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? Province = null,
    string? PostalCode = null,
    string? Notes = null,
    string? Language = null,
    string? PreferredContactMethod = null
);

public record CreateDebtorDto(
    string Name,
    string? CadenceName,
    string? Group,
    bool Active = true,
    bool Dnc = false,
    string? Contact = null,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? Province = null,
    string? PostalCode = null,
    string? Notes = null,
    string? Language = null,
    string? PreferredContactMethod = null
);
