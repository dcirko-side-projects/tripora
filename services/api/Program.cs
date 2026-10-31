using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;
using Tripora.Api.Features;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient.storage", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient.places", LogLevel.Warning);
var healthOnly = builder.Configuration.GetValue<bool>("Tripora:HealthOnly");
if (!healthOnly)
{
    var connection = builder.Configuration.GetConnectionString("Tripora")
        ?? throw new InvalidOperationException("Set ConnectionStrings__Tripora in the environment or User Secrets.");
    builder.Services.AddDbContext<TriporaDb>(options => options.UseNpgsql(connection));
    builder.Services.AddAuthorization();
    HostedBeta.Configure(builder);
    builder.Services.AddHttpClient("email", client => client.Timeout = TimeSpan.FromSeconds(20));
    builder.Services.AddHttpClient("places", client => client.Timeout = TimeSpan.FromSeconds(15));
    builder.Services.AddTransient<IEmailSender<IdentityUser>, AccountEmail>();
    builder.Services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromHours(1));
    builder.Services.AddIdentityApiEndpoints<IdentityUser>(options => {
        options.User.RequireUniqueEmail = true;
        options.SignIn.RequireConfirmedEmail = builder.Configuration.GetValue<bool>("Tripora:RequireConfirmedEmail");
        options.Password.RequiredLength = 12;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    }).AddEntityFrameworkStores<TriporaDb>();
    builder.Services.Configure<BearerTokenOptions>(IdentityConstants.BearerScheme, options => {
        options.BearerTokenExpiration = TimeSpan.FromMinutes(15);
        options.RefreshTokenExpiration = TimeSpan.FromDays(7);
    });
    builder.Services.AddRateLimiter(options => {
        options.RejectionStatusCode = 429;
        options.AddPolicy("places", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
            _ => new() { PermitLimit = 12, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        options.AddPolicy("auth", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new() { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    });
}
var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) => {
    if (context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } limit)
        limit.MaxRequestBodySize = context.Request.Path.StartsWithSegments("/auth") ? 16 * 1024 : 16 * 1024 * 1024;
    if (context.Request.Path.StartsWithSegments("/auth") || context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "private, no-store";
    await next();
});
app.MapGet("/health/live", () => Results.Ok(new { status = "ok", service = "Tripora.Api" }));
if (!healthOnly)
{
    var isolateDataApi = builder.Configuration.GetValue<bool>("Tripora:EnforceDataApiIsolation") || (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"));
    if (isolateDataApi)
    {
        using var safetyScope = app.Services.CreateScope();
        await DataApiSafety.EnsurePrivateDatabase(safetyScope.ServiceProvider.GetRequiredService<TriporaDb>(), builder.Configuration["Tripora:DatabaseProvider"] != "Neon");
    }
    app.MapGet("/health/ready", async (TriporaDb db) => {
        try { return await db.SyncClocks.AnyAsync(c => c.Id == 1) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503); }
        catch { return Results.StatusCode(503); }
    });
    if (args.Contains("--migrate"))
    {
        using var scope = app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<TriporaDb>().Database.MigrateAsync();
        return;
    }
    if (app.Services.GetRequiredService<MediaFiles>() is SupabaseMediaFiles remote &&
        (builder.Configuration.GetValue<bool>("Tripora:ValidatePrivateBucket") || (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))))
        await remote.EnsurePrivateBucket();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseRateLimiter();
    app.MapGroup("/auth").RequireRateLimiting("auth").MapIdentityApi<IdentityUser>();
    app.MapGroup("/auth").RequireRateLimiting("auth").MapAccountAccess(builder.Configuration.GetValue<bool>("Tripora:RequireConfirmedEmail"));
    var guarded = app.MapGroup("").RequireAuthorization(policy => policy.AddAuthenticationSchemes(IdentityConstants.BearerScheme).RequireAuthenticatedUser());
    guarded.AddEndpointFilter(async (context, next) => {
        var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<IdentityUser>>();
        var user = await users.GetUserAsync(context.HttpContext.User);
        if (user is null || user.PasswordHash is null || (builder.Configuration.GetValue<bool>("Tripora:RequireConfirmedEmail") && !user.EmailConfirmed) || context.HttpContext.User.FindFirstValue("AspNet.Identity.SecurityStamp") != await users.GetSecurityStampAsync(user))
            return Results.Unauthorized();
        return await next(context);
    });
    guarded.MapGet("/auth/me", (ClaimsPrincipal actor) => Results.Ok(new {
        id = actor.FindFirstValue(ClaimTypes.NameIdentifier), email = actor.FindFirstValue(ClaimTypes.Email)
    }));
    guarded.MapPost("/auth/revoke-all", async (ClaimsPrincipal actor, UserManager<IdentityUser> users) => {
        var user = await users.GetUserAsync(actor);
        var result = await users.UpdateSecurityStampAsync(user!);
        return result.Succeeded ? Results.NoContent() : Results.Problem("Session revocation failed.");
    });
    guarded.MapGroup("/api/sync").MapTripSync();
    guarded.MapMembership();
    guarded.MapGroup("/api/places").MapPlaceSync();
    guarded.MapPlaceSearch();
    guarded.MapGroup("/api/entries").MapEntrySync();
    guarded.MapMedia();
    guarded.MapAccountDeletion();
}
app.Run();
