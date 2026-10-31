# 0004 — Free hosted beta and account lifecycle

Date: 2026-10-30. Explicit user decisions during implementation of the next three release phases.

- Budget is zero. The user wants internet availability and accepts free-service limits. No paid plan/domain/resource is authorized.
- Approved preparation: Render Free API, dedicated Supabase Free PostgreSQL/private storage, Brevo Free transactional email. ASP.NET Identity remains the auth system; Supabase Auth/sync is not introduced.
- Keep email confirmation and email password recovery. Local development/testing may deliver to a private file outbox; hosted beta requires actual Brevo credentials and confirmed email.
- Account deletion requires password, the exact phrase OBRIŠI RAČUN I PUTOVANJA, and a final native confirmation. Delete the account's owned trips and their content, plus the user's own records in other trips, including personal packing and private images.
- Keep only erased, versioned tombstones and a credential-free identity stub needed by existing references. Clear email/phone/password/logins/tokens/claims/roles and invalidate sessions. Already downloaded copies on other phones cannot be remotely erased. Historic backups need their own retention/erasure procedure.
- Track place creator identity going forward. Backfill old creator IDs from the earliest retained place mutation receipt. Do not infer authorship from the last editor.
- A byte-deletion failure does not restore access: persist PendingDeletion, report pending cleanup, and retry through guarded foreground/manual cleanup. This is not a continuously scheduled deletion service.
- Use database-persisted Data Protection keys, certificate-encrypted in hosted mode, and private object storage instead of ephemeral API disk. Close the Supabase public Data API schema to anon/authenticated roles before migrations. Fail startup if the schema or photo bucket is public.
- iPhone acceptance remains deferred on the user's instruction; no iOS physical-device sign-off is claimed.
- Launcher branding: original vector suitcase/airplane in the existing raspberry/sky palette, rasterized for Android adaptive and ordinary app icons.

Free plans are for the bounded private beta, not a promise of always-on production or unlimited storage. Real provider provisioning, email deliverability, hosted backup/restore, quota operation and hosted CI are still acceptance steps. No external accounts/resources or real email deliveries were created by this implementation.

Implementation/checkpoints: [release work](../RELEASE_PHASES.md), [free beta setup](../FREE_BETA_SETUP.md), [status](../STATUS.md).
