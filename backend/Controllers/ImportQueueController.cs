using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ImportQueueController : ControllerBase
{
    private readonly IImportQueueService _service;

    public ImportQueueController(IImportQueueService service) => _service = service;

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<ImportQueueItemDto>>> GetPending()
        => Ok(await _service.GetPendingAsync());

    [HttpPost("{id:long}/resolve")]
    public async Task<IActionResult> Resolve(long id, ResolveQueueDto dto)
    {
        var resolvedBy = GetUserId();
        var (success, error, created) = await _service.ResolveAsync(id, dto, resolvedBy);

        if (!success) return BadRequest(error);
        return Ok(created);
    }

    [HttpPost("{id:long}/dismiss")]
    public async Task<IActionResult> Dismiss(long id, DismissQueueDto dto)
    {
        var resolvedBy = GetUserId();
        var (success, error) = await _service.DismissAsync(id, dto, resolvedBy);

        if (!success) return BadRequest(error);
        return NoContent();
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) 
               ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }
}
