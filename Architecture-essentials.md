# Architecture essentials

Status: executable prototype started 2026-09-28. Architecture.md is authoritative; update both when decisions change.

- Android and iPhone, offline read/write, shared trips and memories are confirmed.
- Working prototype: Expo SDK 57/React Native/TypeScript, local SQLite, ASP.NET Core .NET 10.
- EF Core/PostgreSQL and Identity opaque bearer/refresh tokens are implemented on the development server; hosting remains unselected.
- One mobile client, one backend; feature-based organization.
- UI reads local data. Save entity and outbox operation in one local transaction.
- Stable client IDs, operation deduplication, record versions, tombstones and server pull cursor.
- Never silently overwrite a dirty local record or discard an unresolved conflict.
- Retry an operation with the same ID; do not duplicate expenses.
- Server checks membership on all data and media access.
- Offline revocation is not instantaneous; do not claim it is.
- Keep credentials in platform secure storage; local data is account-scoped.
- Money uses exact representation; one currency per trip initially.
- Calendar dates/local itinerary times differ from UTC audit timestamps.
- Places/Food/Nightlife are separate views over a shared place concept.
- Images need durable local copies, private remote storage and a separate upload queue.
- No promises of synchronization while the app is closed.
- No microservices, CQRS framework, chat, AI, booking or debt settlement in initial scope.
- Current mobile UI: local trip creation/list with atomic outbox. New account/session/sync core modules are not wired to App.tsx.
- Server: owner-only trip push/pull, receipts, versions and tombstones. No invitation/shared-membership flow or media yet.
- Consult docs/NEW_LAPTOP_HANDOFF.md before continuing; do not treat the new modules as a finished mobile auth/sync feature.
- Prototype data uses tripora-prototype.db; do not reuse it as an authenticated account database.
- Automated desktop SQLite tests and mobile bundle exports are not native-device persistence proof.
