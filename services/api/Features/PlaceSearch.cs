using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public record PlaceSearchRequest(Guid TripId, string Name, string City);
public static class PlaceSearch
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static void MapPlaceSearch(this RouteGroupBuilder group)
    {
        group.MapGet("/api/maps/config", (IConfiguration config) => Results.Ok(new {
            tileUrl = config["Tripora:Maps:TileUrl"] ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution = config["Tripora:Maps:Attribution"] ?? "© OpenStreetMap contributors",
            attributionUrl = config["Tripora:Maps:AttributionUrl"] ?? "https://www.openstreetmap.org/copyright"
        }));
        group.MapPost("/api/places/search", Search).RequireRateLimiting("places");
    }
    private static async Task<IResult> Search(PlaceSearchRequest input, ClaimsPrincipal actor, TriporaDb db,
        IHttpClientFactory clients, IConfiguration config, IHostEnvironment environment, HttpContext context)
    {
        if (input.TripId == Guid.Empty || string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 120 ||
            string.IsNullOrWhiteSpace(input.City) || input.City.Length > 120)
            return Results.BadRequest(new { code = "invalid_search" });
        var user = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
        if (!await db.Trips.AnyAsync(t => t.Id == input.TripId && !t.Deleted &&
            (t.OwnerId == user || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == user && m.Active))))
            return Results.NotFound(new { code = "trip_unavailable" });
        var query = input.Name.Trim() + ", " + input.City.Trim();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(query.ToLowerInvariant())));
        await using var tx = await db.Database.BeginTransactionAsync();
        // One application-wide upstream request at a time, across instances/restarts.
        var acquired = await db.Database.SqlQueryRaw<bool>("SELECT pg_try_advisory_xact_lock(81724032) AS \"Value\"").SingleAsync();
        if (!acquired) return Limited(context);
        var now = DateTime.UtcNow;
        var cached = await db.PlaceSearchCache.FindAsync(hash);
        if (cached is not null && cached.UpdatedAt > now.AddDays(-30))
            return Results.Content(cached.ResultsJson, "application/json");
        var gate = await db.PlaceSearchCache.FindAsync("upstream");
        if (gate is not null && gate.UpdatedAt > now.AddMilliseconds(-1100)) return Limited(context);
        var daily = await db.PlaceSearchCache.FindAsync("daily");
        var count = daily is not null && daily.UpdatedAt.Date == now.Date && int.TryParse(daily.ResultsJson, out var previous) ? previous : 0;
        if (count >= config.GetValue("Tripora:Maps:DailySearchLimit", 200)) return Limited(context);
        gate ??= new PlaceSearchCache { Id = "upstream" }; gate.UpdatedAt = now;
        if (db.Entry(gate).State == EntityState.Detached) db.Add(gate);
        daily ??= new PlaceSearchCache { Id = "daily" }; daily.UpdatedAt = now; daily.ResultsJson = (count + 1).ToString(CultureInfo.InvariantCulture);
        if (db.Entry(daily).State == EntityState.Detached) db.Add(daily);
        IResult result;
        try
        {
            using var client = clients.CreateClient("places");
            var origin = config["Tripora:Maps:SearchUrl"] ?? "https://nominatim.openstreetmap.org/search";
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var endpoint) ||
                (endpoint.Scheme != "https" && !(environment.IsEnvironment("Testing") && endpoint.IsLoopback)))
                throw new InvalidOperationException("Place search requires HTTPS.");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Tripora/0.1");
            using var response = await client.GetAsync(origin + "?format=jsonv2&limit=5&accept-language=hr,en&q=" + Uri.EscapeDataString(query), context.RequestAborted);
            response.EnsureSuccessStatusCode();
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(context.RequestAborted));
            var matches = new List<PlaceLocation>();
            foreach (var row in document.RootElement.EnumerateArray().Take(5))
            {
                if (!row.TryGetProperty("lat", out var lat) || !row.TryGetProperty("lon", out var lon) ||
                    !double.TryParse(lat.GetString(), CultureInfo.InvariantCulture, out var latitude) ||
                    !double.TryParse(lon.GetString(), CultureInfo.InvariantCulture, out var longitude)) continue;
                var type = row.GetProperty("osm_type").GetString() switch { "node" => "N", "way" => "W", "relation" => "R", _ => "?" };
                var match = new PlaceLocation(latitude, longitude, row.GetProperty("display_name").GetString() ?? "", "osm", type + row.GetProperty("osm_id").ToString());
                if (PlaceSync.ValidLocation(match)) matches.Add(match);
            }
            var json = JsonSerializer.Serialize(new { items = matches.DistinctBy(p => p.ProviderId).ToArray() }, Json);
            cached ??= new PlaceSearchCache { Id = hash }; cached.ResultsJson = json; cached.UpdatedAt = now;
            if (db.Entry(cached).State == EntityState.Detached) db.Add(cached);
            // Bound the shared cache without retaining raw user queries/account identities.
            await db.PlaceSearchCache.Where(c => c.Id != "upstream" && c.Id != "daily" && c.UpdatedAt < now.AddDays(-30)).ExecuteDeleteAsync();
            result = Results.Content(json, "application/json");
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException or KeyNotFoundException or FormatException)
        { result = Results.Json(new { code = "place_search_unavailable" }, statusCode: 503); }
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return result;
    }
    private static IResult Limited(HttpContext context)
    {
        context.Response.Headers.RetryAfter = "2";
        return Results.Json(new { code = "place_search_limited" }, statusCode: 429);
    }
}
