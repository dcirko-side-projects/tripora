# Mobile UX proposal — 2026-09-28

Status: initial flow and navigation proposal; native visual/device review pending.
Croatian labels are a reversible prototype default. No final branding decision is implied.

## Navigation

Outside a trip: My trips -> new trip or trip overview.
Inside a trip, propose four bottom destinations: Overview, Explore, Expenses, Memories.
Explore contains clearly labeled Places / Food / Nightlife views.
Overview links to Information, Participants, Daily plan and Packing.
Do not put every module into an overcrowded bottom bar.
Android system back and iOS navigation back must preserve expected navigation and unsaved-form behavior.

## Current implemented flow

My trips -> New trip -> name, destination, start/end date -> Save -> local trip card.
No preloaded sample data. Empty state makes the first action clear.
Form retains invalid input so the user can correct it.
Date entry currently uses ISO calendar dates; a native date picker is a follow-up UX improvement.
Cards explicitly show local-only state. They are not tappable until detail navigation exists.
The prototype's local-only explanation prevents an assumption that data is backed up or shared.

## Wireframes

~~~text
MY TRIPS                    NEW TRIP
Tripora                     Back / Cancel
Your next trip              Name
Local-only notice           Destination
My trips              N     Start / End date
[ + New trip ]              [ Save trip ]
[ Destination          ]
[ Trip name            ]
[ Dates                ]
[ Saved on this device ]
~~~

~~~text
TRIP OVERVIEW (planned)
Trip title / dates / participants
[ Today's plan ]
[ Budget / spent ]
[ Packing progress ]
[ Information ] [ Participants ]
----------------------------------
Overview | Explore | Expenses | Memories
~~~

## Primary journeys to build

- Explore: choose category -> add place/link/note -> optionally schedule -> mark visited.
- Expenses: amount first, title, category, date default -> save -> exact budget update.
- Members: invite online -> accept online -> download -> offline shared edits.
- Memories: select photo -> durable local copy -> optional caption -> pending upload -> shared when finalized.

## State and accessibility requirements

Loading, empty, validation, storage failure, offline, pending upload, conflict, expired session.
Text labels accompany status colors; do not communicate saving by color alone.
Use safe areas, scrollable forms, touch targets >=48 layout units and system text scaling.
Check long names, small screens, keyboard behavior, screen reader order and landscape policy.
Visual palette in the prototype: warm neutral background, dark green actions and high-contrast text.
No claim of native visual QA until screenshots or physical-device inspection are available.
