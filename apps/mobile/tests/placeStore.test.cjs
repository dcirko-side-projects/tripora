const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const account = require('../.test-build/core/accountStore.js');
const places = require('../.test-build/core/placeStore.js');
const { synchronizePlaces } = require('../.test-build/core/placeSync.js');
function connect(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  const db = { exec: s => sqlite.exec(s), run: (s, p) => sqlite.prepare(s).run(...p), all: (s, p = []) => sqlite.prepare(s).all(...p),
    transaction: action => { sqlite.exec('BEGIN IMMEDIATE'); try { action(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
  account.initAccountStore(db); return { db, close: () => sqlite.close() };
}
const trip = { id: 'trip', name: 'Synthetic trip', destination: 'Test island', startDate: '2026-11-01', endDate: '2026-11-03', createdAt: '2026-10-22', version: 1, deleted: false };
const data = { category: 'food', name: 'Synthetic cafe', address: 'Test street 1', notes: 'Test note', link: 'https://example.test/cafe', visited: false };
const remote = (id, version = 2, changes = {}) => ({ ...data, id, tripId: 'trip', createdAt: '2026-10-22', version, deleted: false, ...changes });
const location = { latitude: 45.81, longitude: 15.98, displayName: 'Synthetic cafe, Test island', provider: 'osm', providerId: 'N123' };
function seed(db) { account.applyPage(db, [trip], 1, [{ id: 'trip', role: 'member' }]); }

test('place coordinates survive offline reopen and immutable follow-up; invalid coordinates never enter the queue', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-map-')); let c;
  try {
    const path = join(folder, 'account.sqlite'); c = connect(path); seed(c.db);
    places.savePlace(c.db, 'trip', { ...data, location }, randomUUID);
    const first = places.placeSnapshot(c.db).pending[0].operation;
    const moved = { ...location, longitude: 16.1 };
    places.savePlace(c.db, 'trip', { ...data, location: moved }, randomUUID, first.placeId);
    c.close(); c = connect(path);
    assert.deepEqual(places.placeSnapshot(c.db).pending[0].operation, first);
    assert.deepEqual(places.placeSnapshot(c.db).places[0].location, moved);
    places.acknowledgePlace(c.db, first.operationId, remote(first.placeId, 2, { location }));
    assert.deepEqual(places.placeSnapshot(c.db).pending[0].operation.data.location, moved);
    const followup = places.placeSnapshot(c.db).pending[0].operation;
    places.markPlaceError(c.db, followup.operationId, 'conflict', remote(first.placeId, 3, { location }));
    places.resolvePlaceConflict(c.db, followup.operationId, 'local', randomUUID);
    assert.deepEqual(places.placeSnapshot(c.db).pending[0].operation.data.location, moved);
    for (const changes of [{ latitude: NaN }, { latitude: 91 }, { longitude: Infinity }, { longitude: -181 }, { providerId: 'script' }])
      assert.throws(() => places.validatePlace({ ...data, location: { ...location, ...changes } }), /Položaj/);
    assert.equal(places.placeSnapshot(c.db).pending.length, 1);
  } finally { c?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('place validation accepts all three categories and rejects unsafe/invalid fields without writes', () => {
  const c = connect();
  try {
    seed(c.db);
    for (const category of ['place', 'food', 'nightlife']) places.savePlace(c.db, 'trip', { ...data, category }, randomUUID);
    assert.equal(places.placeSnapshot(c.db).places.length, 3);
    for (const changes of [{ category: 'other' }, { name: ' ' }, { name: 'x'.repeat(121) }, { link: 'javascript:alert(1)' }, { link: '/relative' }, { link: 'ftp://example.test' }, { notes: 'x'.repeat(2001) }, { visited: 'yes' }])
      assert.throws(() => places.savePlace(c.db, 'trip', { ...data, ...changes }, randomUUID));
    assert.equal(places.placeSnapshot(c.db).pending.length, 3);
    assert.equal(places.validatePlace({ ...data, name: ' Literal SQL; -- ', link: '' }).name, 'Literal SQL; --');
  } finally { c.close(); }
});

test('v1 upgrade preserves queued trips; offline places, later edits and immutable requests survive restart', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-places-')); let c;
  try {
    const path = join(folder, 'account.sqlite'); c = connect(path);
    account.saveAccountTrip(c.db, trip, randomUUID);
    const before = account.accountSnapshot(c.db);
    // Reconstruct the exact pre-places v1 schema, preserving a queued trip as an upgrade fixture.
    c.db.exec('DROP TABLE pending_entries; DROP TABLE account_entries; DROP TABLE entry_meta; DROP TABLE local_media; DROP TABLE pending_places; DROP TABLE account_places; DROP TABLE place_meta; PRAGMA user_version=1');
    account.initAccountStore(c.db); assert.deepEqual(account.accountSnapshot(c.db), before);
    const id = before.trips[0].id; places.savePlace(c.db, id, data, randomUUID);
    let p = places.placeSnapshot(c.db); const original = p.pending[0].operation;
    places.savePlace(c.db, id, { ...data, name: 'Offline revised', category: 'nightlife', visited: true }, randomUUID, p.places[0].id);
    c.close(); c = connect(path); p = places.placeSnapshot(c.db);
    assert.equal(p.places[0].name, 'Offline revised'); assert.equal(p.places[0].visited, true);
    assert.equal(p.places[0].category, 'nightlife'); assert.deepEqual(p.pending[0].operation, original); assert.ok(p.pending[0].followupId);
    assert.deepEqual(account.accountSnapshot(c.db), before);
    account.initAccountStore(c.db); assert.equal(places.placeSnapshot(c.db).pending.length, 1);
  } finally { c?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('failed place outbox and acknowledgement writes roll back local state', () => {
  const c = connect();
  try {
    seed(c.db); c.db.exec("CREATE TRIGGER fail_place BEFORE INSERT ON pending_places BEGIN SELECT RAISE(ABORT, 'disk'); END;");
    assert.throws(() => places.savePlace(c.db, 'trip', data, randomUUID), /disk/);
    assert.equal(places.placeSnapshot(c.db).places.length, 0);
    c.db.exec('DROP TRIGGER fail_place'); places.savePlace(c.db, 'trip', data, randomUUID);
    const state = places.placeSnapshot(c.db); const op = state.pending[0].operation;
    assert.throws(() => places.acknowledgePlace(c.db, op.operationId, remote('wrong')), /ne pripada/);
    assert.deepEqual(places.placeSnapshot(c.db), state);
    c.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON pending_places BEGIN SELECT RAISE(ABORT, 'disk'); END;");
    assert.throws(() => places.acknowledgePlace(c.db, op.operationId, remote(op.placeId)), /disk/);
    assert.deepEqual(places.placeSnapshot(c.db), state);
  } finally { c.close(); }
});

test('lost acknowledgement retries original body then drains latest offline draft, without duplicate records', async () => {
  const c = connect();
  try {
    seed(c.db); places.savePlace(c.db, 'trip', data, randomUUID);
    const original = places.placeSnapshot(c.db).pending[0].operation;
    const receipts = new Map(); let current; let version = 1; let lose = true; const requests = [];
    const api = { async request(path, body) {
      await new Promise(r => setImmediate(r));
      if (path.endsWith('/push')) {
        requests.push(structuredClone(body));
        if (!receipts.has(body.operationId)) {
          current = remote(body.placeId, ++version, { ...body.data, deleted: body.kind === 'place.delete' });
          receipts.set(body.operationId, structuredClone(current));
        }
        if (lose) { lose = false; throw new Error('lost acknowledgement'); }
        return receipts.get(body.operationId);
      }
      return { items: current ? [current] : [], cursor: version, hasMore: false };
    } };
    await assert.rejects(synchronizePlaces(c.db, api), /lost acknowledgement/);
    places.savePlace(c.db, 'trip', { ...data, name: 'Latest offline', visited: true, category: 'nightlife' }, randomUUID, original.placeId);
    const one = synchronizePlaces(c.db, api); assert.equal(one, synchronizePlaces(c.db, api)); await one;
    const state = places.placeSnapshot(c.db);
    assert.equal(receipts.size, 2); assert.deepEqual(requests[0], requests[1]); assert.deepEqual(requests[1], original);
    assert.equal(requests[2].baseVersion, 2); assert.equal(requests[2].data.name, 'Latest offline');
    assert.equal(state.pending.length, 0); assert.equal(state.places.length, 1); assert.equal(state.places[0].visited, true);
  } finally { c.close(); }
});

test('offline create followed by delete keeps first request immutable and queues a versioned deletion', () => {
  const c = connect();
  try {
    seed(c.db); places.savePlace(c.db, 'trip', data, randomUUID);
    const first = places.placeSnapshot(c.db).pending[0].operation;
    places.deletePlace(c.db, first.placeId, randomUUID);
    assert.deepEqual(places.placeSnapshot(c.db).pending[0].operation, first);
    places.acknowledgePlace(c.db, first.operationId, remote(first.placeId));
    const next = places.placeSnapshot(c.db).pending[0].operation;
    assert.equal(next.kind, 'place.delete'); assert.equal(next.baseVersion, 2); assert.equal(next.data, null);
    places.acknowledgePlace(c.db, next.operationId, remote(next.placeId, 3, { deleted: true }));
    assert.equal(places.placeSnapshot(c.db).pending.length, 0); assert.equal(places.placeSnapshot(c.db).places[0].deleted, true);
    assert.throws(() => places.savePlace(c.db, 'trip', data, randomUUID, first.placeId), /nije dostupno/);
  } finally { c.close(); }
});

test('dirty pull preserves newest local draft; explicit resolution keeps all fields and rejects resurrection', () => {
  const c = connect();
  try {
    seed(c.db); places.applyPlacePage(c.db, [remote('place')], 2);
    places.savePlace(c.db, 'trip', { ...data, name: 'First local' }, randomUUID, 'place');
    places.savePlace(c.db, 'trip', { ...data, name: 'Latest local', notes: 'Newest note', visited: true }, randomUUID, 'place');
    places.applyPlacePage(c.db, [remote('place', 3, { name: 'Server' })], 3);
    let state = places.placeSnapshot(c.db); assert.equal(state.places[0].name, 'Latest local'); assert.equal(state.pending[0].conflict.name, 'Server');
    const oldId = state.pending[0].operation.operationId;
    places.resolvePlaceConflict(c.db, oldId, 'local', randomUUID); state = places.placeSnapshot(c.db);
    assert.notEqual(state.pending[0].operation.operationId, oldId); assert.equal(state.pending[0].operation.baseVersion, 3);
    assert.equal(state.pending[0].operation.data.notes, 'Newest note'); assert.equal(state.pending[0].operation.data.visited, true);
    places.applyPlacePage(c.db, [remote('place', 4, { deleted: true })], 4);
    const id = places.placeSnapshot(c.db).pending[0].operation.operationId;
    assert.throws(() => places.resolvePlaceConflict(c.db, id, 'local', randomUUID), /obrisano/);
    places.resolvePlaceConflict(c.db, id, 'server', randomUUID);
    assert.equal(places.placeSnapshot(c.db).places[0].deleted, true); assert.equal(places.placeSnapshot(c.db).pending.length, 0);
  } finally { c.close(); }
});

test('removed membership pauses place upload across restart and never discards queued work', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-removed-place-')); let c;
  try {
    const path = join(folder, 'a.sqlite'); c = connect(path); seed(c.db);
    places.savePlace(c.db, 'trip', data, randomUUID); const original = places.placeSnapshot(c.db).pending[0].operation;
    account.applyPage(c.db, [], 1, []); c.close(); c = connect(path);
    let pushes = 0; await synchronizePlaces(c.db, { async request(path) { if (path.endsWith('/push')) pushes++; return { items: [], cursor: 0, hasMore: false }; } });
    assert.equal(pushes, 0); const state = places.placeSnapshot(c.db);
    assert.deepEqual(state.pending[0].operation, original); assert.equal(state.pending[0].error, places.PLACE_ACCESS_REMOVED);
    assert.throws(() => places.savePlace(c.db, 'trip', data, randomUUID), /pristup/);
    assert.throws(() => places.deletePlace(c.db, original.placeId, randomUUID), /pristup/);
    account.applyPage(c.db, [{ ...trip, version: 2 }], 2, [{ id: 'trip', role: 'member' }]);
    c.db.transaction(() => places.refreshPlaceAccess(c.db)); assert.equal(places.placeSnapshot(c.db).pending[0].error, null);
  } finally { c?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('place pages/cursor roll back atomically; parent deletion prevents edits but permits accepting its tombstone', () => {
  const c = connect();
  try {
    seed(c.db); places.applyPlacePage(c.db, [remote('place')], 2);
    const before = places.placeSnapshot(c.db);
    c.db.exec("CREATE TRIGGER fail_page BEFORE UPDATE ON place_meta BEGIN SELECT RAISE(ABORT, 'disk'); END;");
    assert.throws(() => places.applyPlacePage(c.db, [remote('new', 3)], 3), /disk/);
    assert.deepEqual(places.placeSnapshot(c.db), before); c.db.exec('DROP TRIGGER fail_page');
    assert.throws(() => places.applyPlacePage(c.db, [remote('foreign', 3, { tripId: 'missing' })], 3), /Putovanje/);
    places.savePlace(c.db, 'trip', { ...data, name: 'Pending' }, randomUUID, 'place');
    account.applyPage(c.db, [{ ...trip, version: 4, deleted: true }], 4, [{ id: 'trip', role: 'member' }]);
    places.applyPlacePage(c.db, [remote('place', 3, { deleted: true })], 3);
    const op = places.placeSnapshot(c.db).pending[0].operation;
    assert.throws(() => places.resolvePlaceConflict(c.db, op.operationId, 'local', randomUUID), /obrisano/);
    places.resolvePlaceConflict(c.db, op.operationId, 'server', randomUUID);
    assert.equal(places.placeSnapshot(c.db).pending.length, 0);
  } finally { c.close(); }
});

test('offline preparation is persisted only after complete trip and place downloads; interrupted pull resumes', async () => {
  const { synchronizeAccount } = require('../.test-build/core/accountSync.js');
  const folder = mkdtempSync(join(tmpdir(), 'tripora-prepared-')); let c;
  try {
    const path = join(folder, 'account.sqlite'); c = connect(path); seed(c.db); let fail = true;
    const api = { async request(path) {
      if (path.startsWith('/api/sync/pull')) return { items: [trip], cursor: 1, hasMore: false, access: [{ id: 'trip', role: 'member' }] };
      if (path.startsWith('/api/entries/pull')) return { items: [], cursor: 0, hasMore: false };
      if (path === '/api/places/pull?after=0') return { items: [remote('one')], cursor: 2, hasMore: true };
      if (fail) { fail = false; throw new Error('interrupted download'); }
      return { items: [remote('two', 3)], cursor: 3, hasMore: false };
    } };
    await assert.rejects(synchronizeAccount(c.db, api), /interrupted download/);
    assert.equal(account.accountSnapshot(c.db).trips[0].offlinePreparedAt, undefined);
    assert.equal(places.placeSnapshot(c.db).cursor, 2);
    await synchronizeAccount(c.db, api);
    const prepared = account.accountSnapshot(c.db).trips[0].offlinePreparedAt; assert.ok(prepared);
    c.close(); c = connect(path);
    assert.equal(account.accountSnapshot(c.db).trips[0].offlinePreparedAt, prepared);
    assert.equal(places.placeSnapshot(c.db).places.length, 2);
    places.savePlace(c.db, 'trip', { ...data, name: 'Still editable offline' }, randomUUID, 'one');
    assert.equal(places.placeSnapshot(c.db).pending.length, 1);
  } finally { c?.close(); rmSync(folder, { recursive: true, force: true }); }
});
