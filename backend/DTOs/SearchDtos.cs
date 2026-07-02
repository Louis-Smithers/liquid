namespace Smithers.API.DTOs;

public record OmnibarSearchDto(IEnumerable<SearchHitDto> Debtors, IEnumerable<SearchHitDto> Clients);

public record SearchHitDto(string Id, string Title, string? Subtitle, string Type);
