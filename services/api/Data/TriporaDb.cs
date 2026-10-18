using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Tripora.Api.Data;

public class TriporaDb(DbContextOptions<TriporaDb> options) : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<TripRecord> Trips => Set<TripRecord>();
    public DbSet<MutationReceipt> Receipts => Set<MutationReceipt>();
    public DbSet<SyncClock> SyncClocks => Set<SyncClock>();
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
