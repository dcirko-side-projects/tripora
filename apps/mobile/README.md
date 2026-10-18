# Mobile prototype

Expo SDK 57 / React Native / TypeScript, with SQLite for local trips and pending operations.

Run npm ci then npm start in this directory. See ../../README.md for Windows npm workaround.
Checks: npm run typecheck, npm test, npm run export:android, npm run export:ios.
The lockfile records tested package resolutions.

App.tsx currently implements one small journey: list -> create form -> locally saved trip.
src/core/localStore.ts holds validation, schema migration and atomic writes.
src/core/database.ts adapts Expo SQLite. tests/localStore.test.cjs uses real desktop SQLite
against the same store functions; it does not exercise Expo's native SQLite bridge.

No login, upload worker, account database, photos or trip details exist yet.
Do not enter private information. Read ../../docs/STATUS.md for device-test boundaries.
