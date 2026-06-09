using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IOcrPipelineService
{
    Task<UploadBatchDto> CreateBatchAsync(Guid userId);
    Task<UploadBatchDto> AddFilesAsync(Guid batchId, IFormFileCollection files, Guid userId);
    Task<UploadBatchDto> GetBatchAsync(Guid batchId, Guid userId);
    Task<ConfirmResultDto> ConfirmDocumentAsync(Guid batchId, Guid docId, ConfirmDocDto dto, Guid userId);
    Task<bool> DiscardBatchAsync(Guid batchId, Guid userId);
}
