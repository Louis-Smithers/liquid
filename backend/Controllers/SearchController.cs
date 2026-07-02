using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Smithers.API.DTOs;
using Smithers.API.Services;

namespace Smithers.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SearchController : ControllerBase
{
    private readonly ISearchService _service;

    public SearchController(ISearchService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<OmnibarSearchDto>> Search([FromQuery] string? q)
        => Ok(await _service.SearchAsync(q ?? string.Empty));
}
