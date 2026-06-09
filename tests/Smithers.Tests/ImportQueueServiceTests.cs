using FluentAssertions;
using Smithers.API.DTOs;
using Smithers.API.Models;
using Smithers.API.Services;

namespace Smithers.Tests;

public class ImportQueueServiceTests
{
    [Fact]
    public async Task GetPendingAsync_ReturnsOnlyPendingItems()
    {
        var ctx = TestDbFactory.Create(nameof(GetPendingAsync_ReturnsOnlyPendingItems));
        TestDbFactory.SeedQueueItem(ctx, invoiceNumber: "INV-001", status: "Pending");
        TestDbFactory.SeedQueueItem(ctx, invoiceNumber: "INV-002", status: "Resolved");
        TestDbFactory.SeedQueueItem(ctx, invoiceNumber: "INV-003", status: "Dismissed");
        var svc = new ImportQueueService(ctx);

        var result = await svc.GetPendingAsync();

        result.Should().HaveCount(1);
        result.First().InvoiceNumber.Should().Be("INV-001");
    }

    [Fact]
    public async Task ResolveAsync_ValidItem_CreatesInvoiceAndMarksResolved()
    {
        var ctx = TestDbFactory.Create(nameof(ResolveAsync_ValidItem_CreatesInvoiceAndMarksResolved));
        var client = TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx, "Wayne Enterprises");
        var item = TestDbFactory.SeedQueueItem(ctx, invoiceNumber: "INV-QUEUE-01", amount: 1500m);
        var svc = new ImportQueueService(ctx);

        var (success, error, created) = await svc.ResolveAsync(
            item.Id,
            new ResolveQueueDto("ACME", debtor.Id),
            resolvedBy: Guid.NewGuid());

        success.Should().BeTrue();
        error.Should().BeNull();
        created.Should().NotBeNull();
        created!.InvoiceId.Should().Be("ACME_INV-QUEUE-01");
        created.Amount.Should().Be(1500m);
        created.Status.Should().Be("Pre-Verified");

        var queueItem = ctx.ImportReviewQueue.Find(item.Id);
        queueItem!.ReviewStatus.Should().Be("Resolved");
    }

    [Fact]
    public async Task ResolveAsync_AlreadyResolved_ReturnsFalse()
    {
        var ctx = TestDbFactory.Create(nameof(ResolveAsync_AlreadyResolved_ReturnsFalse));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx);
        var item = TestDbFactory.SeedQueueItem(ctx, status: "Resolved");
        var svc = new ImportQueueService(ctx);

        var (success, error, _) = await svc.ResolveAsync(
            item.Id,
            new ResolveQueueDto("ACME", debtor.Id),
            Guid.NewGuid());

        success.Should().BeFalse();
        error.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task ResolveAsync_InvalidClient_ReturnsFalse()
    {
        var ctx = TestDbFactory.Create(nameof(ResolveAsync_InvalidClient_ReturnsFalse));
        var debtor = TestDbFactory.SeedDebtor(ctx);
        var item = TestDbFactory.SeedQueueItem(ctx);
        var svc = new ImportQueueService(ctx);

        var (success, error, _) = await svc.ResolveAsync(
            item.Id,
            new ResolveQueueDto("NONEXISTENT", debtor.Id),
            Guid.NewGuid());

        success.Should().BeFalse();
        error.Should().Contain("Client");
    }

    [Fact]
    public async Task DismissAsync_ValidItem_MarksAsDismissed()
    {
        var ctx = TestDbFactory.Create(nameof(DismissAsync_ValidItem_MarksAsDismissed));
        var item = TestDbFactory.SeedQueueItem(ctx);
        var svc = new ImportQueueService(ctx);

        var (success, error) = await svc.DismissAsync(
            item.Id,
            new DismissQueueDto("Duplicate record"),
            Guid.NewGuid());

        success.Should().BeTrue();
        error.Should().BeNull();

        var updated = ctx.ImportReviewQueue.Find(item.Id);
        updated!.ReviewStatus.Should().Be("Dismissed");
        updated.Notes.Should().Be("Duplicate record");
    }

    [Fact]
    public async Task DismissAsync_AlreadyDismissed_ReturnsFalse()
    {
        var ctx = TestDbFactory.Create(nameof(DismissAsync_AlreadyDismissed_ReturnsFalse));
        var item = TestDbFactory.SeedQueueItem(ctx, status: "Dismissed");
        var svc = new ImportQueueService(ctx);

        var (success, _) = await svc.DismissAsync(item.Id, new DismissQueueDto(null), Guid.NewGuid());

        success.Should().BeFalse();
    }
}
