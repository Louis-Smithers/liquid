using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IInvoiceService
{
    Task<InvoicePageDto> GetPageAsync(string? search, string? status, DateTimeOffset? cursorTime, string? cursorId, int pageSize);
    Task<IEnumerable<InvoiceDto>> GetByClientAsync(string shortcode);
    Task<IEnumerable<InvoiceDto>> GetByDebtorAsync(Guid debtorId);
    Task<InvoiceDto?> GetByIdAsync(string invoiceId);
    Task<bool> UpdateStatusAsync(string invoiceId, string status);
    Task<IEnumerable<AgingClientReportDto>> GetAgingReportAsync();
}
