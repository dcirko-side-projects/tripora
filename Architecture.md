# Tripora — Architecture

Status: planning, personal packing, expenses and memories checkpoint 2026-10-22. Read docs/STATUS.md for verification and remaining boundaries.
Product requirements: PRD.md. Quick rules: Architecture-essentials.md.

## 1. Decision register

| Area | Proposal | Reason | Status |
| --- | --- | --- | --- |
| Mobile | React Native, Expo, TypeScript | Android/iPhone UI, device media, shared client | Prototype implemented |
| Local data | SQLite | Transactional persistent offline records and outbox | Prototype implemented |
| Backend | ASP.NET Core, EF Core | One maintainable API and learning C# | Implemented development backend |
| Server data | PostgreSQL | Relationships, constraints and transactions | Migration and HTTP tests implemented |
| Media | Private local filesystem / Supabase Free private bucket | Image bytes remain separate from relational data | User selected hosted provider; adapter locally tested, deployment pending |
| Auth | Identity opaque bearer/refresh tokens, SecureStore adapter | Retain existing auth; Brevo delivers verification/reset | Mobile connected; real hosted email acceptance pending |
| Sync | Explicit versioned operations and incremental pull | Offline writes and collaboration need a defined contract | Owned writes, member reads, access reconciliation and automated tests implemented |
| Desktop | Separate delivery decision | Initial brief requests a useful desktop experience | Open |

Alternative clients: Flutter, or Ionic/Capacitor if sharing a web UI becomes decisive.
PWA remains viable but is no longer the leading proposal after native/mobile, offline and media requirements.
A managed synchronization service must be evaluated against custom sync in the spike; do not adopt a vendor by accident.
Expo SDK 57, React 19.2.3, React Native 0.86.3 and TypeScript 6 are locked through apps/mobile/package-lock.json after checking the official template and Expo compatibility. Backend targets .NET 10. Identity/explicit sync remain. User selected Render/Supabase/Brevo Free on 2026-10-30; no paid infrastructure is authorized. Section 6 and decision 0004 supersede historical open-provider/recovery notes below.

### Current implementation boundary

App.tsx uses Identity sessions and account-scoped SQLite for trip create/list/update/delete and explicit conflict resolution. SecureStore persists the session; expired authentication pauses uploads while retaining local work. Logout confirms retention and clears the session, not the account database. Synchronization runs on sign-in/restore, foreground resume, local mutation, manual retry and a 30-second foreground retry; concurrent runs share one promise. Network retries keep the immutable operation ID. Owners can issue/revoke invitations and remove members; invited accounts accept online and download shared trips. Members currently read basic trip data; only owners edit/delete it. The anonymous tripora-prototype.db is not opened or migrated. Real mobile core HTTP tests use two SQLite stores against PostgreSQL; component tests mock native bridges. Both owners and active members maintain shared places, food and nightlife through separate category views. Planning, personal packing, exact expenses/budget and private photo memories are implemented in the development prototype. Native-device verification, recovery and production deployment remain open. Croatian UI is a reversible prototype default.

## 2. Boundaries and layout

One repository, one mobile client and one deployable backend. No distributed services.
apps/mobile will own mobile UI, feature logic and local persistence.
services/api will own authentication integration, membership enforcement, validation, synchronization and media authorization.
tests/e2e will own cross-client scenarios. Unit/integration tests live beside the corresponding project.
docs owns decisions and the roadmap.

Inside mobile, organize by features and a small shared core for persistence, sync, auth and media.
Screens call feature actions and local queries, not server endpoints directly.

### Mobile navigation and design — 2026-10-23

The user's redesign brief confirms a raspberry (#C2185B), pale-sky (#E0F2FE) and white UI with Croatian date presentation. Global Trips/Sync/Account screens are separate from a selected trip's Overview/Plan/Places/Expenses/More tabs. More and overview shortcuts lead to personal packing, memories, membership and settings. Explicit typed React state extends the existing navigation approach; no navigation library or route backend was present. Android BackHandler and native Modal.onRequestClose provide return behavior. Form/detail modals prevent full editors from expanding lists. Shared UI tokens/components live under apps/mobile/src/ui, with feature screens retaining existing persistence actions.

SDK 57 native date/time pickers replace all free-text date/time input. Calendar dates are built from local components (no UTC-midnight conversion), displayed in Croatian and serialized to the same YYYY-MM-DD/HH:mm fields. Android uses the device's system picker locale; iOS requests hr-HR with explicit confirm/cancel. SVG icons and the date/time picker use versions listed in Expo's bundledNativeModules.json. No account DB migration, auth change, server endpoint, paid service or sync protocol change is introduced. Expense presentation groups existing canonical minor-unit strings using BigInt by category/author/payer without debt settlement. Details, coverage and remaining native QA: docs/UX_REDESIGN.md.
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
| PackingItem | Trip, author, label, checked state; personal per participant, explicitly selected 2026-10-22 |
| Expense | Trip, exact amount, currency, date, category, author, optional payer, version |
| Memory | Trip, author, caption, optional place, media references, version |
| MediaAsset | Trip, author, private object key, content type, size, upload state |
| PendingOperation | Local operation ID, record ID, base version, payload, dependencies, retry state |
| ChangeRecord | Server sequence, trip, record ID/type, version, deletion marker |

Use client-generated stable record IDs for offline creation.
Server authorization derives the actor from the authenticated identity, not a client-supplied owner.
Implemented money representation: canonical integer-minor-unit strings in validated record payloads; server validates bounded Int64 values and client sums with BigInt. The prototype supports EUR/USD/GBP, all with exponent two. A relational decimal column was an earlier proposal and is not the implemented format.
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

### Hosted beta and account lifecycle — explicit user decisions 2026-10-30

The budget is zero, internet availability is desired, email confirmation/recovery remains required, and the user approved preparation for Render Free API + dedicated Supabase Free PostgreSQL/private storage + Brevo Free HTTPS email. ASP.NET Identity stays the authentication system; Supabase is not an auth or sync replacement. No service accounts, paid resources or live deployment were created. [Setup and verified limits](docs/FREE_BETA_SETUP.md), [decision](docs/decisions/0004-free-beta-and-account-lifecycle.md).

AccountEmail implements Identity's generic email sender, analogous to injecting a mail transport bean into Spring Security's account service. Development/Testing use a private file outbox; hosted mode requires configured Brevo transport and confirmed-email login. Native resend/confirmation-code and password-reset forms use framework tokens with a one-hour lifespan, no custom password hashing/token protocol. Reset invalidates old access/refresh stamps; anonymous forgotten-password requests are neutral for unknown/unconfirmed addresses. Body limits and request-query logging suppression protect auth codes. Actual sender deliverability remains an external acceptance step.

The user explicitly chose deletion of owned trips and all own records in other trips. Native UI requires current password, exact deletion phrase and a final confirmation. Under the existing transaction advisory lock the server erases record content/PII, advances tombstone versions, removes relevant receipts and credentials/claims/logins/tokens/roles, disables memberships and invitations, and leaves only a credential-free identity stub for FK/sync references. Place creator identity is now persisted; the migration backfills it from earliest retained place receipts. New-trip writes recheck non-erased identity under the transaction lock. A new registration of the erased email receives a new ID/scope and cannot reclaim old records. Personal packing is included; other authors' text remains when clearing a reference to the erased account's photo.

Photo erasure marks assets PendingDeletion in the account transaction before byte deletion. Authorization is revoked even if storage cleanup fails. The response reports pending cleanup, later guarded foreground/manual cleanup retries it, and a different author's live reference is cleared before deleting bytes. There is no unattended hosted cleanup worker yet. Local logout after closure waits for in-flight sync, closes the DB and attempts removal of that account's SQLite/media scope; failures are shown. Copies on other disconnected devices and historical backups require separate retention/erasure treatment.

Hosted key persistence uses the official EF Data Protection repository and a required PFX encryption certificate, analogous to a shared encrypted key store rather than per-container generated secrets. SupabaseMediaFiles preserves the private API contract, stable object IDs/upsert retries and age-based orphan cleanup while moving bytes off ephemeral Render disk. Every client read/write still passes the existing API membership/publication rules. Before migrations/startup, Supabase anon/authenticated roles must lack public schema access, so automatic Data API routes cannot expose Identity/app tables. Startup also refuses a public bucket, incomplete hosted opt-in, non-HTTPS origins or a DB connection lacking VerifyFull TLS. Docker/readiness and Render configuration are prepared; live provisioning and hosted backup/restore remain open.

Launcher assets are original vector suitcase/airplane artwork in the existing raspberry/sky theme. A reproducible SVG rasterization script produces the ordinary PNG and a padded Android adaptive foreground. This is branding/configuration, not a database/sync change.

The private spike uses ASP.NET Core Identity opaque bearer/refresh tokens; see docs/decisions/0001-auth-sync.md.
An OIDC provider with Authorization Code + PKCE remains an alternative for future federation; it is not the implemented flow.
Store refresh/session secrets using platform secure storage, never ordinary SQLite, source code or logs.
Do not carry the old web-cookie recommendation into the mobile client unchanged.
Local databases are scoped to the signed-in account.
Offline use is access to already downloaded data, not fresh server authentication.
Expired sessions pause uploading and ask for online reauthentication without destroying pending changes.
Logout with pending changes requires explicit handling; do not silently wipe unsent work.
Every API query, mutation and media access checks membership. Possession of a UUID is not authorization.
Invitation acceptance and membership administration are online actions with expiry and revocation handling.
Token expiry, revocation behavior and local lock policy remain explicit pre-auth implementation decisions.

### Membership implementation — 2026-10-22

Development defaults, not final production product decisions: owner manages base trip metadata and membership; member reads base metadata. Shared place/activity edits will follow in their feature iteration. Invitations target an existing registered account, use a manually shared random 256-bit code, expire after seven days and store only SHA-256 of the code. No email is sent. Email verification is still absent; this flow is development-only. See docs/decisions/0002-membership.md.

Invitation acceptance is idempotent while accepted membership remains active; removal revokes all prior codes for that recipient/trip. Reissuing supersedes old codes. Membership changes, acceptance and sync writes/pull hold the same PostgreSQL transaction advisory lock, analogous to Spring @Transactional with a database lock. Granting access bumps the trip's global version so existing device cursors still discover it.

Each pull includes the current full accessible-trip ID/role list, including tombstones. SQLite applies access, remote records and cursor atomically. Missing access marks a known server record as revoked; it does not erase its downloaded copy or immutable outbox. Local creates are excluded from revocation. Removed work is visible and paused; an explicit new invitation can restore access. The full access list is a deliberate small-group prototype tradeoff, not a scalable access-event stream. No instantaneous offline data erasure is promised.

### Shared places and offline data — 2026-10-22

One PlaceRecord with category place/food/nightlife backs three explicit UI views. Owner and active member can create/edit/delete places and mark them visited. Fields are name, notes, address, optional HTTP(S) link and visited status; external links do not provide offline maps. Daily-plan entries reference these places by ID without duplicating records.

SQLite account schema v2 adds account_places, pending_places and a separate place cursor in an additive transaction preserving all v1 trips/outbox. Place edits write the entity and immutable pending request atomically. More offline edits keep the original request unchanged and stage a follow-up ID; acknowledgement atomically queues the latest desired state against the accepted version. This supports edit/visited/delete before the first request is confirmed, including after an uncertain network failure. Conflict resolution compares the server version with the latest local draft, not only the older request payload. No tombstone is resurrected.

Account synchronization downloads/reconciles parent trips and access first, then uploads and pulls places. Place endpoints use the same global clock, receipt table and transaction lock as trips; receipt digests are feature-scoped. Every place access rechecks current membership and parent identity. Granting membership bumps existing child versions to avoid skipping them behind a device's cursor. Deleting a trip produces tombstones for all its live places in the same transaction. Removed access pauses child uploads without erasing the local copy or outbox.

The manual Prepare for offline action runs the same pipeline. A persisted offlinePreparedAt marker is written only after all trip/place/entry paginated pulls finish; interrupted downloads resume from the committed cursor without claiming a completed initial snapshot. It covers trip/place/entry metadata; photographic bytes require explicit download and external maps are excluded. Pending/conflict states are independent of this downloaded-snapshot timestamp. Desktop persistence tests and Expo exports do not prove native cold start without Metro.

### Phases 6–8 implementation — 2026-10-22

The user explicitly chose personal packing. Plan activities are shared, reference places by ID and store calendar dates and optional destination-local HH:mm strings; no device-zone conversion occurs. Dates outside the trip are rejected, and the owner must first adjust/unschedule activities before shortening the trip. Place deletion preserves existing references with an unavailable label until the user chooses another place or clears the reference.

New Entry records share one offline transport/storage mechanism with separately validated typed payloads for plan, packing, budget, expense and memory. The server assigns immutable author identity/email. Plan is editable by active members; packing is readable/writable only by its author, including against trip-owner requests. Expense/memory author edits/deletes own content; owner moderation is the explicit prototype default. Only owner configures the budget. Budget ID equals trip ID, one currency per trip; currency locks after the first expense, including deleted history. Payer is a separate optional text field. Totals include local drafts/pending records and use exact integer arithmetic; no exchange rates or debt settlement.

SQLite account schema v3 adds entries, immutable pending operations/follow-ups, a cursor and local media metadata. v1/v2 records and queues survive migration; old offline-ready timestamps are cleared because their download scope was smaller. Sync order is trips/access, places, referenced media uploads, entries (budget before expenses), then confirmed local media cleanup. Packing filters are enforced by the server before pagination. Membership grants advance eligible child versions, including the rejoining user's own packing; trip deletion tombstones all child records atomically. Metadata preparation markers exclude photographic bytes.

### Implemented photo lifecycle — development defaults

Gallery selection uses Expo image picker with no microphone/camera permission, then re-encodes to PNG at max 1280 px and a 320 px thumbnail. The picker pixel count is checked before preparation, and decoded dimensions are checked before resizing; sizing uses decoded dimensions because EXIF rotation can swap the picker axes. One image per memory, 100 assets per trip, 8 MiB image/1 MiB thumbnail are reviewable development limits, not production storage pricing decisions. Both copies are written into account-scoped document storage before reporting save; hashes and scope/URI checks guard reads/downloads. Temporary picker/manipulator URIs are not the only saved copies.

Oversized copies left by the earlier EXIF sizing bug can recover after HTTP 400/invalid_media, only while locally pending. The native adapter verifies both hashes and PNG headers/bounds, then prepares bounded copies at new durable paths. The media row switches only after preparation; the asset ID and immutable entry outbox remain unchanged. Such oversized bytes could not have passed the server's existing validation. Accepted/downloaded media, other errors and correctly bounded images are never rewritten by this recovery. Retry uses persisted repaired hashes/paths across restart; original copies remain tracked in recoveryCopies until normal guarded deletion/orphan cleanup. No database schema migration or server contract change is required.

The separate media queue posts a stable asset ID plus original/thumbnail hashes and bytes before memory metadata can reference the asset. Interrupted requests retry the entire bounded upload idempotently; there is no chunk-offset resume claim. The API checks PNG signature/chunks/CRC, bounds and decompressed row structure, then writes temporary files and atomically moves them to a private root outside web serving. It commits MediaAsset metadata only after both writes. The local adapter accounts for File.move changing the source object's URI so cleanup cannot delete the successful destination.

Authenticated image downloads recheck active membership, parent trip and a published live memory (or the uploader); responses are private/no-store. Other members explicitly download to durable local copies with hash checks for offline viewing. No public image URLs exist. Metadata preparation does not imply image availability or offline maps.

Confirmed memory deletion permits local copy removal only when no active/pending record references it. Server cleanup by uploader or trip owner removes unreferenced assets tied to a deleted memory; otherwise unreferenced uploads/final orphan files expire after seven days. Recent unrelated uploads are retained. Interrupted .part files older than one day are cleaned during guarded cleanup. Cleanup runs on foreground sync/manual request, not an independently scheduled cloud job. Byte/database backups must be managed together. Native picker, codec output, metadata stripping, permissions and real-device restart remain beta QA requirements, not inferred from component/desktop tests. No cloud media vendor or paid storage was selected.

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

### Phase 9 development safeguards — 2026-10-22

Trip cards summarize local places/plan/personal packing, exact pending-inclusive money, memory/photo counts and work needing attention. A metadata download marker does not claim that all image bytes are local. Device testing remains required for usability and cold-start acceptance.

Secure-storage writes/clearing are serialized and generation-guarded so logout during sign-in or refresh cannot restore old credentials. Authenticated/auth responses use private/no-store. Native image preparation checks a 32 MiB free-space development threshold and cleans temporary codec files on errors; SQL/filesystem failures preserve previous committed data and queues. The threshold is advisory, not a reservation or native low-storage proof.

Session race hardening — 2026-10-23: restore waits for earlier queued storage work and checks the session generation after asynchronous storage reads and scope validation. HTTP requests capture their starting generation, check it before sending/retrying and after successful responses, and discard stale results. A late 401 cannot refresh a different account or replay the old account's mutation with its token. Refresh sharing is scoped to a generation, so a new account does not join an old refresh still in flight. Logout blocks new requests immediately while secure-storage clearing completes. Already-sent server operations may still commit; existing immutable operation IDs/receipts make a later retry safe.

The local runner configures Tripora:KeyRoot inside its private data folder. These Data Protection keys protect opaque Identity tokens (analogous to persisting application token key material in Spring Security); they are separate from password hashes. Existing sessions may need sign-in when first switching from host-default keys. Production key encryption/hosting is still unselected.

Local cold snapshots copy stopped PostgreSQL 17 cluster files, private media, keys and settings together with SHA-256 manifests. The runner and maintenance share an exclusive lock. PostgreSQL is shut down using pg_ctl fast/wait, avoiding the embedded library's forced Windows termination. Live clusters, linked/outside paths, corrupted files and existing restore targets are rejected. Restores create a new data folder; no automatic overwrite or deletion occurs. TRIPORA_DEV_DATA can point the runner at the verified restored folder. This is a same-platform/architecture development snapshot, not a portable SQL dump, encrypted archive, remote backup or backup of unsent phone data. Checksums detect corruption, not malicious replacement; keep the entire snapshot private. See docs/PRIVATE_BETA.md.

Local development and private test environment precede production distribution.
API host, managed database, object storage, email and auth costs are reviewed before provisioning.
CI runs the actual typecheck, SQLite tests, mobile exports, API build and HTTP smoke check defined in .github/workflows/ci.yml. Local results and hosted CI results must be reported separately.
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

## 11. Decisions needed before authenticated synchronization

Confirm production auth/recovery approach; final UI language; desktop timeline;
expense/memory edit permissions; photo limits; hosting budget; physical-device availability.
Open product decisions should block only the feature they affect, not unrelated documentation work.

## References

- https://docs.expo.dev/guides/local-first/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://docs.expo.dev/versions/latest/sdk/imagepicker/

## Visual and connection update — 2026-10-31

The explicit user palette supersedes raspberry/pale-sky: primary #0593C6, surface #FCFFFF, accent #D83995, with darker text variants and blue/pink tinted panels. Existing global/trip navigation, account scopes, DB/API/sync payloads remain. Shared tokens, cards, controls, day selector and launcher assets follow this palette.

SessionClient bounds each JSON request, including response-body consumption, with AbortController and a cleared 75-second timer instead of the old 15-second fetch-only AbortSignal.timeout. This accommodates an approximately one-minute free-host cold start; it is no availability guarantee. Arbitrary POSTs are not automatically replayed on network failures. Existing immutable sync operation IDs, foreground/resume retry and session-generation checks remain. Failure preserves account credentials and local outbox. The UI's existing global busy lock can remain active while a slow request waits; independent editing during sync needs a separate bounded change.

The current QA endpoint is a local computer HTTPS service, not internet hosting. No hosted URL/credentials are provisioned. Stopped laptop processes, stale runner locks, missing USB forwarding or laptop sleep can make it unreachable. Render Free wakes on demand after idle; Supabase Free can pause after prolonged inactivity. There is no zero-cost always-on guarantee. No paid hosting, OS auto-start service or keepalive automation has been enabled.

Maps remain proposal-only: no dependencies, schema, endpoints or map UI added. See [map research](docs/MAP_RESEARCH.md) and [connection evidence](docs/DESIGN_CONNECTION_2026-10-31.md). Provider, persistence rights, EEA rules and costs require agreement before implementation.

## Maps and card-free beta — accepted 2026-10-31

This section supersedes the earlier research-only map boundary and the Supabase-based hosting proposal. The user authorized implementation of name+city lookup with candidate confirmation, an online trip map, offline saved lists, zero cost and no bank card even for hosting. Small initial audience; market release requires a new capacity review. Full decision: [0005](docs/decisions/0005-maps-and-no-card-beta.md).

MapLibre 11.5.1 adds a native Popis/Karta view within Places, category/status filters, numbered category-colored markers, existing details and external Google Maps directions by coordinates (no Google API key). SDK 57/new architecture compatibility is checked through typecheck/exports and Android compilation; new native install required. Runtime config provides tile URL/attribution; the beta default is OSM raster with application User-Agent, visible attribution and normal HTTP cache, without offline packs/prefetch. Saved lists remain available when the map/provider cannot load.

Authenticated /api/places/search accepts a trip, public place name and city only after a user action; it checks current trip membership. Nominatim-compatible responses yield at most five finite/bounded, deduplicated OSM candidates. Global PostgreSQL transaction advisory lock and persisted timestamps gate upstream calls (1.1 seconds), 30-day hashed-query cache survives API restarts, per-account limiter is 12/minute, and default upstream cap is 200/day. No autocomplete, bulk backfill or confidential notes sent to providers. Search and map tile origins are server-configurable. Cache rows retain public results, not raw queries or account identities. Public OSM service limits are not a production SLA.

Place location is optional latitude/longitude/displayName/provider/providerId, stored in existing SQLite JSON and server nullable LocationJson via an additive migration, plus PlaceSearchCache. No existing outbox rewrite/local DB version bump. Existing entity+operation atomic writes, immutable IDs/follow-ups, retry, pull, conflicts, removals and tombstones carry coordinates. Null location is omitted from server mutation serialization to preserve old receipt digest shapes. Renaming/address/city changes clear stale location; asynchronous search generations prevent old results attaching to a new draft. Conflict descriptions include both coordinate versions. Place/account deletion clears server coordinates.

Hosting uses Render Free API, Neon Free PostgreSQL, Cloudinary Free authenticated original/thumbnail objects and Brevo Free email. The four accounts are connected and the API is live; verified transport evidence and remaining acceptance gates are in [the hosted checkpoint](docs/HOSTED_BETA_2026-10-31.md). Supabase support remains optional for prior environments. Neon does not replace Identity/auth/sync. Production still requires hosted opt-in, confirmed email, durable certificate-encrypted DB keys and verified DB TLS; Neon mode rejects unexpected exposed Data API roles without requiring Supabase roles. Cloudinary signed upload/download/delete and inventory operate server-side; provider URLs/credentials never reach clients. Stable IDs, exact PNG/hash checks, existing API authorization and retriable byte deletion remain. Inventory is limited to every 30 minutes per process; confirmed deletions are independent. Setup and all external gates: [no-card guide](docs/NO_CARD_SETUP.md).

The user initially had no provider accounts and requested registration steps; all four are now registered. Card-required registration, quotas or provider rejection cannot be hidden by a paid upgrade. Short automatic cold start is acceptable, but full unattended availability and hosted combined backup still need acceptance. No keepalive automation or OS autostart is introduced.

Publication checkpoint — 2026-10-31: user made the repository public and authorized commit/push to codex/offline-foundation. Source 4890618 is live on Render Free at https://tripora-l4c7.onrender.com. Provider secrets and the verified sender address were connected with explicit approval; actual readiness/restart, Brevo test delivery and private Cloudinary adapter transport pass. This is not full hosted auth/sync, device, idle/multi-day or backup acceptance. Main and parent legacy history remain unchanged. Current setup state is in docs/STATUS.md.
