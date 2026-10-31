# 0003 — Planning, exact money and private photo memories

Date: 2026-10-22. Status: development implementation; production defaults remain reviewable.

The user requested roadmap phases 6–8 and explicitly selected personal packing for each participant. Packing is author-only even against the owner. Plan is shared among active members. Expense/memory authors edit their own records; owner moderation and owner-only budget settings are prototype defaults.

Typed validated plan/packing/budget/expense/memory payloads share Entry storage and offline transport. Server persists validated JSON text with immutable author/version/tombstone metadata; SQLite v3 preserves queues. This avoids five duplicate sync engines while retaining per-feature validation/permissions. Revisit relational projections when querying needs justify them.

Money travels as canonical integer-minor-unit strings with Int64 server validation and BigInt client arithmetic. Current EUR/USD/GBP use two decimals. One currency per trip locks after the first expense; payer differs from author. No exchange service or debt calculation.

Photos use gallery selection, re-encoded PNG at max 1280 px plus 320 px thumbnail, durable account files and an independent idempotent queue. Development limits: one photo/memory, 100 assets/trip, 8 MiB/1 MiB. Private server files remain outside static serving; membership/publication are checked on reads. Cloud vendor, paid infrastructure and production storage limits were not selected.

Bounded uploads retry whole files, not chunks. Explicit verified downloads determine offline availability; metadata readiness does not imply images. Deleted unreferenced assets can be cleaned after acknowledgement; unrelated orphans have seven-day grace, interrupted .part files one day. Cleanup is guarded foreground/manual work. Backups must pair DB and private bytes.

Native codec output/metadata stripping, gallery permissions and physical Android/iPhone restart remain beta requirements. Evidence: [checklist](../PHASES_6_8_CHECKLIST.md). Both [architecture](../../Architecture.md) and [essentials](../../Architecture-essentials.md) record these decisions.
