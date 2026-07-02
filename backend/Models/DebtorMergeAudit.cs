namespace Smithers.API.Models;

/// <summary>
/// Lightweight audit trail for the debtor-merge action (see DebtorService.MergeAsync).
/// Deliberately has no FKs/navigation properties — mirrors ImportReviewQueue — so the
/// log survives future debtor edits/deletes and always reflects the state at merge time.
/// </summary>
public class DebtorMergeAudit
{
    public Guid Id { get; set; }

    /// <summary>The debtor that was merged away (now redirects). Plain id, no FK.</summary>
    public Guid AliasId { get; set; }

    /// <summary>Snapshot of the alias debtor's name at merge time.</summary>
    public string AliasName { get; set; } = null!;

    /// <summary>The canonical id the user picked, before chain resolution.</summary>
    public Guid RequestedCanonicalId { get; set; }

    /// <summary>The ultimate target after ResolveUltimateTargetAsync. Plain id, no FK.</summary>
    public Guid CanonicalId { get; set; }

    /// <summary>Snapshot of the canonical debtor's name at merge time.</summary>
    public string CanonicalName { get; set; } = null!;

    /// <summary>Number of invoices re-pointed from the alias to the canonical debtor.</summary>
    public int InvoicesRepointed { get; set; }

    /// <summary>Number of debtors that pointed at the alias and were re-pointed to the canonical debtor.</summary>
    public int AliasesRepointed { get; set; }

    /// <summary>Supabase user id of the staff member who performed the merge.</summary>
    public Guid PerformedBy { get; set; }

    public DateTimeOffset PerformedAt { get; set; } = DateTimeOffset.UtcNow;
}
