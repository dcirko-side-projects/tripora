# Auth and trip-sync iteration

Updated: 2026-10-21. Private development scope; physical-device testing deferred by the user.

## Phase A — authentication and account isolation
- [x] Identity register/login/refresh/me on server; mobile registration/login UI.
- [x] SecureStore adapter connected, session restore/expiry handling and account-scoped SQLite.
- [x] Confirmed logout retains unsent work for the same account and clears the active session.
- [x] Automated session/account isolation, concurrent refresh and logout-during-refresh tests.
- [ ] Native secure-storage and device lifecycle verification.
- [ ] Email verification and account recovery before production.

## Phase B — PostgreSQL and guarded trip synchronization
- [x] EF Core migration, isolated PostgreSQL integration and API restart persistence.
- [x] Atomic receipts, version checks, deletion markers and ordered pull.
- [x] Mobile immutable outbox upload, acknowledgement and dirty-data protection.
- [x] Visible conflicts with deliberate, confirmed server/local choices; no tombstone resurrection.
- [x] One sync at a time; auth/restore, foreground resume, 30-second foreground retries and manual sync.
- [x] Client tests for persistence, migrations, rollback, isolation, lost acknowledgements and conflict preservation.
- [x] Actual mobile core against HTTP/PostgreSQL with two device stores, conflict resolution, deletion and logout/relogin.
- [x] App.tsx component journey with mocked native adapters.
- [x] Typecheck, 20 mobile tests, 11 PostgreSQL scenarios, Android/iOS exports and Release build passed locally.
- [x] CI definition includes mobile-core HTTP integration; hosted run not verified.
- [x] Persistent development runner and verified local launcher/manifest/bundle responses.
- [ ] Physical Android/iPhone acceptance, intentionally postponed.

No invitation roles, media, paid/cloud provisioning or production release in this iteration.
