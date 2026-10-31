using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public static class HostedBeta
{
    public static void Configure(WebApplicationBuilder builder)
    {
        var config = builder.Configuration;
        var hosted = !builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing");
        if (hosted)
        {
            if (!config.GetValue<bool>("Tripora:EnableHostedBeta") || !config.GetValue<bool>("Tripora:RequireConfirmedEmail") || config["Tripora:Email:Mode"] != "Brevo" || config["Tripora:Storage:Mode"] is not ("Supabase" or "Cloudinary") || !config.GetValue<bool>("Tripora:DatabaseKeys"))
                throw new InvalidOperationException("Hosted beta requires explicit opt-in, confirmed email, private remote storage and durable database keys.");
            var storageSettings = config["Tripora:Storage:Mode"] == "Cloudinary"
                ? new[] { "Tripora:Storage:CloudName", "Tripora:Storage:ApiKey", "Tripora:Storage:ApiSecret" }
                : new[] { "Tripora:Storage:Url", "Tripora:Storage:ServiceKey" };
            foreach (var name in new[] { "Tripora:PublicUrl", "Tripora:Email:From", "Tripora:Email:ApiKey", "Tripora:KeyCertificate", "Tripora:KeyCertificatePassword" }.Concat(storageSettings))
                if (string.IsNullOrWhiteSpace(config[name])) throw new InvalidOperationException("Missing required hosted setting: " + name);
            foreach (var name in config["Tripora:Storage:Mode"] == "Cloudinary" ? new[] { "Tripora:PublicUrl" } : new[] { "Tripora:PublicUrl", "Tripora:Storage:Url" })
                if (!Uri.TryCreate(config[name], UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0 || uri.AbsolutePath != "/")
                    throw new InvalidOperationException("Hosted URLs must be HTTPS origins.");
            var connection = new Npgsql.NpgsqlConnectionStringBuilder(config.GetConnectionString("Tripora"));
            if (connection.SslMode != Npgsql.SslMode.VerifyFull) throw new InvalidOperationException("Hosted database requires certificate-verified TLS (SSL Mode=VerifyFull).");
            if (config["Tripora:DatabaseProvider"] is not (null or "Supabase" or "Neon")) throw new InvalidOperationException("Unsupported database provider.");
            if (config["Tripora:DatabaseProvider"] == "Neon" && connection.Host?.EndsWith(".neon.tech", StringComparison.OrdinalIgnoreCase) != true)
                throw new InvalidOperationException("Neon beta requires its certificate-verified database endpoint.");
            if (config["Tripora:Storage:Mode"] == "Cloudinary" && !System.Text.RegularExpressions.Regex.IsMatch(config["Tripora:Storage:CloudName"]!, "^[a-zA-Z0-9_-]{1,100}$"))
                throw new InvalidOperationException("Invalid Cloudinary cloud name.");
        }
        var keys = builder.Services.AddDataProtection().SetApplicationName("Tripora");
        if (config.GetValue<bool>("Tripora:DatabaseKeys")) keys.PersistKeysToDbContext<TriporaDb>();
        else if (config["Tripora:KeyRoot"] is { Length: > 0 } root) keys.PersistKeysToFileSystem(new DirectoryInfo(Path.GetFullPath(root)));
        if (config["Tripora:KeyCertificate"] is { Length: > 0 } pfx)
        {
            var certificate = X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(pfx), config["Tripora:KeyCertificatePassword"], X509KeyStorageFlags.EphemeralKeySet);
            if (!certificate.HasPrivateKey) throw new InvalidOperationException("Key encryption certificate needs its private key.");
            builder.Services.AddSingleton(certificate);
            keys.ProtectKeysWithCertificate(certificate);
        }
        builder.Services.AddHttpClient("storage", client => client.Timeout = TimeSpan.FromSeconds(25));
        builder.Services.AddSingleton<MediaFiles>(services => config["Tripora:Storage:Mode"] switch {
            null or "Local" => new MediaFiles(config, builder.Environment),
            "Supabase" => new SupabaseMediaFiles(config, builder.Environment, services.GetRequiredService<IHttpClientFactory>()),
            "Cloudinary" => new CloudinaryMediaFiles(config, builder.Environment, services.GetRequiredService<IHttpClientFactory>()),
            _ => throw new InvalidOperationException("Unsupported private storage mode.")
        });
    }
}
