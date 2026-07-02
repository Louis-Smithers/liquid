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
            d.Address, d.City, d.Province, d.PostalCode, d.Notes, d.Language, d.PreferredContactMethod,
            d.RedirectId, d.Redirect?.Name);

    public async Task<IEnumerable<DebtorDto>> GetAllAsync()
    {
        // Client users see only debtors reachable through their own invoices
        if (_currentUser.IsClient)
            return await GetByClientAsync(_currentUser.ClientShortcode!);

        return await _context.Debtors
            .Include(d => d.Redirect)
            .Select(d => ToDto(d))
            .ToListAsync();
    }

    public async Task<IEnumerable<DebtorDto>> GetByClientAsync(string shortcode)
    {
        if (_currentUser.IsClient && shortcode != _currentUser.ClientShortcode)
            return Enumerable.Empty<DebtorDto>();

        var debtorIds = await _context.Invoices
            .Where(p => p.LiquidClient == shortcode)
            .Select(p => p.DebtorId)
            .Distinct()
            .ToListAsync();

        return await _context.Debtors
            .Include(d => d.Redirect)
            .Where(d => debtorIds.Contains(d.Id))
            .Select(d => ToDto(d))
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

        var d = await _context.Debtors.Include(d => d.Redirect).FirstOrDefaultAsync(d => d.Id == id);
        return d is null ? null : ToDto(d);
    }

    public async Task<IEnumerable<DebtorClientDto>?> GetClientsForDebtorAsync(Guid debtorId)
    {
        var debtorExists = await _context.Debtors.AnyAsync(d => d.Id == debtorId);
        if (!debtorExists) return null;

        var query = _context.Invoices
            .Where(p => p.DebtorId == debtorId);

        if (_currentUser.IsClient)
            query = query.Where(p => p.LiquidClient == _currentUser.ClientShortcode);

        var groupedStats = await query
            .GroupBy(p => p.LiquidClient)
            .Select(g => new
            {
                Shortcode = g.Key,
                InvoiceCount = g.Count(),
                TotalAmount = g.Sum(p => p.Amount)
            })
            .ToListAsync();

        var clientCodes = groupedStats.Select(s => s.Shortcode).ToList();
        var clients = await _context.Clients
            .Where(c => clientCodes.Contains(c.Shortcode))
            .ToListAsync();

        return groupedStats
            .Join(clients,
                g => g.Shortcode,
                c => c.Shortcode,
                (g, c) => new DebtorClientDto(c.Shortcode, c.CadenceName, g.InvoiceCount, g.TotalAmount))
            .OrderByDescending(d => d.TotalAmount);
    }

    // Resolves a candidate canonical debtor to its ultimate target, following redirect chains
    // and collapsing them to a single hop (mirrors OldDbExplorer/Migrate.cs ResolveRedirectTarget).
    // Returns null if the walk detects a cycle back to the original alias (which the caller must
    // treat as a rejection, not as "no redirect").
    private async Task<Guid?> ResolveUltimateTargetAsync(Guid aliasId, Guid canonicalId)
    {
        var visited = new HashSet<Guid> { aliasId };
        var current = canonicalId;

        while (true)
        {
            if (!visited.Add(current))
                return null; // cycle detected

            var currentDebtor = await _context.Debtors
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == current);

            if (currentDebtor is null) return null; // canonical target doesn't exist
            if (currentDebtor.RedirectId is null) return current; // resolved to a non-redirected debtor

            current = currentDebtor.RedirectId.Value;
        }
    }

    public async Task<(bool Success, string? Error, DebtorDto? Result)> MergeAsync(Guid id, Guid canonicalId, Guid performedBy)
    {
        if (id == canonicalId)
            return (false, "A debtor cannot be merged into itself.", null);

        var alias = await _context.Debtors.FirstOrDefaultAsync(d => d.Id == id);
        if (alias is null)
            return (false, "Debtor not found.", null);

        var canonicalExists = await _context.Debtors.AnyAsync(d => d.Id == canonicalId);
        if (!canonicalExists)
            return (false, "Canonical debtor not found.", null);

        // Resolve to the ultimate target so we never create >1-hop chains, and detect cycles
        // (e.g. merging A -> B when B (directly or transitively) already redirects to A).
        var ultimateTargetId = await ResolveUltimateTargetAsync(id, canonicalId);
        if (ultimateTargetId is null)
            return (false, "This merge would create a cycle or the canonical debtor could not be resolved.", null);

        if (ultimateTargetId == id)
            return (false, "This merge would create a cycle.", null);

        var canonical = await _context.Debtors.FirstOrDefaultAsync(d => d.Id == ultimateTargetId);
        if (canonical is null)
            return (false, "Canonical debtor not found.", null);

        // Snapshot the names before any mutation for the audit log (alias.Name isn't changed
        // by the merge, but we read it explicitly here to be clear about intent).
        var aliasName = alias.Name;
        var canonicalName = canonical.Name;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            alias.RedirectId = canonical.Id;

            var invoices = await _context.Invoices.Where(p => p.DebtorId == id).ToListAsync();
            foreach (var inv in invoices)
            {
                inv.DebtorId = canonical.Id;
                inv.DebtorName = canonical.Name;
                inv.UpdatedAt = DateTimeOffset.UtcNow;
            }

            // Any debtor that was pointing at the alias as ITS canonical target should now be
            // repointed straight at the ultimate target too, keeping every chain exactly 1 hop.
            var pointingAtAlias = await _context.Debtors.Where(d => d.RedirectId == id).ToListAsync();
            foreach (var d in pointingAtAlias)
                d.RedirectId = canonical.Id;

            _context.DebtorMergeAudits.Add(new Smithers.API.Models.DebtorMergeAudit
            {
                Id = Guid.NewGuid(),
                AliasId = alias.Id,
                AliasName = aliasName,
                RequestedCanonicalId = canonicalId,
                CanonicalId = canonical.Id,
                CanonicalName = canonicalName,
                InvoicesRepointed = invoices.Count,
                AliasesRepointed = pointingAtAlias.Count,
                PerformedBy = performedBy,
                PerformedAt = DateTimeOffset.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        var refreshed = await _context.Debtors.Include(d => d.Redirect).FirstAsync(d => d.Id == id);
        return (true, null, ToDto(refreshed));
    }

    public async Task<IEnumerable<DebtorMergeAuditDto>> GetMergeHistoryAsync(Guid id)
    {
        return await _context.DebtorMergeAudits
            .Where(a => a.AliasId == id || a.CanonicalId == id)
            .OrderByDescending(a => a.PerformedAt)
            .Select(a => new DebtorMergeAuditDto(
                a.Id, a.AliasId, a.AliasName, a.RequestedCanonicalId, a.CanonicalId, a.CanonicalName,
                a.InvoicesRepointed, a.AliasesRepointed, a.PerformedBy, a.PerformedAt))
            .ToListAsync();
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
