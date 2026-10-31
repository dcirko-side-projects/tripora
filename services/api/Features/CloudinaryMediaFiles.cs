using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Tripora.Api.Features;

// Authenticated originals only. Provider URLs and credentials never leave the API.
public sealed class CloudinaryMediaFiles(IConfiguration configuration, IHostEnvironment environment, IHttpClientFactory clients) : MediaFiles(configuration, environment)
{
    private readonly bool testing = environment.IsEnvironment("Testing");
    private readonly SemaphoreSlim inventoryLock = new(1, 1);
    private DateTime nextInventory = DateTime.MinValue;
    private string Key => Configuration["Tripora:Storage:ApiKey"]!;
    private string Secret => Configuration["Tripora:Storage:ApiSecret"]!;
    private string PublicId(Guid id, bool thumbnail) => "tripora/" + id.ToString("N") + (thumbnail ? "-thumb" : "");
    private string Root => testing && Configuration["Tripora:Storage:TestUrl"] is { Length: > 0 } test
        ? test.TrimEnd('/') : "https://api.cloudinary.com/v1_1/" + Uri.EscapeDataString(Configuration["Tripora:Storage:CloudName"]!);
    private Dictionary<string, string> Signed(Dictionary<string, string> fields)
    {
        fields["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var canonical = string.Join("&", fields.OrderBy(x => x.Key, StringComparer.Ordinal).Select(x => x.Key + "=" + x.Value));
        fields["signature"] = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical + Secret))).ToLowerInvariant();
        fields["api_key"] = Key;
        return fields;
    }
    public override async Task Write(Guid id, byte[] bytes, bool thumbnail)
    {
        var fields = Signed(new() { ["public_id"] = PublicId(id, thumbnail), ["type"] = "authenticated", ["overwrite"] = "true" });
        using var body = new MultipartFormDataContent();
        foreach (var item in fields) body.Add(new StringContent(item.Value), item.Key);
        var file = new ByteArrayContent(bytes); file.Headers.ContentType = new MediaTypeHeaderValue("image/png"); body.Add(file, "file", "image.png");
        using var client = clients.CreateClient("storage");
        using var response = await client.PostAsync(Root + "/image/upload", body);
        if (!response.IsSuccessStatusCode) throw new IOException("Private photo storage write failed.");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (json.RootElement.GetProperty("type").GetString() != "authenticated" || json.RootElement.GetProperty("public_id").GetString() != PublicId(id, thumbnail))
            throw new IOException("Private photo storage did not confirm authenticated identity.");
    }
    public override async Task<byte[]> Read(Guid id, bool thumbnail)
    {
        var fields = Signed(new() { ["public_id"] = PublicId(id, thumbnail), ["type"] = "authenticated", ["format"] = "png",
            ["expires_at"] = DateTimeOffset.UtcNow.AddMinutes(1).ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture) });
        var query = string.Join("&", fields.Select(x => Uri.EscapeDataString(x.Key) + "=" + Uri.EscapeDataString(x.Value)));
        using var client = clients.CreateClient("storage");
        using var response = await client.GetAsync(Root + "/image/download?" + query);
        if (response.StatusCode == HttpStatusCode.NotFound) throw new FileNotFoundException("Private photo unavailable.");
        if (!response.IsSuccessStatusCode) throw new IOException("Private photo storage read failed.");
        return await response.Content.ReadAsByteArrayAsync();
    }
    private async Task Remove(string publicId)
    {
        using var client = clients.CreateClient("storage");
        using var response = await client.PostAsync(Root + "/image/destroy", new FormUrlEncodedContent(Signed(new() { ["public_id"] = publicId, ["type"] = "authenticated", ["invalidate"] = "true" })));
        if (!response.IsSuccessStatusCode) throw new IOException("Private photo storage cleanup failed.");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (json.RootElement.GetProperty("result").GetString() is not ("ok" or "not found")) throw new IOException("Private photo removal not confirmed.");
    }
    public override async Task Delete(Guid id) { await Remove(PublicId(id, false)); await Remove(PublicId(id, true)); }
    public override Task CleanInterrupted() => Task.CompletedTask;
    public override async Task CleanUntracked(HashSet<Guid> known)
    {
        if (!await inventoryLock.WaitAsync(0)) return;
        try
        {
            if (DateTime.UtcNow < nextInventory) return;
            var expired = new List<string>(); string? cursor = null;
            using var client = clients.CreateClient("storage");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(Key + ":" + Secret)));
            do
            {
                using var response = await client.GetAsync(Root + "/resources/image/authenticated?prefix=tripora%2F&max_results=500" + (cursor is null ? "" : "&next_cursor=" + Uri.EscapeDataString(cursor)));
                if (!response.IsSuccessStatusCode) throw new IOException("Private photo inventory failed.");
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                foreach (var item in json.RootElement.GetProperty("resources").EnumerateArray())
                {
                    var name = item.GetProperty("public_id").GetString()!;
                    if (!name.StartsWith("tripora/", StringComparison.Ordinal)) continue;
                    var key = name[8..]; if (key.EndsWith("-thumb", StringComparison.Ordinal)) key = key[..^6];
                    if (Guid.TryParseExact(key, "N", out var id) && !known.Contains(id) && item.GetProperty("created_at").GetDateTimeOffset() < DateTimeOffset.UtcNow.AddDays(-7)) expired.Add(name);
                }
                var next = json.RootElement.TryGetProperty("next_cursor", out var value) ? value.GetString() : null;
                if (next is not null && next == cursor) throw new IOException("Private photo inventory did not advance.");
                cursor = next;
            } while (cursor is not null);
            foreach (var name in expired) await Remove(name);
            nextInventory = DateTime.UtcNow.AddMinutes(30);
        }
        finally { inventoryLock.Release(); }
    }
}
