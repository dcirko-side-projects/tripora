# Tripora

Offline-capable travel companion for Android and iPhone, with shared trips, places,
food, nightlife, expenses and memories as the product goal.

**Current stage: executable local prototype.** You can create and list trips on the device.
The prototype has no accounts, cloud backup, sharing or synchronization. Use synthetic data.
The backend now contains development-only Identity authentication and PostgreSQL trip synchronization.
Mobile account/session/sync modules exist but are not yet connected to App.tsx.

**Moving to another laptop or a new Codex chat? Read [NEW_LAPTOP_HANDOFF.md](docs/NEW_LAPTOP_HANDOFF.md).**
Latest development is on `codex/offline-foundation`, not `main`.

## Prerequisites

- Node.js 22.13+ (CI uses 22.22.0) and npm.
- .NET 10 SDK; global.json allows current .NET 10 feature bands.
- A compatible Expo Go or development build on Android/iPhone to inspect the native UI.
- Windows cannot run an iOS simulator. iOS bundle export is not an iOS app build.

## Mobile

From apps/mobile:

~~~sh
npm ci
npm start
npm run typecheck
npm test
npm run export:android
npm run export:ios
~~~

On this Windows host the roaming npm shim is broken. In PowerShell use:

~~~powershell
& 'C:\Program Files\nodejs\npm.cmd' start
~~~

The app saves to tripora-prototype.db. A trip and its pending operation are written together.
Uninstalling the app or clearing its data may remove this local-only data.
An Expo development session may need the development server to open/reload the JS bundle.
Reliable cold start in airplane mode must be checked using an installed development/release build,
not inferred from Expo Go or desktop database tests.

## Backend

From repository root:

~~~sh
dotnet run --project services/api/Tripora.Api.csproj
~~~

Default development URL: http://127.0.0.1:5080/health/live
This checks the API process, not a database or sync service.
Normal startup requires PostgreSQL, ConnectionStrings__Tripora and applied migrations.
See the handoff document for setup. For liveness-only mode without a database set Tripora__HealthOnly=true.
Authenticated routes: /auth/me, /auth/revoke-all and /api/sync/push and /api/sync/pull.

Verification:

~~~sh
dotnet build services/api/Tripora.Api.csproj --configuration Release
node tests/e2e/api-health.mjs
~~~

The smoke test uses a dynamically allocated loopback port and stops its server afterward.

## Project map

- [Product requirements](PRD.md)
- [Architecture and implementation boundaries](Architecture.md)
- [Quick architecture rules](Architecture-essentials.md)
- [Agent instructions](AGENTS.md)
- [Phased roadmap](docs/TRIPORA_PLAN.md)
- [Current iteration](docs/IMPLEMENTATION_CHECKLIST.md)
- [Mobile UX proposal](docs/MOBILE_UX.md)
- [Validation and current status](docs/STATUS.md)

apps/mobile owns the native client; services/api owns the API; tests/e2e owns HTTP/cross-client checks.
.github/workflows/ci.yml defines mobile and API verification; a workflow file is not proof of a hosted run.
The parent directory contains the legacy project and must not be included in this repository.

The original documentation setup follows [Bilal Ahmad's article](https://bilalahmad72.com/blog/vibe-coding-setup-files/).
