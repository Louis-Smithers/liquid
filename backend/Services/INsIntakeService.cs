using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface INsIntakeService
{
    Task<SubmitNsResultDto> GenerateAndStoreAsync(Guid sheetId);
    Task<byte[]?> GetOrGenerateAsync(Guid sheetId);
}
