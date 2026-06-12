using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IImportQueueService
{
    Task<ImportQueuePageDto> GetPendingAsync(long? cursor, int pageSize);
    Task<(bool Success, string? Error, InvoiceDto? CreatedInvoice)> ResolveAsync(long id, ResolveQueueDto dto, Guid resolvedBy);
    Task<(bool Success, string? Error, ResolveGroupResultDto? Result)> ResolveGroupAsync(ResolveGroupDto dto, Guid resolvedBy);
    Task<(bool Success, string? Error)> DismissAsync(long id, DismissQueueDto dto, Guid resolvedBy);
}
