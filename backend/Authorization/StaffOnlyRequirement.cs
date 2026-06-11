using Microsoft.AspNetCore.Authorization;
using Smithers.API.Services;

namespace Smithers.API.Authorization;

public class StaffOnlyRequirement : IAuthorizationRequirement { }

public class StaffOnlyHandler : AuthorizationHandler<StaffOnlyRequirement>
{
    private readonly ICurrentUserService _currentUser;

    public StaffOnlyHandler(ICurrentUserService currentUser)
    {
        _currentUser = currentUser;
    }

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, StaffOnlyRequirement requirement)
    {
        if (_currentUser.IsAdmin || _currentUser.Role == "user")
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
