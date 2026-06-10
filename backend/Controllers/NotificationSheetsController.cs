using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationSheetsController : ControllerBase
{
    private readonly INotificationSheetService _service;

    public NotificationSheetsController(INotificationSheetService service) => _service = service;

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) 
               ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificationSheetDto>>> GetAll()
    {
        return Ok(await _service.GetAllVisibleAsync(GetUserId()));
    }

    [HttpGet("draft-count")]
    public async Task<ActionResult<int>> GetDraftCount()
    {
        return Ok(await _service.GetDraftItemCountAsync(GetUserId()));
    }

    [HttpGet("active/{shortcode}")]
    public async Task<ActionResult<NotificationSheetDto>> GetActiveDraft(string shortcode)
    {
        var sheet = await _service.GetActiveDraftForClientAsync(shortcode, GetUserId());
        return sheet is null ? NotFound() : Ok(sheet);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<NotificationSheetDto>> GetById(Guid id)
    {
        var sheet = await _service.GetByIdAsync(id);
        return sheet is null ? NotFound() : Ok(sheet);
    }

    [HttpGet("client/{shortcode}")]
    public async Task<ActionResult<IEnumerable<NotificationSheetDto>>> GetHistoryByClient(string shortcode)
    {
        return Ok(await _service.GetHistoryByClientAsync(shortcode));
    }

    [HttpPost]
    public async Task<ActionResult<NotificationSheetDto>> Create(CreateNotificationSheetDto dto)
    {
        var created = await _service.CreateAsync(dto, GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, UpdateNotificationSheetDto dto)
    {
        var updated = await _service.UpdateAsync(id, dto, GetUserId());
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        try
        {
            var deleted = await _service.DeleteAsync(id, GetUserId());
            return deleted ? NoContent() : NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{id:guid}/items")]
    public async Task<ActionResult<NotificationSheetItemDto>> AddItem(Guid id, AddNsQueueItemDto dto)
    {
        try
        {
            var item = await _service.AddItemAsync(id, dto);
            return Ok(item);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<ActionResult> RemoveItem(Guid id, Guid itemId)
    {
        var removed = await _service.RemoveItemAsync(id, itemId);
        return removed ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<ActionResult<SubmitNsResultDto>> Submit(Guid id, [FromServices] INsIntakeService intakeService)
    {
        var sheet = await _service.GetByIdAsync(id);
        if (sheet == null) return NotFound();
        if (sheet.Status != "Draft") return BadRequest("Only draft sheets can be submitted.");
        if (!sheet.Items.Any()) return BadRequest("Sheet must have at least 1 item to submit.");

        var dto = new UpdateNotificationSheetDto { Status = "Submitted" };
        var updated = await _service.UpdateAsync(id, dto, GetUserId());
        
        if (!updated) return NotFound();

        try
        {
            var result = await intakeService.GenerateAndStoreAsync(id);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Ok(new SubmitNsResultDto
            {
                IntakeGenerated = false,
                Message = $"Intake generation failed: {ex.Message}"
            });
        }
    }

    [HttpGet("{id:guid}/pdf")]
    public async Task<ActionResult> GetPdf(Guid id, [FromServices] INsPdfService pdfService)
    {
        var sheet = await _service.GetByIdAsync(id);
        if (sheet == null) return NotFound();
        if (sheet.Status != "Submitted") return BadRequest("Only submitted sheets can generate a PDF.");

        var pdfBytes = pdfService.GenerateScheduleOfAccounts(sheet);
        return File(pdfBytes, "application/pdf", $"ScheduleOfAccounts_{sheet.ClientShortcode}_{id}.pdf");
    }

    [HttpGet("{id:guid}/intake")]
    public async Task<ActionResult> GetIntake(Guid id, [FromServices] INsIntakeService intakeService)
    {
        var sheet = await _service.GetByIdAsync(id);
        if (sheet == null) return NotFound();

        var bytes = await intakeService.GetOrGenerateAsync(id);
        if (bytes == null) return NotFound("Intake document could not be generated or found.");

        return File(bytes, "application/pdf", $"InvoiceIntake_{sheet.ClientShortcode}_{id}.pdf");
    }

    [HttpPost("{id:guid}/intake/regenerate")]
    public async Task<ActionResult<SubmitNsResultDto>> RegenerateIntake(Guid id, [FromServices] INsIntakeService intakeService)
    {
        var sheet = await _service.GetByIdAsync(id);
        if (sheet == null) return NotFound();

        var result = await intakeService.GenerateAndStoreAsync(id);
        return Ok(result);
    }
}
