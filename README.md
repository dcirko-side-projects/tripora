# Tripora

Tripora is an offline-first mobile app for planning trips with a small group.
It brings daily itineraries, saved places and maps, personal packing lists, exact
expense tracking, and private photo memories together on Android and iPhone.

**Current stage: authenticated shared-trip prototype.** Register/login, create/list/update/delete owned trips
offline, synchronize and deliberately resolve conflicts. Invite a registered companion by manually shared code;
members can download/view basic trip data. Owner manages membership and trip metadata. Use synthetic data.
Logout retains pending work for the same account. Owners and members maintain places, food and nightlife in separate views,
including offline editing, visited status, filtering and explicit conflict resolution. Prepare for offline confirms a complete
metadata download; images require explicit download and offline maps are not included. Daily plans link saved places,
packing is personal per participant, expenses use exact totals and one trip currency, and memories support text and private photos.
Account confirmation/recovery/deletion and free hosted adapters are implemented and locally tested; real email/internet deployment remains pending. Android has bounded physical acceptance with QA9 branding; iPhone is deferred. See [current release phases](docs/RELEASE_PHASES.md), [card-free beta setup](docs/NO_CARD_SETUP.md) and the earlier [phase 6–8 evidence](docs/PHASES_6_8_CHECKLIST.md).

Place lookup searches a public name plus city on demand and lets the user confirm a result. Saved coordinates synchronize with the trip and appear on the native map; downloaded lists remain usable offline. Online maps and place lookup use OpenStreetMap services within their beta usage limits, without a Google API key.

The prepared zero-cost hosting stack is Render, Neon PostgreSQL, authenticated Cloudinary storage and Brevo email. Provider accounts are registered, but real secrets, deployment, delivery and idle/wake acceptance are still pending. The repository is public; credentials and local runtime data stay excluded. Current evidence: 83 mobile tests, 48 PostgreSQL/HTTP scenarios, both platform exports and an Android QA10 build. New map behavior has not yet passed physical-device acceptance.

**Moving to another laptop or a new Codex chat? Read [NEW_LAPTOP_HANDOFF.md](docs/NEW_LAPTOP_HANDOFF.md).**
Latest development is on `codex/offline-foundation`, not `main`.

## Prerequisites

- Node.js 22.13+ (CI uses 22.22.0) and npm.
- .NET 10 SDK; global.json allows current .NET 10 feature bands.
- A native development/release build on Android/iPhone for the MapLibre map; Expo Go lacks this module.
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

The app saves to a SQLite database scoped by server and user; tokens use native SecureStore.
A trip and its pending operation are written together. The anonymous prototype database is not migrated.
Uninstalling the app or clearing its data may remove unsynchronized data.
An Expo development session may need the development server to open/reload the JS bundle.
Reliable cold start in airplane mode must be checked using an installed development/release build,
not inferred from Expo Go or desktop database tests.

Trip cards summarize local plans/packing, pending-inclusive spending and photo availability.
Private beta gates, safe development shutdown and paired DB/media/key backup/restore:
[PRIVATE_BETA.md](docs/PRIVATE_BETA.md). Phase 9 is prepared for device QA; no physical beta sign-off yet.

## Run the full local development app

After installing mobile and tests/e2e dependencies and building the API:

~~~sh
node tests/e2e/dev.mjs
~~~

This runner starts persistent development PostgreSQL on loopback port 55433, migrates the database,
starts the API on port 5080 and Expo on 8081. It prints Android/iPhone launcher URLs.
Open the URL on the same trusted Wi-Fi with a compatible native client. Expo Go can inspect the saved-list fallback but does not include the native map module.
If there are multiple network interfaces, set TRIPORA_DEV_HOST to the intended local IPv4 address.
Ctrl+C stops the runner; local-data/development is ignored and retains the database, private media and generated DB credentials.
For a background runner use `node tests/e2e/dev-stop.mjs`. The runner and backup tools share an exclusive maintenance lock.
For later sessions rerun the command; the laptop must remain on and firewall/network access must permit the ports.
No public service is provisioned. Register a synthetic account in the app; there is no seeded password.

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
npm ci --prefix tests/e2e
npm test --prefix apps/mobile
node --experimental-sqlite tests/e2e/auth-sync.mjs
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
