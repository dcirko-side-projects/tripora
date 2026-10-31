const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, createHash } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const store = require('../.test-build/core/accountStore.js');
const { synchronize, ApiError } = require('../.test-build/core/sync.js');
const { SessionClient } = require('../.test-build/core/sessionClient.js');
function connect(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  const db = {
    exec: sql => sqlite.exec(sql), run: (sql, args) => sqlite.prepare(sql).run(...args),
    all: (sql, args = []) => sqlite.prepare(sql).all(...args),
    transaction: action => { sqlite.exec('BEGIN IMMEDIATE'); try { action(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
  store.initAccountStore(db);
  return { db, close: () => sqlite.close() };
}
const input = { name: 'Synthetic trip', destination: 'Test island', startDate: '2026-11-01', endDate: '2026-11-03' };
const remote = (id, version = 1, data = {}) => ({ ...input, id, version, deleted: false, createdAt: '2026-10-21T00:00:00Z', ...data });
const hash = async value => createHash('sha256').update(value).digest('hex');
function storage() { return { value: null, async read() { return this.value; }, async write(v) { this.value = v; }, async clear() { this.value = null; } }; }
function response(data, status = 200) { return new Response(data === null ? null : JSON.stringify(data), { status }); }
function authServer() {
  const calls = [];
  const send = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/auth/me')) return response({ id: 'user-a', email: 'a@example.test' });
    return response({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 });
  };
  return { send, calls };
}

test('account store survives restart, preserves immutable outbox and isolates another account', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-account-'));
  let a; let b;
  try {
    const path = join(folder, 'a.sqlite'); a = connect(path);
    store.saveAccountTrip(a.db, input, randomUUID);
    const first = store.accountSnapshot(a.db);
    a.close(); a = connect(path); b = connect(join(folder, 'b.sqlite'));
    assert.deepEqual(store.accountSnapshot(a.db), first);
    assert.equal(store.accountSnapshot(b.db).trips.length, 0);
    assert.throws(() => store.saveAccountTrip(a.db, input, randomUUID, first.trips[0].id), /Prvo/);
    assert.throws(() => store.deleteAccountTrip(a.db, first.trips[0].id, randomUUID), /Prvo/);
    assert.deepEqual(store.accountSnapshot(a.db), first);
  } finally { a?.close(); b?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('account outbox failure rolls back local data and future migration keeps pending work', () => {
  const c = connect();
  try {
    c.db.exec("CREATE TRIGGER fail BEFORE INSERT ON pending_mutations BEGIN SELECT RAISE(ABORT, 'disk'); END;");
    assert.throws(() => store.saveAccountTrip(c.db, input, randomUUID), /disk/);
    assert.equal(store.accountSnapshot(c.db).trips.length, 0);
    c.db.exec('DROP TRIGGER fail'); store.saveAccountTrip(c.db, input, randomUUID);
    store.initAccountStore(c.db); assert.equal(store.accountSnapshot(c.db).pending.length, 1);
    c.db.exec('PRAGMA user_version = 4'); assert.throws(() => store.initAccountStore(c.db), /noviju/);
    assert.equal(store.accountSnapshot(c.db).pending.length, 1);
  } finally { c.close(); }
});

test('lost acknowledgement retries exact operation and overlapping sync shares one run', async () => {
  const c = connect();
  try {
    store.saveAccountTrip(c.db, input, randomUUID);
    const op = store.accountSnapshot(c.db).pending[0].operation;
    let pushes = 0; let lost = true;
    const api = { async request(path, body) {
      await new Promise(resolve => setImmediate(resolve));
      if (path.endsWith('/push')) {
        pushes++; assert.deepEqual(body, op);
        if (lost) { lost = false; throw new Error('lost ack'); }
        return remote(op.tripId);
      }
      return { items: [remote(op.tripId)], cursor: 1, hasMore: false };
    } };
    await assert.rejects(synchronize(c.db, api), /lost ack/);
    assert.deepEqual(store.accountSnapshot(c.db).pending[0].operation, op);
    const p1 = synchronize(c.db, api); const p2 = synchronize(c.db, api);
    assert.equal(p1, p2); await Promise.all([p1, p2]);
    assert.equal(pushes, 2); assert.equal(store.accountSnapshot(c.db).pending.length, 0);
    assert.equal(store.accountSnapshot(c.db).trips.length, 1);
  } finally { c.close(); }
});

test('dirty pull and conflicts survive restart; deliberate local resolution uses new ID and latest version', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-conflict-')); let c;
  try {
    const path = join(folder, 'a.sqlite'); c = connect(path);
    store.applyPage(c.db, [remote('trip')], 1);
    store.saveAccountTrip(c.db, { ...input, name: 'Local' }, randomUUID, 'trip');
    const op = store.accountSnapshot(c.db).pending[0].operation;
    store.applyPage(c.db, [remote('trip', 2, { name: 'Server' })], 2);
    c.close(); c = connect(path);
    let state = store.accountSnapshot(c.db);
    assert.equal(state.trips[0].name, 'Local'); assert.equal(state.pending[0].conflict.name, 'Server');
    store.resolveConflict(c.db, op.operationId, 'local', randomUUID);
    state = store.accountSnapshot(c.db);
    assert.notEqual(state.pending[0].operation.operationId, op.operationId);
    assert.equal(state.pending[0].operation.baseVersion, 2);
    assert.equal(state.pending[0].operation.data.name, 'Local');
    assert.equal(state.pending[0].conflict, null);
  } finally { c?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('server tombstone cannot be resurrected; explicit server choice removes pending deletion', () => {
  const c = connect();
  try {
    store.applyPage(c.db, [remote('trip')], 1); store.deleteAccountTrip(c.db, 'trip', randomUUID);
    assert.equal(store.accountSnapshot(c.db).trips.length, 0);
    store.applyPage(c.db, [remote('trip', 2, { deleted: true })], 2);
    const op = store.accountSnapshot(c.db).pending[0].operation;
    assert.throws(() => store.resolveConflict(c.db, op.operationId, 'local', randomUUID), /obrisano/);
    assert.equal(store.accountSnapshot(c.db).pending.length, 1);
    store.resolveConflict(c.db, op.operationId, 'server', randomUUID);
    assert.equal(store.accountSnapshot(c.db).pending.length, 0);
    assert.equal(store.accountSnapshot(c.db).trips.length, 0);
    assert.throws(() => store.saveAccountTrip(c.db, input, randomUUID, 'trip'), /Obrisano/);
  } finally { c.close(); }
});

test('pull page and cursor are atomic; invalid acknowledgement does not discard pending work', () => {
  const c = connect();
  try {
    store.saveAccountTrip(c.db, input, randomUUID);
    const state = store.accountSnapshot(c.db);
    assert.throws(() => store.acknowledge(c.db, state.pending[0].operation.operationId, remote('wrong')), /Potvrda/);
    c.db.exec("CREATE TRIGGER fail BEFORE UPDATE ON sync_meta BEGIN SELECT RAISE(ABORT, 'disk'); END;");
    assert.throws(() => store.applyPage(c.db, [remote('other')], 1), /disk/);
    assert.deepEqual(store.accountSnapshot(c.db), state);
    assert.throws(() => store.applyPage(c.db, [remote('other', 2)], 1), /Neispravna/);
  } finally { c.close(); }
});

test('authorization rejection remains visible, while 401 and network failure preserve exact mutation', async () => {
  for (const status of [401, 403, 404, 409, 500]) {
    const c = connect();
    try {
      store.saveAccountTrip(c.db, input, randomUUID); const original = store.accountSnapshot(c.db).pending[0].operation;
      const api = { async request(path) { if (path.endsWith('/push')) throw new ApiError(status); return { items: [], cursor: 0, hasMore: false }; } };
      if ([401, 500].includes(status)) await assert.rejects(synchronize(c.db, api), e => e.status === status);
      else { const result = await synchronize(c.db, api); assert.equal(result.errors, 1); }
      assert.deepEqual(store.accountSnapshot(c.db).pending[0].operation, original);
    } finally { c.close(); }
  }
});

test('pagination advances and stalled server is rejected without dropping pending data', async () => {
  const c = connect();
  try {
    let calls = 0;
    await synchronize(c.db, { async request(path) { calls++; return calls === 1 ? { items: [remote('one')], cursor: 1, hasMore: true } : { items: [remote('two', 2)], cursor: 2, hasMore: false }; } });
    assert.equal(store.accountSnapshot(c.db).trips.length, 2);
    await assert.rejects(synchronize(c.db, { async request() { return { items: [], cursor: 2, hasMore: true }; } }), /kursor/);
    assert.equal(store.accountSnapshot(c.db).cursor, 2);
  } finally { c.close(); }
});

test('session restores offline, scopes server/user, clears tokens on logout without touching account data', async () => {
  const disk = storage(); const server = authServer();
  const a = new SessionClient('https://one.test', disk, hash, server.send);
  const account = await a.signIn(' a@example.test ', 'Synthetic!123', false);
  const restored = new SessionClient('https://one.test', disk, hash, () => { throw new Error('offline'); });
  assert.deepEqual(await restored.restore(), account);
  assert.equal(await new SessionClient('https://two.test', disk, hash).restore(), null);
  assert.notEqual(await hash('https://one.test|user-b'), account.scope);
  const c = connect();
  try { store.saveAccountTrip(c.db, input, randomUUID); await a.signOut(); assert.equal(disk.value, null); assert.equal(store.accountSnapshot(c.db).pending.length, 1); }
  finally { c.close(); }
  await assert.rejects(a.request('/auth/me'), e => e.status === 401);
});

test('expired concurrent requests refresh once; 401 refresh failure retains offline session', async () => {
  const disk = storage(); let now = 0; const server = authServer();
  const a = new SessionClient('https://one.test', disk, hash, server.send, () => now);
  await a.signIn('a@example.test', 'Synthetic!123', false); now = 900000;
  await Promise.all([a.request('/auth/me'), a.request('/auth/me')]);
  assert.equal(server.calls.filter(c => c.url.endsWith('/auth/refresh')).length, 1);
  const b = new SessionClient('https://one.test', disk, hash, async () => response({}, 401), () => now + 900000);
  await b.restore(); const before = disk.value;
  await assert.rejects(b.request('/auth/me'), e => e.status === 401);
  assert.equal(disk.value, before); assert.ok(await b.restore());
});

test('logout during refresh never restores tokens', async () => {
  const disk = storage(); const server = authServer(); let now = 0; let release;
  const a = new SessionClient('https://one.test', disk, hash, async (url, opts) => {
    if (url.endsWith('/auth/refresh')) { await new Promise(r => { release = r; }); }
    return server.send(url, opts);
  }, () => now);
  await a.signIn('a@example.test', 'Synthetic!123', false); now = 900000;
  const request = a.request('/auth/me'); const rejected = assert.rejects(request, e => e.status === 401);
  const logout = a.signOut(); release(); await Promise.all([rejected, logout]);
  assert.equal(disk.value, null); assert.equal(await a.restore(), null);
});

test('corrupt storage, HTML errors and storage failures do not expose or fabricate a session', async () => {
  const disk = storage(); disk.value = 'null'; const server = authServer();
  const a = new SessionClient('https://one.test', disk, hash, server.send);
  await assert.rejects(a.restore(), /nije ispravna/); disk.value = '{'; await assert.rejects(a.restore(), /nije ispravna/);
  const b = new SessionClient('https://one.test', storage(), hash, async () => new Response('<html>error</html>', { status: 502 }));
  await assert.rejects(b.signIn('a@example.test', 'Synthetic!123', false), e => e.status === 502);
  const failing = { ...storage(), async write() { throw new Error('secure storage failed'); } };
  const c = new SessionClient('https://one.test', failing, hash, server.send);
  await assert.rejects(c.signIn('a@example.test', 'Synthetic!123', false), /secure storage/);
  await assert.rejects(c.request('/auth/me'), e => e.status === 401);
});

test('access removal survives restart, keeps queued work, blocks edits and pauses upload until regrant', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-access-')); let c;
  try {
    const path = join(folder, 'account.sqlite'); c = connect(path);
    store.applyPage(c.db, [remote('trip')], 1, [{ id: 'trip', role: 'owner' }]);
    store.saveAccountTrip(c.db, { ...input, name: 'Retained offline' }, randomUUID, 'trip');
    const op = store.accountSnapshot(c.db).pending[0].operation;
    store.applyPage(c.db, [], 1, []); c.close(); c = connect(path);
    let state = store.accountSnapshot(c.db);
    assert.equal(state.trips[0].accessRevoked, true); assert.equal(state.trips[0].name, 'Retained offline');
    assert.deepEqual(state.pending[0].operation, op); assert.match(state.pending[0].error, /Pristup/);
    assert.throws(() => store.saveAccountTrip(c.db, input, randomUUID, 'trip'));
    assert.throws(() => store.deleteAccountTrip(c.db, 'trip', randomUUID));
    let pushes = 0;
    await synchronize(c.db, { async request(path) { if (path.endsWith('/push')) pushes++; return { items: [], access: [], cursor: 1, hasMore: false }; } });
    assert.equal(pushes, 0);
    store.applyPage(c.db, [remote('trip', 2, { name: 'Updated server' })], 2, [{ id: 'trip', role: 'member' }]);
    state = store.accountSnapshot(c.db); assert.equal(state.trips[0].accessRevoked, false);
    assert.equal(state.trips[0].role, 'member'); assert.equal(state.pending[0].conflict.name, 'Updated server');
    assert.throws(() => store.resolveConflict(c.db, op.operationId, 'local', randomUUID), /ovlast/);
    store.resolveConflict(c.db, op.operationId, 'server', randomUUID);
    assert.throws(() => store.saveAccountTrip(c.db, input, randomUUID, 'trip'), /ovlast/);
    assert.throws(() => store.deleteAccountTrip(c.db, 'trip', randomUUID), /ovlast/);
  } finally { c?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('access snapshot does not revoke offline creates and access/cursor application rolls back together', () => {
  const c = connect();
  try {
    store.saveAccountTrip(c.db, input, randomUUID);
    store.applyPage(c.db, [remote('shared')], 1, [{ id: 'shared', role: 'member' }]);
    assert.equal(store.accountSnapshot(c.db).trips.find(t => t.id !== 'shared').accessRevoked, undefined);
    const before = store.accountSnapshot(c.db);
    c.db.exec("CREATE TRIGGER fail_access BEFORE UPDATE ON sync_meta BEGIN SELECT RAISE(ABORT, 'disk'); END;");
    assert.throws(() => store.applyPage(c.db, [], 2, []), /disk/);
    assert.deepEqual(store.accountSnapshot(c.db), before);
  } finally { c.close(); }
});



test('logout during an in-flight secure-storage sign-in write cannot restore a session', async () => {
  const disk=storage();const server=authServer();let release;let entered;
  const started=new Promise(r=>{entered=r;});
  const originalWrite=disk.write.bind(disk);
  disk.write=async value=>{entered();await new Promise(r=>{release=r;});await originalWrite(value);};
  const session=new SessionClient('https://one.test',disk,hash,server.send);
  const signin=session.signIn('a@example.test','Synthetic!123',false);
  const rejected=assert.rejects(signin,e=>e.status===401);
  await started;const logout=session.signOut();release();await Promise.all([rejected,logout]);
  assert.equal(disk.value,null);assert.equal(await session.restore(),null);
  await assert.rejects(session.request('/auth/me'),e=>e.status===401);
});
