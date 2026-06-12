using Microsoft.EntityFrameworkCore;
using Smithers.API.Models;

namespace Smithers.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Debtor> Debtors => Set<Debtor>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceOcrResult> InvoiceOcrResults => Set<InvoiceOcrResult>();
    public DbSet<ImportRun> ImportRuns => Set<ImportRun>();
    public DbSet<ImportReviewQueue> ImportReviewQueue => Set<ImportReviewQueue>();
    public DbSet<NotificationSheet> NotificationSheets => Set<NotificationSheet>();
    public DbSet<NotificationSheetItem> NotificationSheetItems => Set<NotificationSheetItem>();
    public DbSet<UserAccessRequest> UserAccessRequests => Set<UserAccessRequest>();
    public DbSet<UploadBatch> UploadBatches => Set<UploadBatch>();
    public DbSet<StagedDocument> StagedDocuments => Set<StagedDocument>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<LoanPayment> LoanPayments => Set<LoanPayment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // StagedDocument -> UploadBatch
        modelBuilder.Entity<StagedDocument>()
            .HasOne(s => s.Batch)
            .WithMany(b => b.Documents)
            .HasForeignKey(s => s.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configure Client shortcode as unique key
        modelBuilder.Entity<Client>()
            .HasAlternateKey(c => c.Shortcode);

        // Invoice refers to Client via Shortcode
        modelBuilder.Entity<Invoice>()
            .HasOne(p => p.Client)
            .WithMany()
            .HasPrincipalKey(c => c.Shortcode)
            .HasForeignKey(p => p.LiquidClient);

        // Debtor self-referencing redirect
        modelBuilder.Entity<Debtor>()
            .HasOne(d => d.Redirect)
            .WithMany()
            .HasForeignKey(d => d.RedirectId)
            .OnDelete(DeleteBehavior.Restrict);

        // Invoice -> Debtor
        modelBuilder.Entity<Invoice>()
            .HasOne(p => p.Debtor)
            .WithMany()
            .HasForeignKey(p => p.DebtorId)
            .OnDelete(DeleteBehavior.Restrict);

        // Map Invoice class to the "invoices" table
        modelBuilder.Entity<Invoice>()
            .ToTable("invoices");

        // InvoiceOcrResult -> Invoice
        modelBuilder.Entity<InvoiceOcrResult>()
            .HasOne(r => r.Invoice)
            .WithMany()
            .HasForeignKey(r => r.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        // ImportReviewQueue — owned by n8n, no FK to ImportRun.
        // id is SERIAL (auto-increment integer), run_id is a TEXT string from n8n.
        modelBuilder.Entity<ImportReviewQueue>(entity =>
        {
            entity.HasKey(q => q.Id);
            entity.Property(q => q.Id).ValueGeneratedOnAdd();
            entity.Property(q => q.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(q => q.RunTimestamp).HasDefaultValueSql("now()");
            entity.ToTable("import_review_queue");
        });

        // NotificationSheet
        modelBuilder.Entity<NotificationSheet>()
            .Property(n => n.IsShared)
            .HasDefaultValue(true);

        // NotificationSheet -> Client
        modelBuilder.Entity<NotificationSheet>()
            .HasOne(n => n.Client)
            .WithMany()
            .HasPrincipalKey(c => c.Shortcode)
            .HasForeignKey(n => n.ClientShortcode)
            .OnDelete(DeleteBehavior.Restrict);

        // NotificationSheetItem -> NotificationSheet
        modelBuilder.Entity<NotificationSheetItem>()
            .HasOne(i => i.NotificationSheet)
            .WithMany(n => n.Items)
            .HasForeignKey(i => i.NotificationSheetId)
            .OnDelete(DeleteBehavior.Cascade);

        // NotificationSheetItem -> Invoice
        modelBuilder.Entity<NotificationSheetItem>()
            .HasOne(i => i.Invoice)
            .WithMany()
            .HasForeignKey(i => i.InvoiceId)
            .OnDelete(DeleteBehavior.Restrict);

        // LoanPayment -> Loan
        modelBuilder.Entity<LoanPayment>()
            .HasOne(p => p.Loan)
            .WithMany(l => l.Payments)
            .HasForeignKey(p => p.LoanId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
