# Membership iteration — 2026-10-22

## End-to-end acceptance

- [x] Owner issues a recipient-bound invitation and manually shares its code; only hash stored.
- [x] Invited account accepts online; retry is idempotent and trip downloads past an older cursor.
- [x] Member sees owner updates and deletion; member cannot modify basic metadata or membership.
- [x] Owner lists members and pending invitations, revokes invitations and removes members.
- [x] Revoked, expired, superseded and wrong-recipient codes are rejected.
- [x] Removed user cannot fetch or push; old codes cannot silently rejoin.
- [x] Cached copy/outbox survive restart with explicit revoked status; upload pauses and local edits are blocked.
- [x] Deliberate new invitation restores access without dropping queued work.
- [x] Accept/remove race is serialized and removed access stays removed.
- [x] API restart preserves invitations and accepted membership.
- [x] App component journey covers issue/revoke/remove confirmation/accept and read-only/revoked UI.
- [ ] Physical Android/iPhone and native secure storage/SQLite bridges: postponed by user.

Development defaults: owner manages base trip data; member reads it; seven-day code for an existing registered account.
Production policy, verified email, hosting and device acceptance remain open.
