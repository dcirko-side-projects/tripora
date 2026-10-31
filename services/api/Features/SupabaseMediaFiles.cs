using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Tripora.Api.Features;

// Server-only service credentials. Clients always pass through the existing membership-checked API.
public sealed class SupabaseMediaFiles(IConfiguration configuration, IHostEnvironment environment, IHttpClientFactory clients) : MediaFiles(configuration, environment)
{
    private string Bucket => Configuration["Tripora:Storage:Bucket"] ?? "tripora-private";
    private HttpClient Client()
    {
        var client = clients.CreateClient("storage");
        client.BaseAddress = new Uri(Configuration["Tripora:Storage:Url"]!.TrimEnd('/') + "/storage/v1/");
        var key = Configuration["Tripora:Storage:ServiceKey"]!;
        client.DefaultRequestHeaders.Add("apikey", key);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        return client;
    }
    private static string Name(Guid id, bool thumbnail) => id.ToString("N") + (thumbnail ? ".thumb.png" : ".png");
    public async Task EnsurePrivateBucket()
    {
        using var client = Client();
        using var response = await client.GetAsync("bucket/" + Uri.EscapeDataString(Bucket));
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Private photo bucket is unavailable.");
        var bucket = await response.Content.ReadFromJsonAsync<JsonElement>();
        if (!bucket.TryGetProperty("public", out var visibility) || visibility.ValueKind != JsonValueKind.False)
            throw new InvalidOperationException("Refusing a public photo bucket.");
    }
    public override async Task Write(Guid id, byte[] bytes, bool thumbnail)
    {
        using var client = Client();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"object/{Uri.EscapeDataString(Bucket)}/{Name(id, thumbnail)}");
        request.Headers.Add("x-upsert", "true");
        request.Content = new ByteArrayContent(bytes); request.Content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode) throw new IOException("Private photo storage write failed.");
    }
    public override async Task<byte[]> Read(Guid id, bool thumbnail)
    {
        using var client = Client();
        using var response = await client.GetAsync($"object/authenticated/{Uri.EscapeDataString(Bucket)}/{Name(id, thumbnail)}");
        if (response.StatusCode == HttpStatusCode.NotFound || response.StatusCode == HttpStatusCode.BadRequest) throw new FileNotFoundException("Private photo unavailable.");
        if (!response.IsSuccessStatusCode) throw new IOException("Private photo storage read failed.");
        return await response.Content.ReadAsByteArrayAsync();
    }
    private async Task Remove(string[] names)
    {
        using var client = Client();
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"object/{Uri.EscapeDataString(Bucket)}") { Content = JsonContent.Create(new { prefixes = names }) };
        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode) throw new IOException("Private photo storage cleanup failed.");
    }
    public override Task Delete(Guid id) => Remove([Name(id, false), Name(id, true)]);
    public override Task CleanInterrupted() => Task.CompletedTask; // No remote .part files; each bounded object request is whole.
    public override async Task CleanUntracked(HashSet<Guid> known)
    {
        var expired = new List<string>();
        using var client = Client();
        for (var offset = 0; ; offset += 100)
        {
            using var response = await client.PostAsJsonAsync($"object/list/{Uri.EscapeDataString(Bucket)}", new { prefix = "", limit = 100, offset, sortBy = new { column = "name", order = "asc" } });
            if (!response.IsSuccessStatusCode) throw new IOException("Private photo inventory failed.");
            var rows = await response.Content.ReadFromJsonAsync<JsonElement>();
            foreach (var row in rows.EnumerateArray())
            {
                var name = row.GetProperty("name").GetString()!;
                if (!name.EndsWith(".png", StringComparison.Ordinal) || !Guid.TryParseExact(name.Split('.')[0], "N", out var id) || known.Contains(id)) continue;
                if (row.TryGetProperty("updated_at", out var time) && time.TryGetDateTimeOffset(out var updated) && updated < DateTimeOffset.UtcNow.AddDays(-7)) expired.Add(name);
            }
            if (rows.GetArrayLength() < 100) break;
        }
        // Collect before deleting so offset pagination cannot skip objects.
        foreach (var batch in expired.Chunk(100)) await Remove(batch);
    }
}
