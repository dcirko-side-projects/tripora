# Architecture essentials

Status: proposed baseline. Architecture.md is authoritative; update both when decisions change.

- Android and iPhone, offline read/write, shared trips and memories are confirmed.
- Proposed stack: React Native/Expo/TypeScript, local SQLite, ASP.NET Core/EF Core/PostgreSQL.
- Auth provider, sync implementation, package versions and hosting are not selected.
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
- Runtime scaffold, tests and builds do not exist yet; placeholders are not working features.
