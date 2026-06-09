using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IImportQueueService
{
    Task<IEnumerable<ImportQueueItemDto>> GetPendingAsync();
    Task<(bool Success, string? Error, InvoiceDto? CreatedInvoice)> ResolveAsync(long id, ResolveQueueDto dto, Guid resolvedBy);
    Task<(bool Success, string? Error)> DismissAsync(long id, DismissQueueDto dto, Guid resolvedBy);
}
