# 0002 — Development membership and invitation flow

Date: 2026-10-22. Scope: next small end-to-end development behavior under the user's request to continue.

## Development defaults and open choices

Owner/member follows the existing proposal. For this iteration, owner alone edits/deletes basic trip
metadata and manages membership; accepted members read/download it. Shared place/activity edits belong
to the next iteration. These are reversible development defaults, not newly approved production policy.
Invitation expiry is seven days. Recipient must already have a registered development account.
No paid service, mail provider or hosting is selected. No email or external message is sent by the application.

## Invitation lifecycle

Owner issues a cryptographically random 32-byte code for a trip and registered recipient.
The code is displayed once for manual sharing. Only its SHA-256 hash is persisted by the API.
Acceptance checks authenticated recipient ID, expiry, revocation, trip deletion and prior membership.
Identical acceptance retry is safe while membership remains active.
Owner can revoke a pending invitation or remove a member. Removal invalidates all old codes for that recipient/trip.
Issuing another invitation supersedes earlier codes. A deliberate fresh invite is required for rejoining.
Production verified email/recovery remain prerequisites; development email registration is not identity proof.

## Synchronization and access

The existing PostgreSQL transaction advisory lock serializes writes, pulls and membership changes.
Acceptance raises the trip's sync version to make the trip discoverable after any existing device cursor.
Pull returns currently accessible trip IDs/roles as well as paginated records/tombstones.
The client applies records, access flags and cursor in one SQLite transaction.

After removal, a cached copy remains visible with a revoked-access label; its outbox is retained but paused.
A disconnected device cannot know immediately that membership was revoked. Every server mutation still
checks current access; a previously cached ID/token is insufficient. Current member metadata writes return 403,
nonmembers get 404 without the trip's current payload. Only owner can edit/delete base trip metadata.

The full access snapshot is adequate for this small prototype; a larger product needs an explicit scaling/retention design.
No existing local DB is cleared or account data migrated. Optional JSON metadata fields preserve the v1 SQLite schema.

## Acceptance evidence

See [membership checklist](../MEMBERSHIP_CHECKLIST.md) and [status](../STATUS.md).
Automated desktop/component/HTTP evidence does not replace native device QA.
