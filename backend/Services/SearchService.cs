using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class SearchService : ISearchService
{
    private const int MaxResultsPerGroup = 8;

    private readonly AppDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public SearchService(AppDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<OmnibarSearchDto> SearchAsync(string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return new OmnibarSearchDto(Enumerable.Empty<SearchHitDto>(), Enumerable.Empty<SearchHitDto>());

        var term = q.Trim();
        var pattern = $"%{term}%";

        var debtorsTask = SearchDebtorsAsync(pattern);
        var clientsTask = SearchClientsAsync(pattern);

        await Task.WhenAll(debtorsTask, clientsTask);

        return new OmnibarSearchDto(debtorsTask.Result, clientsTask.Result);
    }

    private async Task<IEnumerable<SearchHitDto>> SearchDebtorsAsync(string pattern)
    {
        var query = _context.Debtors
            .Where(d => d.RedirectId == null)
            .Where(d =>
                EF.Functions.ILike(d.Name, pattern) ||
                (d.Contact != null && EF.Functions.ILike(d.Contact, pattern)) ||
                (d.Phone != null && EF.Functions.ILike(d.Phone, pattern)) ||
                (d.Email != null && EF.Functions.ILike(d.Email, pattern)));

        // Client users only see debtors reachable via their own invoices (mirrors
        // DebtorService.GetByClientAsync scoping).
        if (_currentUser.IsClient)
        {
            var debtorIds = await _context.Invoices
                .Where(p => p.LiquidClient == _currentUser.ClientShortcode)
                .Select(p => p.DebtorId)
                .Distinct()
                .ToListAsync();

            query = query.Where(d => debtorIds.Contains(d.Id));
        }

        var debtors = await query
            .OrderBy(d => d.Name)
            .Take(MaxResultsPerGroup)
            .ToListAsync();

        return debtors.Select(ToDebtorHit);
    }

    private async Task<IEnumerable<SearchHitDto>> SearchClientsAsync(string pattern)
    {
        var query = _context.Clients
            .Where(c =>
                (c.CadenceName != null && EF.Functions.ILike(c.CadenceName, pattern)) ||
                (c.Contact != null && EF.Functions.ILike(c.Contact, pattern)) ||
                (c.Phone != null && EF.Functions.ILike(c.Phone, pattern)) ||
                (c.Email != null && EF.Functions.ILike(c.Email, pattern)) ||
                EF.Functions.ILike(c.Shortcode, pattern) ||
                (c.Code != null && EF.Functions.ILike(c.Code, pattern)));

        // Client users only see their own record.
        if (_currentUser.IsClient)
            query = query.Where(c => c.Shortcode == _currentUser.ClientShortcode);

        var clients = await query
            .OrderBy(c => c.CadenceName ?? c.Shortcode)
            .Take(MaxResultsPerGroup)
            .ToListAsync();

        return clients.Select(ToClientHit);
    }

    private static SearchHitDto ToDebtorHit(Debtor d) =>
        new(d.Id.ToString(), d.Name, FirstNonEmpty(d.Contact, d.Email, d.Phone), "debtor");

    private static SearchHitDto ToClientHit(Client c)
    {
        var detail = FirstNonEmpty(c.Contact, c.Email, c.Phone);
        var subtitle = detail is null ? c.Shortcode : $"{c.Shortcode} · {detail}";
        return new(c.Shortcode, c.CadenceName ?? c.Shortcode, subtitle, "client");
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
}
