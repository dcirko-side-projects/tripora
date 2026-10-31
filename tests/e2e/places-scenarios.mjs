import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const trips = require('../../apps/mobile/.test-build/core/accountStore.js');
const places = require('../../apps/mobile/.test-build/core/placeStore.js');
const { synchronizeAccount } = require('../../apps/mobile/.test-build/core/accountSync.js');
const tripInput = { name: 'Places synthetic trip', destination: 'Test island', startDate: '2026-11-01', endDate: '2026-11-03' };
const data = { category: 'food', name: 'Synthetic cafe', notes: 'Synthetic note', address: 'Test street', link: 'https://example.test/cafe', visited: false };
function operation(tripId, kind = 'place.create', placeId = randomUUID(), baseVersion = 0, changes = {}) {
  return { operationId: randomUUID(), tripId, placeId, kind, baseVersion, data: kind === 'place.delete' ? null : { ...data, ...changes } };
}
export async function verifyPlaces({ mobile, other, local, request, client, tokenA, tokenB, emailB, memberId, folder, pass }) {
  const owner = local(join(folder, 'places-owner.sqlite'));
  const peer = local(join(folder, 'places-peer.sqlite'));
  const member = local(join(folder, 'places-member.sqlite'));
  trips.saveAccountTrip(owner, tripInput, randomUUID);
  const tripId = trips.accountSnapshot(owner).trips[0].id;
  places.savePlace(owner, tripId, data, randomUUID);
  let state = places.placeSnapshot(owner); const firstPlace = state.places[0].id;
  places.savePlace(owner, tripId, { ...data, category: 'place', name: 'Offline attraction', visited: true }, randomUUID, firstPlace);
  await synchronizeAccount(owner, mobile);
  state = places.placeSnapshot(owner);
  assert.equal(state.pending.length, 0); assert.equal(state.places[0].name, 'Offline attraction'); assert.equal(state.places[0].visited, true);
  assert.equal((await client.query('SELECT COUNT(*) FROM "Places" WHERE "Id"=$1', [firstPlace])).rows[0].count, '1');
  await synchronizeAccount(peer, mobile);
  places.savePlace(owner, tripId, { ...data, name: 'Owner edit' }, randomUUID, firstPlace);
  places.savePlace(peer, tripId, { ...data, name: 'Peer edit', notes: 'Keep this note' }, randomUUID, firstPlace);
  await synchronizeAccount(owner, mobile); await synchronizeAccount(peer, mobile);
  let queued = places.placeSnapshot(peer).pending[0];
  assert.equal(queued.conflict.name, 'Owner edit'); assert.equal(places.placeSnapshot(peer).places.find(p => p.id === firstPlace).notes, 'Keep this note');
  places.resolvePlaceConflict(peer, queued.operation.operationId, 'local', randomUUID);
  await synchronizeAccount(peer, mobile); await synchronizeAccount(owner, mobile);
  assert.equal(places.placeSnapshot(owner).places.find(p => p.id === firstPlace).name, 'Peer edit');
  pass('places mobile core: offline parent+child creation, continued edits, two-device conflict and deliberate resolution');

  assert.equal((await request('/api/places/push', tokenB, operation(tripId))).status, 404);
  const ownTrip = await other.request('/api/sync/push', { operationId: randomUUID(), tripId: randomUUID(), kind: 'trip.create', baseVersion: 0, data: tripInput });
  await other.request('/api/places/push', operation(ownTrip.id)); await synchronizeAccount(member, other);
  const oldCursor = places.placeSnapshot(member).cursor;
  assert.ok(oldCursor > places.placeSnapshot(owner).places.find(p => p.id === firstPlace).version);
  const invitePath = `/api/trips/${tripId}`;
  const invitation = await mobile.request(invitePath + '/invitations', { email: emailB });
  await other.request('/api/invitations/accept', { token: invitation.token }); await synchronizeAccount(member, other);
  const received = places.placeSnapshot(member).places.find(p => p.id === firstPlace);
  assert.ok(received.version > oldCursor); assert.equal(received.name, 'Peer edit');
  places.savePlace(member, tripId, { ...data, category: 'nightlife', name: 'Synthetic evening venue' }, randomUUID);
  const nightlife = places.placeSnapshot(member).places.find(p => p.name === 'Synthetic evening venue').id;
  await synchronizeAccount(member, other); await synchronizeAccount(owner, mobile);
  assert.equal(places.placeSnapshot(owner).places.find(p => p.id === nightlife).category, 'nightlife');
  assert.equal((await request('/api/places/push', tokenB, operation(ownTrip.id, 'place.update', firstPlace, received.version))).status, 404);
  pass('places membership: earlier records download past cursor, members create shared categories, foreign trip IDs rejected');

  await synchronizeAccount(owner, mobile);
  places.savePlace(member, tripId, { ...data, name: 'Stale offline edit' }, randomUUID, firstPlace);
  places.deletePlace(owner, firstPlace, randomUUID); await synchronizeAccount(owner, mobile); await synchronizeAccount(member, other);
  queued = places.placeSnapshot(member).pending.find(p => p.operation.placeId === firstPlace);
  assert.equal(queued.conflict.deleted, true);
  assert.throws(() => places.resolvePlaceConflict(member, queued.operation.operationId, 'local', randomUUID), /obrisano/);
  places.resolvePlaceConflict(member, queued.operation.operationId, 'server', randomUUID);
  assert.equal(places.placeSnapshot(member).places.find(p => p.id === firstPlace).deleted, true);
  pass('places deletion versus stale edit preserves local draft, shows tombstone and prevents resurrection');

  const duplicate = operation(tripId);
  let lost = true;
  places.savePlace(owner, tripId, { ...data, name: 'Lost acknowledgement venue' }, randomUUID);
  const stable = places.placeSnapshot(owner).pending.find(p => p.operation.data?.name === 'Lost acknowledgement venue').operation;
  const flaky = { async request(path, body) {
    const result = await mobile.request(path, body);
    if (path === '/api/places/push' && body.operationId === stable.operationId && lost) { lost = false; throw new Error('lost place acknowledgement'); }
    return result;
  } };
  await assert.rejects(synchronizeAccount(owner, flaky), /lost place acknowledgement/);
  places.savePlace(owner, tripId, { ...data, name: 'Edited after connection loss', visited: true }, randomUUID, stable.placeId);
  await synchronizeAccount(owner, mobile);
  assert.equal(places.placeSnapshot(owner).pending.length, 0);
  assert.equal((await client.query('SELECT COUNT(*) FROM "Places" WHERE "Id"=$1', [stable.placeId])).rows[0].count, '1');
  const [a, b] = await Promise.all([request('/api/places/push', tokenA, duplicate), request('/api/places/push', tokenA, duplicate)]);
  assert.equal(a.status, 200); assert.deepEqual(a, b);
  assert.equal((await request('/api/places/push', tokenA, { ...duplicate, data: { ...data, name: 'Changed replay' } })).status, 409);
  assert.equal((await request('/api/sync/push', tokenA, { operationId: duplicate.operationId, tripId: randomUUID(), kind: 'trip.create', baseVersion: 0, data: tripInput })).status, 409);
  const invalid = operation(tripId, 'place.create', randomUUID(), 0, { link: 'javascript:alert(1)' });
  assert.equal((await request('/api/places/push', tokenA, invalid)).status, 400);
  assert.equal((await client.query('SELECT COUNT(*) FROM "Places" WHERE "Id"=$1', [invalid.placeId])).rows[0].count, '0');
  pass('places lost acknowledgements and concurrent duplicates create once; changed replay and unsafe links rejected');

  await synchronizeAccount(member, other);
  places.savePlace(member, tripId, { ...data, name: 'Preserved after removal' }, randomUUID, nightlife);
  const pending = places.placeSnapshot(member).pending.find(p => p.operation.placeId === nightlife).operation;
  const race = operation(tripId, 'place.update', nightlife, pending.baseVersion, { category: 'nightlife', name: 'Race update' });
  const [writeRace, removeRace] = await Promise.all([
    request('/api/places/push', tokenB, race), request(invitePath + '/members/' + memberId + '/remove', tokenA, {}),
  ]);
  assert.ok([200, 404].includes(writeRace.status)); assert.equal(removeRace.status, 204);
  await synchronizeAccount(member, other);
  assert.equal(places.placeSnapshot(member).pending.find(p => p.operation.placeId === nightlife).error, places.PLACE_ACCESS_REMOVED);
  assert.deepEqual(places.placeSnapshot(member).pending.find(p => p.operation.placeId === nightlife).operation, pending);
  assert.equal((await request('/api/places/push', tokenB, pending)).status, 404);
  assert.ok(!(await request('/api/places/pull', tokenB)).data.items.some(p => p.tripId === tripId));
  const rejoin = await mobile.request(invitePath + '/invitations', { email: emailB });
  await other.request('/api/invitations/accept', { token: rejoin.token }); await synchronizeAccount(member, other);
  queued = places.placeSnapshot(member).pending.find(p => p.operation.placeId === nightlife);
  assert.ok(queued.conflict); places.resolvePlaceConflict(member, queued.operation.operationId, 'local', randomUUID);
  await synchronizeAccount(member, other); await synchronizeAccount(owner, mobile);
  assert.equal(places.placeSnapshot(owner).places.find(p => p.id === nightlife).name, 'Preserved after removal');
  pass('places removal/write race enforces access, preserves outbox and permits explicit rejoin/conflict recovery');

  for (let i = 0; i < 101; i++) await mobile.request('/api/places/push', operation(tripId, 'place.create', randomUUID(), 0, { name: 'Synthetic page ' + i, category: ['place', 'food', 'nightlife'][i % 3] }));
  const page1 = (await request('/api/places/pull', tokenA)).data;
  const page2 = (await request('/api/places/pull?after=' + page1.cursor, tokenA)).data;
  assert.equal(page1.items.length, 100); assert.equal(page1.hasMore, true); assert.equal(page2.hasMore, false);
  assert.equal(new Set([...page1.items, ...page2.items].map(p => p.id)).size, page1.items.length + page2.items.length);
  await synchronizeAccount(owner, mobile); await synchronizeAccount(member, other);
  places.savePlace(member, tripId, { ...data, name: 'Draft before trip deletion' }, randomUUID, nightlife);
  trips.deleteAccountTrip(owner, tripId, randomUUID); await synchronizeAccount(owner, mobile); await synchronizeAccount(member, other);
  queued = places.placeSnapshot(member).pending.find(p => p.operation.placeId === nightlife);
  assert.equal(queued.conflict.deleted, true);
  assert.throws(() => places.resolvePlaceConflict(member, queued.operation.operationId, 'local', randomUUID));
  places.resolvePlaceConflict(member, queued.operation.operationId, 'server', randomUUID);
  assert.ok(places.placeSnapshot(member).places.filter(p => p.tripId === tripId).every(p => p.deleted));
  assert.equal((await request('/api/places/push', tokenB, operation(tripId))).status, 409);
  pass('places cursor pagination and parent-trip tombstones reconcile all categories without resurrection');
}
