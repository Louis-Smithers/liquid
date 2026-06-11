using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;
using System.Text;

namespace Smithers.API.Services;

public class GcsService : IGcsService
{
    private readonly ILogger<GcsService> _logger;
    private readonly string? _bucketName;
    private readonly GoogleCredential? _credential;

    public bool Configured => !string.IsNullOrEmpty(_bucketName) && _credential != null;

    public GcsService(IConfiguration config, ILogger<GcsService> logger)
    {
        _logger = logger;
        _bucketName = config["Google:GcsBucketName"];

        var base64Json = config["Google:ServiceAccountJson"];
        if (!string.IsNullOrEmpty(base64Json))
        {
            try
            {
                var jsonBytes = Convert.FromBase64String(base64Json);
                var json = Encoding.UTF8.GetString(jsonBytes);
                _credential = GoogleCredential.FromJson(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse Google Service Account JSON.");
            }
        }
    }

    public async Task<string?> UploadAsync(byte[] data, string contentType, string objectPath)
    {
        if (!Configured) return null;

        try
        {
            using var client = await StorageClient.CreateAsync(_credential);
            using var stream = new MemoryStream(data);

            await client.UploadObjectAsync(_bucketName, objectPath, contentType, stream);
            return objectPath;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload object {ObjectPath} to GCS bucket {BucketName}.", objectPath, _bucketName);
            return null;
        }
    }

    public async Task<bool> CheckAccessAsync(CancellationToken ct = default)
    {
        if (!Configured) return false;

        try
        {
            using var client = await StorageClient.CreateAsync(_credential);
            await client.GetBucketAsync(_bucketName, cancellationToken: ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "GCS access check failed for bucket {BucketName}.", _bucketName);
            return false;
        }
    }

    public async Task<string?> GetSignedUrlAsync(string objectPath, TimeSpan expiry)
    {
        if (!Configured || string.IsNullOrEmpty(objectPath)) return null;

        try
        {
            if (_credential!.UnderlyingCredential is ServiceAccountCredential sa)
            {
                var signer = UrlSigner.FromServiceAccountCredential(sa);
                return await signer.SignAsync(_bucketName, objectPath, expiry, HttpMethod.Get);
            }

            _logger.LogWarning("Google credential is not a ServiceAccountCredential. Cannot generate signed URL.");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate signed URL for object {ObjectPath} in GCS.", objectPath);
            return null;
        }
    }
}
