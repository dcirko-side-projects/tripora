# Tripora agent instructions

## Read before work

Read PRD.md, Architecture-essentials.md and the current checklist in docs/TRIPORA_PLAN.md.
For structural, sync, auth or media changes, read the relevant Architecture.md sections.
Follow explicit user decisions over drafts; record changed decisions in both architecture files.
The parent directory contains legacy work. This directory is the clean restart.
Do not migrate or publish the parent code or Git history without a user request.

## Work style

Communicate with the user in Croatian; use consistent English code identifiers.
Explain unfamiliar .NET concepts through precise Java/Spring comparisons.
Implement one small end-to-end behavior at a time, with acceptance criteria before edits.
Inspect current files and Git state; preserve unrelated changes.
Keep scope bounded. Label assumptions and unapproved choices rather than presenting them as decisions.
Do not silently choose an auth vendor, sync service or paid infrastructure.
Use synthetic people, trips and photos for demos and tests.
Do not spawn subagents unless the user explicitly requests delegation.

## Verification

For documentation/layout-only changes, check relative links, required files, consistency and git diff --check.
No runtime is scaffolded yet: do not invent npm, dotnet or CI commands.
When runtime projects are created, add their exact working build/lint/typecheck/test commands here.
For sync changes verify restart persistence, retries, conflicts, deletions and access enforcement.
For media changes verify durable local storage and interrupted uploads.
Run relevant checks as features evolve; report what was and was not tested.
Never call build success an Android/iPhone physical-device test.

## Repository hygiene

Keep secrets, credentials, real travel data, databases, personal photos and generated output out of Git.
Stage explicit intended files. Avoid force-push and destructive resets.
Keep commits small; user authorization governs commit and push.
Use codex/ prefixed feature branches when creating feature branches.
Update docs/STATUS.md with completed work, evidence and next concrete step.
CLAUDE.md imports this file; do not duplicate instructions there.
