# Tripora — Product requirements

Status: product baseline from the user's brief and follow-up requests, 2026-09-26.
Technical choices belong in Architecture.md.

## Purpose and audience

Tripora brings a small group's travel information together before, during and after a trip.
The primary experience is a mobile application for Android and iPhone.
People must be able to read previously downloaded information and record changes without internet.
The initial audience is the owner and their travel companions. A credible portfolio is a secondary outcome.

## Required sections

- Trips: upcoming, active and past trips; create, edit and delete.
- Information: title, destination, dates, description and practical notes.
- Places: attractions, landmarks and other places to visit.
- Food: restaurants, cafes and related places.
- Nightlife: clubs, bars and related places.
- Expenses: fast entry, list and budget overview.
- Participants: real people with accounts who can use a shared trip.
- Memories: photos and written memories. Other formats need a separate decision.
- Daily plan and personal packing: included in the requested phases 6–8; personal ownership confirmed 2026-10-22.

Separate food and nightlife views must remain visible to users even if they share underlying behavior.

UX redesign brief accepted 2026-10-23: mobile screens must separate global navigation from a selected trip, keep full forms out of lists, use native date/time selection and Croatian date formatting, and apply the visual palette (superseded by the 2026-10-31 palette below). Existing functionality, personal packing privacy and explicit offline/sync/conflict states must remain available. Implementation and device acceptance: docs/UX_REDESIGN.md.

## Principal journeys

1. Create a trip, enter basic information and prepare it for offline use.
2. Invite a companion while online; they accept and download the trip.
3. Save a landmark or restaurant, optionally add it to a day and mark it visited.
4. Record an expense immediately after paying, including without a connection.
5. Add a photo and note without internet, then share them after reconnecting.
6. Reopen the app offline and find saved work intact.
7. Reconnect and see pending changes converge, or resolve an explicitly shown conflict.

## Offline contract — proposed details

First sign-in, invitations and initial download require internet.
Locally available trip information stays usable offline.
New and edited records persist after closing and reopening the app.
The interface distinguishes saved on device, pending upload, synchronized and needs attention.
A trip is marked ready offline only after its required content has been saved.
Photos from other members require download before offline viewing.
External map links do not imply that maps or navigation work offline.
Membership revocation cannot instantly erase already downloaded information on a disconnected device.
Do not promise continuous background synchronization while the application is closed.

## Collaboration — proposal to validate

Use two initial roles: owner and member.
Only the owner manages membership and deletes the whole trip.
Members can maintain shared places and activities.
For expenses and memories, propose author edits/deletes own content; owner can moderate.
Show who recorded an expense; a payer is distinct from the author.
Do not calculate debts or settlement payments in the first release.
Conflict resolution must preserve the user's pending version until an explicit resolution.

## Initial release boundaries

Decisions 2026-10-30: initial internet beta must use zero-cost services within their limits. Retain email confirmation and password recovery. Deleting an account requires password and explicit double confirmation and removes owned trips plus the user's own records in other trips; previously downloaded copies/backups need separate retention handling. The app must have a recognizable suitcase/airplane launcher icon. iPhone acceptance is deferred; this does not silently remove iOS or desktop from the overall requirements. Details: docs/decisions/0004-free-beta-and-account-lifecycle.md.

One currency per trip; no automatic exchange rates.
Memories initially support images and text, not video.
Personal packing per participant was explicitly selected by the user on 2026-10-22; other participants, including the owner, do not see that list.
UI language, desktop priority and production photo/storage limits remain open decisions. Prototype photo limits are documented in Architecture.md.
Desktop remains a requirement from the initial brief whose timing must be agreed, not silently dropped.

Excluded: booking, payments, chat, social feed, live tracking, AI generation, automatic venue discovery,
weather integrations and Splitwise-style settlement.

## Acceptance examples

- A user cannot fetch or change a trip to which they do not belong.
- Two members independently create expenses offline; both appear once after synchronization.
- Two edits of the same record produce a visible conflict rather than silent data loss.
- A photo added offline remains available after restart and is uploaded when permitted.
- A removed member's queued changes are rejected without pretending they synchronized.
- Budget totals include pending local expenses and reconcile after accepted synchronization.
- Android and iPhone physical-device evidence is required for beta sign-off.

## Milestones

Local prototype -> shared data foundation -> places and planning -> money -> memories -> private beta.
Use docs/TRIPORA_PLAN.md for the detailed checklist. No dates are promised before the technical spike.

## Visual refresh — 2026-10-31

User requested primary #0593C6, light #FCFFFF and accent #D83995, with mobile hierarchy, tinted surfaces and accessible text/control colors. Existing navigation and offline behavior remain. The original research-only map boundary is superseded by the accepted scope below. Historical comparison: [map research](docs/MAP_RESEARCH.md).

## Accepted maps and no-card availability — 2026-10-31

User authorized implementation: enter a public place name plus city, explicitly find/select the correct result, save its coordinates and display it on the trip map. Manual pin placement is not the primary workflow. No invented positions when lookup fails. The map requires internet; existing downloaded lists/addresses/notes stay usable offline. Popis/Karta sits within Places, with category/status filters and place details/navigation. Existing places without coordinates remain visible in the list and can be located later. User-triggered lookup is included; automatic venue recommendations remain excluded.

Initial hosting must cost zero and require no bank card, including provider verification. Laptop-independent availability with occasional short automatic wake is acceptable; Free quotas/SLA limitations must be explicit. Users retain email/password accounts. No provider accounts exist; user requested [registration steps](docs/NO_CARD_SETUP.md). Real hosting/native acceptance remains pending, not implied by local builds. [Decision 0005](docs/decisions/0005-maps-and-no-card-beta.md).
