using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

public class DebtorService : IDebtorService
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public DebtorService(AppDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    private static DebtorDto ToDto(Smithers.API.Models.Debtor d) =>
        new(d.Id, d.Name, d.CadenceName, d.Group, d.Active, d.Dnc, d.Contact, d.Email, d.Phone,
            d.Address, d.City, d.Province, d.PostalCode, d.Notes, d.Language, d.PreferredContactMethod);

    public async Task<IEnumerable<DebtorDto>> GetAllAsync()
    {
        // Client users see only debtors reachable through their own invoices
        if (_currentUser.IsClient)
            return await GetByClientAsync(_currentUser.ClientShortcode!);

        return await _context.Debtors
            .Select(d => ToDto(d))
            .ToListAsync();
    }

    public async Task<IEnumerable<DebtorDto>> GetByClientAsync(string shortcode)
    {
        if (_currentUser.IsClient && shortcode != _currentUser.ClientShortcode)
            return Enumerable.Empty<DebtorDto>();

        return await _context.Invoices
            .Where(p => p.LiquidClient == shortcode)
            .Select(p => p.Debtor)
            .Distinct()
            .Select(d => ToDto(d!))
            .ToListAsync();
    }

    public async Task<DebtorDto?> GetByIdAsync(Guid id)
    {
        if (_currentUser.IsClient)
        {
            // Verify the debtor belongs to the client's invoices
            var owned = await _context.Invoices
                .AnyAsync(p => p.DebtorId == id && p.LiquidClient == _currentUser.ClientShortcode);
            if (!owned) return null;
        }

        var d = await _context.Debtors.FindAsync(id);
        return d is null ? null : ToDto(d);
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

        return ToDto(debtor);
    }
}
