using FluentAssertions;
using Smithers.API.Services;

namespace Smithers.Tests;

public class InvoiceServiceTests
{
    [Fact]
    public async Task GetByClientAsync_ReturnsOnlyInvoicesForThatClient()
    {
        var ctx = TestDbFactory.Create(nameof(GetByClientAsync_ReturnsOnlyInvoicesForThatClient));
        TestDbFactory.SeedClient(ctx, "ACME");
        TestDbFactory.SeedClient(ctx, "GLOBEX");
        var debtor = TestDbFactory.SeedDebtor(ctx);

        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001");
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-002");
        TestDbFactory.SeedInvoice(ctx, "GLOBEX", debtor.Id, "GLB-001");

        var svc = new InvoiceService(ctx);
        var result = await svc.GetByClientAsync("ACME");

        result.Should().HaveCount(2);
        result.Should().OnlyContain(i => i.LiquidClient == "ACME");
    }

    [Fact]
    public async Task GetByIdAsync_ExistingInvoice_ReturnsDto()
    {
        var ctx = TestDbFactory.Create(nameof(GetByIdAsync_ExistingInvoice_ReturnsDto));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx);
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001", 5000m);

        var svc = new InvoiceService(ctx);
        var result = await svc.GetByIdAsync("ACME_INV-001");

        result.Should().NotBeNull();
        result!.Amount.Should().Be(5000m);
        result.Status.Should().Be("Pre-Verified");
    }

    [Fact]
    public async Task GetByIdAsync_NonExisting_ReturnsNull()
    {
        var ctx = TestDbFactory.Create(nameof(GetByIdAsync_NonExisting_ReturnsNull));
        var svc = new InvoiceService(ctx);

        var result = await svc.GetByIdAsync("GHOST_INV-999");

        result.Should().BeNull();
    }

    [Fact]
    public async Task UpdateStatusAsync_ExistingInvoice_UpdatesStatus()
    {
        var ctx = TestDbFactory.Create(nameof(UpdateStatusAsync_ExistingInvoice_UpdatesStatus));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx);
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001", status: "Pre-Verified");

        var svc = new InvoiceService(ctx);
        var success = await svc.UpdateStatusAsync("ACME_INV-001", "Paid");

        success.Should().BeTrue();
        var updated = await svc.GetByIdAsync("ACME_INV-001");
        updated!.Status.Should().Be("Paid");
    }

    [Fact]
    public async Task UpdateStatusAsync_NonExistingInvoice_ReturnsFalse()
    {
        var ctx = TestDbFactory.Create(nameof(UpdateStatusAsync_NonExistingInvoice_ReturnsFalse));
        var svc = new InvoiceService(ctx);

        var success = await svc.UpdateStatusAsync("GHOST_INV-999", "Paid");

        success.Should().BeFalse();
    }

    [Fact]
    public async Task GetAgingReportAsync_BucketsInvoicesCorrectly()
    {
        var ctx = TestDbFactory.Create(nameof(GetAgingReportAsync_BucketsInvoicesCorrectly));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx, "Wayne Enterprises");

        // Current (10 days old)
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001", 1000m, "Pre-Verified", daysOld: 10);
        // 31-60 days
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-002", 2000m, "Pre-Verified", daysOld: 45);
        // 61-90 days
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-003", 3000m, "Unverified", daysOld: 75);
        // Over 90 days
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-004", 4000m, "Pre-Verified", daysOld: 120);
        // Paid — should be EXCLUDED from aging report
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-005", 9999m, "Paid", daysOld: 5);

        var svc = new InvoiceService(ctx);
        var report = (await svc.GetAgingReportAsync()).ToList();

        report.Should().HaveCount(1);
        var acme = report.First();
        acme.Shortcode.Should().Be("ACME");

        var wayne = acme.Debtors.First();
        wayne.Current.Should().Be(1000m);
        wayne.Days31To60.Should().Be(2000m);
        wayne.Days61To90.Should().Be(3000m);
        wayne.Over90.Should().Be(4000m);
        wayne.Total.Should().Be(10000m);
    }

    [Fact]
    public async Task GetAgingReportAsync_ExcludesArchivedInvoices()
    {
        var ctx = TestDbFactory.Create(nameof(GetAgingReportAsync_ExcludesArchivedInvoices));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx);

        // Add one active, one archived
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001", 1000m, "Pre-Verified");
        var archived = TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-002", 9999m, "Pre-Verified");
        archived.Archived = true;
        ctx.SaveChanges();

        var svc = new InvoiceService(ctx);
        var report = await svc.GetAgingReportAsync();
        var total = report.First().Debtors.First().Total;

        total.Should().Be(1000m, "archived invoices must not appear in aging report");
    }
}
