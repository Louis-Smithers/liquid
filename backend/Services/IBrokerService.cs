using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IBrokerService
{
    Task<BrokerSubmissionDto> CreateAsync(CreateBrokerSubmissionDto dto);
    Task<IEnumerable<BrokerSubmissionDto>> GetMySubmissionsAsync();
    Task<BrokerSubmissionDto?> GetByIdAsync(Guid id);
    Task<bool> ResubmitAsync(Guid id, CreateBrokerSubmissionDto dto);
    Task<IEnumerable<BrokerSubmissionDto>> GetAllAsync();
    Task<bool> UpdateStatusAsync(Guid id, UpdateBrokerStatusDto dto);
}
