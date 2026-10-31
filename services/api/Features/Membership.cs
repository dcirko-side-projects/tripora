using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public record InviteRequest(string Email);
public record AcceptInvitation(string Token);
public static class Membership
{
    private static string Actor(ClaimsPrincipal actor) => actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    public static void MapMembership(this RouteGroupBuilder group)
    {
        group.MapPost("/api/trips/{tripId:guid}/invitations", async (Guid tripId, InviteRequest request, ClaimsPrincipal actor, TriporaDb db, UserManager<IdentityUser> users) => {
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var trip = await db.Trips.SingleOrDefaultAsync(t => t.Id == tripId && t.OwnerId == Actor(actor) && !t.Deleted);
            if (trip is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 254) return Results.BadRequest(new { code = "invalid_email" });
            var recipient = await users.FindByEmailAsync(request.Email.Trim());
            if (recipient is null || recipient.Id == trip.OwnerId) return Results.BadRequest(new { code = "recipient_unavailable" });
            if (await db.TripMembers.AnyAsync(m => m.TripId == tripId && m.UserId == recipient.Id && m.Active))
                return Results.Conflict(new { code = "already_member" });
            // Only the latest invitation for this trip/recipient may grant access.
            foreach (var old in await db.TripInvitations.Where(i => i.TripId == tripId && i.RecipientId == recipient.Id).ToListAsync()) old.Revoked = true;
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var invitation = new TripInvitation { Id = Guid.NewGuid(), TripId = tripId, RecipientId = recipient.Id, TokenHash = Hash(token), ExpiresAt = DateTime.UtcNow.AddDays(7) };
            db.TripInvitations.Add(invitation);
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Ok(new { invitation.Id, token, invitation.ExpiresAt });
        }).RequireRateLimiting("auth");

        group.MapPost("/api/invitations/accept", async (AcceptInvitation request, ClaimsPrincipal actor, TriporaDb db) => {
            if (request.Token is null || request.Token.Length != 64 || !request.Token.All(Uri.IsHexDigit)) return Results.BadRequest(new { code = "invitation_unavailable" });
            var digest = Hash(request.Token.ToUpperInvariant());
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var invite = await db.TripInvitations.SingleOrDefaultAsync(i => i.TokenHash == digest && i.RecipientId == Actor(actor));
            if (invite is null || invite.Revoked || invite.ExpiresAt <= DateTime.UtcNow) return Results.NotFound(new { code = "invitation_unavailable" });
            var trip = await db.Trips.SingleAsync(t => t.Id == invite.TripId);
            if (trip.Deleted) return Results.NotFound(new { code = "invitation_unavailable" });
            var member = await db.TripMembers.FindAsync(trip.Id, Actor(actor));
            if (invite.Accepted)
                return member?.Active == true ? Results.Ok(new { tripId = trip.Id }) : Results.NotFound();
            if (member is null) { member = new TripMember { TripId = trip.Id, UserId = Actor(actor) }; db.TripMembers.Add(member); }
            member.Active = true; invite.Accepted = true;
            // A newly granted trip must be newer than any existing device cursor.
            var clock = await db.SyncClocks.SingleAsync(c => c.Id == 1); trip.Version = ++clock.Value;
            foreach (var place in await db.Places.Where(p => p.TripId == trip.Id).ToListAsync()) place.Version = ++clock.Value;
            foreach (var entry in await db.Entries.Where(e => e.TripId == trip.Id && (e.Feature != "packing" || e.AuthorId == member.UserId)).ToListAsync()) entry.Version = ++clock.Value;
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Ok(new { tripId = trip.Id });
        }).RequireRateLimiting("auth");

        group.MapGet("/api/trips/{tripId:guid}/members", async (Guid tripId, ClaimsPrincipal actor, TriporaDb db) => {
            if (!await db.Trips.AnyAsync(t => t.Id == tripId && t.OwnerId == Actor(actor) && !t.Deleted)) return Results.NotFound();
            var members = await (from m in db.TripMembers join u in db.Users on m.UserId equals u.Id
                where m.TripId == tripId && m.Active select new { id = u.Id, u.Email }).ToListAsync();
            var invitations = await (from i in db.TripInvitations join u in db.Users on i.RecipientId equals u.Id
                where i.TripId == tripId && !i.Revoked && !i.Accepted && i.ExpiresAt > DateTime.UtcNow
                select new { i.Id, u.Email, i.ExpiresAt }).ToListAsync();
            return Results.Ok(new { members, invitations });
        });
        group.MapPost("/api/trips/{tripId:guid}/members/{userId}/remove", async (Guid tripId, string userId, ClaimsPrincipal actor, TriporaDb db) => {
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            if (!await db.Trips.AnyAsync(t => t.Id == tripId && t.OwnerId == Actor(actor) && !t.Deleted)) return Results.NotFound();
            if (userId == Actor(actor)) return Results.BadRequest(new { code = "cannot_remove_owner" });
            var member = await db.TripMembers.FindAsync(tripId, userId);
            if (member is not null) member.Active = false;
            foreach (var invite in await db.TripInvitations.Where(i => i.TripId == tripId && i.RecipientId == userId).ToListAsync()) invite.Revoked = true;
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent();
        });
        group.MapPost("/api/trips/{tripId:guid}/invitations/{invitationId:guid}/revoke", async (Guid tripId, Guid invitationId, ClaimsPrincipal actor, TriporaDb db) => {
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            if (!await db.Trips.AnyAsync(t => t.Id == tripId && t.OwnerId == Actor(actor) && !t.Deleted)) return Results.NotFound();
            var invite = await db.TripInvitations.SingleOrDefaultAsync(i => i.Id == invitationId && i.TripId == tripId);
            if (invite is null) return Results.NotFound();
            invite.Revoked = true;
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent();
        });
    }
}
