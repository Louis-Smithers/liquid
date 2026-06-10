using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IClientService
{
    Task<IEnumerable<ClientDto>> GetAllAsync();
    Task<ClientDto?> GetByShortcodeAsync(string shortcode);
    Task<ClientDto> CreateAsync(CreateClientDto dto);
    Task<bool> UpdateAsync(string shortcode, UpdateClientDto dto);
    Task<ClientSummaryDto?> GetSummaryAsync(string shortcode);
    Task<IEnumerable<ClientStatDto>> GetAllStatsAsync();
}
