using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface ILoanPdfService
{
    byte[] GenerateLoanTable(LoanTableDto table);
}
