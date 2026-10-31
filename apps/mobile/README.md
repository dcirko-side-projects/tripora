# Mobile prototype

Free hosted-beta preparation and account confirmation/recovery/deletion: [setup](../../docs/FREE_BETA_SETUP.md). Current acceptance: [status](../../docs/STATUS.md). Real internet deployment/email delivery remains pending. Rebuild icon PNGs from the original suitcase/airplane SVG with `npm run branding`; Android adaptive foreground has safe mask margins. A native rebuild is required to update the launcher icon.

Expo SDK 57 / React Native / TypeScript. App.tsx uses account-scoped SQLite and native SecureStore sessions.

The redesigned UI separates global Trips/Sync/Account screens from selected-trip Overview/Plan/Places/Expenses/More tabs.
Shared design tokens/components live in src/ui. Native date/time pickers replace date text fields; forms/details open in modals.
Use Expo Go compatible with SDK 57, not SDK 58; reload after installing dependencies. The user confirmed the earlier Android launch
after matching Expo Go versions. Redesigned device flows and acceptance scenarios: [UX redesign](../../docs/UX_REDESIGN.md).

Supported development flow: register/login -> create/list/update/delete trip -> sync -> resolve conflicts.
Offline local writes survive desktop SQLite reopen tests; logout retains them for the same account.
The anonymous prototype database is not opened or migrated.

Run the full local stack from the repository root with `node tests/e2e/dev.mjs` after installing
mobile/e2e dependencies and building the API; see [README](../../README.md).
For a separately managed API, set EXPO_PUBLIC_API_URL to its reachable URL before `npm start`.
The default loopback URL only works when the API and client share the host, not on a physical phone.

Checks: npm run typecheck; npm test; npm run export:android; npm run export:ios.
Tests cover actual store/session/sync logic with desktop SQLite and App.tsx with mocked native bridges.
The PostgreSQL suite additionally runs the mobile core against real HTTP endpoints.
These checks are not a native SecureStore/SQLite or physical-device test.

Owners can issue/revoke recipient-bound invitation codes and remove members; members accept online and download/view trip metadata.
Removed access is labeled locally and queued work is retained/paused. Only owner edits basic trip data in this development iteration.
Places/Food/Nightlife have separate views over one record model, filters, visited status and shared offline CRUD.
Account schema v3 preserves older trip/place data and pending queues, adding plan, personal packing, exact expenses/budget and memories.
Immutable requests plus staged follow-ups preserve edits after connection loss. Account sync processes trips/access, places, photo uploads and entries.
Prepare for offline confirms complete metadata pulls; photographs need explicit download. Gallery images are copied to durable account storage,
resized with thumbnails and uploaded through a separate retry queue. Private downloads check membership and hashes.
Production recovery remains open. Native cold start, gallery/codec behavior and permissions still need installed-build device tests. Use synthetic data.
See [status](../../docs/STATUS.md) for verification and remaining dependency audit findings.

## Karta mjesta — 2026-10-31

MapLibre native 11.5.1 treba novi native build; Expo Go/stari QA APK nema SDK. Mjesta imaju Popis/Karta i eksplicitnu akciju pronalaženja naziva uz grad. Odabir rezultata sprema koordinate, offline popis ostaje dostupan, a karta/lookup trebaju internet. Nema Google ključa ni location permissiona. Native build i izvozi nisu fizički prihvat; upute za novu internetsku betu bez kartice: [NO_CARD_SETUP](../../docs/NO_CARD_SETUP.md).
