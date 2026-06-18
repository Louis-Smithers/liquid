using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "StaffOnly")]
public class OcrController : ControllerBase
{
    private readonly IOcrService _service;
    private readonly ISupabaseStorage _storage;

    public OcrController(IOcrService service, ISupabaseStorage storage)
    {
        _service = service;
        _storage = storage;
    }

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

    // Serves the raw scanned document for preview, e.g. "invoices-raw/{fileId}-{name}.pdf"
    // as returned in OcrScanResultDto.RawDocumentPath. Restricted to that bucket prefix so
    // callers can't use this to read arbitrary storage paths.
    [HttpGet("scan/file")]
    public async Task<IActionResult> GetScanFile([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !path.StartsWith("invoices-raw/", StringComparison.Ordinal))
            return BadRequest("Invalid path.");

        var bytes = await _storage.DownloadAsync(path);
        if (bytes is null) return NotFound();

        var filename = path.Split('/')[^1];
        if (!new FileExtensionContentTypeProvider().TryGetContentType(filename, out var contentType))
            contentType = "application/octet-stream";

        // Each scan path embeds a fresh Guid (see OcrService.ScanAsync), so the object at this
        // path never changes — safe to let the browser cache it long-term instead of
        // re-downloading the same file every time the review UI reselects it.
        Response.Headers.CacheControl = "private, max-age=86400, immutable";

        return File(bytes, contentType, filename);
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }
}
