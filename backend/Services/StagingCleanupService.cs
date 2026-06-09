using Microsoft.EntityFrameworkCore;
using Smithers.API.Data;

namespace Smithers.API.Services;

/// <summary>
/// Sweeps abandoned upload batches: any batch still in "Staging" past its ExpiresAt has
/// its staged files deleted from Supabase Storage and is marked "Abandoned". This is the
/// reliable half of the temp-storage lifecycle (the browser unload warning is cosmetic).
/// </summary>
public class StagingCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;

    public StagingCleanupService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredBatchesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"StagingCleanupService error: {ex.Message}");
            }
            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }

    private async Task CleanupExpiredBatchesAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<ISupabaseStorage>();

        var expired = await context.UploadBatches
            .Include(b => b.Documents)
            .Where(b => b.Status == "Staging" && b.ExpiresAt < DateTimeOffset.UtcNow)
            .ToListAsync();

        if (expired.Count == 0) return;

        foreach (var batch in expired)
        {
            foreach (var doc in batch.Documents)
                await storage.DeleteAsync(doc.StoragePath);

            batch.Status = "Abandoned";
        }

        await context.SaveChangesAsync();
    }
}
