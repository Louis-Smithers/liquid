using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface IOcrService
{
    Task<(bool Success, string? Error, string? DocumentPath)> UploadAndExtractAsync(IFormFile file, string invoiceId);
    Task<IEnumerable<OcrResultDto>> GetResultsAsync(string invoiceId);
    Task<bool> ConfirmValueAsync(Guid resultId, string confirmedValue, Guid reviewedBy);
    Task<OcrScanResultDto> ScanAsync(IFormFile file);
    Task<(string? InvoiceId, Guid? NotificationSheetId)> ConfirmAndCreateInvoiceAsync(OcrConfirmDto dto, Guid reviewedBy);
}
