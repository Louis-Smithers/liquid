using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IDebtorService
{
    Task<IEnumerable<DebtorDto>> GetAllAsync();
    Task<IEnumerable<DebtorDto>> GetByClientAsync(string shortcode);
    Task<DebtorDto?> GetByIdAsync(Guid id);
    Task<DebtorDto> CreateAsync(CreateDebtorDto dto);
}
