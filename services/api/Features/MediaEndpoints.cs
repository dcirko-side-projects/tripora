using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;
public class MediaFiles(IConfiguration configuration, IHostEnvironment environment)
{
    protected IConfiguration Configuration { get; } = configuration;
    private readonly string root = Path.GetFullPath(configuration["Tripora:MediaRoot"] ?? Path.Combine(environment.ContentRootPath, "local-data", "media"));
    private string PathFor(Guid id, bool thumbnail) => Path.Combine(root, id.ToString("N") + (thumbnail ? ".thumb.png" : ".png"));
    public virtual async Task Write(Guid id, byte[] bytes, bool thumbnail)
    {
        Directory.CreateDirectory(root); var target = PathFor(id, thumbnail); var temp = target + "." + Guid.NewGuid().ToString("N") + ".part";
        try
        {
            await using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.WriteThrough))
            { await file.WriteAsync(bytes); file.Flush(true); }
            File.Move(temp, target, true);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    public virtual Task<byte[]> Read(Guid id, bool thumbnail) => File.ReadAllBytesAsync(PathFor(id, thumbnail));
    public virtual Task Delete(Guid id) { foreach (var thumb in new[] { false, true }) { var file = PathFor(id, thumb); if (File.Exists(file)) File.Delete(file); } return Task.CompletedTask; }
    public virtual Task CleanInterrupted()
    {
        if (!Directory.Exists(root)) return Task.CompletedTask;
        foreach (var file in Directory.EnumerateFiles(root, "*.part")) if (File.GetLastWriteTimeUtc(file) < DateTime.UtcNow.AddDays(-1)) File.Delete(file);
        // Final files without a database record are handled by the guarded cleanup endpoint.
        return Task.CompletedTask;
    }
    public virtual Task CleanUntracked(HashSet<Guid> known)
    {
        if (!Directory.Exists(root)) return Task.CompletedTask;
        foreach (var file in Directory.EnumerateFiles(root, "*.png"))
        {
            var key = Path.GetFileName(file).Split('.')[0];
            if (Guid.TryParseExact(key, "N", out var id) && !known.Contains(id) && File.GetLastWriteTimeUtc(file) < DateTime.UtcNow.AddDays(-7)) File.Delete(file);
        }
        return Task.CompletedTask;
    }
}
public record MediaUpload(Guid Id, Guid TripId, string PngBase64, string ThumbnailBase64, string Sha256, string ThumbnailSha256);
public static class MediaEndpoints
{
    private static string Actor(ClaimsPrincipal actor) => actor.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private static string Digest(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    public static void MapMedia(this RouteGroupBuilder group)
    {
        group.MapPost("/api/media/push", async (MediaUpload request, ClaimsPrincipal actor, TriporaDb db, MediaFiles files) => {
            if (request.Id == Guid.Empty || request.TripId == Guid.Empty || request.PngBase64 is null || request.ThumbnailBase64 is null || request.Sha256 is null || request.ThumbnailSha256 is null ||
                request.PngBase64.Length > 12_000_000 || request.ThumbnailBase64.Length > 1_500_000) return Results.BadRequest(new { code = "invalid_media" });
            byte[] image; byte[] thumbnail;
            try { image = Convert.FromBase64String(request.PngBase64); thumbnail = Convert.FromBase64String(request.ThumbnailBase64); }
            catch (FormatException) { return Results.BadRequest(new { code = "invalid_media" }); }
            var hash = Digest(image); var thumbHash = Digest(thumbnail);
            if (hash != request.Sha256 || thumbHash != request.ThumbnailSha256 || !PngValidation.Valid(image, 1280, 8 * 1024 * 1024) || !PngValidation.Valid(thumbnail, 320, 1024 * 1024))
                return Results.BadRequest(new { code = "invalid_media" });
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var id = Actor(actor);
            if (!await db.Trips.AnyAsync(t => t.Id == request.TripId && !t.Deleted && (t.OwnerId == id || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == id && m.Active)))) return Results.NotFound();
            var prior = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == request.Id);
            if (prior is null && await db.MediaAssets.CountAsync(m => m.TripId == request.TripId) >= 100) return Results.Conflict(new { code = "media_limit" });
            if (prior is not null && (prior.PendingDeletion || prior.AuthorId != id || prior.TripId != request.TripId || prior.Sha256 != hash || prior.ThumbnailSha256 != thumbHash))
                return Results.Conflict(new { code = "media_id_reused" });
            await files.Write(request.Id, image, false); await files.Write(request.Id, thumbnail, true);
            if (prior is null) db.MediaAssets.Add(new MediaAsset { Id = request.Id, TripId = request.TripId, AuthorId = id, Sha256 = hash, ThumbnailSha256 = thumbHash, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { id = request.Id, sha256 = hash });
        });
        group.MapGet("/api/media/{mediaId:guid}", async (Guid mediaId, bool? thumbnail, ClaimsPrincipal actor, TriporaDb db, MediaFiles files, HttpContext context) => {
            context.Response.Headers.CacheControl = "private, no-store";
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var id = Actor(actor); var media = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == mediaId);
            if (media is null || media.PendingDeletion || !await db.Trips.AnyAsync(t => t.Id == media.TripId && !t.Deleted && (t.OwnerId == id || db.TripMembers.Any(m => m.TripId == t.Id && m.UserId == id && m.Active)))) return Results.NotFound();
            var memories = await db.Entries.Where(e => e.TripId == media.TripId && e.Feature == "memory" && !e.Deleted).ToListAsync();
            if (media.AuthorId != id && !memories.Any(e => JsonSerializer.Deserialize<MemoryData>(e.DataJson, EntryRules.Json)?.MediaId == mediaId)) return Results.NotFound();
            try { var bytes = await files.Read(mediaId, thumbnail == true); await tx.CommitAsync(); return Results.Ok(new { base64 = Convert.ToBase64String(bytes), sha256 = Digest(bytes) }); }
            catch (FileNotFoundException) { return Results.NotFound(); }
        });
        group.MapPost("/api/media/cleanup", async (ClaimsPrincipal actor, TriporaDb db, MediaFiles files) => {
            var id = Actor(actor); await using var tx = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(81724031)");
            var candidates = await db.MediaAssets.Where(m => m.PendingDeletion || m.AuthorId == id || db.Trips.Any(t => t.Id == m.TripId && t.OwnerId == id)).ToListAsync();
            var live = await db.Entries.Where(e => e.Feature == "memory" && !e.Deleted).ToListAsync();
            var referenced = live.Select(e => JsonSerializer.Deserialize<MemoryData>(e.DataJson, EntryRules.Json)?.MediaId).ToHashSet();
            var deleted = await db.Entries.Where(e => e.Feature == "memory" && e.Deleted && (e.AuthorId == id || db.Trips.Any(t => t.Id == e.TripId && t.OwnerId == id))).ToListAsync();
            var deletedMedia = deleted.Select(e => JsonSerializer.Deserialize<MemoryData>(e.DataJson, EntryRules.Json)?.MediaId).ToHashSet();
            var removed = 0;
            foreach (var media in candidates)
            {
                if (referenced.Contains(media.Id)) continue;
                if (!media.PendingDeletion && !deletedMedia.Contains(media.Id) && media.CreatedAt > DateTime.UtcNow.AddDays(-7)) continue;
                await files.Delete(media.Id); db.MediaAssets.Remove(media); removed++;
            }
            await db.SaveChangesAsync(); await files.CleanUntracked((await db.MediaAssets.Select(m => m.Id).ToListAsync()).ToHashSet());
            await tx.CommitAsync(); await files.CleanInterrupted(); return Results.Ok(new { removed });
        });
    }
}
