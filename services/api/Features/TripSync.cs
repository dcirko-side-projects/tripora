using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public record TripData(string Name, string Destination, DateOnly StartDate, DateOnly EndDate);
public record TripMutation(Guid OperationId, Guid TripId, string Kind, long BaseVersion, TripData? Data);
public record TripView(Guid Id, string Name, string Destination, DateOnly StartDate, DateOnly EndDate,
    DateTime CreatedAt, long Version, bool Deleted)
{
    public static TripView From(TripRecord t) => new(t.Id, t.Name, t.Destination, t.StartDate, t.EndDate, t.CreatedAt, t.Version, t.Deleted);
}
public static class TripSync
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static void MapTripSync(this RouteGroupBuilder group)
    {
        group.MapPost("/push", Push);
        group.MapGet("/pull", async (long? after, ClaimsPrincipal actor, TriporaDb db) => {
            var cursor = after ?? 0;
            if (cursor < 0) return Results.BadRequest(new { code = "invalid_cursor" });
            var id = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var rows = await db.Trips.AsNoTracking().Where(t => t.OwnerId == id && t.Version > cursor)
                .OrderBy(t => t.Version).Take(101).ToListAsync();
            var items = rows.Take(100).Select(TripView.From).ToList();
            return Results.Ok(new { items, cursor = items.Count == 0 ? cursor : items[^1].Version, hasMore = rows.Count > 100 });
        });
    }
    private static async Task<IResult> Push(TripMutation request, ClaimsPrincipal actor, TriporaDb db)
    {
        if (request.OperationId == Guid.Empty || request.TripId == Guid.Empty || request.BaseVersion < 0 ||
            request.Kind is not ("trip.create" or "trip.update" or "trip.delete"))
            return Results.BadRequest(new { code = "invalid_operation" });
        var data = request.Data;
        if (request.Kind != "trip.delete" && (data is null || string.IsNullOrWhiteSpace(data.Name) ||
            data.Name.Trim().Length > 100 || string.IsNullOrWhiteSpace(data.Destination) ||
            data.Destination.Trim().Length > 120 || data.StartDate == default || data.EndDate < data.StartDate))
            return Results.BadRequest(new { code = "invalid_trip" });
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request, Json))));
        await using var transaction = await db.Database.BeginTransactionAsync();
        // Deliberately serialized tiny spike. Prevents receipt races AND out-of-order cursor commits.
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
        var trip = await db.Trips.SingleOrDefaultAsync(t => t.Id == request.TripId);
        if (trip is not null && trip.OwnerId != actorId) return Results.NotFound(new { code = "trip_unavailable" });
        var prior = await db.Receipts.FindAsync(actorId, request.OperationId);
        if (prior is not null)
            return prior.Digest == digest ? Results.Content(prior.ResponseJson, "application/json") :
                Results.Conflict(new { code = "operation_id_reused" });

        if (request.Kind == "trip.create")
        {
            if (trip is not null) return Results.Conflict(new { code = "version_conflict", current = TripView.From(trip) });
            if (request.BaseVersion != 0) return Results.BadRequest(new { code = "invalid_base_version" });
            trip = new TripRecord { Id = request.TripId, OwnerId = actorId, CreatedAt = DateTime.UtcNow };
            db.Trips.Add(trip);
        }
        else
        {
            if (trip is null) return Results.NotFound(new { code = "trip_unavailable" });
            if (trip.Deleted || trip.Version != request.BaseVersion)
                return Results.Conflict(new { code = "version_conflict", current = TripView.From(trip) });
        }
        if (request.Kind == "trip.delete") trip.Deleted = true;
        else
        {
            trip.Name = data!.Name.Trim();
            trip.Destination = data.Destination.Trim();
            trip.StartDate = data.StartDate;
            trip.EndDate = data.EndDate;
        }
        var clock = await db.SyncClocks.SingleAsync(c => c.Id == 1);
        trip.Version = ++clock.Value;
        var json = JsonSerializer.Serialize(TripView.From(trip), Json);
        db.Receipts.Add(new MutationReceipt { ActorId = actorId, OperationId = request.OperationId, Digest = digest, ResponseJson = json });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Content(json, "application/json");
    }
}
