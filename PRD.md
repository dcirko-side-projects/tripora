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
- Daily plan and packing: retained from the original brief; confirm their release priority.

Separate food and nightlife views must remain visible to users even if they share underlying behavior.

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

One currency per trip; no automatic exchange rates.
Memories initially support images and text, not video.
Packing ownership, UI language, desktop priority and photo limits are open decisions.
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
