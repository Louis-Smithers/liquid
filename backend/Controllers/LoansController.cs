using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "StaffOnly")]
public class LoansController : ControllerBase
{
    private readonly ILoanService _service;
    private readonly ILoanPdfService _pdf;

    public LoansController(ILoanService service, ILoanPdfService pdf)
    {
        _service = service;
        _pdf = pdf;
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanSummaryDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LoanTableDto>> GetById(Guid id)
    {
        var table = await _service.GetTableAsync(id);
        return table is null ? NotFound() : Ok(table);
    }

    [HttpPost]
    public async Task<ActionResult<LoanDto>> Create(CreateLoanDto dto)
    {
        var created = await _service.CreateAsync(dto, GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateLoanDto dto)
    {
        var updated = await _service.UpdateAsync(id, dto);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/payments")]
    public async Task<ActionResult<LoanPaymentDto>> AddPayment(Guid id, AddLoanPaymentDto dto)
    {
        var payment = await _service.AddPaymentAsync(id, dto);
        return Ok(payment);
    }

    [HttpPatch("{id:guid}/payments/{paymentId:guid}")]
    public async Task<IActionResult> UpdatePayment(Guid id, Guid paymentId, UpdateLoanPaymentDto dto)
    {
        var updated = await _service.UpdatePaymentAsync(id, paymentId, dto);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}/payments/{paymentId:guid}")]
    public async Task<IActionResult> DeletePayment(Guid id, Guid paymentId)
    {
        var deleted = await _service.DeletePaymentAsync(id, paymentId);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> GetPdf(Guid id)
    {
        var table = await _service.GetTableAsync(id);
        if (table is null) return NotFound();

        var bytes = _pdf.GenerateLoanTable(table);
        var filename = $"LoanTable_{table.Loan.BorrowerName.Replace(" ", "_")}_{id}.pdf";
        return File(bytes, "application/pdf", filename);
    }
}
