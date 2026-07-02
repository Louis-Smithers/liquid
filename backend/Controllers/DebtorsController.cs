using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DebtorsController : ControllerBase
{
    private readonly IDebtorService _service;

    public DebtorsController(IDebtorService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DebtorDto>>> GetDebtors()
        => Ok(await _service.GetAllAsync());

    [HttpGet("by-client/{shortcode}")]
    public async Task<ActionResult<IEnumerable<DebtorDto>>> GetByClient(string shortcode)
        => Ok(await _service.GetByClientAsync(shortcode));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DebtorDto>> GetDebtor(Guid id)
    {
        var debtor = await _service.GetByIdAsync(id);
        return debtor is null ? NotFound() : Ok(debtor);
    }

    [HttpGet("{id:guid}/clients")]
    public async Task<ActionResult<IEnumerable<DebtorClientDto>>> GetClientsForDebtor(Guid id)
    {
        var clients = await _service.GetClientsForDebtorAsync(id);
        return clients is null ? NotFound() : Ok(clients);
    }

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<DebtorDto>> PostDebtor(CreateDebtorDto dto)
    {
        var created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetDebtor), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/merge")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<DebtorDto>> MergeDebtor(Guid id, MergeDebtorDto dto)
    {
        var performedBy = GetUserId();
        var (success, error, result) = await _service.MergeAsync(id, dto.CanonicalId, performedBy);
        return success ? Ok(result) : BadRequest(error);
    }

    [HttpGet("{id:guid}/merge-history")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<IEnumerable<DebtorMergeAuditDto>>> GetMergeHistory(Guid id)
        => Ok(await _service.GetMergeHistoryAsync(id));

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }
}
