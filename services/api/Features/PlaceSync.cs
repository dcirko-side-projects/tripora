using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public record PlaceLocation(double Latitude, double Longitude, string DisplayName, string Provider, string ProviderId);
public record PlaceData(string Category, string Name, string Notes, string Address, string Link, bool Visited,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] PlaceLocation? Location = null);
public record PlaceMutation(Guid OperationId, Guid PlaceId, Guid TripId, string Kind, long BaseVersion, PlaceData? Data);
public record PlaceView(Guid Id, Guid TripId, string Category, string Name, string Notes, string Address, string Link,
    bool Visited, DateTime CreatedAt, long Version, bool Deleted, PlaceLocation? Location = null)
{
    public static PlaceView From(PlaceRecord p) => new(p.Id, p.TripId, p.Category, p.Name, p.Notes, p.Address, p.Link, p.Visited, p.CreatedAt, p.Version, p.Deleted,
        p.LocationJson is null ? null : JsonSerializer.Deserialize<PlaceLocation>(p.LocationJson));
}
public static class PlaceSync
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static void MapPlaceSync(this RouteGroupBuilder group)
    {
        group.MapPost("/push", Push);
        group.MapGet("/pull", async (long? after, ClaimsPrincipal actor, TriporaDb db) => {
            var cursor = after ?? 0;
            if (cursor < 0) return Results.BadRequest(new { code = "invalid_cursor" });
            var id = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var available = db.Trips.Where(t => t.OwnerId == id || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == id && m.Active));
            var rows = await db.Places.AsNoTracking().Where(p => available.Any(t => t.Id == p.TripId) && p.Version > cursor)
                .OrderBy(p => p.Version).Take(101).ToListAsync();
            var items = rows.Take(100).Select(PlaceView.From).ToList();
            await tx.CommitAsync();
            return Results.Ok(new { items, cursor = items.Count == 0 ? cursor : items[^1].Version, hasMore = rows.Count > 100 });
        });
    }
    private static bool Valid(PlaceData d) => d.Category is "place" or "food" or "nightlife" &&
        !string.IsNullOrWhiteSpace(d.Name) && d.Name.Trim().Length <= 120 && d.Notes is { Length: <= 2000 } &&
        d.Address is { Length: <= 300 } && d.Link is { Length: <= 1000 } &&
        (d.Link.Length == 0 || (Uri.TryCreate(d.Link, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")) && ValidLocation(d.Location);
    public static bool ValidLocation(PlaceLocation? p) => p is null ||
        (double.IsFinite(p.Latitude) && Math.Abs(p.Latitude) <= 90 && double.IsFinite(p.Longitude) && Math.Abs(p.Longitude) <= 180 &&
         p.Provider == "osm" && p.DisplayName is { Length: > 0 and <= 1000 } && p.ProviderId is not null &&
         System.Text.RegularExpressions.Regex.IsMatch(p.ProviderId, "^[NWR][0-9]{1,20}$"));
    private static async Task<IResult> Push(PlaceMutation request, ClaimsPrincipal actor, TriporaDb db)
    {
        if (request.OperationId == Guid.Empty || request.PlaceId == Guid.Empty || request.TripId == Guid.Empty || request.BaseVersion < 0 ||
            request.Kind is not ("place.create" or "place.update" or "place.delete")) return Results.BadRequest(new { code = "invalid_operation" });
        if (request.Kind != "place.delete" && (request.Data is null || !Valid(request.Data))) return Results.BadRequest(new { code = "invalid_place" });
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
        var trip = await db.Trips.SingleOrDefaultAsync(t => t.Id == request.TripId && (t.OwnerId == actorId || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == actorId && m.Active)));
        if (trip is null) return Results.NotFound(new { code = "trip_unavailable" });
        if (trip.Deleted) return Results.Conflict(new { code = "trip_deleted" });
        var place = await db.Places.SingleOrDefaultAsync(p => p.Id == request.PlaceId);
        if (place is not null && place.TripId != request.TripId) return Results.NotFound(new { code = "place_unavailable" });
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("place:" + JsonSerializer.Serialize(request, Json))));
        var receipt = await db.Receipts.FindAsync(actorId, request.OperationId);
        if (receipt is not null) return receipt.Digest == digest ? Results.Content(receipt.ResponseJson, "application/json") : Results.Conflict(new { code = "operation_id_reused" });
        if (request.Kind == "place.create")
        {
            if (place is not null) return Results.Conflict(new { code = "version_conflict", current = PlaceView.From(place) });
            if (request.BaseVersion != 0) return Results.BadRequest(new { code = "invalid_base_version" });
            place = new PlaceRecord { Id = request.PlaceId, TripId = trip.Id, AuthorId = actorId, CreatedAt = DateTime.UtcNow }; db.Places.Add(place);
        }
        else
        {
            if (place is null) return Results.NotFound(new { code = "place_unavailable" });
            if (place.Deleted || place.Version != request.BaseVersion) return Results.Conflict(new { code = "version_conflict", current = PlaceView.From(place) });
        }
        if (request.Kind == "place.delete") { place.Deleted = true; place.LocationJson = null; }
        else
        {
            var d = request.Data!; place.Category = d.Category; place.Name = d.Name.Trim(); place.Notes = d.Notes.Trim();
            place.Address = d.Address.Trim(); place.Link = d.Link.Trim(); place.Visited = d.Visited;
            place.LocationJson = d.Location is null ? null : JsonSerializer.Serialize(d.Location);
        }
        var clock = await db.SyncClocks.SingleAsync(c => c.Id == 1); place.Version = ++clock.Value;
        var json = JsonSerializer.Serialize(PlaceView.From(place), Json);
        db.Receipts.Add(new MutationReceipt { ActorId = actorId, OperationId = request.OperationId, Digest = digest, ResponseJson = json });
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Content(json, "application/json");
    }
}
