using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using Moq.Protected;
using Smithers.API.Data;
using Smithers.API.Models;
using Smithers.API.Services;
using System.Net;

namespace Smithers.Tests;

public class AdminServiceTests
{
    private IConfiguration CreateConfig()
    {
        var mockConfig = new Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:Url"]).Returns("https://mock.supabase.co");
        mockConfig.Setup(c => c["Supabase:ServiceRoleKey"]).Returns("secret-key");
        return mockConfig.Object;
    }

    [Fact]
    public async Task ApproveRequestAsync_Success_ReturnsTrue()
    {
        var ctx = TestDbFactory.Create(nameof(ApproveRequestAsync_Success_ReturnsTrue));
        
        var request = new UserAccessRequest
        {
            Id = Guid.NewGuid(),
            Email = "test@example.com",
            UsernameWanted = "testuser",
            FirstName = "Test",
            LastName = "User",
            Status = "Pending"
        };
        ctx.UserAccessRequests.Add(request);
        ctx.SaveChanges();

        var handlerMock = new Mock<HttpMessageHandler>();
        var response = new HttpResponseMessage
        {
            StatusCode = HttpStatusCode.OK,
            Content = new StringContent("{\"id\": \"12345-abcde\"}")
        };

        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(response);

        var httpClient = new HttpClient(handlerMock.Object);
        var svc = new AdminService(ctx, CreateConfig(), httpClient);

        var result = await svc.ApproveRequestAsync(request.Id, "tempPass123");

        result.Should().BeTrue();
        var updatedReq = ctx.UserAccessRequests.Find(request.Id);
        updatedReq!.Status.Should().Be("Approved");
    }
}
