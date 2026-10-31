using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;

namespace Tripora.Api.Data;

public class TriporaDb(DbContextOptions<TriporaDb> options) : IdentityDbContext<IdentityUser>(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<TripRecord> Trips => Set<TripRecord>();
    public DbSet<MutationReceipt> Receipts => Set<MutationReceipt>();
    public DbSet<SyncClock> SyncClocks => Set<SyncClock>();
    public DbSet<TripMember> TripMembers => Set<TripMember>();
    public DbSet<TripInvitation> TripInvitations => Set<TripInvitation>();
    public DbSet<PlaceRecord> Places => Set<PlaceRecord>();
    public DbSet<PlaceSearchCache> PlaceSearchCache => Set<PlaceSearchCache>();
    public DbSet<TripEntry> Entries => Set<TripEntry>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        base.OnModelCreating(model);
        model.Entity<TripRecord>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Destination).HasMaxLength(120);
            e.HasOne<IdentityUser>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.OwnerId, x.Version });
        });
        model.Entity<MutationReceipt>().HasKey(x => new { x.ActorId, x.OperationId });
        model.Entity<MutationReceipt>().HasOne<IdentityUser>().WithMany().HasForeignKey(x => x.ActorId);
        model.Entity<SyncClock>().HasData(new SyncClock { Id = 1, Value = 0 });
        model.Entity<TripMember>(e => {
            e.HasKey(x => new { x.TripId, x.UserId });
            e.HasOne<TripRecord>().WithMany().HasForeignKey(x => x.TripId);
            e.HasOne<IdentityUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<TripInvitation>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasOne<TripRecord>().WithMany().HasForeignKey(x => x.TripId);
            e.HasOne<IdentityUser>().WithMany().HasForeignKey(x => x.RecipientId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PlaceRecord>(e => {
            e.HasKey(x => x.Id);
            e.HasOne<TripRecord>().WithMany().HasForeignKey(x => x.TripId);
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Category).HasMaxLength(16);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.Address).HasMaxLength(300);
            e.Property(x => x.Link).HasMaxLength(1000);
            e.HasIndex(x => new { x.TripId, x.Version });
        });
        model.Entity<TripEntry>(e => {
            e.HasKey(x => x.Id);
            e.HasOne<TripRecord>().WithMany().HasForeignKey(x => x.TripId);
            e.HasOne<IdentityUser>().WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Feature).HasMaxLength(16);
            e.HasIndex(x => new { x.TripId, x.Version });
        });
        model.Entity<MediaAsset>(e => {
            e.HasKey(x => x.Id);
            e.HasOne<TripRecord>().WithMany().HasForeignKey(x => x.TripId);
            e.HasOne<IdentityUser>().WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Sha256).HasMaxLength(64);
            e.Property(x => x.ThumbnailSha256).HasMaxLength(64);
        });
    }
}
public class TripRecord
{
    public Guid Id { get; set; }
    public string OwnerId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Destination { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public long Version { get; set; }
    public bool Deleted { get; set; }
}
public class MutationReceipt
{
    public string ActorId { get; set; } = "";
    public Guid OperationId { get; set; }
    public string Digest { get; set; } = "";
    public string ResponseJson { get; set; } = "";
}
public class SyncClock
{
    public int Id { get; set; }
    public long Value { get; set; }
}
public class TripMember
{
    public Guid TripId { get; set; }
    public string UserId { get; set; } = "";
    public bool Active { get; set; }
}
public class TripInvitation
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string RecipientId { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public bool Revoked { get; set; }
    public bool Accepted { get; set; }
}
public class PlaceRecord
{
    public string? LocationJson { get; set; }
    public string? AuthorId { get; set; }
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string Category { get; set; } = "place";
    public string Name { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Address { get; set; } = "";
    public string Link { get; set; } = "";
    public bool Visited { get; set; }
    public DateTime CreatedAt { get; set; }
    public long Version { get; set; }
    public bool Deleted { get; set; }
}
public class PlaceSearchCache
{
    public string Id { get; set; } = "";
    public string ResultsJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; }
}
public class TripEntry
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string Feature { get; set; } = "";
    public string AuthorId { get; set; } = "";
    public string AuthorEmail { get; set; } = "";
    public string DataJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public long Version { get; set; }
    public bool Deleted { get; set; }
}
public class MediaAsset
{
    public bool PendingDeletion { get; set; }
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string AuthorId { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public string ThumbnailSha256 { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
