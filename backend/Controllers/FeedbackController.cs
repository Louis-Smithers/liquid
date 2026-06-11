using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;
using System.Security.Claims;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/feedback")]
public class FeedbackController : ControllerBase
{
    private readonly IFeedbackService _feedback;

    public FeedbackController(IFeedbackService feedback)
    {
        _feedback = feedback;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Submit(SubmitFeedbackDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Message))
            return BadRequest(new { message = "Feedback message is required." });

        var userEmail = User.FindFirstValue(ClaimTypes.Email)
                        ?? User.FindFirstValue("email");

        await _feedback.SendAsync(dto, userEmail);
        return Ok(new { message = "Thanks — your feedback was sent." });
    }
}
