using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;
using Smithers.API.DTOs;
using Smithers.API.Models;

namespace Smithers.API.Services;

public class BrokerService : IBrokerService
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public BrokerService(AppDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<BrokerSubmissionDto> CreateAsync(CreateBrokerSubmissionDto dto)
    {
        var userId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("No user ID on token.");

        var submission = new BrokerSubmission
        {
            Id = Guid.NewGuid(),
            SubmittedBySupabaseId = userId,
            CompanyName = dto.CompanyName,
            ContactName = dto.ContactName,
            Email = dto.Email,
            Phone = dto.Phone,
            BusinessNumber = dto.BusinessNumber,
            Address = dto.Address,
            Notes = dto.Notes,
            Status = "Submitted",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.BrokerSubmissions.Add(submission);
        await _context.SaveChangesAsync();
        return MapToDto(submission);
    }

    public async Task<IEnumerable<BrokerSubmissionDto>> GetMySubmissionsAsync()
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
        var list = await _context.BrokerSubmissions
            .Where(s => s.SubmittedBySupabaseId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
        return list.Select(MapToDto);
    }

    public async Task<BrokerSubmissionDto?> GetByIdAsync(Guid id)
    {
        var submission = await _context.BrokerSubmissions.FindAsync(id);
        if (submission == null) return null;

        if (_currentUser.IsExternal && submission.SubmittedBySupabaseId != _currentUser.UserId)
            return null;

        return MapToDto(submission);
    }

    public async Task<bool> ResubmitAsync(Guid id, CreateBrokerSubmissionDto dto)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
        var submission = await _context.BrokerSubmissions.FindAsync(id);
        if (submission == null || submission.SubmittedBySupabaseId != userId) return false;
        if (submission.Status != "NeedsInfo") return false;

        submission.CompanyName = dto.CompanyName;
        submission.ContactName = dto.ContactName;
        submission.Email = dto.Email;
        submission.Phone = dto.Phone;
        submission.BusinessNumber = dto.BusinessNumber;
        submission.Address = dto.Address;
        submission.Notes = dto.Notes;
        submission.Status = "Submitted";
        submission.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<BrokerSubmissionDto>> GetAllAsync()
    {
        var list = await _context.BrokerSubmissions
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
        return list.Select(MapToDto);
    }

    public async Task<bool> UpdateStatusAsync(Guid id, UpdateBrokerStatusDto dto)
    {
        var validStatuses = new[] { "Submitted", "InReview", "NeedsInfo", "Approved", "Rejected" };
        if (!validStatuses.Contains(dto.Status)) return false;

        var submission = await _context.BrokerSubmissions.FindAsync(id);
        if (submission == null) return false;

        submission.Status = dto.Status;
        submission.StaffNote = dto.StaffNote;
        submission.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    private static BrokerSubmissionDto MapToDto(BrokerSubmission s) => new()
    {
        Id = s.Id,
        SubmittedBySupabaseId = s.SubmittedBySupabaseId,
        CompanyName = s.CompanyName,
        ContactName = s.ContactName,
        Email = s.Email,
        Phone = s.Phone,
        BusinessNumber = s.BusinessNumber,
        Address = s.Address,
        Notes = s.Notes,
        Status = s.Status,
        StaffNote = s.StaffNote,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt
    };
}
