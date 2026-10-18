# Auth and server-sync iteration — 2026-09-30

User requested the next two phases and deferred physical-device testing.

## Phase A — authentication and account isolation
- [x] Record Identity token/session choice and its limits.
- [x] Registration, login, refresh and authenticated identity endpoint (server).
- [ ] SecureStore session persistence, expiry handling and account-scoped SQLite.
- [ ] Explicit logout handling with unsent changes retained for the same account.
- [x] Verify anonymous/invalid-token rejection and cross-account isolation on server; mobile validation remains open.

## Phase B — PostgreSQL and guarded trip synchronization
- [x] EF Core migration, isolated PostgreSQL tests and API restart persistence.
- [x] Atomic mutation receipts, version checks, deletion markers and ordered pull (server).
- [ ] Mobile outbox upload, acknowledgement and pull without overwriting dirty data.
- [ ] Visible conflicts with deliberate resolution; retry retains operation IDs.
- [x] HTTP integration tests against PostgreSQL: auth, replay, changed replay, conflict, authorization, deletion and restart (10 scenarios passed again on 2026-10-18).
- [ ] Client tests for migration, account isolation, lost acknowledgements and conflict preservation.
- [ ] Typecheck, bundles, documentation and CI commands.

Boundary: private development spike, no paid/cloud provisioning, no invitation UI or collaborative roles yet.
Device QA stays deferred at the user's request. User requested commit/push on 2026-10-18 for a new laptop.
New client modules are drafted, but UI integration and dedicated client tests remain incomplete.
