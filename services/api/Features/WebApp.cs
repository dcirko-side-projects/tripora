namespace Tripora.Api.Features;

public static class WebApp
{
    // Same origin as Identity and sync; no CORS or extra hosting service.
    public static void UseTriporaWeb(this WebApplication app)
    {
        if (!Directory.Exists(app.Environment.WebRootPath)) return;
        app.Use(async (context, next) => {
            context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
            context.Response.Headers["Cross-Origin-Embedder-Policy"] = "require-corp";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; worker-src 'self' blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
            if (context.Request.Path == "/sw.js") context.Response.Headers["Service-Worker-Allowed"] = "/";
            await next();
        });
        app.UseDefaultFiles();
        var contentTypes = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
        contentTypes.Mappings[".wasm"] = "application/wasm";
        contentTypes.Mappings[".webmanifest"] = "application/manifest+json";
        app.UseStaticFiles(new StaticFileOptions {
            ContentTypeProvider = contentTypes,
            OnPrepareResponse = context => {
                // Browser SW caches its explicit immutable shell; do not HTTP-cache the entry/worker.
                context.Context.Response.Headers.CacheControl = "no-cache";
            }
        });
    }
}
