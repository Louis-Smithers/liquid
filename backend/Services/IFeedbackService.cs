using Smithers.API.DTOs;

namespace Smithers.API.Services;

/// <summary>
/// Delivers user-submitted feedback / bug reports to wherever the team reads them
/// (currently a Discord webhook). Kept transport-agnostic like <see cref="IAlertNotifier"/>
/// so the sink can be swapped without touching the controller.
/// </summary>
public interface IFeedbackService
{
    Task SendAsync(SubmitFeedbackDto feedback, string? userEmail, CancellationToken ct = default);
}
