using FluentAssertions;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.Tests;

public class ClientServiceTests
{
    [Fact]
    public async Task CreateAsync_ValidDto_CreatesClient()
    {
        var ctx = TestDbFactory.Create(nameof(CreateAsync_ValidDto_CreatesClient));
        var svc = new ClientService(ctx);

        var dto = new CreateClientDto("NEWCLI", "New Client Corp", true, false, "new@client.com", "555-9999", null, "Metropolis", "NY", "10000", "English");

        var result = await svc.CreateAsync(dto);

        result.Should().NotBeNull();
        result.Shortcode.Should().Be("NEWCLI");
        result.CadenceName.Should().Be("New Client Corp");
        result.Active.Should().BeTrue();
        result.Dnc.Should().BeFalse();
        result.Email.Should().Be("new@client.com");
        result.Phone.Should().Be("555-9999");
        result.City.Should().Be("Metropolis");
        result.Province.Should().Be("NY");
        result.PostalCode.Should().Be("10000");
        result.Language.Should().Be("English");

        var inDbAlt = ctx.Clients.SingleOrDefault(c => c.Shortcode == "NEWCLI");
        inDbAlt.Should().NotBeNull();
        inDbAlt!.CadenceName.Should().Be("New Client Corp");
        inDbAlt.Email.Should().Be("new@client.com");
        inDbAlt.Phone.Should().Be("555-9999");
        inDbAlt.City.Should().Be("Metropolis");
        inDbAlt.Province.Should().Be("NY");
        inDbAlt.PostalCode.Should().Be("10000");
        inDbAlt.Language.Should().Be("English");
    }
}
