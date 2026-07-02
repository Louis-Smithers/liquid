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
    string? PreferredContactMethod = null,
    Guid? RedirectId = null,
    string? RedirectName = null
);

public record MergeDebtorDto(Guid CanonicalId);

public record DebtorMergeAuditDto(
    Guid Id,
    Guid AliasId,
    string AliasName,
    Guid RequestedCanonicalId,
    Guid CanonicalId,
    string CanonicalName,
    int InvoicesRepointed,
    int AliasesRepointed,
    Guid PerformedBy,
    DateTimeOffset PerformedAt
);

public record DebtorClientDto(
    string Shortcode,
    string? CadenceName,
    int InvoiceCount,
    decimal TotalAmount
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
