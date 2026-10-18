const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { migrate, createTrip, readSnapshot, validateTrip } = require('../.test-build/core/localStore.js');

function connect(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  const adapter = {
    exec: sql => sqlite.exec(sql),
    run: (sql, params) => sqlite.prepare(sql).run(...params),
    all: (sql, params = []) => sqlite.prepare(sql).all(...params),
    transaction: action => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { action(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { db: adapter, close: () => sqlite.close() };
}
const input = { name: ' Jesenski odmor ', destination: ' Krk ', startDate: '2026-10-01', endDate: '2026-10-07' };

test('trip and pending operation survive closing and reopening the database', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-test-'));
  let connection;
  try {
    const path = join(folder, 'offline.sqlite');
    connection = connect(path);
    migrate(connection.db);
    const saved = createTrip(connection.db, input, randomUUID);
    connection.close(); connection = connect(path);
    migrate(connection.db);
    const state = readSnapshot(connection.db);
    assert.equal(state.trips[0].id, saved.id);
    assert.equal(state.trips[0].name, 'Jesenski odmor');
    assert.equal(state.pendingCount, 1);
    const operation = connection.db.all('SELECT * FROM outbox')[0];
    assert.deepEqual(JSON.parse(operation.payload), saved);
  } finally { connection?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('failure writing the outbox rolls back the trip insertion', () => {
  const c = connect();
  try {
    migrate(c.db);
    c.db.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'disk simulation'); END;");
    assert.throws(() => createTrip(c.db, input, randomUUID), /disk simulation/);
    assert.equal(readSnapshot(c.db).trips.length, 0);
    assert.equal(readSnapshot(c.db).pendingCount, 0);
  } finally { c.close(); }
});

test('re-running migrations preserves queued work', () => {
  const c = connect();
  try {
    migrate(c.db); createTrip(c.db, input, randomUUID);
    migrate(c.db); migrate(c.db);
    assert.equal(readSnapshot(c.db).trips.length, 1);
    assert.equal(readSnapshot(c.db).pendingCount, 1);
  } finally { c.close(); }
});

test('future database schema is rejected without clearing data', () => {
  const c = connect();
  try {
    migrate(c.db); createTrip(c.db, input, randomUUID);
    c.db.exec('PRAGMA user_version = 2');
    assert.throws(() => migrate(c.db), /novija/);
    assert.equal(readSnapshot(c.db).pendingCount, 1);
  } finally { c.close(); }
});

test('invalid dates and reverse ranges do not create data', () => {
  const c = connect();
  try {
    migrate(c.db);
    for (const changes of [{ startDate: '2026-02-30' }, { endDate: '2026-09-30' }, { startDate: '01.10.2026' }, { name: ' ' }, { destination: 'x'.repeat(121) }]) {
      assert.throws(() => createTrip(c.db, { ...input, ...changes }, randomUUID));
    }
    assert.equal(readSnapshot(c.db).pendingCount, 0);
    assert.equal(readSnapshot(c.db).trips.length, 0);
    assert.doesNotThrow(() => validateTrip({ ...input, startDate: '2028-02-29', endDate: '2028-02-29' }));
  } finally { c.close(); }
});

test('SQL-looking names are saved literally through parameter binding', () => {
  const c = connect();
  try {
    migrate(c.db);
    const name = "Trip'); DROP TABLE trips; --";
    createTrip(c.db, { ...input, name }, randomUUID);
    assert.equal(readSnapshot(c.db).trips[0].name, name);
    assert.equal(readSnapshot(c.db).pendingCount, 1);
  } finally { c.close(); }
});

test('operation ID collision rolls back a second trip and retains the original', () => {
  const c = connect();
  try {
    migrate(c.db);
    const ids = ['trip-a', 'op-a', 'trip-b', 'op-a'];
    const nextId = () => ids.shift();
    createTrip(c.db, input, nextId);
    assert.throws(() => createTrip(c.db, input, nextId), /UNIQUE/);
    assert.equal(readSnapshot(c.db).trips.length, 1);
    assert.equal(readSnapshot(c.db).trips[0].id, 'trip-a');
    assert.equal(readSnapshot(c.db).pendingCount, 1);
  } finally { c.close(); }
});
