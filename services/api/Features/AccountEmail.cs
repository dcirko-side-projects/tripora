using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace Tripora.Api.Features;

public sealed class AccountEmail(IConfiguration configuration, IHostEnvironment environment, IHttpClientFactory clients) : IEmailSender<IdentityUser>
{
    public Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink)
    {
        var incoming = new Uri(WebUtility.HtmlDecode(confirmationLink));
        var query = QueryHelpers.ParseQuery(incoming.Query);
        var code = query["code"].ToString();
        var publicUrl = configuration["Tripora:PublicUrl"];
        var link = string.IsNullOrWhiteSpace(publicUrl) ? incoming.AbsoluteUri : publicUrl.TrimEnd('/') + incoming.PathAndQuery;
        return Send(email, "confirmation", "Tripora — potvrda e-maila", code,
            $"<p>Potvrdi svoju adresu u Tripori.</p><p><a href=\"{WebUtility.HtmlEncode(link)}\">Potvrdi e-mail</a></p><p>Ili u aplikaciji odaberi Potvrdi e-mail i zalijepi kod:</p><p>{WebUtility.HtmlEncode(code)}</p><p>Ako nisi zatražio račun, zanemari ovu poruku.</p>");
    }
    public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode) =>
        Send(email, "reset", "Tripora — oporavak lozinke", resetCode,
            $"<p>U Tripori odaberi Zaboravljena lozinka i unesi ovaj kod:</p><p>{WebUtility.HtmlEncode(resetCode)}</p><p>Kod vrijedi jedan sat. Ako nisi zatražio promjenu, zanemari ovu poruku.</p>");
    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink) =>
        throw new NotSupportedException("Tripora uses reset codes, not external reset links.");
    private async Task Send(string email, string kind, string subject, string code, string html)
    {
        var mode = configuration["Tripora:Email:Mode"] ?? "File";
        if (mode == "File")
        {
            if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
                throw new InvalidOperationException("File email delivery is local-only.");
            var root = configuration["Tripora:Email:Outbox"] ?? Path.Combine(
                configuration["Tripora:KeyRoot"] is { Length: > 0 } keys ? Path.GetDirectoryName(Path.GetFullPath(keys))! : Path.Combine(environment.ContentRootPath, "local-data"), "email-outbox");
            Directory.CreateDirectory(root);
            var path = Path.Combine(root, Guid.NewGuid() + ".json");
            await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await JsonSerializer.SerializeAsync(file, new { email, kind, subject, code, html });
            return;
        }
        if (mode != "Brevo") throw new InvalidOperationException("Unsupported email delivery mode.");
        var endpoint = "https://api.brevo.com/v3/smtp/email";
        if (environment.IsEnvironment("Testing") && configuration["Tripora:Email:TestUrl"] is { } local)
        {
            if (!Uri.TryCreate(local, UriKind.Absolute, out var uri) || !uri.IsLoopback) throw new InvalidOperationException("Email test transport must be loopback.");
            endpoint = local;
        }
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Add("api-key", configuration["Tripora:Email:ApiKey"] ?? throw new InvalidOperationException("Missing email API key."));
        request.Content = JsonContent.Create(new { sender = new { name = "Tripora", email = configuration["Tripora:Email:From"] }, to = new[] { new { email } }, subject, htmlContent = html });
        using var response = await clients.CreateClient("email").SendAsync(request);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Email delivery failed. Retry later.");
    }
}

public record ConfirmationCode(string Email, string Code);
public static class AccountAccess
{
    public static void MapAccountAccess(this RouteGroupBuilder group, bool requireConfirmedEmail)
    {
        group.MapGet("/options", () => Results.Ok(new { requireConfirmedEmail }));
        group.MapPost("/confirm-code", async (ConfirmationCode request, UserManager<IdentityUser> users) => {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 4096)
                return Results.BadRequest(new { code = "invalid_confirmation" });
            var user = await users.FindByEmailAsync(request.Email.Trim());
            if (user is null) return Results.BadRequest(new { code = "invalid_confirmation" });
            string code;
            try { code = System.Text.Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Code.Trim())); }
            catch (FormatException) { return Results.BadRequest(new { code = "invalid_confirmation" }); }
            var result = await users.ConfirmEmailAsync(user, code);
            return result.Succeeded ? Results.NoContent() : Results.BadRequest(new { code = "invalid_confirmation" });
        });
    }
}
