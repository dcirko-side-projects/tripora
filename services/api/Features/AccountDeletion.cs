using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public record DeleteAccountRequest(string Password, string Confirmation);
public static class AccountDeletion
{
    public const string Confirmation = "OBRIŠI RAČUN I PUTOVANJA";
    public static void MapAccountDeletion(this RouteGroupBuilder group)
    {
        group.MapPost("/auth/delete-account", async (DeleteAccountRequest request, ClaimsPrincipal actor, TriporaDb db, UserManager<IdentityUser> users, MediaFiles files) => {
            if (request.Confirmation != Confirmation || string.IsNullOrEmpty(request.Password) || request.Password.Length > 1024)
                return Results.BadRequest(new { code = "deletion_confirmation_required" });
            var id = actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var user = await users.GetUserAsync(actor);
            if (user is null) return Results.Unauthorized();
            await db.Entry(user).ReloadAsync();
            if (user.PasswordHash is null || user.SecurityStamp != actor.FindFirstValue("AspNet.Identity.SecurityStamp") || await users.IsLockedOutAsync(user)) return Results.Unauthorized();
            if (!await users.CheckPasswordAsync(user, request.Password))
            {
                await users.AccessFailedAsync(user); await tx.CommitAsync();
                return Results.BadRequest(new { code = "deletion_password_invalid" });
            }
            var owned = await db.Trips.Where(t => t.OwnerId == id).ToListAsync();
            var trips = owned.Select(t => t.Id).ToArray();
            var places = await db.Places.Where(p => p.AuthorId == id || trips.Contains(p.TripId)).ToListAsync();
            var entries = await db.Entries.Where(e => e.AuthorId == id || trips.Contains(e.TripId)).ToListAsync();
            var assets = await db.MediaAssets.Where(m => m.AuthorId == id || trips.Contains(m.TripId)).ToListAsync();
            var assetIds = assets.Select(m => m.Id).ToHashSet();
            var clock = await db.SyncClocks.SingleAsync(c => c.Id == 1);
            var tripIds = trips.ToHashSet(); var placeIds = places.Select(p => p.Id).ToHashSet(); var entryIds = entries.Select(e => e.Id).ToHashSet();
            foreach (var trip in owned) { trip.Deleted = true; trip.Name = "Obrisano putovanje"; trip.Destination = "Obrisano"; trip.StartDate = trip.EndDate = new DateOnly(2000, 1, 1); trip.Version = ++clock.Value; }
            foreach (var place in places) { place.Deleted = true; place.Name = "Obrisano"; place.Notes = place.Address = place.Link = ""; place.LocationJson = null; place.Visited = false; place.Version = ++clock.Value; }
            foreach (var entry in entries) { entry.Deleted = true; entry.AuthorEmail = ""; entry.DataJson = ErasedData(entry.Feature, entry.DataJson); entry.Version = ++clock.Value; }
            // A different author's text can survive while the closing account's image is removed.
            foreach (var memory in await db.Entries.Where(e => e.Feature == "memory" && !e.Deleted).ToListAsync())
            {
                var data = JsonSerializer.Deserialize<MemoryData>(memory.DataJson, EntryRules.Json)!;
                if (data.MediaId is { } mediaId && assetIds.Contains(mediaId))
                { memory.DataJson = JsonSerializer.Serialize(data with { MediaId = null }, EntryRules.Json); memory.Version = ++clock.Value; entryIds.Add(memory.Id); }
            }
            foreach (var member in await db.TripMembers.Where(m => m.UserId == id).ToListAsync()) member.Active = false;
            foreach (var invite in await db.TripInvitations.Where(i => i.RecipientId == id || trips.Contains(i.TripId)).ToListAsync()) { invite.Revoked = true; invite.TokenHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"); }
            foreach (var receipt in await db.Receipts.ToListAsync())
            {
                using var json = JsonDocument.Parse(receipt.ResponseJson);
                var erased = json.RootElement.TryGetProperty("id", out var key) && key.TryGetGuid(out var resource) &&
                    (json.RootElement.TryGetProperty("feature", out _) ? entryIds.Contains(resource) : json.RootElement.TryGetProperty("category", out _) ? placeIds.Contains(resource) : tripIds.Contains(resource));
                if (receipt.ActorId == id || erased) db.Receipts.Remove(receipt);
            }
            db.UserClaims.RemoveRange(await db.UserClaims.Where(c => c.UserId == id).ToListAsync());
            db.UserLogins.RemoveRange(await db.UserLogins.Where(l => l.UserId == id).ToListAsync());
            db.UserTokens.RemoveRange(await db.UserTokens.Where(t => t.UserId == id).ToListAsync());
            db.UserRoles.RemoveRange(await db.UserRoles.Where(r => r.UserId == id).ToListAsync());
            user.UserName = "deleted-" + Guid.NewGuid().ToString("N"); user.NormalizedUserName = user.UserName.ToUpperInvariant();
            user.Email = user.NormalizedEmail = user.PhoneNumber = user.PasswordHash = null;
            user.EmailConfirmed = user.PhoneNumberConfirmed = user.TwoFactorEnabled = false;
            user.SecurityStamp = Guid.NewGuid().ToString(); user.ConcurrencyStamp = Guid.NewGuid().ToString(); user.LockoutEnabled = true; user.LockoutEnd = DateTimeOffset.MaxValue;
            foreach (var asset in assets) asset.PendingDeletion = true;
            await db.SaveChangesAsync(); await tx.CommitAsync();
            // Authorization/tombstones commit first. Failed byte deletion remains durable and retriable.
            var pending = 0;
            foreach (var asset in assets)
            {
                try { await files.Delete(asset.Id); db.MediaAssets.Remove(asset); }
                catch (Exception error) when (error is IOException or HttpRequestException or OperationCanceledException) { pending++; }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { deleted = true, mediaCleanupPending = pending });
        }).RequireRateLimiting("auth");
    }
    private static string ErasedData(string feature, string previous)
    {
        using var json = JsonDocument.Parse(previous);
        var currency = json.RootElement.TryGetProperty("currency", out var c) ? c.GetString() ?? "EUR" : "EUR";
        object data = feature switch {
            "plan" => new PlanData("Obrisano", "", "", "", "activity", null, false),
            "packing" => new PackingData("Obrisano", false),
            "budget" => new BudgetData(currency, null),
            "expense" => new ExpenseData("Obrisano", "", "2000-01-01", "ostalo", "1", currency, ""),
            _ => new MemoryData("Obrisano", "", null, null)
        };
        return JsonSerializer.Serialize(data, EntryRules.Json);
    }
}
