using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface INsPdfService
{
    byte[] GenerateScheduleOfAccounts(NotificationSheetDto sheet);
}
