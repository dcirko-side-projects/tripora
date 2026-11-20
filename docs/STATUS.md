# Current status — mobile UX redesign and phase 9 preparation

Updated: 2026-11-20. Development branch: codex/offline-foundation.

## Map location, external export and trip covers — 2026-11-20

Places and Plan have an opt-in blue location marker and an explicit camera
control in both map layouts. Google Maps and Apple Maps open individual
places or routes of up to five stops. CSV files transfer larger selections
to Google My Maps. Exports use existing all-trip, trip, plan and day scopes.
The owner can add, replace or remove a private cover in the trip overview.
Cover copies sync for active members and remain available offline after
download. The trips list uses the thumbnail and the overview uses the full
bounded image.

Clean mobile and integration dependency installs, TypeScript, 94 mobile
tests, Android/iOS/web exports, Release API build/liveness and 53
PostgreSQL/HTTP integration scenarios passed. The cover integration covered
owner authorization, concurrent first writes, upload and download retries,
replacement and clearing shared access to the old photo. All 17 Chromium
checkpoints passed, including GPS permission errors, manual recentering,
route handoff and CSV downloads, plus offline cover replacement and removal.
The focused WebKit run passed map GPS, route handoff, CSV downloads and
cover choice and layout at 320, 390 and 1440 px. The full local Windows
WebKit run stopped at the earlier offline PWA reload with an internal
browser error. Next: verify physical-device GPS prompts, native map handoff
and an actual Google My Maps import.

## Offline audit update released — 2026-11-19

Source `cbfe3bf3078e776ff882bdff8a966c6eadd923b5` was pushed to
`codex/offline-foundation`. Both [GitHub CI jobs](https://github.com/dcirko-side-projects/tripora/actions/runs/44579782099)
passed, including Chromium and Linux WebKit. The
[Render deploy](https://dashboard.render.com/web/srv-dbj16huc6qcc73b6e3a0/deploys/dep-dbvjavqfngtc73cfbsdg)
for that exact source is Live. Public liveness and DB readiness passed.
The public worker cached the new bundle `index-1299fcb631e4cb269cd11641d22b9b1e.js`.
An isolated public Chromium profile reopened the login shell offline and
confirmed that API and auth responses were outside the service-worker cache.
Existing iPhone PWA users can check for an update or open
https://tripora-l4c7.onrender.com/?update=20261119 in Safari.

Android Release `local-data/hosted-beta/Tripora-19.apk` is signed with the
same certificate as beta 18. Package `local.tripora.beta` has versionCode 19,
versionName `0.1.0-beta19` and four ABIs. APK SHA-256
`dc96da726c15829fe387043921ef3799f684e70990240a4fe1f2fa8bc3536517`.
The embedded Hermes bundle contains the schema v4 change and the public API URL.
ADB installed it over beta 18 on the Samsung at 18:44 CET, confirmed the
original first-install timestamp, and cold-launched it with `Status: ok`.
The shared physical Android/iPhone acceptance journey remains deferred.

## Audit follow-up — 2026-11-19

Implemented audit findings 1–4 and 6–10 locally. SQLite schema v4 preserves
existing queues and accepts a later offline trip edit or deletion while the
first operation remains immutable. The app records metadata readiness before
media cleanup, displays last download and local photo counts, and allows
local photo selection and cancellation while sync waits. The participant
roster starts automatically after sync releases the online action.

Fullscreen map details now enter and restore keyboard focus. Compact filter
rows indicate overflow, the daily plan picker searches by saved name or
address, and GeoJSON offers a choice of full export or export without place
and visit notes.

Local verification passed TypeScript, 92 mobile tests, Android/iOS/web
exports, Release API build and liveness, 52 PostgreSQL/HTTP scenarios and
15 Chromium PWA checkpoints. The browser verifies the offline edit via the
real API, delayed cleanup returning 503, roster loading, keyboard focus
restoration, all four export scopes and category fit at 320 px.
The legacy PWA update check passed in Chromium and WebKit. A focused
Windows WebKit run in a temporary browser context passed nine checkpoints
for offline edits, delayed cleanup, roster loading, conflicts, maps and
exports. The full persistent WebKit run timed out. In the temporary
context, the full run stopped when IndexedDB rejected the photo Blob write.
Chromium passed photo durability, restart and upload retry.

The user deferred the physical Android/iPhone acceptance (finding 5). The
next device round uses one shared synthetic trip to check airplane mode,
cold restart, queued trip edits, local photo and the return to connectivity.
Check large text, keyboard, map filters and platform file sharing separately.
See the [iPhone acceptance plan](IPHONE_PWA_PLAN.md).

## Daily plan and saved-place exports released — 2026-11-18

Feature commit `ae4afa7` and the PWA test timing follow-up `6603cac` were
pushed to `codex/offline-foundation`. Both jobs in
[GitHub CI](https://github.com/dcirko-side-projects/tripora/actions/runs/44376922975)
passed, including Chromium and WebKit. The follow-up waits for the final
metadata pull before simulating loss of connectivity in the browser test.

[Render deploy](https://dashboard.render.com/web/srv-dbj16huc6qcc73b6e3a0/deploys/dep-dbuvg2cipgvc73d2h2jg)
is Live for `6603cacf1e1035edf42d72ab733a620ce8fe34bf`. Public HTTPS opened
the login screen with bundle `index-3742dd0cf33586bf05d9f1e0cc30b40c.js`.
Public liveness and database readiness both responded successfully. The
existing Safari/Home Screen app can use the version check or open
https://tripora-l4c7.onrender.com/?update=20261118 in Safari.

The local signed Android APK is `local-data/hosted-beta/Tripora-18.apk`
(129,230,651 bytes, SHA-256
`e29c288901c6115fcd9e0308e3de5e8b20631ceeb478dc9ed49fcc32c28e6df7`).
Gradle Release passed. Package `local.tripora.beta`, versionCode 18,
versionName `0.1.0-beta18`, all four ABIs and the same signing certificate as
beta17 were verified. The embedded bundle targets the public API and the
manifest includes the Expo Sharing file provider.

On the user's request, installed over beta17 on the connected Samsung via
`adb install -r --user 0`. ADB returned Success. The package manager
confirmed versionCode 18, versionName `0.1.0-beta18`, update time
2026-11-18 21:41 CET and the original first-install timestamp. The launcher
resolved from the installed package started the app cold with Status: ok.
Next: verify the plan, map and file sharing on both phones.

## Saved places in the daily plan and file exports — 2026-11-18

The day picker adds an existing saved place through a regular plan entry. The
same place can appear on several days. Removing a visit affects that entry.
The shared map supports all plan places, date and unscheduled scopes, and the
existing search, category, visit status, details and fullscreen controls.
Smještaj is available in the place editor and filters. The bed icon also appears
in the schedule. Client and API reuse the existing storage and sync contracts.

The trips list, Places and Plan expose JSON and GeoJSON exports covering all
accessible trips, one trip, its whole plan or a selected day. JSON also covers
places without coordinates. GeoJSON contains points for mapping tools. Both use
the account's local snapshot, including pending work. Web downloads the file.
Native opens the operating system share sheet through Expo Sharing.

Clean dependency installs, typecheck, 92 mobile tests, Android/iOS/web Expo
exports, Release API build/liveness, 52 HTTP/PostgreSQL scenarios and 14 Chromium
PWA checkpoints passed. Test coverage includes local reopen, shared repeated
visits, independent removal, restart persistence of all four categories,
markers above fullscreen filters at 320 px and real downloads of both formats
in all four scopes. Local Windows WebKit exited during browser launch
(3236495362). Physical devices and the native system share sheet remain to be
verified. Next: test file sharing with synthetic places on Android and iPhone
and coordinate rollout of the API and new clients.

## Safari stale shell / explicit PWA updates - 2026-11-17

User reports an old fullscreen map on a companion's iPhone and confirms she opens
the link in Safari. Public root still correctly serves the published marker build
index-048d4e2d4936ad2414679d76815164c7.js / shell ea42af671f7c91d9.
The deployed worker serves cached HTML first and waits for every old window to
close, with no pending-update UI. This explains stale open Safari tabs; no access
to the physical iPhone or its private data is claimed. Same-origin recovery link
https://tripora-l4c7.onrender.com/?update=20261117 bypasses that legacy worker.

Added startup/foreground/reconnect worker checks, manual check and waiting notice.
Applying an update explicitly warns about unsaved forms and reloads only after
activation; multiple open windows block activation with close-other-tabs guidance.
Normal automatic activation still waits for old clients to close. Saved account
snapshots, outbox, IndexedDB photos/tokens remain untouched. The recovery query is
removed after bootstrap so subsequent root reloads also work offline.

Clean mobile npm ci, typecheck, 90 mobile tests and Android/iOS/web exports pass.
Isolated Chromium reproduces stale legacy navigation and verifies recovery,
confirmation cancellation, multiple-window guard, retained storage and new offline
shell. Final source **1789f3ec4827034bfb07d07f38375d880db8c21c** passes both jobs in
[GitHub CI](https://github.com/dcirko-side-projects/tripora/actions/runs/44124173209):
90 mobile tests, typecheck/audit/three exports, API build/liveness, backup guards,
52 HTTP/PostgreSQL scenarios, 25 PWA checkpoints and two independent legacy-upgrade
scenarios in Linux Chromium/WebKit. Confirmed update retains session, pending
outbox (sent exactly once) and photo. Initial CI exposed the test attempting to
click behind an open form; corrected to verify the draft before closing the form,
then exercise update/cancel/guard. No failed-CI commit was deployed. Local Windows
WebKit exits at launch (3236495362); Linux results provide browser evidence, not a
physical iPhone pass.

Render **dep-dbu7v3nf3r2c73da8cj0** for exact source **1789f3e** reports
**Deploy succeeded | Live**, duration **1m 21s**, triggered **17:23:42 CET** on
2026-11-17. Existing Free service/providers/settings unchanged. Public checks pass:
root/recovery URL, all 13 shell assets, liveness and DB readiness return 200;
Linux bundle `/_expo/static/js/web/index-01f62e7acb6ec46f94f9add87e3f8153.js`
and worker both contain the explicit update handler. Isolated public Chromium
confirms the manual version button, HTTPS startup, shell installation, offline
reload and cache privacy without registration/login or production user mutations.
Ignored evidence: local-data/pwa-qa/safari-update-public.png and
local-data/fullscreen-map/pwa-update-public-smoke.mjs.
Next: companion saves her form and opens the recovery link in the same Safari;
close other Tripora tabs if the storage/update guard requests it, then confirm
fullscreen map and category icons on the physical phone. No Safari storage clearing
or reinstall. Existing beta16/beta17 working documentation is preserved separately.

## Android beta17 retaining upgrade installed - 2026-11-16

User connected the Samsung and authorized preparing/installing the update over
the existing app. Built the current mobile source (checkout 34dfb1e, mobile source
identical to CI-verified 613b8f7) in the existing ignored native workspace.
All 49 source/assets were copied and byte-compared; dependency lockfiles match,
native npm ci and offline Gradle Release pass: 438 tasks, 3m 37s. Package remains
local.tripora.beta, now versionCode 17 / 0.1.0-beta17, four Android ABIs.
APK: local-data/hosted-beta/Tripora-17.apk, 129,191,083 bytes; SHA-256
`3d467247f8f39e5ed8d688e543827e7c47406b82b5d68186cf64046b59d71771`.
apksigner verification passes and its certificate SHA-256 matches beta16:
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
The actual APK Hermes bundle contains the public API origin, fullscreen frame
and new category icon paths; local QA origins are absent. Build log is ignored:
local-data/hosting-setup/tripora17-build.log. No APK/key/generated output is tracked.

ADB install -r --user 0 returns Success on Samsung SM-S936B. Package manager
confirms version 17, update time 2026-11-16 18:15:02 and unchanged original
first-install time 2026-10-31 17:44:27. Cold launch reports Status: ok and the
app process is running. No uninstall, clear-data, logout or trip mutation was
performed. This is retaining installation/launch evidence, not physical visual
acceptance or an inspection of the user's saved travel data. Existing automated
source validation is recorded below; the full suite was not rerun for this
packaging-only step. Next: user reviews retained trips, fullscreen search/X,
category icons/selection and return from details on the phone.

## Category icon markers publication verified - 2026-11-16

User authorized commit/push/deploy. Category icons/selection were implemented in
07b349c; final source **613b8f744aed2f71a452802ec35fe918ca2fe067** includes valid
synthetic OSM fixtures and the keyboard repair discovered by CI. Leaflet creates
the DOM icon after the initial map view exists, so accessible labels and
Enter/Space listeners now attach on the marker's add event. Selection updates
existing markers without rebuilding the map. No failed CI source was deployed.

[Final GitHub CI](https://github.com/dcirko-side-projects/tripora/actions/runs/43912993862)
passes both jobs: 90 mobile tests, typecheck/audit, Android/iOS/web exports, API
build/liveness, backup guards, all 52 HTTP/PostgreSQL and all 25 Chromium/WebKit
PWA checkpoints. Both browser engines verify all three icons, keyboard activation,
one selected marker, filter/detail/edit return and four responsive viewport sizes.
No uncaught browser errors. Local API execution remains blocked by Windows
Application Control; the Linux results supply integration evidence, not a local
or physical-device pass.

Render **dep-dbtjde8n74is73cobo00** for exact source **613b8f7** reports
**Deploy succeeded | Live**, duration **1m 40s**, triggered **18:00:41 CET** on
2026-11-16. Same existing Free service/configuration. Public HTTP checks at
**18:02:49 CET** pass: liveness 200/286 ms, DB readiness 200/1,029 ms,
confirmed-email options true, anonymous sync 401/no-store, root/manifest/security
headers and all 13 PWA shell assets. Public Linux bundle
`/_expo/static/js/web/index-048d4e2d4936ad2414679d76815164c7.js` contains category
icon/selection code and the new legend; the initials legend is absent.
Isolated public Chromium passes HTTPS startup, service-worker/offline reload,
readiness and cache privacy without modifying production users or travel data.
Ignored HTTP proof: local-data/hosting-setup/marker-release-http-2026-11-16.json;
probe: local-data/fullscreen-map/marker-public-http.cjs.

Web/PWA delivery is complete. No Android APK/install or physical phone test was
performed. Next: retaining native Android upgrade and physical review if requested.
Pre-existing beta16 documentation remains preserved and outside these commits.

## Category icon markers - 2026-11-16

User requested replacing marker initials with category icons and a visible selected
state. Existing categories are place/food/nightlife; pin/utensils/cocktail icons now
share the application's outline SVG paths across native/Leaflet. Unknown or missing
category falls back to the pin. No venue-type guessing, new category, dependency,
API/schema/sync change. Markers keep full accessible names, stable coordinates,
52 px targets, 40 px faces and a contrasting selection ring/raised stacking.
Selection persists after closing details/editing and map size transitions.

Local validation: clean mobile/E2E npm ci, typecheck, 90/90 mobile tests and all
three platform exports pass. Tests cover category icons, no marker text, neutral
fallback, changing selected marker, details/editing/filter/camera regressions.
API Release build passes with 0 errors/warnings, but Windows Application Control
blocks executing the newly built Tripora.Api.dll (0x800711C7), including one retry;
local HTTP/PWA integration cannot run. No security policy was changed or bypassed.
The browser E2E suite now verifies all category icons, keyboard activation,
exclusive selection, filter/detail return and four responsive sizes with synthetic
data. Next: run Linux CI for the pushed source, fix any failures, deploy that exact
passing commit on the existing Render Free service and verify public delivery.
No new Android APK/install or physical-device acceptance is claimed.

## Fullscreen map publication verified - 2026-11-16

User authorized commit, push and deployment. Source commits 860eab1 (responsive
fullscreen controls) and **6341e749090d612fb7ba27e0839a8ce41ae82097** (final web
safe-area repair) are pushed to the existing codex/offline-foundation branch.
[Final GitHub CI](https://github.com/dcirko-side-projects/tripora/actions/runs/43908834379)
passes both jobs: 89 mobile tests, typecheck/audit, all platform exports, API
Release/liveness, backup guards, 52 HTTP/PostgreSQL scenarios and 25 combined
Chromium/WebKit PWA checkpoints. The final map responsive assertions run in both
Linux browser engines. Local Chromium separately passes all 13 checkpoints;
Windows WebKit bootstrap reached the watchdog and is not counted as a pass.

Render deployment **dep-dbtj10jbc2fs73brr2v0** for exact source **6341e74** shows
**Deploy succeeded | Live**, duration **1m 2s**, triggered **17:34:10 CET** on
2026-11-16. Same Free service, origin, provider configuration and health path.
Public HTTP verification at **17:37:31 CET** passes: liveness 200/239 ms,
DB readiness 200/99 ms, confirmed-email options true, anonymous sync 401 with
no-store, manifest/root/security headers and all 13 public shell assets.
Deployed Linux bundle: `/_expo/static/js/web/index-250107f10eeeaaff7143b64b5f166a0b.js`;
its final fullscreen frame and compact search are verified after decoding JS
Unicode escapes. Platform-specific export hashes differ from local Windows.
Isolated public Chromium passes HTTPS startup, service-worker installation,
offline reload, readiness and cache privacy without modifying production users.
Ignored evidence: local-data/hosting-setup/release-http-2026-11-16.json,
local-data/fullscreen-map/public-http.cjs and local-data/pwa-qa/*-map-*.png.

Web/PWA publication is complete. No native APK was built/installed and no physical
phone acceptance is claimed. Next concrete step: retaining Android upgrade when
requested, followed by physical Android/iPhone safe-area/keyboard review.
The pre-existing beta16 documentation change remains preserved and uncommitted.

## Compact fullscreen map - 2026-11-16

Implemented the requested bounded fullscreen UX update on native and web:
compact saved-place search with a 48 px accessible X at the top, expanding map,
floating category/status filters above attribution, safe-area padding and
horizontal overflow for large text/narrow screens. Wide screens place both filter
groups side by side. Inline/list UI and existing local filtering stay unchanged.
Details/editing retain their embedded sheet and camera. Resize regression found
and repaired: ResizeObserver owns map resizing and cleanup removes camera event
listeners before disposing Leaflet, preventing a late access to a removed pane.

Validation: clean mobile/E2E npm ci, TypeScript, 89/89 mobile tests, Android/iOS/web
exports, API Release build (0 errors/warnings), HTTP liveness pass. Chromium passes
all 13 PWA checkpoints with no uncaught runtime errors, including actual Leaflet
markers/tiles, search, category/status filtering, fullscreen close and return from
details/editing. Responsive assertions/screenshots cover 320x568, 390x844,
844x390 and 1440x900; map height exceeds 80% at each size, controls stay inside
the viewport and search/X do not overlap. Synthetic tiles/accounts only.
Screenshots remain ignored under local-data/pwa-qa/chromium-map-*.png.
Final source review caught the web safe-area adapter adding numeric insets to CSS
env() strings. Web now uses a plain View, native retains SafeAreaView; an actual
browser assertion verifies the CSS padding survives. Chromium's final 13/13 run
passes this regression and all four responsive sizes. Windows WebKit stalled at
PWA bootstrap and hit the suite watchdog; no local WebKit pass is claimed.
Linux CI for initial source 860eab1 passes both jobs, including Chromium/WebKit;
the final safe-area follow-up will have its own CI/deployment receipt below.
No physical-device test or new native APK/installation is claimed. Native users
need a retaining Android upgrade to receive this UI; web/PWA uses Render deploy.
Next: publish the reviewed commit to the existing branch, deploy that exact SHA
to the existing Free Render service and verify public shell/readiness.

## Android beta16 APK prepared - 2026-11-11

Prepared the requested retaining Android upgrade from the published map/startup
source. Ignored isolated native workspace received current mobile source/assets
(hash-compared) and matching dependency lockfile; npm ci and local Gradle Release
build pass (438 tasks, 5m 59s). APK: `local-data/hosted-beta/Tripora-16.apk`,
129,187,323 bytes, package `local.tripora.beta`, versionCode 16,
versionName `0.1.0-beta16`, four Android ABIs. SHA-256:
`0855e0794fbc5e7d263d91465bb3000e1126cca2ce5603079fafb389fb7c6f81`.
apksigner verification passes; certificate SHA-256 matches beta15:
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Actual Hermes bundle contains the public API origin, new map filter and
background-sync message; no local QA TLS origin. No APK, key, generated build
output or dependency tree is tracked. On the user's explicit request, installed
on the connected Samsung SM-S936B using `adb install -r --user 0`: Success.
Package manager confirms versionCode 16 / 0.1.0-beta16 and unchanged original
first-install time (2026-10-31); no uninstall or data clearing performed.
Physical UI/data acceptance was not tested. Next: user opens Tripora and verifies
retained trips and map return/filter/labels on the device.

## Published map/startup changes - verified 2026-11-11

User explicitly authorized commit, push and deployment, then resumed final
verification. Published **2b794c671fb094f49ca64adc01b5bbe67e929299** (`feat:
preserve map exploration and keep free beta responsive`) to the existing
codex/offline-foundation branch; local and remote SHA matched after push.
Only the reviewed 20 source/test/config/documentation files were committed;
local-data, credentials, generated bundles and screenshots remain ignored.

[GitHub CI run 42886094795](https://github.com/dcirko-side-projects/tripora/actions/runs/42886094795)
completed **success** on this exact source: mobile/API jobs, **89 mobile tests**,
TypeScript, dependency high-severity audit, Android/iOS/web exports, API Release
build/liveness, backup guards, **52 PostgreSQL/HTTP scenarios** and **25 PWA
checkpoints in Linux Chromium + WebKit**. The earlier local Windows WebKit
bootstrap timeout is superseded by this successful Linux verification.

Triggered Render deployment **dep-dbpn420m7kps73815fn0** for this exact commit
on 2026-11-10 at **20:35:36 CET**, retaining the existing service/Free plan,
public origin, provider secrets, DB-free `/health/live` health path and external
monitor. Build logs exported web bundle
`/_expo/static/js/web/index-409306c51c1f6b5d7adc34b654498228.js` and all 13 shell
assets. The last dashboard observation before interruption was waiting for
internal `/health/live` after a successful image build. On resume Chrome's
browser connection was unavailable; no duplicate deploy was triggered. Delivery
is verified independently by the public site serving that exact new bundle,
including the new filter label and nonblocking-sync message, on 2026-11-11.
No unobserved dashboard completion time/status is claimed.

Public checks at **16:59 CET on 2026-11-11** pass: liveness 200/254 ms,
DB readiness 200/3,123 ms, confirmed-email options true, anonymous sync 401 with
private/no-store, root/manifest/service worker/all **13 shell assets** 200,
WASM MIME and CSP/COOP/COEP headers. The short DB wake remains distinct from the
removed tens-of-seconds API idle wake. Isolated **public Chromium** also passes
HTTPS bootstrap, service-worker installation, offline reload, cache privacy and
no uncaught browser errors. Production accounts/trips/photos were not mutated.
Public WebKit was not rerun on Windows; Linux CI covers both browser engines.

Ignored evidence: `local-data/hosting-setup/release-http-2026-11-10.json`
(the report's checkedAt is 2026-11-11), the public Chromium check script and
`local-data/hosting-setup/public-release-2026-11-11.png`. Both architecture files
retain the accepted map/startup/hosting decisions; relative links and diff checks
pass. This final receipt is a documentation-only follow-up to the tested source.

Web/PWA changes are deployed. No new Android APK was built or installed in this
publication step; native map/UI changes require a separate retaining upgrade.
Next: user reviews map return/filter/labels in the PWA; prepare and install an
Android upgrade when requested. Physical Samsung/iPhone acceptance remains
separate from exports and browser tests. No paid infrastructure was introduced.

## Server idle-wake mitigation - 2026-11-10

User requested removing the server wait and explicitly retained **0 cost / no
payment card**, rejecting a paid compute upgrade. Configured the existing Render
Free service's health path as `/health/live` and mirrored that in `render.yaml`.
Created one UptimeRobot Free HTTP monitor, **Tripora API liveness** (804624912),
checking that public endpoint every **300 seconds**. User supplied the monitoring
account via their own sign-in. No API keys/private app data, notification contacts,
integrations, public status page, paid features or card were added.

The normal Single Monitor route returned to the empty list; the official one-row
CSV import succeeded. UI confirms monitor **Up**, first external response **108
ms**, five-minute checks and no alert recipients. Prior unmitigated liveness took
32,272 ms followed by DB readiness in 91 ms; earlier cold/warm readiness was
44,633/243 ms. The initial idle-window timer was canceled: live logs showed that the running
instance still used the prior DB health route after saving Settings and after
Restart service. A specific-commit redeploy of the already-live 93ac4c3 applied
the saved setting. **dep-dbpmkjc9v7es73fbo3e0** is **Deploy succeeded | Live**,
2m 7s, about **20:04:45 CET**, same source 93ac4c3. New instance logs confirm
`/health/live`. Final 16-minute measurement began **19:05:42.726 UTC /
20:05:42.726 CET** and **passed at 20:21:43 CET**: first public liveness
**200 in 276 ms**, DB-backed readiness **200 in 1,991 ms** after Neon had been
explicitly **SUSPENDED for 11 minutes**. Confirmed-email option remains true
(200, 99 ms); anonymous sync remains 401 (102 ms), `private, no-store`. Final
monitor view: **Up**, about 27 minutes, five-minute checks, no incidents,
displayed response about 104 ms. Raw public JSON and screenshot proofs remain
ignored under local-data/hosting-setup; the report below lists exact paths.
This is HTTP/provider proof, not a native phone launch or real-user auth test.

DB-backed `/health/ready` remains the separate deployment/incident DB/API check.
Render's frequent internal health probes now use liveness without querying Neon,
avoiding an estimated 180-186 CU-hours/month at continuous 0.25 CU versus the
current 100 CU-hour Free allowance. Neon Free scale-to-zero remains enabled.
The provider dashboard shows 2.71 CU-hours used this month. The initial project
last-active timestamp did not prove suspension: the compute view still showed
Active and Render logs revealed DB-backed health checks every five seconds. After
the same-source redeploy, the Neon compute UI at **20:10 CET** explicitly shows
**SUSPENDED**, while UptimeRobot remains Up (post-deploy response about 99 ms).
Screenshot proof: ignored local-data/hosting-setup/neon-suspended-2026-11-10.png.

Render UI: Hobby, no card, 8.87/750 Free hours, 8 MB/5 GB outbound bandwidth,
1/500 pipeline minutes, $0 accrued/projected; same deployed source 93ac4c3. No
new application source/auth/sync changes or unrelated service changes; the
existing commit was redeployed solely to apply health settings. The 750-hour
allowance is workspace-wide (two services exist);
one 24/7 service consumes 720-744 hours in a full month. No SLA or quota bypass
claim. Local API liveness and YAML parsing/config comparison pass; only the
health path differs from the prior Render YAML. Required files, relative links,
matching architecture decisions and git diff --check pass.

Full configuration, evidence, source links, limitations and rollback:
[server wake report](SERVER_WAKE_2026-11-10.md). Hosting mitigation is active for
the existing installed app without a new APK. Next: user compares normal app
opening; the later map/startup publication is recorded above.
At that hosting checkpoint the map/startup changes were local; the publication
receipt above now records their later web/PWA delivery.

## Map navigation, filters and responsive local startup - 2026-11-10

Implemented the user's new requirements in the current checkout:

- Fullscreen place details/editing stay inside the map modal. Close/Back restores
  the same mounted map; Android keyboard Back preserves the editor draft first.
  Inline/fullscreen transitions remember native center/zoom/bearing/pitch and web
  center/zoom. Zero filter matches keep the fullscreen map and controls open.
- Category and visit-status filters are available in both map sizes. A local text
  filter matches city/name/address/location display name without case/diacritics.
  City is matched from saved address text; no structured city field, new provider
  lookup, database migration or automatic venue discovery was added.
- Markers use M/H/I (places/food/nightlife) plus up to two name initials, retaining
  category colors and accessible full names. Shared label generation covers both
  MapLibre and Leaflet.
- Session restoration was already local. The actual UI bottleneck was using the
  global busy/lock state for initial and foreground sync: this blocked local
  navigation/writes while the server woke. Sync now has its own visible status;
  local transactions remain usable through the existing immutable outbox/dirty
  reconciliation. Session/account switching and online actions retain serialization.

Read-only public /health/ready measurements: **200 in 44,633 ms**, followed by
**200 in 243 ms**. This supports idle-host wake-up as a network contributor; it is
not a native startup benchmark or server-side trace. First sign-in and remote
operations still wait for connectivity/hosting. No paid hosting, keepalive,
provider change, token or request-timeout change was introduced.

Validation: clean mobile npm ci (Windows sandbox EPERM resolved by approved
execution), TypeScript and **89/89 mobile tests** pass, including moved-camera
return, same-map identity, embedded editor/keyboard Back, zero-result filters,
accent-insensitive/category/status filtering and saving while startup sync waits.
API Release build (0 errors/warnings), HTTP liveness, clean E2E npm ci and all
**52 PostgreSQL/HTTP scenarios** pass, covering persistence/retries/conflicts,
deletions, membership enforcement, sessions and private media. Android/iOS/web
exports pass. Final **13/13 Chromium PWA checkpoints** pass on the final source,
including actual Leaflet tiles/markers, fullscreen return after details/editing,
filters, durable offline storage, conflicts, lost acknowledgements, updates and
account isolation; no uncaught browser errors.

The combined Chromium/WebKit run passed all Chromium checkpoints, including real
Leaflet/fullscreen/details/editing/filter controls, then Windows WebKit timed out
during PWA bootstrap after its storage-capability probe. That local WebKit run did **not pass**; the publication receipt above records
the subsequent successful Linux Chromium/WebKit CI run. Downloaded test browsers
and artifacts remain ignored in local-data; physical device acceptance remains.
At this pre-publication checkpoint no new APK, installation, commit, push or
public deployment was performed. The publication receipt above supersedes the
commit/push/web-deployment boundary; native installation remains separate.

Next concrete step after this checkpoint was publication. Web/PWA publication
is now verified above; the installed native APK still requires an upgrade for
map/UI changes. Real-device pan/zoom/Back and startup acceptance remain.

## iPhone PWA — published; physical iPhone acceptance next

User selected a zero-Apple-fee Safari Home Screen PWA and requested all autonomous
preparation before physical iPhone testing. [Completion plan](IPHONE_PWA_PLAN.md)
and [installation guide](IPHONE_INSTALLATION.md) record the sequence and acceptance.
Shared Expo UI now has web adapters for dates/buttons/confirmations, Leaflet maps,
persistent sessions and photo selection/storage. Existing Identity/API/sync/native
Android remain. Web SQLite uses sql.js 1.15.2 with atomic account-scoped localStorage
snapshots: commit SQL, persist snapshot, then report success; restore prior records
and outbox on SQL/export/quota failure. A Web Lock prevents two active tabs overwriting
one another. This first-beta metadata store has a small browser quota (commonly
5 MiB before encoding/string overhead); photos/tokens are separate IndexedDB data.
No OPFS dependency, vendor patches or memory-only fallback ship. The earlier Expo
OPFS spike failed WebKit writes and was replaced before publication.

PNG/thumbnail blobs commit together in IndexedDB; bounded canvas decode/resizing and
SHA-256 checks retain the private API contract. Unsupported images and simulated
metadata/second-image quota failures preserve the draft and previous persisted data.
Service worker precaches 13 public build assets only, waits for old clients to close
and preserves local queues/photos. Offline-shell readiness and Safari installation
instructions are included. Same-origin HTTPS/CSP/COOP/COEP static delivery ships in
our existing API image; no extra hosting account, CORS or client secrets.

Evidence on final source: clean npm ci with **no vendor patch**, TypeScript, all
**88 mobile tests**, Android/iOS/web exports, API Release/liveness, backup guard and
all **52 PostgreSQL/HTTP scenarios** pass. Linux Chromium + WebKit 1.64.1 passes all
**25 PWA checkpoints**, using actual browser SQLite snapshots/IndexedDB, isolated
real PostgreSQL/API and a test-only HTTP proxy for real lost-acknowledgement faults.
It covers offline reload, atomic metadata/image quota rollback, 2400px input resized
to 1280px/320px, full-image reopening offline, upload accepted then response lost and
safe retry, persisted conflicts/cancel/explicit local resolution, Leaflet/fullscreen/
marker details with synthetic tiles, logout/account isolation/offline deletion, and
new-shell activation preserving draft/outbox/photos. No uncaught browser errors;
API/private media responses never enter the shell cache. A repeatable Linux browser
image and CI checks are included. Generated logs/screenshots stay in ignored
local-data/pwa-qa. Production Docker build passes. Dependency findings remain
2 low/10 moderate, no high/critical.

Published source **93ac4c379fd0f145e88cebdfc2010ffe5b39b7a6** to the existing
codex/offline-foundation branch; remote SHA matches. [GitHub CI run](https://github.com/dcirko-side-projects/tripora/actions/runs/41712825798)
passes both mobile and API jobs, including native/web exports, all integration
checks and the full Chromium/WebKit PWA suite. Main/legacy history remain unchanged.
Render manual deployment **dep-dbl480m7bikc73eubfr0** reports **Deploy succeeded | Live**,
1m57s, on 2026-11-03 at approximately 21:30 CET. No migrations were applied; existing
Free plan/provider settings/secrets were retained. No new paid service/account.

PWA beta is live at **https://tripora-l4c7.onrender.com/**. Public root, manifest,
service worker, all 13 shell assets and readiness return 200; WASM MIME and security
headers pass. Auth options still require confirmed email; anonymous sync returns
401 with no-store. Actual Chrome UI shows the login screen, Safari instructions and
completed offline-shell preparation. Separate read-only **public Chromium and WebKit**
checks pass HTTPS startup and offline reload without logging in or changing user data.
Public HTTP proof, screenshot and logs are ignored under local-data/pwa-qa.

All available autonomous preparation/publication checks are complete for this slice.
Next: real iPhone Safari → Add to Home Screen, standalone layout/keyboard, gallery
cancel/JPEG/HEIC, airplane-mode save/close/reopen/reconnect, update and shared trip with
Android. Browser WebKit is not a physical iPhone test. No new Android installation,
full hosted account/photo exercise, multi-day uptime or unlimited browser storage
claim is implied. First-beta metadata capacity/eviction limits remain documented.

## Latest follow-up — shared trip card in My trips

User clarified that the new travel-card design must also appear in “Moja putovanja” for every existing/new trip. Extracted TripHero and reused it in both the selected-trip overview and the upcoming/current/past trip lists. The whole list card retains its accessible open action, trip status and explicit sync/access warnings. The shared component renders destination/title/dates/role plus the same SVG background, so newly created trips inherit the design automatically. No schema, API or sync behavior changed.

Verification: npm ci, TypeScript, all 88 mobile tests and Android/iOS exports pass. Existing app regression now checks the travel-card banner inside a freshly created trip's list button, pending status and navigation to the overview. No API tests rerun for this presentation-only follow-up. Native physical layout remains for user review.

Delivered **Tripora 15** (versionCode 15 / 0.1.0-beta15): Release build passes, 438 tasks. Native mobile source hashes match; public API origin verified in the Hermes bundle; signing certificate matches Tripora 14. APK SHA-256 ec57d4b59abef8efe828d1a89c6cb5ed47d2f2a7cb9ef576d0ae1159eda746b3. APK/build logs remain ignored under local-data. ADB install -r --user 0 returns Success; installed version 15 and launch Status: ok confirmed on the same Samsung. No uninstall, clear-data, logout or trip edits. Commit/push continues the user's existing delivery authorization. Next: user visually reviews the shared card in the list and overview; no physical layout acceptance is claimed by installation alone.

## Latest delivery — Tripora 14 installed on Samsung

User explicitly authorized commit/push and installation of the new Android version. Built **Tripora 14**, local.tripora.beta, versionCode 14 / 0.1.0-beta14, using the existing isolated native project and identical dependency lockfile. All current mobile source files were copied and hash-compared. Release Gradle build passes (438 tasks); the actual Hermes bundle contains the public API origin plus the new hero/fullscreen/budget text and no old local API origin. APK and build log remain ignored: local-data/hosted-beta/Tripora-14.apk and local-data/hosting-setup/tripora14-build.log. APK SHA-256: 369f0a858621c32c5ec0aed4fa95738b23081840daf99d41abb5c1d4103c2a34. Old/new APK signing-certificate SHA-256 digests match.

ADB upgrade from version 13 returns Success using install -r --user 0 on the connected Samsung SM-S936B; installed versionCode 14 / versionName 0.1.0-beta14 confirmed. No uninstall, clear-data, logout, credential access or user-trip mutation. This verifies retaining upgrade installation, not a physical acceptance test of map gestures, visual layout or preserved session contents. Existing 88-test/typecheck/export evidence below applies; no source changed after those checks. No backend deployment is needed for these UI-only changes. User authorized publication to the current development branch; final response records the verified commit/push result.

Next: user reviews the new header and full-map pan/pinch/Close/marker details on the phone; iPhone distribution remains unconfigured.

## Latest checkpoint — trip card, quieter expenses and fullscreen map

Implemented the user's requested overview refresh: dark blue travel card with local SVG landscape/route, destination, title, dates and role. Budget/expenses now use a normal “Budžet i troškovi” menu row in “Za tvoje putovanje”, including exact pending-inclusive totals/remaining amount and currency warning. Existing expense tab remains available.

Places map has an explicit fullscreen action. A native fullScreen Modal with safe areas and no ScrollView keeps map interaction separate from the app's scroll; Close/Android back restore the inline map, and a marker opens existing details. iOS waits for modal dismissal before presenting details. One map is mounted at a time and the viewport refits filtered markers when switching. Map attribution, category/status filters and online-only boundary remain.

Evidence: npm ci (sandbox EPERM resolved by approved execution outside sandbox), TypeScript, all **88 mobile tests**, Android export and iOS export pass. New component regressions cover fullscreen isolation, one map, Close/back, Android marker selection and deferred iOS details; app regression covers expense row navigation. git diff --check passes. No API/storage/sync changes; API/integration tests not rerun. No new APK/native iOS binary, device installation, physical gesture/layout test, commit, push or deployment performed.

Next: build/install an Android upgrade preserving data, then physically check full-map pan/pinch, marker details, back/Close, long trip titles and large fonts. iPhone distribution is not configured; [installation options](IPHONE_INSTALLATION.md) explain TestFlight and the Mac-only free development alternative. No paid account/service selected.

## Latest checkpoint — search deployed and physically verified on Android

User authorized deployment, retaining phone upgrade, device checks and commit/push. Published branding checkpoint f5fac25 and search fix 941bd341066abfd992c9346b0e26dd2bf507a113 to origin codex/offline-foundation; remote HEAD verified. Render manual deployment dep-dbjg58vb9u1s73dujbs0 reports Deploy succeeded | Live (2026-11-01 10:13 CET, 1m05s), with source 941bd34. Public readiness returns 200/ready. Existing Free plan, provider configuration and credentials remain; no DB migrations were needed.

Built/installed **Tripora 13**, package local.tripora.beta, versionCode 13 / 0.1.0-beta13, same existing signing identity. Gradle Release passes (438 tasks). APK SHA-256 a6aa91e3ced62f60bf674b688927b9a1372bfc8c0e6f3dfd7f18dc023a0c8b2f; ignored artifact local-data/hosted-beta/Tripora-13.apk. Actual Hermes bundle contains the public origin and repaired search text; localhost QA origin absent. Existing session and existing trip remain after adb install -r; no uninstall/clear-data/logout.

Physical Samsung acceptance passes against the **hosted** API: public address without name → explicit museum candidate → auto-filled name → save/synced → rendered OSM tiles and numbered MapLibre marker → marker opens exact details/navigation. Full saved address containing Ć/č/š can be searched again. City-only Sibenik returns multiple distinguishable candidates; exact Unicode name-only Šibenik also returns candidates. Unknown synthetic name plus valid address finds the museum through fallback; the same unknown name with no address shows no results while preserving the draft and leaving coordinates unselected. After force-stop/cold start, the saved museum and session persist, the map marker renders again and opens the same Synced details. One synthetic QA Search 2026-11-01 trip with one saved place remains for user review. Phone radio/font/permissions, account credentials and unrelated trips were not changed. A Samsung Account terms screen interrupted one input sequence; no terms were accepted and testing returned to Tripora.

Native evidence remains ignored under local-data/hosting-setup; scope and exact artifacts are in [the search report](PLACE_SEARCH_FIX_2026-11-01.md). Earlier 86 mobile/52 deterministic HTTP tests and six live adapter lookups remain applicable; this delivery step changed no functional source after 941bd34. This is physical Android search/map acceptance, not iPhone, two-device, airplane-mode or multi-day hosting acceptance. Next: user verifies their intended real locations; broader hosted backup/iPhone gates remain separate.

## Latest checkpoint — location search repair, 2026-11-01

User reported unavailable search yesterday and no matches today. Traced frontend → authenticated endpoint → actual Nominatim request/parser/cache → selection → SQLite/outbox → server persistence/map projection. Confirmed functional defects: Address was never sent, name+city were mandatory, and empty responses lived for 30 days. Fixed optional name/address/city queries, normalized Unicode/whitespace and repeated comma components, bounded address fallback under the existing global spacing/daily budget, five-minute negative cache with new key version, robust candidate parsing, separate empty/unavailable/quota UI, and privacy-preserving provider diagnostics. Explicit selection and existing coordinate sync remain.

Read-only Render inspection confirms yesterday's Search HTTP 503 at 22:31:15 CET while DB/readiness passed; old code suppressed the exception reason, so the exact historical upstream failure cannot be reconstructed. Maps daily quota is 200, SearchUrl uses the default Nominatim HTTPS endpoint, and no API key is required. No provider/configuration change. Details, sources and acceptance boundaries: [search repair](PLACE_SEARCH_FIX_2026-11-01.md).

Clean dependencies, TypeScript, all 86 mobile tests, both bundle exports, API Release build and HTTP liveness pass. New UI test saves a selected location, closes/reopens the actual SQLite file and confirms identical marker coordinates/details (native map bridge mocked). Final deterministic PostgreSQL/HTTP run passes all 52 scenarios, including upstream/daily quota and budget exhaustion between the primary/address queries; backup guard also passes. A separate full opt-in run verified six live Croatian public-location lookups through the actual .NET provider adapter; selected live coordinates survive server save/restart/paginated pull. Local npm audit remains 2 low/10 moderate; e2e dependencies report zero. First integration attempt encountered an unrelated stale development lock; managed stop found no owner process, verified no dotnet/postgres process, and only the lock was archived. No development DB/PID data was removed.

Next: publish the reviewed API/mobile source and deliver a new mobile build, then verify search/map on the hosted API and physical phone. Existing Render source 4890618 and installed Tripora 12 have not been updated by this repair. No commit/push/deploy/install or physical Android/iPhone acceptance is claimed. Existing unrelated launcher/hosted-checkpoint edits are preserved.

## Latest checkpoint — Tripora 12 installed with the final name and palette logo

User requested installation, the display name Tripora without Beta/QA, and updated palette branding. The existing suitcase mark now has a pink #D83995 airplane with a white #FCFFFF outline on the blue #0593C6 background. Regenerated both tracked launcher PNGs from the SVG and native Android density/adaptive resources with Expo's existing icon generator. No application behavior, account scope or API code changed.

Built versionCode 12 / 0.1.0-beta12, display name Tripora, package local.tripora.beta. Public Render origin verified in the actual Hermes bundle; localhost QA origin absent. Gradle Release passes (406 tasks); clean npm ci, typecheck, mobile tests and both Android/iOS exports pass. npm reports 2 low/10 moderate findings, no high/critical. APK SHA-256: 24980acc54f14bd203b228874fd12420f4eb911b7caa769b19ecc5af9664e3e1. Ignored copy: local-data/hosted-beta/Tripora-12.apk.

User connected the Samsung Android. ADB install for user 0 succeeded; installed package/version and app-info name/icon verified. Explicit launch of the resolved activity succeeded and a stable native login/create-account screen was inspected. The initial implicit shell launch did not resolve; the explicit package/activity opens normally. Old local.tripora.qa remains installed; no uninstall, account/data migration, phone security/radio/font setting change or user credentials entered. Private proof stays ignored under local-data/hosting-setup. This proves installation/branding/initial launch, not hosted registration, email confirmation, map or shared sync acceptance; iPhone remains untested. Next: user creates and confirms the hosted account, then tests a saved place on the native map.

## Latest checkpoint — Render API live, real email and private media verified

Published source `4890618` to Render Free / Frankfurt as `tripora`, connected the existing Neon database (direct VerifyFull TLS), Cloudinary authenticated storage, restricted Brevo transactional-email key and existing PFX-encrypted database keys. Public API origin: https://tripora-l4c7.onrender.com. No card, paid plan, main change or legacy publication. User explicitly approved provider secrets, key creation, test email and sender-address transfer. Automatic deploy remains off.

Initial startup failed closed until Render assigned PublicUrl; environment update deployed successfully. Migrations, public liveness/readiness (200), confirmed-email option and anonymous auth/sync/media rejection (401) pass. Render records the 17:18 CET restart and readiness passes afterward. Brevo accepted one approved test message (201), and its real log records Delivered. Actual existing Cloudinary adapter passes signed original/thumbnail upload, idempotent retry, byte-identical reads, anonymous denial (401) and synthetic asset cleanup. Temporary transport-test secrets were removed; no app source changed. [Configuration, evidence and exact acceptance boundaries](HOSTED_BETA_2026-10-31.md).

One-shot continuation after 17 minutes without our API requests passes: readiness 200 in 318 ms at 17:36:33 CET. Internal Render health checks continued; actual suspension/cold-start was not observed, so this is not a cold-wake claim. No keepalive or recurring monitor was added. Separate Tripora Beta 11 APK built successfully (406 tasks), package local.tripora.beta, public origin verified inside Hermes bundle, no local QA origin, four MapLibre ABIs and no active localhost trust override. SHA-256: 78b7b130c7ba2eaa5acb7047b94be0d7df3dbed00f6cf1f93755ab7368c8e19e. Published TypeScript inputs and dependencies match; Expo prebuild changes only run scripts. Initial build failed on Maven DNS using another cache; offline retry with the existing workspace cache passes. QA10 local APK is archived; no phone install/data migration is implied. Remaining: actual confirmation/reset and hosted two-client/session acceptance, native map/device checks, observed cold wake/multi-day availability and combined cloud backup/restore.

## Latest checkpoint — source checkpoint published to GitHub

Committed all 132 current changed/new files as `0b1b3b294b63551cccc9ac5b063daad6a0bb3ffe` (feat: add shared trip planning, maps and card-free beta setup), with an English summary/body and refreshed English README description. Includes AGENTS.md as explicitly authorized. Normal push to origin codex/offline-foundation succeeded; git ls-remote confirmed the exact same SHA. Main remains `b8397cdcc4891f61883815bf9e3e883b785195c4`; no legacy parent repository/history transferred. Worktree was clean after the source push; this small documentation follow-up records that verified result.

Staged diff checks additionally found and removed trailing empty lines in two tests and one checklist; no behavior changed and no tests rerun for that whitespace/docs-only cleanup. Earlier 83-mobile/48-HTTP/native-build evidence remains applicable. Final staged whitespace and documentation links pass, with runtime files/credentials excluded. Hosted CI results have not been checked; no live deployment/email/private-storage or new map physical acceptance is implied.

Next: user connects the public Tripora repository in Render and selects **codex/offline-foundation**, Docker, services/api/Dockerfile, repo-root context, Frankfurt and Free with auto-deploy off. Configure provider secrets directly in Render, then run the live acceptance gates. Public source publication does not activate the API by itself.

## Latest checkpoint — user authorized publication of all current changes

User explicitly requested committing and pushing all current Tripora changes with an English description, confirmed the repository is now public, and will connect it to Render personally. The publication target remains codex/offline-foundation; main and parent legacy history are unchanged. Includes updated AGENTS.md verification instructions, all implemented mobile/API features and tests, deployment adapters/configuration and documentation. English README summary and commit description cover the actual final scope.

Rechecked repository root/branch, full changed/new file inventory, git diff --check and common credential/runtime-output exclusions. The limited scan found no candidate credentials/private keys, databases, APKs, personal media or local-data. Only launcher PNGs are binary assets. Synthetic test credentials remain deliberately synthetic. Current feature evidence remains 83 mobile tests, 48 PostgreSQL/HTTP scenarios, TypeScript, both exports, Release API/liveness, backup guard and QA10 build; no functional code changed during publication preparation and no physical/cloud acceptance is newly claimed.

Next: finish commit/push and verify the remote head, then user selects codex/offline-foundation in Render (Docker, services/api/Dockerfile, root context, Frankfurt, Free, auto-deploy off). Enter provider secrets directly in Render; real deployment/email/private-storage/idle-wake acceptance and hosted backup still pending. No production endpoint has been activated by this source publication.

## Latest checkpoint — Render registered; repository access and commit/push approval pending

User completed Render registration. Existing workspace contains another deployed app, left untouched. Opened New Web Service and its Credentials menu; Render's current GitHub installation lists seven repositories under a different owner, not dcirko-side-projects/tripora. Configure in GitHub is ready for user-controlled least-privilege access to Tripora only. No new Render service, secret, paid plan, deployment, repository permission change, commit or push performed.

Read actual remote heads with git: codex/offline-foundation still facf141; main b8397cd. Current implementation remains local. Prepared [deployment review](DEPLOY_REVIEW.md) with source/branch/scope, intended Free Docker/Frankfurt settings and outstanding acceptance gates. Initial 130-file candidate review excludes local AGENTS.md changes, includes only two launcher PNG binaries and finds no common credential formats/runtime-secret/output candidates (limited scan, not a full audit). Existing source tests remain the 83 mobile/48 HTTP passing checkpoint; current changes are browser/docs only.

Next: user authorizes commit/push of the prepared development checkpoint to codex/offline-foundation (not main), and grants Render access only to the Tripora repository in the side-projects organization. Then configure the Free service and direct server-side credentials. All four provider registrations are now completed; live connections/email/private storage/deployment remain pending.

## Latest checkpoint — Brevo phone verified, Render registration pending

User completed Brevo phone verification. Home no longer shows the verification requirement; API keys page is accessible with Generate API key enabled and no existing keys. No API key generated/copied, email sent, or account security/IP policy modified. Existing verified freemail sender still needs real delivery acceptance. Opened official Render account registration for user-controlled signup/terms/email verification, with no card/paid plan or repository integration authorized by this step. Neon and Cloudinary configurations remain; app/provider credentials and real deployment are not connected yet.

Next: user finishes Render registration and stops at dashboard. Then configure the Free API service against the intended reviewed source and enter secrets directly into hosting settings. Existing no-commit/push boundary remains unless user authorizes publication. Browser/docs-only step; no tests rerun.

## Latest checkpoint — Brevo sender verified, phone verification required

User completed Brevo registration. Dashboard shows 300 available emails and an existing Verified sender, so no duplicate sender was created. It is a freemail sender with a provider compliance/deliverability warning; verified status does not establish successful transactional delivery. API-based transactional onboarding is available, but the account requires phone verification before creating an API key/sending messages. Opened the phone verification dialog and handed it to the user; no number/code entered, no verification SMS or test email triggered by the agent, no credentials created/copied. No additional account access or security setting changed. Neon and Cloudinary remain as documented below; Render registration and live connections/deployment still pending.

Next: user completes Brevo phone verification directly, then review transactional activation/sender behavior and continue Render account setup. Preserve zero-cost/no-card requirement; do not buy a domain or bypass recovery/email confirmation to conceal deliverability problems. Browser/docs-only step, no code or test rerun.

## Latest checkpoint — Cloudinary Free verified, Brevo registration in progress

User completed Cloudinary registration. Verified the official dashboard shows Image and Video Free, $0 total and 0/25 credit usage, with one active product environment (the Free account limit). No paid plan/add-on, extra environment, uploads or SDK onboarding actions performed. API secret not revealed/copied and no live application connection/private-byte acceptance yet. Non-secret cloud identifier is kept only under ignored local-data/hosting-setup.

Opened Brevo's official Free signup page, which explicitly states no credit card required. During the handoff flow the browser moved to Google authentication; automatic browser review denied observation of that separately unauthorized origin. No workaround attempted. User must finish their own sign-in/registration and return to Brevo before setup continues. Neon remains configured as described below. Remaining: Brevo sender/transactional activation, Render account and direct server-side secrets configuration, live deployment/acceptance. No code/test changes or tests rerun in this browser/docs-only step.

## Latest checkpoint — Neon account/project configured, Cloudinary registration pending

User completed Neon registration and requested guided setup. Created dedicated Tripora project/database tripora, production branch, AWS Frankfurt and PostgreSQL 17; confirmed Free plan in the dashboard. Reduced the initial 0.25–2 CU autoscaling range to fixed 0.25 CU and verified success; Free scale-to-zero remains five minutes. Only PostgreSQL enabled. No card, paid upgrade, imported data, application migrations, new auth provider or secrets copied into chat/repository. Connection credentials have not been configured and the app is not yet connected. Non-secret IDs and screenshot proof stay ignored in local-data/hosting-setup.

Opened Cloudinary's official Free signup page (explicitly $0/no card); user must complete their own registration/verification, then continue to storage settings. Neon and Cloudinary browser tabs are retained for handoff. Remaining accounts: Cloudinary, Brevo and Render; real deployment and its acceptance remain pending. The full earlier implementation/test checkpoint is below; no tests rerun for this browser/docs-only configuration step.

## Latest checkpoint — implemented place lookup/map and no-card hosting preparation

User approved implementation after clarifying: no manual pin placement as primary flow, name+city lookup with candidate confirmation, online map/offline saved list, zero cost and no bank card for providers. User has no accounts and requested registration instructions. [Decision 0005](decisions/0005-maps-and-no-card-beta.md) supersedes research-only maps and the Supabase-based hosting proposal; [registration/setup guide](NO_CARD_SETUP.md) is the next external step.

Implemented authenticated trip-bound name/city lookup, persisted 30-day hashed-query cache, cross-instance DB advisory throttle (1.1 s), 12 requests/account/min and 200 upstream requests/day default. Nominatim responses are finite/range-checked and deduplicated; no autocomplete or bulk lookup. UI explicitly selects a result, fills address, stores coordinates in existing local JSON/outbox and invalidates stale selections on changed name/address/city. Old asynchronous results cannot change a newer draft. MapLibre 11.5.1 native Popis/Karta adds category/status filters, numbered category-colored markers, detail/navigation and attribution, with list fallback. No Google key/card or location permission. Existing places without a location remain in the list; no fabricated coordinates.

Server migration 20261031145906_PlaceLocations adds nullable LocationJson and PlaceSearchCache. Existing SQLite rows/immutable operations do not require a local schema rewrite. Sync carries coordinates through retry/follow-up/conflict/tombstones; conflict descriptions include coordinate versions. Place/account deletion clears server position. Old null location fields are omitted from mutation serialization to preserve older receipt digest shapes.

Prepared Render Free + Neon Free PostgreSQL + Cloudinary Free authenticated originals + Brevo email configuration, keeping Identity/auth/sync. Added Cloudinary server-only signed upload/download/delete/inventory adapter; client API still enforces membership and returns bytes/hashes, never provider credentials or signed URLs. Inventory is bounded to every 30 minutes/process. Neon mode keeps verified DB TLS/encrypted DB keys and checks for exposed Data API roles without requiring Supabase roles. Supabase adapter remains supported. No accounts/resources/email/deployment were provisioned; no card or paid plan used.

Evidence: clean mobile npm ci, TypeScript, 83 mobile tests, Android/iOS exports, Release API build/liveness, backup guard and ALL 48 PostgreSQL/HTTP scenarios with completed cleanup pass. New tests cover delayed lookup/draft preservation, exact map coordinates, offline reopen/follow-ups, invalid coordinates, membership/cache/throttle/provider failure/retry, coordinate conflicts/deletion, signed private media interrupted retry/exact bytes/restart/deletion. External transports are local test stubs, not real-provider acceptance. npm reports 2 low / 10 moderate and no high/critical. Android QA10 native build passes after restoring isolated localhost certificate config following prebuild; no lint checks were disabled. The first storage-test attempts exposed two fixture parser/field errors, corrected before final passing run.

QA10 APK: local.tripora.qa, versionCode 10, SHA-256 71bf7b978455079f366a1d756ea14cee2470061eb0dd14309d2f7d53ea5c5b8b. Ignored output: local-data/native-qa/android/app/build/outputs/apk/release/app-release.apk. Verified embedded https://localhost:5443, byte-identical existing QA certificate and MapLibre native libraries for four Android ABIs; final copied app source matches workspace. APK not installed; no new physical Android/iPhone map/visual/network test. It remains a local QA build, not an internet-distributed production build.

Before applying the migration to existing development data, created ignored cold backup local-data/backups/pre-maps-20261031 (1,373 files, credentials/media/keys private). Development stack and existing HTTPS wrapper restarted afterward; HTTP and certificate-verified HTTPS readiness pass. Both existing place rows retained with null coordinates. No automatic real-place lookup/backfill. New cloud account scope does not inherit local data. No phone settings/data changed, no commit/push/publication.

Next: user registers the four free accounts using NO_CARD_SETUP, stopping if any requires a bank card; configure secrets directly in provider settings, then deliberate deployment and actual email/private storage/idle-wake/two-client acceptance. Hosted combined backup/restore and native Android/iPhone map acceptance remain open. Free quotas can suspend services and have no production uptime guarantee. Do not call laptop-independent availability achieved before this live acceptance.

## Latest checkpoint — blue/pink refresh and connection investigation

User requested #0593C6 / #FCFFFF / #D83995, connection investigation and map research only. Applied shared theme, darker readable action labels, tinted auth/trip headers, expense panel, cards/navigation/controls, day selector and source/generated launcher branding. Map dependencies/UI/schema/endpoints were not added. See [design/connection evidence](DESIGN_CONNECTION_2026-10-31.md) and [map options, EEA rules and MVP proposal](MAP_RESEARCH.md).

Confirmed local ports 5080/5443/8081 initially refused connections. Runner PID 21196 was absent, PostgreSQL stopped, and a stale development.lock blocked startup. Archived only that verified stale lock under ignored local-data; existing database/media/keys preserved. Existing development stack and QA HTTPS wrapper now running. Five HTTP and five certificate-verified HTTPS database readiness probes pass; anonymous HTTPS auth is rejected. No internet deployment exists. Phone USB forwarding/reachability is not verified in this round; laptop shutdown/sleep still removes availability.

SessionClient now bounds request and response-body reading at 75 seconds with a cleaned AbortController timer, distinguishes timeout/network messages and retains existing generation checks/foreground retries. No arbitrary POST network replay. The prior 15-second limit could fail a future free-host cold start; it is not evidence that Render caused yesterday's error. Current UI global busy lock may delay edits during a slow sync. Render/Supabase Free cannot guarantee always-on availability.

Evidence: clean mobile dependency install, TypeScript, 80 mobile tests (three new cold-start/body-timeout/idle-refresh regressions), Android/iOS exports, Release API build/liveness, backup guard and all 43 PostgreSQL/HTTP scenarios plus cleanup pass. First integration run stopped at the stale lock; rerun passes. First separate backup guard hit transient Windows EPERM rename; rerun and integration restore pass. npm ci reports 2 low / 10 moderate, no high/critical. No forced dependency upgrade. New physical-device design acceptance, APK install, actual hosted idle/wake and multi-day uptime remain untested; existing QA9 does not update automatically. No commit/push/publication.

Next: physical mobile visual acceptance/build distribution, configure the already selected free cloud accounts and run real HTTPS/two-client/cold-start acceptance; agree map provider/persistence/budget before any map implementation. Older palette references below are historical.

## Latest checkpoint — accounts, launcher icon and free-beta preparation

User approved Render Free API, Supabase Free PostgreSQL/private objects and Brevo Free email, with no paid services/domain. Keep email confirmation/recovery. Account deletion removes owned trips and the user's contributions to others' trips, with password, exact phrase and final confirmation. These decisions supersede older open-provider/recovery notes below. See [decision 0004](decisions/0004-free-beta-and-account-lifecycle.md), [release phases](RELEASE_PHASES.md) and [setup](FREE_BETA_SETUP.md).

Implemented native confirmation/resend/reset/deletion forms and Identity email adapter, one-hour codes, confirmed-email hosted login, session revocation, erased sync tombstones/credential-free identity stub, account-local cleanup and durable pending photo deletion. Place creator migration backfills existing retained receipts. Hosted configuration includes private Supabase storage, closed Data API schema checks, verified DB TLS, certificate-encrypted database keys, Docker startup migrations/readiness and a manual Free Render blueprint. No real service accounts/resources, email delivery or internet deployment have been created.

Evidence: clean mobile npm ci, TypeScript, 77 mobile tests, Android/iOS exports, Release API build/liveness, backup guards and all 43 PostgreSQL/HTTP scenarios pass with completed integration cleanup. Local provider stubs test private storage/retries, email contract, account deletion and startup safeguards; these are not real-provider tests. A non-root Linux API container limited to 512 MiB passes migrations, readiness/auth and restart with certificate-encrypted persistent keys. Fixed the integration harness double-shutdown hang and smoke-test dynamic port discovery. Existing development data was cold-backed up before migration (ignored pre-accounts-20261030 snapshot, 1,366 files); existing two place records both have backfilled creators.

Dependency audit: four high findings resolved with Expo 57.0.31, node-forge 1.4.2 and the scoped Expo CLI Zod 4.6.6 override; actual CLI schemas are tested. Zero high/critical, eight low remain. No forced SDK downgrade.

Original suitcase/airplane branding is generated from source SVG. Android QA9 retaining upgrade installed successfully, versionCode 9, SHA-256 133ee13642b4d33fec5242d1fec03372065166ccb20d14da8a2a0e31b3132f9a. Existing session/synthetic trip survives. Final adaptive foreground adds safe margins after QA8 launcher inspection. No phone radio/font/accessibility setting changed in this round; iPhone explicitly deferred. Native email/deletion end-to-end against real services is still open.

Final QA9 physical launcher inspection passes: suitcase handle/airplane fully visible within the Samsung adaptive mask. Existing signed-in trip remains visible after upgrade. Private cropped proof is ignored under local-data/native-qa-tls/qa9-launcher-icon.png. Both platform exports rerun after final icon padding and pass.

Final phone state: zero pending changes/attention items and no reported sync problems; airplane=0, stay-awake=0, font=1.15, USB reverse 5443→5443 retained. CI definition now gates high dependency findings; hosted CI has not run. Documentation relative-link checks and git diff --check pass.

Next: user creates the free service accounts and configures secrets using the setup guide. Real sender delivery, internet/two-client acceptance, hosted logical database+objects+certificate backup/restore and operational quota/cleanup procedures remain release gates. First three release phases are advanced, not fully signed off. No commit/push/publication.

## Latest checkpoint — available Android acceptance round closed

User requested completion of Android checks and explicitly deferred today's iPhone work. The remaining available Samsung round is complete with bounded results: pending member expense uploaded once (12,34 EUR / 987,66 EUR remaining); native plan conflict survives restart, both explicit resolution choices pass, and server deletion cannot be resurrected. Dedicated synthetic fixture only. QA6 safely simulated low photo space without filling the phone; error preserves title and a text/notes-only memory saves once. Restored normal QA7, then native WebP/HEIC picker/preparation/upload pass on the same memory with verified PNG dimensions/hashes; photo/note survive source removal and offline cold start. Large text 1.5 and a basic active TalkBack/form-focus check pass.

Limits are explicit: real physical ENOSPC was not induced; absent broad gallery permission is N/A for the system picker; USB localhost does not prove LAN permission-denial enforcement. Full spoken/gesture accessibility audit and all codec profiles are not claimed. iPhone/two-device and real-trip acceptance remain deferred/open, rather than blocking today's Android round. [Complete matrix and evidence](ANDROID_ACCEPTANCE_2026-10-29.md).

Final QA7 versionCode 7, SHA-256 224a8b964b3a6e0a621037b7eecb8cc2210fd4b373a39019f964e2636fc57698. Normal nativeMedia source restored/verified; no product code/schema/API change in this round. Three focused storage tests rerun successfully; QA6/QA7 builds and retaining installs pass. Earlier full 73 mobile/35 HTTP checks remain the relevant baseline, not falsely reported as rerun. Settings restored/verified: stay-awake=0, airplane=0, font=1.15, TalkBack off with original null services, effective local-network app-op allow, direct reverse 5443→5443. Synthetic credentials and output remain ignored. No commit/push.

Next: resolve four high mobile dependency findings, then prepare account recovery and HTTPS private beta/distribution choices; iPhone/different-device testing resumes when available. Existing development/HTTPS QA stack remains running. Older next-step paragraphs below are historical.

Final normal-QA7 manual synchronization confirms zero pending changes, zero attention items and no reported problems. Documentation relative links (50 across nine documents) and git diff --check pass.

## Latest checkpoint — EXIF queue recovery completed

User resumed work. USB authorized; saved phone baseline restored and confirmed: stay-awake=0, airplane=0, font=1.15, direct adb reverse 5443→5443. QA4 build/exports/71 tests were successful; its integration had stopped at the backup guard while the development stack held the lock. Today the stale runner lock was removed only after confirming its runner/database PIDs, PostgreSQL processes and listeners were absent. Later maintenance used managed clean shutdown.

Fixed recovery of earlier oversized PNGs: a pending upload rejected as 400/invalid_media can verify local hashes/bounds and prepare new durable copies, retaining the media ID, immutable entry outbox and tracked original copies. Valid/accepted/downloaded media and unrelated errors are excluded. Repaired metadata persists before retry; storage failure preserves originals. No schema/API change. Both architecture files updated.

Evidence: clean mobile npm ci, TypeScript, 73 mobile tests, Android/iOS exports, Release API build/liveness, backup guard and all 35 PostgreSQL/HTTP scenarios pass; integration rerun after the recovery change and clean e2e npm ci. Mobile dependencies still report 6 low/4 high findings. QA5 assembleRelease and adb install -r pass; final APK SHA-256 b713c3e0c2b0a8b2ac454fe546d491c5be89dd917b7205b3345c7fd19b679a3c. Initial QA5 build used the wrong API hostname; corrected ignored QA configuration to existing localhost trust/scope and regenerated/verified the embedded JS endpoint before final installation. Original session and queue restored.

Physical Samsung PASS: old rejected asset uploaded with the same ID at corrected 800×1280/200×320 dimensions, pending queue drained to zero, and exactly one JPEG memory remains with the selected replacement. API verifies hashes/private caching/401 anonymous/404 non-member and absence of EXIF/text PNG chunks for this synthetic fixture. Removed only today's synthetic picker file; full photo remains visible after force-stop/cold start with QA API tunnel absent. Restored direct tunnel/settings and rechecked API uniqueness. [Detailed evidence](ANDROID_MEDIA_RECOVERY_2026-10-29.md).

Next: restore the synthetic member's pending 12,34 EUR expense through native reauthentication, then remaining conflict/accessibility/permission/controlled low-space acceptance. iPhone/two physical devices, dependency findings, production account recovery and beta distribution remain open. Development stack/HTTPS QA API are running; no commit/push. Older checkpoints below are history, not current stop instructions.

## Latest checkpoint — user requested stop

User explicitly stopped work to continue later. No further phone tests until resumed. Since the previous checkpoint, QA3 installation is confirmed by Android versionCode=3 (install command timed out without reporting Success). Physical packing fix passes at original font 1.15 and font 1.5; edit opens the native form. Revoked-session local continuation preserved packing, reauthentication uploaded it once, and owner API cannot read it. Removed-member offline plan remained queued across restart and was rejected server-side; a new invitation restored access and uploaded the same plan once (2026-10-27 09:00, transport). Native food/visited place saved successfully. Native offline expense 12,34 EUR displayed exact 987,66 EUR remaining from synthetic 1000 EUR budget; it remains pending under member account after logout. Owner login did not send the member's expense.

**New media regression reproduced, not yet signed off:** synthetic JPEG with EXIF orientation 6/GPS was displayed correctly but upload rejected 400: native full image 1280×2048 and thumbnail 320×512 exceeded limits because picker dimensions preceded rotation. Current source fix in nativeMedia.ts uses decoded ImageManipulator dimensions before sizing; focused regression fails geometrically with old code and passes with fix (800×1280 / 200×320), and all 71 mobile tests pass. QA4 build, exports and isolated auth/sync check were launched before stop; inspect saved qa4 logs for completion, do not assume success. QA4 has not been installed or physically verified. Existing oversized JPEG remains in owner's local pending queue; new preparation code does not automatically reprocess that cached image. Resolve recovery of that pending fixture without discarding local work before claiming the JPEG flow complete.

Phone settings cleanup was attempted on stop but ADB reported no device; **restoration is not confirmed**. Last confirmed font is 1.15 and airplane mode 0; temporary USB stay-awake was enabled during testing and must be restored from local-data/native-qa-tls/stay-awake-baseline.txt on reconnection, together with direct QA USB forwarding 5443→5443. No further phone actions after stop. Next: restore that baseline first, then finish EXIF/pending-photo recovery, verify/install QA4 as appropriate, restore member expense and remaining conflict/native acceptance. Preserve all existing changes. No commit/push.

## Extended Android device QA — waiting for USB reconnection

Latest continuation: user resumed device work. Native member packing offline create passed; native session-revocation screen requests reauthentication while preserving local work. Discovered a physical packing layout bug: full-title edit button squeezed title/status into a narrow column. Replaced it with a 48×48-minimum icon action retaining the full accessibility label and existing behavior. Clean npm ci, TypeScript, all 71 tests, Android/iOS exports and QA3 assembleRelease pass. QA3 versionCode 3 hash: faab8ea0b392a6ce48291aa4e0824458cf0c711bac56cc30084d655a97a11277. USB disconnected again before installation and final device regression; user was asked to reconnect. No font/radio/permission settings changed in this continuation. Next: install QA3, verify packing layout and pending work through reauthentication, then revoked membership/native plan/expenses and remaining safe checks. Full Android sign-off remains open. [Current checkpoint](ANDROID_DEVICE_QA_2026-10-28.md).

Resume update 2026-10-28: airplane mode restored to 0; QA2 versionCode 2 installed successfully with session/two pending items retained; upload retry drains to zero without duplicate memory. Native login under second synthetic account, explicit photo download, offline cold reopen and interrupted-download/retry pass. User then explicitly requested a pause to use the phone. No further device UI work; original QA USB forwarding restored at pause. Font/permissions were not changed. Next after user resumes: session revocation/member removal with pending data, native packing/plan/expenses and remaining safe device matrix. Detailed current results: [ANDROID_DEVICE_QA_2026-10-28.md](ANDROID_DEVICE_QA_2026-10-28.md). The following bullets describe the earlier disconnect, now superseded.

- User requested completion of remaining phone checks. Actual active-upload interruption is confirmed: fault proxy closed the mobile request after 8,192–57,344 of 4,235,566 bytes; replacement photo and two pending items remained visible. Real airplane mode (setting=1), removed QA USB API forwarding and force-stop/cold start preserved the session/pending queue.
- USB initially disconnected; user subsequently reconnected and authorized it. Initial settings (airplane=0, font scale=1.15, original USB forwarding) are saved under ignored local-data. Airplane restoration is now confirmed; no font or permission changes have been made.
- QA2 APK built successfully with versionCode 2, unchanged app/schema/signature. Installation with pending data, successful upload retry and native download under the second synthetic account now pass. No app source changes/full automated suite rerun.
- Resume only after user lifts the pause, following the remaining matrix in [ANDROID_DEVICE_QA_2026-10-28.md](ANDROID_DEVICE_QA_2026-10-28.md). Full Android/beta sign-off is not claimed. No commit/push.

## Android photo acceptance — 2026-10-28

- Existing installed Samsung QA build passed actual native photo-picker cancellation/selection, PNG preparation, offline memory save, source-fixture removal and force-stop/cold reopen with image and thumbnail still available. Reconnected foreground sync drained the two pending items to zero; repeated synchronization retained one memory. No product code changes were needed.
- Authenticated API verification confirms 1280×800 image and 320×200 thumbnail, matching SHA-256 hashes, private/no-store responses, anonymous HTTP 401 and non-member HTTP 404 for both. The synthetic PNG tEXt comment was absent from uploaded copies; JPEG/HEIC/EXIF/GPS generalizations are not claimed.
- Actual installed APK hash matches the 2026-10-27 build. No new build/export/full automated suite or audit was run for this device/documentation-only step. Native/HTTP evidence: [ANDROID_PHOTO_QA_2026-10-28.md](ANDROID_PHOTO_QA_2026-10-28.md).
- Offline means unavailable QA API, not changed phone radios. Permission denial, interruption during active upload, native offline download on another account/device, other codecs, low space and iPhone remain open. Next concrete step: interrupted upload/retry and explicit native offline photo download on a second synthetic account.
- Development stack restarted only after verifying old recorded PIDs, PostgreSQL processes and listeners were absent; existing database retained. Runner uses loopback links for USB QA; the HTTPS QA API and USB forwarding are restored. No commit/push.

## Android native acceptance — 2026-10-27

- Samsung Galaxy S25+ (SM-S936B, Android 17/API 37): actual installed `local.tripora.qa` build passed registration, native calendar selection, online trip creation, offline session/data restore, offline trip creation, force-stop/reopen with one pending operation, reconnect and manual synchronization to zero pending operations. Authenticated server pull independently confirms exactly two expected synthetic trips, one copy each, including after repeated synchronization.
- Reproduced a native UX bug: dismissing the Samsung keyboard through Back also closed the trip form and discarded its unsaved draft. `FormSheet` now dismisses a visible Android keyboard before allowing modal closure. Physical regression passes: first Back preserves entered text/form and hides the keyboard; second Back closes the form. Existing busy-operation guards and iOS behavior remain covered by component tests.
- Updated QA APK installed with `adb install -r` (Success), retaining session and saved trip. APK SHA-256: `f463ff488d5e9aafabda0d3b4fa233847dbfbce9a0c20e251d1b82808fedbc25`. QA source tree matches current mobile source. Build is from an uncommitted working tree, with the separate QA identity/local HTTPS configuration; no clean-commit release identity is claimed.
- Verification: clean mobile npm ci, TypeScript, all 71 mobile tests, Android/iOS exports and arm64 QA assembleRelease pass. Initial test runs hit sandbox TEMP rename restrictions and then a TEMP path-separator assertion; rerun with canonical Windows TEMP/TMP under ignored local-data passes. Clean install currently reports 4 high dependency findings; these remain unresolved. No API/auth-sync integration suite rerun for this UI-only change.
- Offline test removed only QA USB API forwarding; it did not toggle phone radios. No-Metro installed cold start is confirmed for this trip/session scenario; airplane mode, gallery/photo persistence, permissions, low space, multi-device behavior, pending-data upgrades/migrations and iPhone remain open. Full phase 9 is not signed off.
- Restored managed development stack after checking old runner/database PIDs, PostgreSQL processes and listeners were absent; only the stale runner lock was removed. Existing database recovered through PostgreSQL startup. Local development stack and QA HTTPS API are running; QA USB forwarding was restored. Evidence and next device steps: [ANDROID_QA_2026-10-27.md](ANDROID_QA_2026-10-27.md). No commit/push.

The next step recorded on 2026-10-27 (Android synthetic gallery/photo durability) is completed within the bounded scenario above. Full installed-device matrix and iPhone/two-device acceptance remain open.

Development restart 2026-10-25: the previous runner/API/Expo were stopped. Removed the stale runner lock only after confirming recorded runner/database PIDs, PostgreSQL processes and development listeners were absent. Started the existing data folder with explicit Wi-Fi host 192.168.0.173 (additional APIPA interfaces were present). Expo status, Android launcher, API health and SDK 57 Android development bundle returned HTTP 200. Stack is running for the user's Android test; no new native-device acceptance is claimed. Next: reload in compatible Expo Go and run the redesign scenarios in UX_REDESIGN.md.

## Full functional QA — 2026-10-25

- Executed the requested test/fix/regression loop. Baseline 58 mobile tests passed; expanded coverage now totals 71 mobile tests, with zero failures after fixes. All 35 PostgreSQL/HTTP scenarios, backup guard, TypeScript, Release build/liveness and Android/iOS exports pass.
- Fixed two reproduced UI bugs: currency selection was enabled after deleting the final expense despite the existing historical lock; rejected native invitation sharing caused an unhandled Promise. Currency now respects tombstone history, and failed sharing retains the code with a useful error.
- Added full feature UI CRUD/cancel/error/access tests, native modal busy/back checks and resumed entry pagination after SQLite reopen. Extended App tests exercise registration/rejected login, restored account/component remount, trip editing and local/server conflict resolution for places/plans including tombstones.
- At the automated baseline no Android SDK/ADB or iOS simulator was available. Android tools are now installed locally with the user's explicit licence approval; an authorized Samsung Galaxy S25+ (SM-S936B, Android 17/API 37) is connected over USB. A standalone, separate `local.tripora.qa` arm64 APK was built successfully with its embedded JS bundle. USB installation succeeded and Android reports `local.tripora.qa/.MainActivity` running. The device still reports its lock screen is showing; the user was asked to unlock. Functional device acceptance is not yet confirmed. Native controls/bridges in the existing component tests remain mocked; physical cold start, permissions/gallery/codec, keyboard/accessibility, low storage and real multi-device QA remain open. Six high dependency audit findings and account recovery/distribution remain release gates.
- Full feature-by-feature evidence, failed-then-passing regressions, acceptance criteria and outstanding work: [QA_REPORT_2026-10-25.md](QA_REPORT_2026-10-25.md). Existing unrelated uncommitted changes were retained; no commit/push.
- Restarted the managed stack with the two UI fixes: Android launcher, Expo status and API health returned 200; SDK 57 Android bundle returned 200 (4,687,590 bytes), anonymous entry pull returned 401. Documentation links and git diff --check passed. Stack remains running for Android device acceptance.

## Implemented

- Existing account/session, shared trips, invitations, membership and places/food/nightlife work remains preserved.
- Phase 6: daily/unscheduled plan, optional local time, activity/transport/stay categories and saved-place references. Trip date shortening cannot strand activities outside the new range.
- Personal packing per participant, explicitly chosen by the user. Other participants, including the owner, cannot read or modify it.
- Phase 7: expenses, immutable author, separate optional payer, date/category/notes, owner budget and one trip currency. Exact minor-unit arithmetic includes pending changes and deletions; currency locks after the first expense. No debt settlement.
- Phase 8: text/photo memories, optional place, gallery selection, durable account-scoped image and thumbnail, separate idempotent upload queue, private authorized downloads and explicit offline saving.
- Development media defaults: one photo/memory, 100 assets/trip, 1280 px image/320 px thumbnail, 8 MiB/1 MiB. Private local server storage; cloud/paid hosting remains unselected.
- SQLite v3 preserves previous data and queues, invalidates older narrower readiness markers and adds feature/media state. Sync processes trips/access, places, image uploads, entries, then guarded cleanup.
- Immutable requests, follow-up drafts, explicit conflicts, tombstones, server validation and removed-access handling cover new sections.
- Prepare for offline confirms complete metadata pulls; image bytes require explicit download. External maps are not included.

## Phase 9 completed development work

- Integrated per-trip local overview: places/visited, plans/unscheduled, own packing, exact spending/remaining, memory/image availability and pending/attention counts. Child work is no longer labelled synchronized from parent status alone.
- Added clear disk-full handling preserving previous commits/queues, an advisory native photo free-space threshold and cleanup when thumbnail generation fails.
- Fixed logout during secure-storage sign-in writes; token writes and clearing now serialize with generation guards. All auth/API responses use private/no-store.
- Added exclusive runner/maintenance locking, managed stop command, clean pg_ctl shutdown and same-platform PostgreSQL 17 snapshot/restore with media, keys and settings. Restore refuses live clusters, corruption, unsafe paths and existing targets. Explicit private key folder supports complete recovery.
- Actual restored-cluster HTTP test verifies identities/tokens, receipts, sync clock, membership and private photos; backup guard test verifies checksum/path/overwrite/lock defenses and empty directories. CI definition includes the guard test; hosted result is not claimed.
- Private beta instructions, device matrix, known limits and recovery procedure: [PRIVATE_BETA.md](PRIVATE_BETA.md). No store/TestFlight package or paid infrastructure provisioned.

## Mobile UX redesign — 2026-10-23

- Replaced the single long app form with separate global Trips/Sync/Account screens and selected-trip Overview/Plan/Places/Expenses/More navigation. More includes personal packing, memories, membership and settings; overview has direct shortcuts.
- Added shared raspberry/pale-sky/white tokens, SVG icons, consistent fields/buttons/empty states, native modal forms/details and Android back handling. Trip cards separate upcoming/active and past trips.
- Added SDK 57 native date/time selection (Croatian display, unchanged calendar-only payloads), horizontal itinerary days, saved-place-to-plan flow, personal packing checklist, exact expense breakdowns and thumbnail memories.
- Added datetimepicker 9.1.0 and react-native-svg 15.15.4; aligned crypto/SQLite patch versions with Expo's local SDK list. No DB/API/auth/sync contract changes. Offline dependency compatibility check passes.
- Latest verification: all 58 mobile tests, all 35 PostgreSQL/HTTP scenarios, backup guard, TypeScript, Release build/API liveness and Android/iOS exports pass. Native pickers are mocked; date/DST serialization is also checked in three time zones. Synthetic component layouts were inspected in an HTML projection, not a native device render.
- Final lockfile clean install passed. Managed development stack restarted with the redesign: Android/iPhone launchers and API returned HTTP 200, SDK 57 Android development bundle returned HTTP 200 (4,687,166 bytes), anonymous entries returned 401. The temporary layout-preview server was stopped; the actual development stack remains running for device testing.
- Android launch before redesign was confirmed by the user after installing SDK 57-compatible Expo Go (previously 58.0.5). The redesigned native flows still need Android/iOS acceptance. Detailed changes and concrete test scenarios: [UX_REDESIGN.md](UX_REDESIGN.md).

## Verification

- Session hardening on 2026-10-23: late restore cannot undo logout or replace a new account; old requests cannot replay mutations under the new account after 401. Refresh sharing is generation-scoped and logout blocks requests while secure-storage clearing is pending. Nine deterministic race regressions added; the first six reproduced failures before the fix.
- Continuation verification on 2026-10-23: all 35 PostgreSQL/HTTP scenarios, backup guard, Release build/liveness, both platform exports, updated documentation links and git diff --check passed again. The old runner lock referenced a nonexistent PID; it was removed only after confirming both recorded runner/database PIDs, PostgreSQL processes and development listeners were absent. Restarted managed stack; Android/iPhone launchers and API returned 200, anonymous entries returned 401. Physical-device acceptance is the next concrete step using PRIVATE_BETA.md.
- TypeScript passed; all 71 mobile tests passed, including actual desktop SQLite/reopen/rollback, real temporary image files/hashes, mocked native adapters and App.tsx journeys with denied/cancelled gallery selection. On this Windows sandbox, TEMP/TMP were pointed at ignored local-data/test-temp to permit file renames and Hermes output; npm ci needed normal host access for node_modules.
- All 35 PostgreSQL/HTTP scenarios passed: actual mobile modules, two accounts/stores, retries/lost acknowledgements, conflicts, membership enforcement, personal packing privacy, exact money, interrupted/malformed media, quotas, cleanup and API restart persistence.
- .NET Release build: zero warnings/errors. API liveness passed. Android and iOS exports passed.
- Restarted the local stack with migrations applied. Android/iPhone launchers, API health and Android development bundle returned HTTP 200; anonymous entry/media requests returned 401. Relative documentation links and git diff --check passed.
- Managed dev-stop released the lock after clean shutdown; a subsequent runner restart and the same HTTP checks passed. The app is left running for trusted-LAN testing. Existing sessions may need reauthentication after the switch to explicit local token keys; account data/queues are retained.
- PNG structure/CRC/dimensions/decompression bounds and private/no-store downloads tested. Native File.move destination retention has an adapter regression test.
- React test renderer is deprecated and native bridges are mocked. Desktop files/SQLite and bundle exports do not establish native cold start, SecureStore, gallery codecs/metadata stripping or physical-device behavior. Full Android/iPhone QA remains pending; only earlier Android startup has user confirmation.
- Added Expo-compatible file-system, image-picker and image-manipulator dependencies. The latest 2026-10-23 install audit reports 6 high mobile dependency findings (earlier runs: 4/15); these remain a release gate. Only SDK-aligned UI dependencies and crypto/SQLite patches were updated; no audit fix --force was run. No lint script exists. Hosted CI result remains unverified.

## Remaining work

The installed Samsung QA runs establish registration/calendar/trip behavior, offline session/trip persistence and the keyboard Back fix (2026-10-27), plus synthetic PNG gallery selection, source-independent image persistence after cold start and private upload (2026-10-28). They do not establish full redesigned UX acceptance, airplane mode, all codecs/permissions or iPhone behavior. Next concrete step: interrupted upload/retry and native explicit offline photo download on another synthetic account, then the remaining installed-build matrix in PRIVATE_BETA.md. Earlier Expo Go compatibility and startup evidence remains historical.

Phase 9 remains open for device acceptance and deployment: integration/private beta — installed-build Android/iPhone cold start and airplane mode, low storage/weak network/permissions, real multi-person trip, UX/accessibility, security review, paired database/media backup and restore, account verification/recovery and private distribution.

Then phase 10: agree private/store release, hosting/storage costs, resolve release dependency findings, verify hosted CI and establish repeatable release/operations. Production permissions, currencies/photo limits and Croatian UI remain reviewable prototype defaults except explicitly confirmed personal packing.

No public hosting provisioned. No commit or push performed; prior uncommitted work preserved. Start the trusted-LAN stack using node tests/e2e/dev.mjs; ignored local-data/development retains DB, private media and generated credentials. The laptop and development server must remain available.

Evidence: [phases 6–8](PHASES_6_8_CHECKLIST.md), [places/offline](PLACES_OFFLINE_CHECKLIST.md), [membership](MEMBERSHIP_CHECKLIST.md), [decisions](decisions/0003-planning-money-memories.md).
