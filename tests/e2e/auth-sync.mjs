import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { verifyPlaces } from './places-scenarios.mjs';
import { verifyWork } from './work-scenarios.mjs';
import { verifyAccounts } from './accounts-scenarios.mjs';
import { verifyMaps } from './map-scenarios.mjs';
import { verifyCloudinary } from './cloudinary-scenarios.mjs';
import { backupLocal, restoreLocal } from './local-backup.mjs';
import { stopPostgres } from './postgres-stop.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { SessionClient } = require('../../apps/mobile/.test-build/core/sessionClient.js');
const { synchronize } = require('../../apps/mobile/.test-build/core/sync.js');
const store = require('../../apps/mobile/.test-build/core/accountStore.js');
const root = fileURLToPath(new URL('../../', import.meta.url));
const dataRoot = join(root, 'local-data');
await mkdir(dataRoot, { recursive: true });
const folder = await mkdtemp(join(dataRoot, 'pg-test-'));
const port = await new Promise((resolvePort, reject) => {
  const s = createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolvePort(port)); });
});
const password = randomBytes(24).toString('hex');
let pg = new EmbeddedPostgres({
  databaseDir: join(folder, 'postgres'), user: 'tripora_test', password, port,
  authMethod: 'scram-sha-256', persistent: true,
  postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {},
});
const env = {
  ...process.env, ASPNETCORE_ENVIRONMENT: 'Testing', ASPNETCORE_URLS: 'http://127.0.0.1:0',
  Tripora__HealthOnly: 'false',
  Tripora__MediaRoot: join(folder, 'media'), Tripora__KeyRoot: join(folder, 'keys'),
  ConnectionStrings__Tripora: `Host=127.0.0.1;Port=${port};Database=tripora_test;Username=tripora_test;Password=${password}`,
};
const dll = 'services/api/bin/Release/net10.0/Tripora.Api.dll';
let server; let base; let client; let started = false;
let databaseDir = join(folder, 'postgres');
const watchdog = setTimeout(() => { console.error('Integration suite timed out before completion.'); process.exit(1); }, 180000);
async function stopApi() {
  if (server && server.exitCode === null && server.signalCode === null) {
    await new Promise(resolveExit => { server.once('exit', resolveExit); server.kill(); });
  }
  server = undefined;
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
let workRestart;
function pass(name) { checks++; console.log('PASS: ' + name); }
try {
  await writeFile(join(folder, 'settings.json'), JSON.stringify({ password }), { mode: 0o600 });
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
  assert.equal((await fetch(base + '/auth/me', { headers: { Authorization: 'Bearer ' + a.accessToken } })).headers.get('cache-control'), 'private, no-store');
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

  // Exercise the actual mobile core against HTTP/PostgreSQL, not a second protocol implementation.
  const connections = [];
  function local(path) {
    const sqlite = new DatabaseSync(path); connections.push(sqlite);
    const db = {
      exec: sql => sqlite.exec(sql), run: (sql, args) => sqlite.prepare(sql).run(...args),
      all: (sql, args = []) => sqlite.prepare(sql).all(...args),
      transaction: action => { sqlite.exec('BEGIN IMMEDIATE'); try { action(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
    };
    store.initAccountStore(db); return db;
  }
  const sessionDisk = { value: null, async read() { return this.value; }, async write(v) { this.value = v; }, async clear() { this.value = null; } };
  const scopeFor = async value => createHash('sha256').update(value).digest('hex');
  const mobile = new SessionClient(base, sessionDisk, scopeFor);
  const other = new SessionClient(base, { ...sessionDisk, value: null }, scopeFor);
  try {
    const account = await mobile.signIn(aEmail, passwordA, false);
    const otherAccount = await other.signIn(bEmail, passwordB, false);
    assert.notEqual(account.scope, otherAccount.scope);
    const localPath = join(folder, 'mobile-a.sqlite');
    let deviceA = local(localPath);
    const input = { name: 'Mobile offline', destination: 'Synthetic island', startDate: '2026-11-01', endDate: '2026-11-03' };
    store.saveAccountTrip(deviceA, input, randomUUID);
    const original = store.accountSnapshot(deviceA).pending[0].operation;
    connections.pop().close(); deviceA = local(localPath);
    const deviceB = local(join(folder, 'mobile-b.sqlite'));
    let lost = true;
    const flaky = { async request(path, body) {
      const result = await mobile.request(path, body);
      if (path.endsWith('/push') && lost) { lost = false; throw new Error('Simulated lost acknowledgement'); }
      return result;
    } };
    await assert.rejects(synchronize(deviceA, flaky), /lost acknowledgement/);
    assert.deepEqual(store.accountSnapshot(deviceA).pending[0].operation, original);
    await Promise.all([synchronize(deviceA, mobile), synchronize(deviceA, mobile)]);
    assert.equal(store.accountSnapshot(deviceA).pending.length, 0);
    assert.equal((await client.query('SELECT COUNT(*) FROM "Trips" WHERE "Id" = $1', [original.tripId])).rows[0].count, '1');
    await synchronize(deviceB, mobile);
    store.saveAccountTrip(deviceA, { ...input, name: 'Device A' }, randomUUID, original.tripId);
    store.saveAccountTrip(deviceB, { ...input, name: 'Device B' }, randomUUID, original.tripId);
    await synchronize(deviceA, mobile); await synchronize(deviceB, mobile);
    let pending = store.accountSnapshot(deviceB).pending[0];
    assert.equal(pending.conflict.name, 'Device A');
    assert.equal(store.accountSnapshot(deviceB).trips.find(t => t.id === original.tripId).name, 'Device B');
    store.resolveConflict(deviceB, pending.operation.operationId, 'local', randomUUID);
    await synchronize(deviceB, mobile); await synchronize(deviceA, mobile);
    assert.equal(store.accountSnapshot(deviceA).trips.find(t => t.id === original.tripId).name, 'Device B');
    store.deleteAccountTrip(deviceA, original.tripId, randomUUID);
    await synchronize(deviceA, mobile); await synchronize(deviceB, mobile);
    assert.ok(!store.accountSnapshot(deviceB).trips.some(t => t.id === original.tripId));
    const isolated = local(join(folder, 'other-account.sqlite'));
    await synchronize(isolated, other); assert.equal(store.accountSnapshot(isolated).trips.length, 0);
    store.saveAccountTrip(deviceA, input, randomUUID); const unsent = store.accountSnapshot(deviceA).pending;
    await mobile.signOut(); assert.equal(sessionDisk.value, null);
    assert.deepEqual(store.accountSnapshot(deviceA).pending, unsent);
    await mobile.signIn(aEmail, passwordA, false); await synchronize(deviceA, mobile);
    assert.equal(store.accountSnapshot(deviceA).pending.length, 0);
    pass('mobile core HTTP: restart, lost ack, concurrent sync, two-device conflict, resolution, deletion, account isolation and logout/relogin');

    const shared = mutation();
    assert.equal((await request('/api/sync/push', a.accessToken, shared)).status, 200);
    // Move the recipient cursor past the trip before accepting: acceptance must bump its version.
    await other.request('/api/sync/push', mutation()); await synchronize(isolated, other);
    const oldCursor = store.accountSnapshot(isolated).cursor;
    const path = `/api/trips/${shared.tripId}`;
    const invite = await mobile.request(path + '/invitations', { email: bEmail });
    assert.equal(invite.token.length, 64);
    const stored = (await client.query('SELECT "TokenHash" FROM "TripInvitations" WHERE "Id" = $1', [invite.id])).rows[0].TokenHash;
    assert.notEqual(stored, invite.token);
    assert.equal((await request('/api/invitations/accept', a.accessToken, { token: invite.token })).status, 404);
    assert.equal((await request(path + '/members', b.accessToken)).status, 404);
    await other.request('/api/invitations/accept', { token: invite.token });
    await other.request('/api/invitations/accept', { token: invite.token }); // lost-response retry is safe
    await synchronize(isolated, other);
    let sharedLocal = store.accountSnapshot(isolated).trips.find(t => t.id === shared.tripId);
    assert.ok(sharedLocal.version > oldCursor); assert.equal(sharedLocal.role, 'member');
    assert.equal((await mobile.request(path + '/members')).members.length, 1);
    assert.throws(() => store.saveAccountTrip(isolated, input, randomUUID, shared.tripId), /ovlast/);
    assert.equal((await request('/api/sync/push', b.accessToken, mutation('trip.delete', shared.tripId, sharedLocal.version))).status, 403);
    assert.equal((await request(path + '/invitations', b.accessToken, { email: aEmail })).status, 404);
    assert.equal((await request(path + '/members/' + account.id + '/remove', b.accessToken, {})).status, 404);
    pass('recipient-bound hashed invitation, idempotent acceptance past cursor and read-only member enforcement');

    const ownerUpdate = mutation('trip.update', shared.tripId, sharedLocal.version); ownerUpdate.data.name = 'Shared revised';
    assert.equal((await request('/api/sync/push', a.accessToken, ownerUpdate)).status, 200);
    await synchronize(isolated, other);
    sharedLocal = store.accountSnapshot(isolated).trips.find(t => t.id === shared.tripId);
    assert.equal(sharedLocal.name, 'Shared revised');
    // Simulate an old/tampered client with queued work: removing membership must never mark it synced.
    const rejected = mutation('trip.update', shared.tripId, sharedLocal.version);
    isolated.run('INSERT INTO pending_mutations (operation_id, trip_id, body) VALUES (?, ?, ?)', [rejected.operationId, shared.tripId, JSON.stringify(rejected)]);
    await mobile.request(path + '/members/' + otherAccount.id + '/remove', {});
    await synchronize(isolated, other);
    const retained = store.accountSnapshot(isolated);
    assert.equal(retained.trips.find(t => t.id === shared.tripId).accessRevoked, true);
    assert.deepEqual(retained.pending[0].operation, rejected); assert.match(retained.pending[0].error, /Pristup/);
    assert.equal((await request('/api/sync/push', b.accessToken, rejected)).status, 404);
    assert.equal((await request('/api/invitations/accept', b.accessToken, { token: invite.token })).status, 404);
    assert.ok(!(await request('/api/sync/pull', b.accessToken)).data.items.some(t => t.id === shared.tripId));
    pass('owner update reaches member; removal rejects queued writes and old invite, preserving visible local work');

    const revoked = await mobile.request(path + '/invitations', { email: bEmail });
    await mobile.request(path + '/invitations/' + revoked.id + '/revoke', {});
    assert.equal((await request('/api/invitations/accept', b.accessToken, { token: revoked.token })).status, 404);
    const expiredInvite = await mobile.request(path + '/invitations', { email: bEmail });
    await client.query('UPDATE "TripInvitations" SET "ExpiresAt" = NOW() - INTERVAL \'1 second\' WHERE "Id" = $1', [expiredInvite.id]);
    assert.equal((await request('/api/invitations/accept', b.accessToken, { token: expiredInvite.token })).status, 404);
    const rejoin = await mobile.request(path + '/invitations', { email: bEmail });
    const superseding = await mobile.request(path + '/invitations', { email: bEmail });
    assert.equal((await request('/api/invitations/accept', b.accessToken, { token: rejoin.token })).status, 404);
    await other.request('/api/invitations/accept', { token: superseding.token }); await synchronize(isolated, other);
    assert.equal(store.accountSnapshot(isolated).trips.find(t => t.id === shared.tripId).accessRevoked, false);
    pass('revoked, expired and superseded invitations rejected; deliberate new invitation restores membership');

    const latest = (await request('/api/sync/pull', b.accessToken)).data.items.find(t => t.id === shared.tripId);
    const deleteShared = mutation('trip.delete', shared.tripId, latest.version);
    assert.equal((await request('/api/sync/push', a.accessToken, deleteShared)).status, 200);
    await synchronize(isolated, other);
    assert.ok(store.accountSnapshot(isolated).pending[0].conflict.deleted);
    store.resolveConflict(isolated, rejected.operationId, 'server', randomUUID);
    assert.ok(!store.accountSnapshot(isolated).trips.some(t => t.id === shared.tripId));
    pass('shared deletion reaches member and cannot resurrect through queued client mutation');

    const raceTrip = mutation(); await mobile.request('/api/sync/push', raceTrip);
    const racePath = `/api/trips/${raceTrip.tripId}`;
    const raceInvite = await mobile.request(racePath + '/invitations', { email: bEmail });
    const [acceptRace, removeRace] = await Promise.all([
      request('/api/invitations/accept', b.accessToken, { token: raceInvite.token }),
      request(racePath + '/members/' + otherAccount.id + '/remove', a.accessToken, {}),
    ]);
    assert.ok([200, 404].includes(acceptRace.status)); assert.equal(removeRace.status, 204);
    assert.ok(!(await request('/api/sync/pull', b.accessToken)).data.access.some(t => t.id === raceTrip.tripId));
    assert.equal((await request('/api/invitations/accept', b.accessToken, { token: raceInvite.token })).status, 404);
    pass('concurrent invitation acceptance/removal serializes without granting revoked access');
    await verifyPlaces({ mobile, other, local, request, client, tokenA: a.accessToken, tokenB: b.accessToken,
      emailB: bEmail, memberId: otherAccount.id, folder, pass });
    workRestart = await verifyWork({ mobile, other, local, request, client, tokenA: a.accessToken, tokenB: b.accessToken,
      emailB: bEmail, ownerActor: { id: account.id, email: aEmail }, memberActor: { id: otherAccount.id, email: bEmail }, folder, pass });
  } finally { for (const connection of connections) connection.close(); }

  await verifyMaps({ request, startApi, stopApi, env, client, tokenA: a.accessToken, tokenB: b.accessToken, pass });
  await verifyCloudinary({ request, startApi, stopApi, env, tokenA: a.accessToken, tokenB: b.accessToken, pass });
  const restartTrip = mutation(); await request('/api/sync/push', a.accessToken, restartTrip);
  const restartInvite = (await request(`/api/trips/${restartTrip.tripId}/invitations`, a.accessToken, { email: bEmail })).data;
  await stopApi(); await startApi();
  assert.equal((await request('/api/invitations/accept', b.accessToken, { token: restartInvite.token })).status, 200);
  assert.ok((await request('/api/sync/pull', b.accessToken)).data.access.some(t => t.id === restartTrip.tripId));
  pass('API restart preserves invitations and accepted membership');
  let placeCursor = 0; const persistedPlaces = [];
  while (true) {
    const page = (await request('/api/places/pull?after=' + placeCursor, a.accessToken)).data;
    persistedPlaces.push(...page.items); placeCursor = page.cursor;
    if (!page.hasMore) break;
  }
  assert.ok(persistedPlaces.length >= 104);
  assert.ok(persistedPlaces.every(p => p.deleted));
  assert.equal(new Set(persistedPlaces.map(p => p.category)).size, 3);
  pass('API restart preserves all place categories, deletion markers and paginated cursor data');
  const restartedPhoto = await request('/api/media/' + workRestart.mediaId, a.accessToken);
  assert.equal(restartedPhoto.status, 200); assert.equal(restartedPhoto.data.sha256, workRestart.sha256);
  assert.equal((await request('/api/media/' + workRestart.mediaId, b.accessToken)).status, 404);
  await assert.rejects(backupLocal(folder, folder + '-live'), /Stop the development stack/);
  const clockBefore = (await client.query('SELECT "Value" FROM "SyncClocks"')).rows[0].Value;
  await stopApi(); await client.end(); client = null; await stopPostgres(pg, databaseDir); started = false;
  await backupLocal(folder, folder + '-backup');
  await restoreLocal(folder + '-backup', folder + '-restored');
  await assert.rejects(restoreLocal(folder + '-backup', folder + '-restored'), /already exists/);
  pg = new EmbeddedPostgres({ databaseDir: join(folder + '-restored', 'postgres'), user: 'tripora_test', password, port,
    authMethod: 'scram-sha-256', persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  databaseDir = join(folder + '-restored', 'postgres');
  await pg.start(); started = true; client = pg.getPgClient('tripora_test'); await client.connect();
  env.Tripora__MediaRoot = join(folder + '-restored', 'media'); env.Tripora__KeyRoot = join(folder + '-restored', 'keys');
  await startApi();
  assert.equal((await client.query('SELECT "Value" FROM "SyncClocks"')).rows[0].Value, clockBefore);
  assert.equal((await request('/auth/me', a.accessToken)).status, 200);
  assert.equal((await request('/api/media/' + workRestart.mediaId, a.accessToken)).data.sha256, workRestart.sha256);
  assert.equal((await request('/api/media/' + workRestart.mediaId, b.accessToken)).status, 404);
  assert.equal((await request('/api/sync/push', a.accessToken, restartTrip)).status, 200);
  assert.ok((await request('/api/sync/pull', b.accessToken)).data.access.some(t => t.id === restartTrip.tripId));
  pass('cold backup/restore to new cluster preserves identity tokens/keys, receipts, clock, membership and private photo bytes; live backup and overwrite refused');
  assert.equal((await request('/api/entries/push', a.accessToken, { operationId: randomUUID(), entryId: workRestart.memoryId, tripId: workRestart.tripId, feature: 'memory', kind: 'delete', baseVersion: workRestart.version, data: null })).status, 200);
  await request('/api/media/cleanup', a.accessToken, {});
  assert.equal((await request('/api/media/' + workRestart.mediaId, a.accessToken)).status, 404);
  pass('API restart preserves private image bytes and memory ownership; confirmed deletion cleans the restarted asset');

  assert.equal((await request('/auth/revoke-all', a.accessToken, {})).status, 204);
  assert.equal((await request('/auth/me', a.accessToken)).status, 401);
  assert.equal((await request('/auth/refresh', null, { refreshToken: a.refreshToken })).status, 401);
  pass('revoke-all rejects existing access and refresh tokens');
  await verifyAccounts({ request, startApi, stopApi, env, client, folder, pass });
  console.log(`ALL ${checks} PostgreSQL/HTTP scenarios passed.`);
} finally {
  clearTimeout(watchdog);
  let cleanupPhase = 'API shutdown';
  const cleanupWatchdog = setTimeout(() => { console.error('Integration cleanup timed out: ' + cleanupPhase); process.exit(1); }, 90000);
  await stopApi(); cleanupPhase = 'PostgreSQL client shutdown'; await client?.end();
  cleanupPhase = 'PostgreSQL shutdown';
  if (started) await stopPostgres(pg, databaseDir);
  // Only remove this test's randomly created directory within the explicit test data root.
  for (const path of [folder, folder + '-backup', folder + '-restored'])
    if (resolve(path).startsWith(resolve(dataRoot) + (process.platform === 'win32' ? '\\' : '/'))) {
      cleanupPhase = 'temporary directory removal: ' + path;
      await rm(path, { recursive: true, force: true });
    }
  clearTimeout(cleanupWatchdog);
  console.log('Integration cleanup complete.');
}
