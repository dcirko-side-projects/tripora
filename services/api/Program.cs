using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;
using Tripora.Api.Features;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
var healthOnly = builder.Configuration.GetValue<bool>("Tripora:HealthOnly");
if (!healthOnly)
{
    if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing"))
        throw new InvalidOperationException("This auth/sync spike is development-only until verified email and recovery are configured.");
    var connection = builder.Configuration.GetConnectionString("Tripora")
        ?? throw new InvalidOperationException("Set ConnectionStrings__Tripora in the environment or User Secrets.");
    builder.Services.AddDbContext<TriporaDb>(options => options.UseNpgsql(connection));
    builder.Services.AddAuthorization();
    builder.Services.AddIdentityApiEndpoints<IdentityUser>(options => {
        options.User.RequireUniqueEmail = true;
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
        options.AddPolicy("auth", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new() { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    });
}
var app = builder.Build();
app.UseExceptionHandler();
app.MapGet("/health/live", () => Results.Ok(new { status = "ok", service = "Tripora.Api" }));
if (!healthOnly)
{
    if (args.Contains("--migrate"))
    {
        using var scope = app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<TriporaDb>().Database.MigrateAsync();
        return;
    }
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseRateLimiter();
    app.MapGroup("/auth").RequireRateLimiting("auth").MapIdentityApi<IdentityUser>();
    var guarded = app.MapGroup("").RequireAuthorization(policy => policy.AddAuthenticationSchemes(IdentityConstants.BearerScheme).RequireAuthenticatedUser());
    guarded.AddEndpointFilter(async (context, next) => {
        var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<IdentityUser>>();
        var user = await users.GetUserAsync(context.HttpContext.User);
        if (user is null || context.HttpContext.User.FindFirstValue("AspNet.Identity.SecurityStamp") != await users.GetSecurityStampAsync(user))
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
}
app.Run();
