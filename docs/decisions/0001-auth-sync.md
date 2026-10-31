# 0001 — Identity tokens and PostgreSQL trip sync

Date: 2026-09-30. Scope: private development foundation, authorized continuation of phases.

Update 2026-10-30: [decision 0004](0004-free-beta-and-account-lifecycle.md) adds confirmed email/recovery/deletion and the user-approved free hosted beta. Identity and explicit sync remain; earlier no-email/open-hosting notes describe the original foundation, not the current implementation.

Implementation update 2026-10-21: mobile UI now connects this protocol and session storage, with confirmed logout and conflict resolution. Desktop SQLite/component and real mobile-core HTTP tests pass; native-device validation and production recovery remain open. See ../STATUS.md.

## Decision

Use ASP.NET Core Identity API endpoints and its opaque bearer/refresh tokens.
These are not JWTs and are not a general OAuth/OIDC identity provider.
Identity supplies password hashing, validation, lockout and refresh validation.
Use 15-minute access and 7-day refresh lifetime, platform SecureStore on mobile.
Validate the Identity security stamp on guarded endpoints; revoke-all invalidates protected access and refresh.
Ordinary mobile logout clears the local session; it does not claim global server revocation.
Refresh tokens are framework tokens, not a custom rotating-token implementation.

Choose PostgreSQL with EF Core/Npgsql and real migrations for server storage.
Use a small explicit trip-only synchronization contract before considering a managed sync vendor.
No external identity/sync subscription, email service or cloud resource is provisioned.

## Alternatives

OIDC + PKCE remains preferable if third-party login, federation or multiple APIs become requirements.
A managed sync service could reduce custom protocol work but introduces vendor and operating-cost decisions.
Do not build a custom password or signing system.

## Scope boundaries

Self-registration is development-only until email confirmation/recovery and operational safeguards exist.
Identity mail-dependent endpoints have no delivery service configured; recovery is not usable yet.
The app must not be deployed publicly in this state.
Only owned trips are synced. Invitations and membership authorization replace this owner-only policy next.
No images, expenses or other records are transferred by this iteration.

## Protocol

POST /api/sync/push: operationId, tripId, kind, baseVersion, data.
The server resolves the actor from the bearer token, never from submitted ownership.
Stable operation ID is scoped to that actor; identical retry returns the stored acknowledgement.
Reusing the ID with changed contents returns 409. Mutation, cursor and receipt commit together.
Updates/deletes require the current version; a tombstone prevents resurrection.
GET /api/sync/pull?after=N pages at 100 rows, including deleted records.
A PostgreSQL transaction-scoped advisory lock serializes writers, including cursor allocation.
This deliberately trades throughput for correct commit ordering in the small spike.
No retention purge of receipts/tombstones or arbitrary cursor expiration is implemented yet.

## Local data

Separate SQLite filename per server identity + user, never implicitly upload the legacy prototype database.
Outbox entries are immutable after creation so retries cannot change their body.
One pending mutation per trip; sync or resolve it before a further local edit.
Store conflicts separately and retain the local record/outbox until explicit resolution.
Advance the pull cursor in the same transaction as local apply/conflict staging.
Logout preserves local databases and pending writes for that same account. It removes the active token.
Previously downloaded information cannot be revoked while a phone is disconnected.

## Sources

- https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-api-authorization?view=aspnetcore-10.0
- https://www.npgsql.org/efcore/
