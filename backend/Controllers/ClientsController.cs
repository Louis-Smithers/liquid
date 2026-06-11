using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ClientsController : ControllerBase
{
    private readonly IClientService _service;

    public ClientsController(IClientService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ClientDto>>> GetClients()
        => Ok(await _service.GetAllAsync());

    [HttpGet("{shortcode}")]
    public async Task<ActionResult<ClientDto>> GetClient(string shortcode)
    {
        var client = await _service.GetByShortcodeAsync(shortcode);
        return client is null ? NotFound() : Ok(client);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<IEnumerable<ClientStatDto>>> GetStats()
        => Ok(await _service.GetAllStatsAsync());

    [HttpGet("{shortcode}/summary")]
    public async Task<ActionResult<ClientSummaryDto>> GetClientSummary(string shortcode)
    {
        var summary = await _service.GetSummaryAsync(shortcode);
        return summary is null ? NotFound() : Ok(summary);
    }

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ClientDto>> PostClient(CreateClientDto dto)
    {
        var created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetClient), new { shortcode = created.Shortcode }, created);
    }

    [HttpPut("{shortcode}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> PutClient(string shortcode, UpdateClientDto dto)
    {
        var updated = await _service.UpdateAsync(shortcode, dto);
        return updated ? NoContent() : NotFound();
    }
}
