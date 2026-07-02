using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IDebtorService
{
    Task<IEnumerable<DebtorDto>> GetAllAsync();
    Task<IEnumerable<DebtorDto>> GetByClientAsync(string shortcode);
    Task<DebtorDto?> GetByIdAsync(Guid id);
    Task<DebtorDto> CreateAsync(CreateDebtorDto dto);
    Task<IEnumerable<DebtorClientDto>?> GetClientsForDebtorAsync(Guid debtorId);
    Task<(bool Success, string? Error, DebtorDto? Result)> MergeAsync(Guid id, Guid canonicalId, Guid performedBy);
    Task<IEnumerable<DebtorMergeAuditDto>> GetMergeHistoryAsync(Guid id);
}
