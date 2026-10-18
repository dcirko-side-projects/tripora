# API foundation

ASP.NET Core on .NET 10. Run dotnet run --project services/api/Tripora.Api.csproj from the repository root.

GET /health/live returns process liveness. It does not check PostgreSQL or authentication.
Normal startup needs a development PostgreSQL connection and applied EF migrations. See ../../docs/NEW_LAPTOP_HANDOFF.md.
Identity and owner-only /api/sync/push and /api/sync/pull are implemented. No credentials are tracked.

Build: dotnet build services/api/Tripora.Api.csproj --configuration Release
HTTP smoke test: node tests/e2e/api-health.mjs (from repository root, after the Release build).

Program.cs creates the app and registers its endpoint, similar to Spring Boot startup plus a small controller route.
EF Core, Identity EF stores and Npgsql versions are pinned in the project. The private spike is not production-ready.
