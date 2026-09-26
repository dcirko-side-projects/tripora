# Tripora — Architecture

Status: proposed technical baseline, not an assertion that the user approved a stack.
Product requirements: PRD.md. Quick rules: Architecture-essentials.md.

## 1. Decision register

| Area | Proposal | Reason | Status |
| --- | --- | --- | --- |
| Mobile | React Native, Expo, TypeScript | Android/iPhone UI, device media, shared client | Proposed |
| Local data | SQLite | Transactional persistent offline records and outbox | Proposed |
| Backend | ASP.NET Core, EF Core | One maintainable API and learning C# | Proposed |
| Server data | PostgreSQL | Relationships, constraints and transactions | Proposed |
| Media | Private object storage | Keep image bytes separate from relational data | Provider open |
| Auth | Standard mobile authentication with secure token storage | Native clients differ from browser cookie clients | Provider/protocol details open |
| Sync | Explicit versioned operations and incremental pull | Offline writes and collaboration need a defined contract | Spike required |
| Desktop | Separate delivery decision | Initial brief requests a useful desktop experience | Open |

Alternative clients: Flutter, or Ionic/Capacitor if sharing a web UI becomes decisive.
PWA remains viable but is no longer the leading proposal after native/mobile, offline and media requirements.
A managed synchronization service must be evaluated against custom sync in the spike; do not adopt a vendor by accident.
No concrete package versions are locked until the runtime scaffold is approved and compatibility is verified.

## 2. Boundaries and layout

One repository, one mobile client and one deployable backend. No distributed services.
apps/mobile will own mobile UI, feature logic and local persistence.
services/api will own authentication integration, membership enforcement, validation, synchronization and media authorization.
tests/e2e will own cross-client scenarios. Unit/integration tests live beside the corresponding project.
docs owns decisions and the roadmap.

Inside mobile, organize by features and a small shared core for persistence, sync, auth and media.
Screens call feature actions and local queries, not server endpoints directly.
Network and persistence adapters have explicit boundaries; do not introduce an interface for every class.
Backend feature endpoints may use EF Core directly for simple reads; extract meaningful business logic when required.
Avoid generic repository, CQRS/MediatR, event sourcing and an empty multi-project enterprise template.

## 3. Logical data model

| Record | Key relationships and important fields |
| --- | --- |
| User | Authentication subject; minimal profile; no custom password crypto |
| Trip | Owner, name, destination, start/end date, currency, optional budget, version |
| TripMember | Trip + user unique; owner/member role; membership status |
| Invitation | Trip, recipient or invite token hash, expiry, accepted/revoked state |
| Place | Trip, category, name, address/link, notes, visited status, version |
| Activity | Trip, optional place, date, optional local time, notes, version |
| PackingItem | Trip, label, checked state; personal/shared scope still open |
| Expense | Trip, exact amount, currency, date, category, author, optional payer, version |
| Memory | Trip, author, caption, optional place, media references, version |
| MediaAsset | Trip, author, private object key, content type, size, upload state |
| PendingOperation | Local operation ID, record ID, base version, payload, dependencies, retry state |
| ChangeRecord | Server sequence, trip, record ID/type, version, deletion marker |

Use client-generated stable record IDs for offline creation.
Server authorization derives the actor from the authenticated identity, not a client-supplied owner.
Use a decimal server column and a defined exact client representation (integer minor units with a known currency exponent, or a decimal library).
Never aggregate money using binary floating-point arithmetic.
Trip dates are calendar dates; itinerary time is destination-local with an explicit zone policy.
Audit timestamps are UTC. Do not reinterpret all trip dates as UTC midnight.

## 4. Local write and read flow

User action -> validation -> one SQLite transaction updates the record and writes its pending operation.
Only after that transaction commits may the UI report saved on device.
Screens read local data; local totals include pending writes.
When online and authenticated, the sync worker processes pending operations in dependency order.
Server checks membership, validates the operation, applies it and records deduplication receipt atomically.
The acknowledgement updates local version and pending state atomically.
Incremental pull applies remote records and advances its cursor in the same local transaction.
A pull must not overwrite dirty local records; retain the pending change and expose conflicts.

## 5. Synchronization contract to prove in the spike

- Each mutation has a stable operation ID scoped to its actor; retries reuse it.
- Repeated identical operations return the prior result; a reused ID with different payload is rejected.
- Updates/deletes carry a base server version. Mismatch returns a conflict and current server version.
- Initially prefer explicit user resolution for same-record conflicts over silent last-write-wins.
- Concurrent independent creates use different IDs and can merge without conflict.
- Deletions use tombstones; offline stale clients must not resurrect deleted records.
- Server ordering uses a cursor, not the device clock.
- Cursor expiry requires a controlled snapshot refresh without dropping the outbox.
- A local-only trip must be created remotely before its children can synchronize.
- Pending media bytes use a separate upload queue; metadata must not point to an unavailable finalized asset.
- Backoff transient failures; keep validation, authorization and conflict failures visible.
- Retry safely after crash between server commit and local acknowledgement.
- Membership removal rejects pending writes; preserve a visible explanation and apply the agreed local retention policy.
- Test concurrent membership removal versus mutation within server transaction boundaries.
- Initial scope is synchronization on open/resume/reconnect and manual retry. Background work is best effort.

## 6. Authentication and authorization

Select a supported mobile auth flow before implementing login.
An OIDC provider with Authorization Code + PKCE is a candidate; local Identity-based accounts need an explicit session/token design.
Store refresh/session secrets using platform secure storage, never ordinary SQLite, source code or logs.
Do not carry the old web-cookie recommendation into the mobile client unchanged.
Local databases are scoped to the signed-in account.
Offline use is access to already downloaded data, not fresh server authentication.
Expired sessions pause uploading and ask for online reauthentication without destroying pending changes.
Logout with pending changes requires explicit handling; do not silently wipe unsent work.
Every API query, mutation and media access checks membership. Possession of a UUID is not authorization.
Invitation acceptance and membership administration are online actions with expiry and revocation handling.
Token expiry, revocation behavior and local lock policy remain explicit pre-auth implementation decisions.

## 7. Media lifecycle

Copy selected images into application-owned durable storage before reporting offline save complete.
Do not persist temporary picker paths as the only copy.
Validate allowed content types and sizes server-side and decode safely.
Generate thumbnails/compressed variants; decide metadata/location stripping before uploads.
Use private objects and short-lived authorized access; never public permanent URLs.
Upload initialization, transfer and finalization must tolerate interruption.
Keep local originals until successful finalization and the agreed retention rule allows cleanup.
Offer deliberate offline downloads and clear status for unavailable images.
Set photo/space limits before beta. Clean orphaned uploads according to a retention policy.
Database and object-store backup/restore must be considered together.

## 8. Errors and observability

Use typed client results and a stable API error body with code, message and correlation ID.
Distinguish validation, unauthenticated, forbidden, conflict, offline and transient server failures.
Never expose stack traces or sensitive details in UI or API errors.
Collect only useful operational metadata; no tokens, trip notes or photo contents in logs.
Show pending count and actionable errors without presenting a failed upload as success.

## 9. Deployment and tests

Local development and private test environment precede production distribution.
API host, managed database, object storage, email and auth costs are reviewed before provisioning.
CI runs only commands that actually exist in generated projects; there is no executable application yet.
Use synthetic travel data.
Test local migrations with unsent changes, idempotency, money, membership enforcement,
conflicts, delete/update races, media interruption and offline restart.
Testflight/Android distribution and store requirements are separate work, with current cost checks.
A build is not a physical-device test. Windows cannot be assumed to provide an iOS simulator.

## 10. Architecture stress review

| Failure or overengineering risk | Treatment |
| --- | --- |
| Offline and collaboration dominate complexity | Prove two-client sync before building all sections |
| Last-write-wins loses meaningful changes | Version checks and explicit conflict preservation |
| Duplicate expenses after retry | Stable operation IDs and transactional deduplication |
| Photos vanish after restart | Durable copy, upload queue and restart test |
| Revoked access while disconnected | Document revocation limit; enforce on server reconnect |
| Currency math drifts | Exact numeric representation and authoritative validation |
| Full framework scaffolding locks in unapproved choices | Create layout now; runtime setup follows explicit decision |
| Three duplicate venue modules | One Place model, separate user-facing category views |
| Too many backend layers | One service with feature boundaries |
| Arbitrary device clocks reorder changes | Server cursor and server-assigned versions |

## 11. Decisions needed before runtime setup

Confirm mobile stack and auth/sync approach; UI language; desktop timeline; packing ownership;
expense/memory edit permissions; photo limits; hosting budget; physical-device availability.
Open product decisions should block only the feature they affect, not unrelated documentation work.

## References

- https://docs.expo.dev/guides/local-first/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://docs.expo.dev/versions/latest/sdk/imagepicker/
