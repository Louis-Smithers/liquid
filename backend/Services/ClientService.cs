using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

public class ClientService : IClientService
{
    private readonly AppDbContext _context;

    public ClientService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ClientDto>> GetAllAsync()
    {
        return await _context.Clients
            .Select(c => new ClientDto(
                c.Shortcode, 
                c.CadenceName, 
                c.Active, 
                c.Dnc,
                c.Email, c.Phone, c.Notes, c.City, c.Province, c.PostalCode, c.Language,
                c.ReserveRate, c.DiscountRate, c.Address, c.Contact))
            .ToListAsync();
    }

    public async Task<ClientDto?> GetByShortcodeAsync(string shortcode)
    {
        var c = await _context.Clients.SingleOrDefaultAsync(c => c.Shortcode == shortcode);
        return c is null ? null : new ClientDto(
            c.Shortcode, 
            c.CadenceName, 
            c.Active, 
            c.Dnc,
            c.Email, c.Phone, c.Notes, c.City, c.Province, c.PostalCode, c.Language,
            c.ReserveRate, c.DiscountRate, c.Address, c.Contact);
    }

    public async Task<ClientDto> CreateAsync(CreateClientDto dto)
    {
        var client = new Smithers.API.Models.Client
        {
            Id = Guid.NewGuid(),
            Shortcode = dto.Shortcode,
            CadenceName = dto.CadenceName ?? "",
            Active = dto.Active,
            Dnc = dto.Dnc,
            Email = dto.Email,
            Phone = dto.Phone,
            Notes = dto.Notes,
            City = dto.City,
            Province = dto.Province,
            PostalCode = dto.PostalCode,
            Language = dto.Language,
            ReserveRate = dto.ReserveRate,
            DiscountRate = dto.DiscountRate,
            Address = dto.Address,
            Contact = dto.Contact
        };

        _context.Clients.Add(client);
        await _context.SaveChangesAsync();

        return new ClientDto(
            client.Shortcode, 
            client.CadenceName, 
            client.Active, 
            client.Dnc,
            client.Email, client.Phone, client.Notes, client.City, client.Province, client.PostalCode, client.Language,
            client.ReserveRate, client.DiscountRate, client.Address, client.Contact);
    }

    public async Task<bool> UpdateAsync(string shortcode, UpdateClientDto dto)
    {
        var client = await _context.Clients.FirstOrDefaultAsync(c => c.Shortcode == shortcode);
        if (client is null) return false;

        if (dto.CadenceName is not null) client.CadenceName = dto.CadenceName;
        if (dto.Active.HasValue) client.Active = dto.Active.Value;
        if (dto.Dnc.HasValue) client.Dnc = dto.Dnc.Value;
        if (dto.Email is not null) client.Email = dto.Email;
        if (dto.Phone is not null) client.Phone = dto.Phone;
        if (dto.Notes is not null) client.Notes = dto.Notes;
        if (dto.City is not null) client.City = dto.City;
        if (dto.Province is not null) client.Province = dto.Province;
        if (dto.PostalCode is not null) client.PostalCode = dto.PostalCode;
        if (dto.Language is not null) client.Language = dto.Language;
        if (dto.ReserveRate.HasValue) client.ReserveRate = dto.ReserveRate;
        if (dto.DiscountRate.HasValue) client.DiscountRate = dto.DiscountRate;
        if (dto.Address is not null) client.Address = dto.Address;
        if (dto.Contact is not null) client.Contact = dto.Contact;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<ClientSummaryDto?> GetSummaryAsync(string shortcode)
    {
        var client = await _context.Clients.FirstOrDefaultAsync(c => c.Shortcode == shortcode);
        if (client is null) return null;

        var includedStatuses = new[] { "Pre-Verified", "Unverified", "OA", "ON" };
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var invoices = await _context.Invoices
            .Include(p => p.Debtor)
            .Where(p => p.LiquidClient == shortcode && includedStatuses.Contains(p.Status) && !p.Archived)
            .ToListAsync();

        var totalAmount = invoices.Sum(p => p.Amount);
        var openCount = invoices.Count;
        var verifiedInvoices = invoices.Where(p => p.Verified).ToList();
        var verifiedAmount = verifiedInvoices.Sum(p => p.Amount);
        var verifiedPercent = openCount > 0 ? (decimal)verifiedInvoices.Count / openCount : 0;

        int DaysOld(Smithers.API.Models.Invoice p) => today.DayNumber - p.Date.DayNumber;

        var clientAging = new ClientSummaryAgingDto(
            invoices.Where(p => DaysOld(p) <= 30).Sum(p => p.Amount),
            invoices.Where(p => DaysOld(p) > 30 && DaysOld(p) <= 60).Sum(p => p.Amount),
            invoices.Where(p => DaysOld(p) > 60 && DaysOld(p) <= 90).Sum(p => p.Amount),
            invoices.Where(p => DaysOld(p) > 90 && DaysOld(p) <= 120).Sum(p => p.Amount),
            invoices.Where(p => DaysOld(p) > 120).Sum(p => p.Amount)
        );

        var debtors = invoices
            .GroupBy(p => p.DebtorId)
            .Select(g => new ClientSummaryDebtorDto(
                g.Key,
                g.First().Debtor.Name,
                g.Count(),
                g.Sum(p => p.Amount),
                new ClientSummaryAgingDto(
                    g.Where(p => DaysOld(p) <= 30).Sum(p => p.Amount),
                    g.Where(p => DaysOld(p) > 30 && DaysOld(p) <= 60).Sum(p => p.Amount),
                    g.Where(p => DaysOld(p) > 60 && DaysOld(p) <= 90).Sum(p => p.Amount),
                    g.Where(p => DaysOld(p) > 90 && DaysOld(p) <= 120).Sum(p => p.Amount),
                    g.Where(p => DaysOld(p) > 120).Sum(p => p.Amount)
                )
            )).ToList();

        return new ClientSummaryDto(
            totalAmount,
            openCount,
            verifiedPercent,
            verifiedAmount,
            clientAging,
            debtors
        );
    }
}
