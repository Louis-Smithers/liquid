using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/broker")]
[Authorize]
public class BrokerSubmissionsController : ControllerBase
{
    private readonly IBrokerService _brokerService;
    private readonly ICurrentUserService _currentUser;

    public BrokerSubmissionsController(IBrokerService brokerService, ICurrentUserService currentUser)
    {
        _brokerService = brokerService;
        _currentUser = currentUser;
    }

    // External (broker) endpoints
    [HttpPost("submissions")]
    public async Task<ActionResult<BrokerSubmissionDto>> Create([FromBody] CreateBrokerSubmissionDto dto)
    {
        if (!_currentUser.IsExternal) return Forbid();
        try { return Ok(await _brokerService.CreateAsync(dto)); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("submissions/mine")]
    public async Task<ActionResult<IEnumerable<BrokerSubmissionDto>>> GetMine()
    {
        if (!_currentUser.IsExternal) return Forbid();
        try { return Ok(await _brokerService.GetMySubmissionsAsync()); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("submissions/{id:guid}")]
    public async Task<ActionResult<BrokerSubmissionDto>> GetById(Guid id)
    {
        if (!_currentUser.IsExternal && !_currentUser.IsStaff && !_currentUser.IsAdmin) return Forbid();
        var submission = await _brokerService.GetByIdAsync(id);
        return submission == null ? NotFound() : Ok(submission);
    }

    [HttpPut("submissions/{id:guid}/resubmit")]
    public async Task<ActionResult> Resubmit(Guid id, [FromBody] CreateBrokerSubmissionDto dto)
    {
        if (!_currentUser.IsExternal) return Forbid();
        var result = await _brokerService.ResubmitAsync(id, dto);
        if (!result) return BadRequest("Cannot resubmit. Submission must be in 'NeedsInfo' status and owned by you.");
        return Ok(new { message = "Resubmitted." });
    }

    // Staff/admin oversight endpoints
    [HttpGet("submissions")]
    public async Task<ActionResult<IEnumerable<BrokerSubmissionDto>>> GetAll()
    {
        if (!_currentUser.IsStaff && !_currentUser.IsAdmin) return Forbid();
        return Ok(await _brokerService.GetAllAsync());
    }

    [HttpPatch("submissions/{id:guid}/status")]
    public async Task<ActionResult> UpdateStatus(Guid id, [FromBody] UpdateBrokerStatusDto dto)
    {
        if (!_currentUser.IsStaff && !_currentUser.IsAdmin) return Forbid();
        var result = await _brokerService.UpdateStatusAsync(id, dto);
        if (!result) return BadRequest("Could not update status. Check that the status value is valid.");
        return Ok(new { message = "Status updated." });
    }
}
