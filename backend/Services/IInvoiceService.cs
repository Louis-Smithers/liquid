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
    Task<IEnumerable<InvoiceNoteDto>> GetNotesAsync(string invoiceId);
    Task<InvoiceNoteDto?> AddNoteAsync(string invoiceId, string text, Guid userId);
    Task<int> AddNotesBulkAsync(IEnumerable<string> invoiceIds, string text, Guid userId);
}
