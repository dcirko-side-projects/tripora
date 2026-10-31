# Phases 6–8 — acceptance and evidence

Checkpoint: 2026-10-22. Functional development implementation; physical-device acceptance remains open.

## Phase 6 — plan and personal packing

- [x] Shared activities can be created/edited/completed/deleted offline, dated or unscheduled, with optional local time and activity/transport/stay category.
- [x] Plan references saved places; missing/deleted places visibly unavailable. No duplicate place records.
- [x] Client/server reject invalid dates and trip shortening that excludes planned activities.
- [x] Personal packing visible/editable only to its author, including against owner access and paginated API pulls.
- [x] Restart, two-account conflicts, removed access and parent deletion tested without resurrection.
- [ ] Follow a real multi-day trip on installed Android/iPhone builds.

## Phase 7 — expenses and budget

- [x] Amount/title/date/category/notes, optional payer and immutable server author.
- [x] Owner controls budget/currency; author edits own expense and owner can moderate.
- [x] EUR/USD/GBP two-decimal minor-unit strings, server Int64 validation, client BigInt totals; 0.10 + 0.20 = 0.30 exactly.
- [x] Pending edits/deletions affect totals; currency locks after any expense, including deleted history.
- [x] Lost/concurrent acknowledgements, changed replays, invalid data, conflicts and unauthorized edits tested.
- [ ] Confirm practical entry speed/accessibility during beta; no conversion or debt settlement.

## Phase 8 — memories and photos

- [x] Text/photo memories with optional place; denied/cancelled gallery selection handled in component tests.
- [x] Durable local original/thumbnail and independent upload state; source deletion/restart and uncertain upload retry tested with actual temporary files.
- [x] Stable asset ID/hashes, PNG validation, bounded dimensions/bytes/count, duplicate retry and corrupt/partial HTTP uploads tested.
- [x] Membership/publication checks, private/no-store responses, cross-account denial and restart persistence tested against actual API.
- [x] Explicit verified download supports offline images. Interrupted download never claims success or destroys existing verified cache.
- [x] Confirmed deletion guards live/pending references; owner moderation, seven-day unrelated orphan grace and quota recovery tested. Interrupted .part retention is one day, cleanup runs foreground/manual.
- [ ] Native gallery codecs, metadata stripping, permissions, low disk space, SecureStore/SQLite bridges and airplane-mode installed-build restart on both platforms.

## Executed checks

Typecheck; 43 mobile tests; 34 PostgreSQL/HTTP scenarios; .NET Release build (zero warnings/errors); HTTP liveness; Android/iOS bundle exports.

Evidence lives in apps/mobile/tests/entriesMedia.test.cjs, nativeMedia.test.cjs and app.test.cjs, plus tests/e2e/work-scenarios.mjs invoked by auth-sync.mjs. Images/accounts are synthetic. Tests exercise desktop SQLite/filesystem and actual HTTP/PostgreSQL; native bridges are mocked. These are not device tests or hosted CI results.

See [status](STATUS.md), [roadmap](TRIPORA_PLAN.md) and [decision](decisions/0003-planning-money-memories.md).
