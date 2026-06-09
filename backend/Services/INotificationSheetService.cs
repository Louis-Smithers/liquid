using Smithers.API.DTOs;

namespace Smithers.API.Services;

public interface INotificationSheetService
{
    Task<IEnumerable<NotificationSheetDto>> GetHistoryByClientAsync(string shortcode);
    Task<NotificationSheetDto?> GetByIdAsync(Guid id);
    Task<NotificationSheetDto> CreateAsync(CreateNotificationSheetDto dto, Guid userId);

    Task<IEnumerable<NotificationSheetDto>> GetAllVisibleAsync(Guid userId);
    Task<NotificationSheetDto?> GetActiveDraftForClientAsync(string clientShortcode, Guid userId);
    Task<NotificationSheetItemDto> AddItemAsync(Guid sheetId, AddNsQueueItemDto dto);
    Task<bool> RemoveItemAsync(Guid sheetId, Guid itemId);
    Task<bool> UpdateAsync(Guid sheetId, UpdateNotificationSheetDto dto, Guid userId);
    Task<bool> DeleteAsync(Guid sheetId, Guid userId);
    Task<int> GetDraftItemCountAsync(Guid userId);
}
