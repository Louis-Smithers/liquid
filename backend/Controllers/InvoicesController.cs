using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _service;

    public InvoicesController(IInvoiceService service) => _service = service;

    [HttpGet("client/{shortcode}")]
    public async Task<ActionResult<IEnumerable<InvoiceDto>>> GetByClient(string shortcode)
        => Ok(await _service.GetByClientAsync(shortcode));

    [HttpGet("debtor/{debtorId:guid}")]
    public async Task<ActionResult<IEnumerable<InvoiceDto>>> GetByDebtor(Guid debtorId)
        => Ok(await _service.GetByDebtorAsync(debtorId));

    [HttpGet("{id}")]
    public async Task<ActionResult<InvoiceDto>> GetInvoice(string id)
    {
        var invoice = await _service.GetByIdAsync(id);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> PatchStatus(string id, UpdateInvoiceStatusDto dto)
    {
        var updated = await _service.UpdateStatusAsync(id, dto.Status);
        return updated ? NoContent() : NotFound();
    }

    [HttpGet("aging")]
    public async Task<ActionResult<IEnumerable<AgingClientReportDto>>> GetAgingReport()
        => Ok(await _service.GetAgingReportAsync());
}
