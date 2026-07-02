using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _service;
    private readonly ISupabaseStorage _storage;

    public InvoicesController(IInvoiceService service, ISupabaseStorage storage)
    {
        _service = service;
        _storage = storage;
    }

    [HttpGet]
    public async Task<ActionResult<InvoicePageDto>> GetPage(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? cursorTime = null,
        [FromQuery] string? cursorId = null,
        [FromQuery] int pageSize = 25)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        DateTimeOffset? parsedCursor = DateTimeOffset.TryParse(cursorTime, out var ct) ? ct : null;
        return Ok(await _service.GetPageAsync(search, status, parsedCursor, cursorId, pageSize));
    }

    [HttpGet("client/{shortcode}")]
    public async Task<ActionResult<IEnumerable<InvoiceDto>>> GetByClient(string shortcode)
        => Ok(await _service.GetByClientAsync(shortcode));

    [HttpGet("debtor/{debtorId:guid}")]
    public async Task<ActionResult<IEnumerable<InvoiceDto>>> GetByDebtor(Guid debtorId)
        => Ok(await _service.GetByDebtorAsync(debtorId));

    // Cursor-paged variants of the two endpoints above, for large per-client/per-debtor invoice
    // lists (e.g. a client with hundreds of invoices). Existing non-paged endpoints above are left
    // untouched — other callers (NS builder eligible-invoice fetch, client portal, drawer
    // "Unprocessed" sections) still rely on getting everything back in one call.
    [HttpGet("client/{shortcode}/page")]
    public async Task<ActionResult<InvoicePageDto>> GetByClientPage(
        string shortcode,
        [FromQuery] string? cursorTime = null,
        [FromQuery] string? cursorId = null,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? status = null)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        DateTimeOffset? parsedCursor = DateTimeOffset.TryParse(cursorTime, out var ct) ? ct : null;
        return Ok(await _service.GetPageAsync(null, status, parsedCursor, cursorId, pageSize, client: shortcode));
    }

    [HttpGet("debtor/{debtorId:guid}/page")]
    public async Task<ActionResult<InvoicePageDto>> GetByDebtorPage(
        Guid debtorId,
        [FromQuery] string? cursorTime = null,
        [FromQuery] string? cursorId = null,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? status = null)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        DateTimeOffset? parsedCursor = DateTimeOffset.TryParse(cursorTime, out var ct) ? ct : null;
        return Ok(await _service.GetPageAsync(null, status, parsedCursor, cursorId, pageSize, debtorId: debtorId));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<InvoiceDto>> GetInvoice(string id)
    {
        var invoice = await _service.GetByIdAsync(id);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> PatchStatus(string id, UpdateInvoiceStatusDto dto)
    {
        var updated = await _service.UpdateStatusAsync(id, dto.Status);
        return updated ? NoContent() : NotFound();
    }

    [HttpGet("aging")]
    public async Task<ActionResult<IEnumerable<AgingClientReportDto>>> GetAgingReport()
        => Ok(await _service.GetAgingReportAsync());

    [HttpGet("{id}/file")]
    public async Task<IActionResult> GetFile(string id)
    {
        var invoice = await _service.GetByIdAsync(id);
        if (invoice is null) return NotFound();
        if (string.IsNullOrEmpty(invoice.DocumentPath)) return NotFound();

        var bytes = await _storage.DownloadAsync(invoice.DocumentPath);
        if (bytes is null) return NotFound();

        var filename = invoice.DocumentPath.Split('/')[^1];
        if (!new FileExtensionContentTypeProvider().TryGetContentType(filename, out var contentType))
            contentType = "application/octet-stream";

        return File(bytes, contentType, filename);
    }

    [HttpGet("{id}/notes")]
    public async Task<ActionResult<IEnumerable<InvoiceNoteDto>>> GetNotes(string id)
        => Ok(await _service.GetNotesAsync(id));

    [HttpPost("{id}/notes")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<InvoiceNoteDto>> AddNote(string id, CreateInvoiceNoteDto dto)
    {
        var note = await _service.AddNoteAsync(id, dto.Text, GetUserId());
        return note is null ? NotFound() : Ok(note);
    }

    [HttpPost("notes/bulk")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> AddNotesBulk(CreateBulkInvoiceNotesDto dto)
    {
        var count = await _service.AddNotesBulkAsync(dto.InvoiceIds, dto.Text, GetUserId());
        return Ok(new { count });
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }
}
