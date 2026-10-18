import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dataRoot = join(root, 'local-data');
await mkdir(dataRoot, { recursive: true });
const folder = await mkdtemp(join(dataRoot, 'pg-test-'));
const port = await new Promise((resolvePort, reject) => {
  const s = createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolvePort(port)); });
});
const password = randomBytes(24).toString('hex');
const pg = new EmbeddedPostgres({
  databaseDir: folder, user: 'tripora_test', password, port,
  authMethod: 'scram-sha-256', persistent: true,
  postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {},
});
const env = {
  ...process.env, ASPNETCORE_ENVIRONMENT: 'Testing', ASPNETCORE_URLS: 'http://127.0.0.1:0',
  Tripora__HealthOnly: 'false',
  ConnectionStrings__Tripora: `Host=127.0.0.1;Port=${port};Database=tripora_test;Username=tripora_test;Password=${password}`,
};
const dll = 'services/api/bin/Release/net10.0/Tripora.Api.dll';
let server; let base; let client; let started = false;
async function stopApi() {
  if (server && server.exitCode === null) {
    await new Promise(resolveExit => { server.once('exit', resolveExit); server.kill(); });
  }
}
async function startApi() {
  server = spawn('dotnet', [dll], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolveUrl, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('API start timeout: ' + log)), 20000);
    const collect = data => {
      log = (log + data).slice(-5000);
      const match = log.match(/Now listening on: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolveUrl(match[1]); }
    };
    server.stdout.on('data', collect); server.stderr.on('data', collect);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('API exit ' + code + ': ' + log)); });
  });
}
async function request(path, token, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}
function mutation(kind = 'trip.create', id = randomUUID(), version = 0) {
  return { operationId: randomUUID(), tripId: id, kind, baseVersion: version,
    data: kind === 'trip.delete' ? null : { name: 'Synthetic trip', destination: 'Test island', startDate: '2026-10-01', endDate: '2026-10-03' } };
}
let checks = 0;
function pass(name) { checks++; console.log('PASS: ' + name); }
try {
  await pg.initialise(); await pg.start(); started = true;
  await pg.createDatabase('tripora_test');
  client = pg.getPgClient('tripora_test'); await client.connect();
  await new Promise((ok, fail) => {
    const migration = spawn('dotnet', [dll, '--migrate'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; migration.stdout.on('data', d => { output += d; }); migration.stderr.on('data', d => { output += d; });
    migration.once('error', fail); migration.once('exit', c => c === 0 ? ok() : fail(new Error('Migration failed: ' + output)));
  });
  await startApi();
  assert.equal((await request('/api/sync/pull')).status, 401);
  assert.equal((await request('/api/sync/pull', 'invalid')).status, 401);
  pass('anonymous and invalid tokens rejected');

  const passwordA = 'T!' + randomBytes(18).toString('hex') + 'aZ1';
  const passwordB = 'T!' + randomBytes(18).toString('hex') + 'aZ1';
  const aEmail = 'traveler-a@example.test'; const bEmail = 'traveler-b@example.test';
  assert.equal((await request('/auth/register', null, { email: aEmail, password: passwordA })).status, 200);
  assert.equal((await request('/auth/register', null, { email: bEmail, password: passwordB })).status, 200);
  assert.equal((await request('/auth/register', null, { email: aEmail, password: passwordA })).status, 400);
  const a = (await request('/auth/login?useCookies=false', null, { email: aEmail, password: passwordA })).data;
  const b = (await request('/auth/login?useCookies=false', null, { email: bEmail, password: passwordB })).data;
  assert.ok(a.accessToken && a.refreshToken && b.accessToken);
  assert.equal((await request('/auth/me', a.accessToken)).data.email, aEmail);
  assert.equal((await request('/auth/refresh', null, { refreshToken: a.refreshToken })).status, 200);
  pass('register, duplicate rejection, bearer login, identity and refresh');

  const create = mutation();
  const [first, replay] = await Promise.all([
    request('/api/sync/push', a.accessToken, create), request('/api/sync/push', a.accessToken, create),
  ]);
  assert.equal(first.status, 200); assert.deepEqual(replay, first);
  assert.equal((await client.query('SELECT COUNT(*) FROM "Trips"')).rows[0].count, '1');
  assert.equal((await client.query('SELECT COUNT(*) FROM "Receipts"')).rows[0].count, '1');
  pass('concurrent duplicate push commits one trip and one receipt');

  const changed = structuredClone(create); changed.data.name = 'Changed payload';
  assert.equal((await request('/api/sync/push', a.accessToken, changed)).status, 409);
  assert.equal((await request('/api/sync/push', b.accessToken, create)).status, 404);
  assert.equal((await request('/api/sync/pull', b.accessToken)).data.items.length, 0);
  pass('changed replay and cross-account reads/writes rejected');

  const update = mutation('trip.update', create.tripId, first.data.version);
  update.data.name = 'Updated plan';
  const updated = await request('/api/sync/push', a.accessToken, update);
  assert.equal(updated.status, 200);
  const stale = mutation('trip.update', create.tripId, first.data.version);
  const conflict = await request('/api/sync/push', a.accessToken, stale);
  assert.equal(conflict.status, 409); assert.equal(conflict.data.current.name, 'Updated plan');
  assert.equal((await request('/api/sync/pull?after=' + first.data.version, a.accessToken)).data.items[0].name, 'Updated plan');
  pass('version conflict preserves latest server record and incremental pull');

  const invalid = mutation(); invalid.data.endDate = '2026-09-01';
  assert.equal((await request('/api/sync/push', a.accessToken, invalid)).status, 400);
  assert.equal((await client.query('SELECT COUNT(*) FROM "Receipts"')).rows[0].count, '2');
  pass('invalid dates commit neither trip nor receipt');

  const del = mutation('trip.delete', create.tripId, updated.data.version);
  const deleted = await request('/api/sync/push', a.accessToken, del);
  assert.equal(deleted.status, 200); assert.equal(deleted.data.deleted, true);
  assert.deepEqual(await request('/api/sync/push', a.accessToken, del), deleted);
  assert.equal((await request('/api/sync/push', a.accessToken, mutation('trip.update', create.tripId, deleted.data.version))).status, 409);
  assert.equal((await request('/api/sync/pull', a.accessToken)).data.items[0].deleted, true);
  pass('idempotent deletion, tombstone pull and no resurrection');

  await stopApi(); await startApi();
  assert.deepEqual(await request('/api/sync/push', a.accessToken, create), first);
  assert.equal((await request('/api/sync/pull', a.accessToken)).data.items[0].deleted, true);
  pass('API restart preserves users, data, token keys and receipts');

  for (let i = 0; i < 101; i++)
    assert.equal((await request('/api/sync/push', a.accessToken, mutation())).status, 200);
  const page1 = (await request('/api/sync/pull', a.accessToken)).data;
  const page2 = (await request('/api/sync/pull?after=' + page1.cursor, a.accessToken)).data;
  assert.equal(page1.items.length, 100); assert.equal(page1.hasMore, true);
  assert.equal(page2.items.length, 2); assert.equal(page2.hasMore, false);
  assert.equal(new Set([...page1.items, ...page2.items].map(x => x.id)).size, 102);
  pass('ordered cursor pagination has no duplicates or missing trips');

  assert.equal((await request('/auth/revoke-all', a.accessToken, {})).status, 204);
  assert.equal((await request('/auth/me', a.accessToken)).status, 401);
  assert.equal((await request('/auth/refresh', null, { refreshToken: a.refreshToken })).status, 401);
  pass('revoke-all rejects existing access and refresh tokens');
  console.log(`ALL ${checks} PostgreSQL/HTTP scenarios passed.`);
} finally {
  await stopApi(); await client?.end();
  if (started) await pg.stop();
  // Only remove this test's randomly created directory within the explicit test data root.
  if (resolve(folder).startsWith(resolve(dataRoot) + (process.platform === 'win32' ? '\\' : '/')))
    await rm(folder, { recursive: true, force: true });
}
