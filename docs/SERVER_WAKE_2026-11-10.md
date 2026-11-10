# Server wake mitigation - 2026-11-10

## Requirement and budget

The user requested removal of the server wait, then explicitly kept **0 cost and
no payment card**. No paid compute/account/plan was activated. Earlier acceptance
of occasional wake-ups is superseded by this request to mitigate normal idle
spin-down. Absolute always-on availability is not guaranteed on Free hosting.

## Evidence and cause

Before mitigation, two public readiness requests took 44,633 ms then 243 ms.
A later pre-monitor probe returned liveness 200 after 32,272 ms and readiness 200
in 91 ms. The much faster immediately-following DB-backed response, plus the
provider's documented idle behavior, supports Render cold start as the main
observed contributor; no server-side trace or physical native startup benchmark
is claimed. Render documents a 15-minute idle threshold and roughly one-minute
wake. Neon separately sleeps after five minutes and normally wakes much faster.

## Active configuration

- Existing Render `tripora` service, Frankfurt, Free; same public origin and application source. Health Check Path saved as **`/health/live`** in Settings.
  Logs showed that saving Settings and Restart service both left the running
  deployment using `/health/ready` every five seconds. A specific-commit redeploy
  of the already-live **93ac4c379fd0f145e88cebdfc2010ffe5b39b7a6** applied the
  new service configuration. Deployment **dep-dbpmkjc9v7es73fbo3e0** reports
  **Deploy succeeded | Live**, duration **2m 7s**, at about **20:04:45 CET**.
  New instance logs show `/health/live` checks instead of `/health/ready`.
  No new application source, secret, account scope or intended schema change
  is introduced.
- One UptimeRobot Free monitor: **Tripora API liveness**, ID **804624912**,
  URL `https://tripora-l4c7.onrender.com/health/live`, HTTP, **300 seconds**.
  Account was supplied by the user's own sign-in. Created through the official
  one-row CSV import because the Single Monitor route returned to the list.
- No alert contacts/integrations, public status page, payment card or paid feature.
  Public liveness only; no access to app tokens, travel records, photos or DB.
- `render.yaml` mirrors the live health path. `/health/ready` remains available
  for release/incident validation and continues to check real DB readiness.
- The monitor runs on UptimeRobot infrastructure, not this laptop/Codex, the
  mobile client, GitHub Actions or a local scheduled task.

## Database quota guard

Render sends internal health probes every few seconds. The prior `/health/ready`
queries `SyncClocks`, keeping Neon awake while the API runs. Using the existing
DB-free liveness route avoids that unnecessary compute. At 0.25 CU, 30/31-day
continuous DB activity would use 180/186 CU-hours versus Neon's current 100
CU-hour Free allowance. Keep Neon scale-to-zero enabled. Its next real request
may still need a short DB wake; liveness does not certify database availability.

Render dashboard at setup: Hobby, no card on file, **8.87/750 Free hours**,
**8 MB/5 GB bandwidth**, **1/500 pipeline minutes**, $0 accrued/projected.
The workspace has two services. No other service was modified. A single 24/7
service uses up to 744 hours/month, so future use of other Free services can
exhaust the shared quota. If quotas block the service, stop/review usage; do not
add a card, upgrade or silently provision another service.

## Validation

- Existing API liveness test passes without a database; no application source or
  auth/sync protocol changed in this hosting step.
- Render UI confirms the saved `/health/live` path; monitor UI confirms one HTTP
  monitor at five-minute intervals and no notification recipients.
- The first idle-window timer (18:55:58 UTC) was canceled before probing when
  production logs revealed the old DB-backed health route still running.
  The final 16-minute no-agent-application-requests measurement began
  **19:05:42.726 UTC / 20:05:42.726 CET**, after the same-source redeploy and
  route validation. At **20:21:43 CET**, after the full 16-minute window,
  the first liveness response was **200 in 276 ms**. The next DB-backed readiness
  response was **200 in 1,991 ms**. Just before the probe, Neon explicitly showed
  **SUSPENDED for 11 minutes**: the readiness result therefore includes actual
  database wake/reconnection, not only an already-warm DB query.
- Follow-on public auth checks: `/auth/options` **200 in 99 ms**, confirmed email
  still required; anonymous `/api/sync/pull` **401 in 102 ms**, `private, no-store`.
  These do not exercise a real hosted user login or physical phone launch.
- Final monitor view remains **Up** for about 27 minutes, five-minute checks,
  no incidents, displayed response about 104 ms. The direct idle-window probe
  measures client DNS/TLS/network plus endpoint response; the external monitor
  uses a different network location. No native startup benchmark is claimed.
- Raw public measurements and final screenshots remain ignored at:
  `local-data/hosting-setup/idle-window-2026-11-10.json`,
  `local-data/hosting-setup/uptimerobot-up-2026-11-10.png`,
  `local-data/hosting-setup/render-health-live-2026-11-10.png`, and
  `local-data/hosting-setup/neon-suspended-before-probe-2026-11-10.png`.
- Screenshot proof is ignored at
  `local-data/hosting-setup/render-health-deploy-2026-11-10.png`.
- At **20:10 CET**, the Neon compute UI explicitly reports **SUSPENDED**,
  0.25 CU, suspended about one minute earlier, while the UptimeRobot monitor
  remains Up. This confirms that the new liveness probes allow database sleep.
  Screenshot: `local-data/hosting-setup/neon-suspended-2026-11-10.png`.
- The external monitor reports five-minute checks, 0 incidents and a post-deploy
  response around 99 ms; the first monitor response before redeploy was 108 ms.
- No new mobile tests/exports, physical-device test, commit or push in this step;
  previous map/startup source verification remains recorded in STATUS.

## Operations and rollback

Use [the monitor](https://dashboard.uptimerobot.com/monitors/804624912) to inspect
Up/Down/last check and response time. Pause this one monitor to stop periodic
requests; this restores ordinary Render idle behavior. Restore Render's Health
Check Path to `/health/ready` and the corresponding YAML value if reverting the
liveness policy, then redeploy the already-live commit to apply the saved
health-check setting. Saving Settings or Restart service alone did not update
the active probe route in this session. The DB-backed path again causes routine
DB queries while the service runs.
Do not disable auth or DB TLS to reduce latency. A deployment/restart/network
failure or missed monitor checks can still cause waiting. Check DB readiness,
account login and sync separately when diagnosing a green liveness monitor.

## Sources checked 2026-11-10

- [Render Free behavior and 750-hour allowance](https://render.com/docs/free)
- [Render health probes and response rules](https://render.com/docs/health-checks)
- [UptimeRobot Free: 50 monitors, five-minute checks, no card](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan)
- [UptimeRobot interval/backoff behavior](https://help.uptimerobot.com/en/articles/11360876-what-is-a-monitoring-interval-in-uptimerobot)
- [UptimeRobot fair use](https://uptimerobot.com/terms-fair-use/)
- [Neon Free compute allowance](https://neon.com/pricing)
- [Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero)
