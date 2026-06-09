using FluentAssertions;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.Tests;

public class DebtorServiceTests
{
    [Fact]
    public async Task CreateAsync_ValidDto_CreatesDebtor()
    {
        var ctx = TestDbFactory.Create(nameof(CreateAsync_ValidDto_CreatesDebtor));
        var svc = new DebtorService(ctx);

        var dto = new CreateDebtorDto("New Debtor LLC", "New Debtor", "Review", true);

        var result = await svc.CreateAsync(dto);

        result.Should().NotBeNull();
        result.Id.Should().NotBeEmpty();
        result.Name.Should().Be("New Debtor LLC");
        result.CadenceName.Should().Be("New Debtor");
        result.Group.Should().Be("Review");
        result.Active.Should().BeTrue();

        var inDb = await ctx.Debtors.FindAsync(result.Id);
        inDb.Should().NotBeNull();
        inDb!.Name.Should().Be("New Debtor LLC");
    }
}
