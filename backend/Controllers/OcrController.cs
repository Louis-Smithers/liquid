using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "StaffOnly")]
public class OcrController : ControllerBase
{
    private readonly IOcrService _service;

    public OcrController(IOcrService service) => _service = service;

    [HttpPost("upload")]
    public async Task<IActionResult> UploadPdf(IFormFile file, [FromForm] string invoiceId)
    {
        var (success, error, documentPath) = await _service.UploadAndExtractAsync(file, invoiceId);
        if (!success) return BadRequest(error);
        return Ok(new { documentPath, message = "Upload and OCR processing completed." });
    }

    [HttpGet("results/{invoiceId}")]
    public async Task<ActionResult<IEnumerable<OcrResultDto>>> GetResults(string invoiceId)
        => Ok(await _service.GetResultsAsync(invoiceId));

    [HttpPatch("results/{id:guid}/confirm")]
    public async Task<IActionResult> ConfirmValue(Guid id, ConfirmOcrValueDto dto)
    {
        var reviewedBy = GetUserId();
        var confirmed = await _service.ConfirmValueAsync(id, dto.ConfirmedValue, reviewedBy);
        return confirmed ? NoContent() : NotFound();
    }

    [HttpPost("scan")]
    public async Task<IActionResult> Scan(IFormFile file)
    {
        var result = await _service.ScanAsync(file);
        return Ok(result);
    }

    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm(OcrConfirmDto dto)
    {
        var reviewedBy = GetUserId();
        var (invoiceId, nsId) = await _service.ConfirmAndCreateInvoiceAsync(dto, reviewedBy);
        if (invoiceId == null) return BadRequest("Could not confirm invoice.");
        return Ok(new { invoiceId, notificationSheetId = nsId });
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }
}
