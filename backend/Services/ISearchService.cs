using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface ISearchService
{
    Task<OmnibarSearchDto> SearchAsync(string q);
}
