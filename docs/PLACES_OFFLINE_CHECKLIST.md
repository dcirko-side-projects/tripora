# Places, food, nightlife and offline — 2026-10-22

## Acceptance

- [x] Three explicit category views over one model: Places, Food, Nightlife.
- [x] Name, category, notes, address, safe HTTP(S) link, visited status and visited/planned filters.
- [x] Owner and active member create/edit/delete shared places; API checks membership and parent identity.
- [x] Local create/edit/visited/delete works without network; successive edits keep the first request immutable and stage a follow-up.
- [x] SQLite v1 -> v2 migration preserves queued trips; place records/drafts/queue survive close/reopen.
- [x] Entity/outbox, acknowledgement and pull/cursor transactions roll back without partial state on injected storage failures.
- [x] Lost acknowledgement retries exactly, concurrent requests deduplicate and changed replay fails.
- [x] Two-device conflicts preserve the newest local draft; deliberate local/server choices do not resurrect tombstones.
- [x] Membership acceptance downloads older places beyond an existing place cursor.
- [x] Revoked membership rejects access and pauses retained child work; deliberate rejoin recovers it.
- [x] Trip deletion atomically tombstones its places, preserves pending drafts and permits explicit acceptance of deletion.
- [x] Prepare for offline marks a completed trip/places download, persists across restart and resumes interrupted pagination.
- [x] Real component journey exercises category views, filtering, visited changes, offline edits, account isolation and member/revoked UI.
- [x] PostgreSQL suite exercises mobile core, authorization, pagination, races, parent/child ordering, retries and restart.
- [ ] Link places to the daily plan: belongs to the next itinerary iteration.
- [ ] Physical Android/iPhone, native bridge and cold start without development Metro: deferred by user.

Verification: 31 mobile tests and 24 PostgreSQL/HTTP scenarios; typecheck, .NET Release, liveness and Android/iOS exports.
See STATUS.md for the remaining release scope.
