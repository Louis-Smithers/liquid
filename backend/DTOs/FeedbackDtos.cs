namespace Smithers.API.DTOs;

/// <summary>
/// A piece of user-submitted feedback. <see cref="Category"/> is a free-form label
/// (e.g. "Bug", "Feedback", "Feature") and <see cref="PageUrl"/> is the page the user
/// was on, both optional so the form stays low-friction.
/// </summary>
public record SubmitFeedbackDto(
    string Message,
    string? Category = null,
    string? PageUrl = null
);
