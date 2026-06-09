using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/ocr/batch")]
[Authorize]
public class OcrPipelineController : ControllerBase
{
    private readonly IOcrPipelineService _service;

    public OcrPipelineController(IOcrPipelineService service) => _service = service;

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }

    [HttpPost]
    public async Task<ActionResult<UploadBatchDto>> CreateBatch()
    {
        return Ok(await _service.CreateBatchAsync(GetUserId()));
    }

    [HttpPost("{id:guid}/files")]
    public async Task<ActionResult<UploadBatchDto>> AddFiles(Guid id, IFormFileCollection files)
    {
        try
        {
            return Ok(await _service.AddFilesAsync(id, files, GetUserId()));
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UploadBatchDto>> GetBatch(Guid id)
    {
        try
        {
            return Ok(await _service.GetBatchAsync(id, GetUserId()));
        }
        catch (Exception ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("{id:guid}/files/{fid:guid}/confirm")]
    public async Task<ActionResult<ConfirmResultDto>> ConfirmDocument(Guid id, Guid fid, ConfirmDocDto dto)
    {
        try
        {
            return Ok(await _service.ConfirmDocumentAsync(id, fid, dto, GetUserId()));
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DiscardBatch(Guid id)
    {
        var success = await _service.DiscardBatchAsync(id, GetUserId());
        return success ? NoContent() : NotFound();
    }
}
