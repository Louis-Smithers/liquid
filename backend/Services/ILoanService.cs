using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface ILoanService
{
    Task<List<LoanSummaryDto>> GetAllAsync();
    Task<LoanTableDto?> GetTableAsync(Guid id);
    Task<LoanDto> CreateAsync(CreateLoanDto dto, Guid createdBy);
    Task<bool> UpdateAsync(Guid id, UpdateLoanDto dto);
    Task<bool> DeleteAsync(Guid id);

    Task<LoanPaymentDto> AddPaymentAsync(Guid loanId, AddLoanPaymentDto dto);
    Task<bool> UpdatePaymentAsync(Guid loanId, Guid paymentId, UpdateLoanPaymentDto dto);
    Task<bool> DeletePaymentAsync(Guid loanId, Guid paymentId);
}
