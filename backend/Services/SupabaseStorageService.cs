using System.Net.Http.Headers;

namespace Smithers.API.Services;

/// <summary>
/// Thin wrapper over Supabase Storage REST. Shared by the OCR pipeline (upload) and the
/// staging cleanup service (delete). Paths passed to Delete include the bucket as the
/// first segment, e.g. "invoices-staging/{batchId}/{file}".
/// </summary>
public interface ISupabaseStorage
{
    Task<string?> UploadAsync(IFormFile file, string bucket, string path);

    Task<bool> DeleteAsync(string pathWithBucket);
    Task<byte[]?> DownloadAsync(string pathWithBucket);
}

public class SupabaseStorageService : ISupabaseStorage
{
    private readonly HttpClient _http;
    private readonly string _url;
    private readonly string _key;

    public SupabaseStorageService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _url = config["Supabase:Url"]?.TrimEnd('/') ?? "";
        _key = config["Supabase:ServiceRoleKey"] ?? "";
    }

    private bool Configured => !string.IsNullOrEmpty(_url) && !string.IsNullOrEmpty(_key);

    public async Task<string?> UploadAsync(IFormFile file, string bucket, string path)
    {
        if (!Configured) return null;

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_url}/storage/v1/object/{bucket}/{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _key);

        using var content = new StreamContent(file.OpenReadStream());
        if (file.ContentType != null)
            content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
        request.Content = content;

        var response = await _http.SendAsync(request);
        if (response.IsSuccessStatusCode) return $"{bucket}/{path}";

        Console.WriteLine($"Supabase Storage upload error: {await response.Content.ReadAsStringAsync()}");
        return null;
    }

    public async Task<bool> DeleteAsync(string pathWithBucket)
    {
        if (!Configured) return false;

        var request = new HttpRequestMessage(HttpMethod.Delete, $"{_url}/storage/v1/object/{pathWithBucket}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _key);

        var response = await _http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            Console.WriteLine($"Supabase Storage delete error ({pathWithBucket}): {await response.Content.ReadAsStringAsync()}");
        return response.IsSuccessStatusCode;
    }

    public async Task<byte[]?> DownloadAsync(string pathWithBucket)
    {
        if (!Configured) return null;

        var request = new HttpRequestMessage(HttpMethod.Get, $"{_url}/storage/v1/object/{pathWithBucket}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _key);

        var response = await _http.SendAsync(request);
        if (response.IsSuccessStatusCode)
            return await response.Content.ReadAsByteArrayAsync();

        return null;
    }
}
