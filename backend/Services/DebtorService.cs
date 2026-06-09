using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

public class DebtorService : IDebtorService
{
    private readonly AppDbContext _context;

    public DebtorService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<DebtorDto>> GetAllAsync()
    {
        return await _context.Debtors
            .Select(d => new DebtorDto(d.Id, d.Name, d.CadenceName, d.Group, d.Active, d.Dnc, d.Contact, d.Email, d.Phone, d.Address, d.City, d.Province, d.PostalCode, d.Notes, d.Language, d.PreferredContactMethod))
            .ToListAsync();
    }

    public async Task<IEnumerable<DebtorDto>> GetByClientAsync(string shortcode)
    {
        // Debtors that have at least one purchased invoice for this client
        return await _context.Invoices
            .Where(p => p.LiquidClient == shortcode)
            .Select(p => p.Debtor)
            .Distinct()
            .Select(d => new DebtorDto(d!.Id, d.Name, d.CadenceName, d.Group, d.Active, d.Dnc, d.Contact, d.Email, d.Phone, d.Address, d.City, d.Province, d.PostalCode, d.Notes, d.Language, d.PreferredContactMethod))
            .ToListAsync();
    }

    public async Task<DebtorDto?> GetByIdAsync(Guid id)
    {
        var d = await _context.Debtors.FindAsync(id);
        return d is null ? null : new DebtorDto(d.Id, d.Name, d.CadenceName, d.Group, d.Active, d.Dnc, d.Contact, d.Email, d.Phone, d.Address, d.City, d.Province, d.PostalCode, d.Notes, d.Language, d.PreferredContactMethod);
    }

    public async Task<DebtorDto> CreateAsync(CreateDebtorDto dto)
    {
        var debtor = new Smithers.API.Models.Debtor
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            CadenceName = dto.CadenceName,
            Group = dto.Group ?? "Review",
            Active = dto.Active,
            Dnc = dto.Dnc,
            Contact = dto.Contact,
            Email = dto.Email,
            Phone = dto.Phone,
            Address = dto.Address,
            City = dto.City,
            Province = dto.Province,
            PostalCode = dto.PostalCode,
            Notes = dto.Notes,
            Language = dto.Language,
            PreferredContactMethod = dto.PreferredContactMethod
        };

        _context.Debtors.Add(debtor);
        await _context.SaveChangesAsync();

        return new DebtorDto(debtor.Id, debtor.Name, debtor.CadenceName, debtor.Group, debtor.Active, debtor.Dnc, debtor.Contact, debtor.Email, debtor.Phone, debtor.Address, debtor.City, debtor.Province, debtor.PostalCode, debtor.Notes, debtor.Language, debtor.PreferredContactMethod);
    }
}
