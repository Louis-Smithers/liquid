namespace Smithers.API.Services;

public interface IGcsService
{
    /// <summary>
    /// Upload bytes to objectPath in the configured bucket.
    /// Returns objectPath on success, null if unconfigured or failed.
    /// </summary>
    Task<string?> UploadAsync(byte[] data, string contentType, string objectPath);

    /// <summary>
    /// Generate a signed URL for objectPath, valid for `expiry`.
    /// Returns null if unconfigured.
    /// </summary>
    Task<string?> GetSignedUrlAsync(string objectPath, TimeSpan expiry);

    /// <summary>
    /// Lightweight reachability probe for health checks: confirms the configured bucket can be
    /// accessed with the current credential. Returns false if unconfigured or on any error.
    /// </summary>
    Task<bool> CheckAccessAsync(CancellationToken ct = default);

    bool Configured { get; }
}
