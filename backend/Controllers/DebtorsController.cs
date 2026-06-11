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

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<DebtorDto>> PostDebtor(CreateDebtorDto dto)
    {
        var created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetDebtor), new { id = created.Id }, created);
    }
}
