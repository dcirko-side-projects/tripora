# Tripora agent instructions

## Read before work

Read docs/NEW_LAPTOP_HANDOFF.md, docs/STATUS.md, PRD.md, Architecture-essentials.md and the current checklist in docs/TRIPORA_PLAN.md.
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
Mobile (from apps/mobile): npm ci; npm run typecheck; npm test; npm run export:android; npm run export:ios.
API (from repo root): dotnet build services/api/Tripora.Api.csproj --configuration Release; node tests/e2e/api-health.mjs.
Use Node >=22.13 and .NET 10. On this Windows host the roaming npm shim is broken; use C:/Program Files/nodejs/npm.cmd when necessary.
No lint script exists yet. Do not claim a lint run or native device test based on bundling.
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
