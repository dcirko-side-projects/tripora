// Local-only development runner: persistent synthetic database + API + Expo Go.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { withMaintenance, localDataPath } from './local-backup.mjs';
import { stopPostgres } from './postgres-stop.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
await withMaintenance(async () => {
const local = await localDataPath(process.env.TRIPORA_DEV_DATA ?? join(root, 'local-data', 'development'));
const stopFile = join(root, 'local-data', 'development.stop');
await rm(stopFile, { force: true });
await mkdir(local, { recursive: true });
const candidates = Object.entries(networkInterfaces()).flatMap(([name, items]) => /virtual|vethernet|wsl|docker/i.test(name) ? [] : items.filter(x => x.family === 'IPv4' && !x.internal).map(x => x.address));
const host = process.env.TRIPORA_DEV_HOST ?? (candidates.length === 1 ? candidates[0] : '127.0.0.1');
if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || !['127.0.0.1', ...candidates].includes(host)) throw new Error('TRIPORA_DEV_HOST must be a local IPv4 interface.');
const settingsFile = join(local, 'settings.json');
let settings;
try { settings = JSON.parse(await readFile(settingsFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  settings = { password: randomBytes(32).toString('hex') };
  await writeFile(settingsFile, JSON.stringify(settings), { flag: 'wx', mode: 0o600 });
}
const databaseDir = join(local, 'postgres');
let first = false;
try { await access(join(databaseDir, 'PG_VERSION')); } catch { first = true; }
const pg = new EmbeddedPostgres({ databaseDir, user: 'tripora_dev', password: settings.password, port: 55433,
  authMethod: 'scram-sha-256', persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
const env = { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', Tripora__HealthOnly: 'false',
  Tripora__MediaRoot: join(local, 'media'),
  Tripora__KeyRoot: join(local, 'keys'),
  ASPNETCORE_URLS: host === '127.0.0.1' ? 'http://127.0.0.1:5080' : `http://127.0.0.1:5080;http://${host}:5080`,
  ConnectionStrings__Tripora: `Host=127.0.0.1;Port=55433;Database=tripora_dev;Username=tripora_dev;Password=${settings.password}` };
const dll = join(root, 'services/api/bin/Release/net10.0/Tripora.Api.dll');
let api; let expo; let started = false; let stopTask; let stopTimer;
function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, ...options });
  // Deliberately omit child logs: EF connection diagnostics must never disclose local credentials.
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  return child;
}
function stop() { return stopTask ??= (async () => {
  for (const child of [expo, api]) if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
  if (started) await stopPostgres(pg, databaseDir);
})(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void stop().catch(() => { process.exitCode = 1; }));
try {
  if (first) await pg.initialise();
  await pg.start(); started = true;
  if (first) await pg.createDatabase('tripora_dev');
  const migration = launch('dotnet', [dll, '--migrate']);
  const [code] = await once(migration, 'exit'); if (code !== 0) throw new Error('Migration failed. Check local database setup.');
  api = launch('dotnet', [dll]);
  for (let attempt = 0; ; attempt++) {
    try { const response = await fetch('http://127.0.0.1:5080/health/live'); if (response.ok) break; } catch {}
    if (api.exitCode !== null || attempt >= 100) throw new Error('Development API did not start.');
    await new Promise(r => setTimeout(r, 200));
  }
  expo = launch(process.execPath, [join(root, 'apps/mobile/node_modules/expo/bin/cli'), 'start', '--lan', '--port', '8081'], {
    cwd: join(root, 'apps/mobile'), env: { ...process.env, CI: '1', EXPO_PUBLIC_API_URL: `http://${host}:5080`, REACT_NATIVE_PACKAGER_HOSTNAME: host },
  });
  for (let attempt = 0; ; attempt++) {
    try { const response = await fetch('http://127.0.0.1:8081/status'); if ((await response.text()).includes('packager-status:running')) break; } catch {}
    if (expo.exitCode !== null || attempt >= 150) throw new Error('Expo did not start.');
    await new Promise(r => setTimeout(r, 200));
  }
  const links = { expo: `exp://${host}:8081`, android: `http://${host}:8081/_expo/loading?platform=android`,
    ios: `http://${host}:8081/_expo/loading?platform=ios`, api: `http://${host}:5080/health/live` };
  await writeFile(join(local, 'links.json'), JSON.stringify(links, null, 2));
  console.log('Tripora development ready: ' + JSON.stringify(links));
  console.log('Use synthetic accounts only, on a trusted local network. Ctrl+C stops the runner.');
  stopTimer = setInterval(() => { void access(stopFile).then(() => stop()).catch(error => { if (error.code !== 'ENOENT') { console.error('Development shutdown failed.'); process.exitCode = 1; } }); }, 500);
  await Promise.race([once(api, 'exit'), once(expo, 'exit')]);
} finally { clearInterval(stopTimer); await stop(); await rm(stopFile, { force: true }); }
});
