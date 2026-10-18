# Current status — new-laptop checkpoint

Updated: 2026-10-18
Development branch: codex/offline-foundation
Start here: [NEW_LAPTOP_HANDOFF.md](NEW_LAPTOP_HANDOFF.md).

## Implemented

- Expo/React Native local trip create/list UI, validation, SQLite schema and atomic outbox.
- Development ASP.NET Core Identity register/login/refresh, identity and revoke-all routes.
- PostgreSQL + EF Core migration; owner-only trip push/pull, idempotent receipts, version conflicts, tombstones and cursor pagination.
- Draft mobile account-scoped database, session/SecureStore adapter and sync modules.
- Foundation CI definition and isolated PostgreSQL/HTTP integration suite.

## Incomplete — do not mistake code presence for finished behavior

- App.tsx STILL uses the anonymous prototype database. The new session/account/sync modules are not connected to the UI.
- No dedicated client auth/sync tests yet; npm test currently covers only the original localStore.
- No invitations, membership collaboration, expenses, media or production deployment.
- Email confirmation/recovery is not configured. API is gated to Development/Testing.
- Device testing was explicitly postponed by the user; no Android/iPhone runtime or visual proof.
- Hosted CI result is not yet known. Mobile exports previously passed but are not device tests.

## Verification

- 2026-10-18: TypeScript passed, all 7 localStore SQLite tests passed, .NET Release build passed with zero warnings/errors, HTTP liveness smoke passed.
- 2026-10-18: all 10 isolated PostgreSQL/HTTP auth-sync scenarios passed again, including duplicate replay, cross-account denial, conflicts, tombstones, API restart, pagination and revocation.
- Earlier npm audit reported 10 moderate findings in Expo build-tool dependencies; not reassessed during this checkpoint.

## Environment and Git

- The old laptop's Docker engine did not start, so DB tests use embedded-postgres 17 with synthetic accounts and ephemeral generated credentials.
- Source, migrations, lockfiles, tests and handoff documentation are intended for Git; local databases, credentials, installed dependencies and build output are ignored.
- The user explicitly requested commit and push for laptop migration. Verify the remote branch tip after publishing; main retains the earlier documentation baseline.

## Next steps

1. Read the handoff and inspect current code; do not restart the project.
2. Add client session/account/sync tests and resolve discovered edge cases.
3. Connect auth and account-specific storage to App.tsx; add explicit logout and conflict UX.
4. Validate end-to-end mobile sync before adding shared membership.
5. Continue the roadmap; leave physical-device QA postponed until the user resumes it.
