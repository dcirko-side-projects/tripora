using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;
public record EntryMutation(Guid OperationId, Guid EntryId, Guid TripId, string Feature, string Kind, long BaseVersion, JsonElement? Data);
public record EntryView(Guid Id, Guid TripId, string Feature, string AuthorId, string AuthorEmail, JsonElement Data, DateTime CreatedAt, long Version, bool Deleted)
{
    public static EntryView From(TripEntry e) => new(e.Id, e.TripId, e.Feature, e.AuthorId, e.AuthorEmail, JsonSerializer.Deserialize<JsonElement>(e.DataJson), e.CreatedAt, e.Version, e.Deleted);
}
public static class EntrySync
{
    public static void MapEntrySync(this RouteGroupBuilder group)
    {
        group.MapPost("/push", Push);
        group.MapGet("/pull", async (long? after, ClaimsPrincipal actor, TriporaDb db) => {
            var cursor = after ?? 0; if (cursor < 0) return Results.BadRequest(new { code = "invalid_cursor" });
            var id = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var trips = db.Trips.Where(t => t.OwnerId == id || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == id && m.Active));
            var rows = await db.Entries.AsNoTracking().Where(e => trips.Any(t => t.Id == e.TripId) && (e.Feature != "packing" || e.AuthorId == id) && e.Version > cursor).OrderBy(e => e.Version).Take(101).ToListAsync();
            var items = rows.Take(100).Select(EntryView.From).ToList(); await tx.CommitAsync();
            return Results.Ok(new { items, cursor = items.Count == 0 ? cursor : items[^1].Version, hasMore = rows.Count > 100 });
        });
    }
    private static async Task<IResult> Push(EntryMutation op, ClaimsPrincipal actor, TriporaDb db)
    {
        if (op.OperationId == Guid.Empty || op.EntryId == Guid.Empty || op.TripId == Guid.Empty || !EntryRules.Feature(op.Feature) ||
            op.Kind is not ("create" or "update" or "delete") || op.BaseVersion < 0 || (op.Kind != "delete" && op.Data is null)) return Results.BadRequest(new { code = "invalid_entry" });
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
        var trip = await db.Trips.SingleOrDefaultAsync(t => t.Id == op.TripId && (t.OwnerId == actorId || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == actorId && m.Active)));
        if (trip is null) return Results.NotFound(new { code = "trip_unavailable" });
        if (trip.Deleted) return Results.Conflict(new { code = "trip_deleted" });
        var entry = await db.Entries.SingleOrDefaultAsync(e => e.Id == op.EntryId);
        if (entry is not null && (entry.TripId != op.TripId || entry.Feature != op.Feature)) return Results.NotFound();
        if (entry?.Feature == "packing" && entry.AuthorId != actorId) return Results.NotFound();
        if (entry is not null && entry.Feature is "expense" or "memory" && entry.AuthorId != actorId && trip.OwnerId != actorId) return Results.Json(new { code = "author_or_owner_required" }, statusCode: 403);
        if (op.Feature == "budget" && (op.EntryId != trip.Id || trip.OwnerId != actorId || op.Kind == "delete")) return Results.Json(new { code = "owner_required" }, statusCode: 403);
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("entry:" + JsonSerializer.Serialize(op, EntryRules.Json))));
        var prior = await db.Receipts.FindAsync(actorId, op.OperationId);
        if (prior is not null) return prior.Digest == digest ? Results.Content(prior.ResponseJson, "application/json") : Results.Conflict(new { code = "operation_id_reused" });
        if (op.Kind == "create")
        {
            if (entry is not null) return Results.Conflict(new { code = "version_conflict", current = EntryView.From(entry) });
            if (op.BaseVersion != 0) return Results.BadRequest();
        }
        else if (entry is null) return Results.NotFound();
        else if (entry.Deleted || entry.Version != op.BaseVersion) return Results.Conflict(new { code = "version_conflict", current = EntryView.From(entry) });
        var normalized = op.Kind == "delete" ? null : await EntryRules.Normalize(op.Feature, op.Data!.Value, trip, actorId, db, entry);
        if (op.Kind != "delete" && normalized is null) return Results.BadRequest(new { code = "invalid_entry_data" });
        if (entry is null)
        {
            entry = new TripEntry { Id = op.EntryId, TripId = trip.Id, Feature = op.Feature, AuthorId = actorId,
                AuthorEmail = actor.FindFirstValue(ClaimTypes.Email) ?? "", CreatedAt = DateTime.UtcNow }; db.Entries.Add(entry);
        }
        if (op.Kind == "delete") entry.Deleted = true; else entry.DataJson = normalized!;
        var clock = await db.SyncClocks.SingleAsync(c => c.Id == 1); entry.Version = ++clock.Value;
        var json = JsonSerializer.Serialize(EntryView.From(entry), EntryRules.Json);
        db.Receipts.Add(new MutationReceipt { ActorId = actorId, OperationId = op.OperationId, Digest = digest, ResponseJson = json });
        await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Content(json, "application/json");
    }
}
