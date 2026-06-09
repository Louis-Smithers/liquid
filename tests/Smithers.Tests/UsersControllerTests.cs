using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Smithers.API.Controllers;
using Smithers.API.Models;
using Smithers.API.Services;

namespace Smithers.Tests;

public class UsersControllerTests
{
    [Fact]
    public async Task SubmitAccessRequest_ReturnsOk()
    {
        var mockAdminService = new Mock<IAdminService>();
        var req = new UserAccessRequest { Id = Guid.NewGuid(), Status = "Pending", Email = "test@example.com", UsernameWanted = "testuser", FirstName = "Test", LastName = "User" };
        mockAdminService
            .Setup(s => s.SubmitAccessRequestAsync(It.IsAny<SubmitRequestDto>()))
            .ReturnsAsync(req);

        var controller = new UsersController(mockAdminService.Object);

        var dto = new SubmitRequestDto { Email = "test@example.com", UsernameWanted = "testuser", FirstName = "Test", LastName = "User" };
        var result = await controller.SubmitAccessRequest(dto);

        result.Should().BeOfType<OkObjectResult>();
    }
}
