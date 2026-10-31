import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export async function verifyMaps({ request, startApi, stopApi, env, client, tokenA, tokenB, pass }) {
  let calls = 0, fail = false;
  const upstream = createServer((req, res) => {
    calls++;
    assert.match(req.headers['user-agent'], /Tripora/);
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.searchParams.get('format'), 'jsonv2');
    assert.equal(url.searchParams.get('q'), 'Synthetic tower, Synthetic city');
    assert.equal(url.searchParams.has('notes'), false);
    res.setHeader('Content-Type', 'application/json');
    if (fail) { res.writeHead(503).end('{}'); return; }
    res.end(JSON.stringify([{ osm_type: 'node', osm_id: 123, lat: '45.81', lon: '15.98', display_name: 'Synthetic tower, Synthetic city' },
      { osm_type: 'way', osm_id: 456, lat: '46', lon: '16', display_name: 'Other synthetic tower' },
      { osm_type: 'node', osm_id: 789, lat: '91', lon: '16', display_name: 'Invalid coordinate' },
      { osm_type: 'node', osm_id: 123, lat: '45.81', lon: '15.98', display_name: 'Duplicate synthetic tower' }]));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const search = { tripId: randomUUID(), name: 'Synthetic tower', city: 'Synthetic city' };
  const data = { category: 'place', name: search.name, notes: 'Private note stays in Tripora', address: '', link: '', visited: false };
  try {
    await stopApi(); env.Tripora__Maps__SearchUrl = 'http://127.0.0.1:' + upstream.address().port + '/search'; await startApi();
    await request('/api/sync/push', tokenA, { operationId: randomUUID(), tripId: search.tripId, kind: 'trip.create', baseVersion: 0,
      data: { name: 'Map fixture', destination: search.city, startDate: '2026-11-01', endDate: '2026-11-03' } });
    assert.equal((await request('/api/places/search', null, search)).status, 401);
    assert.equal((await request('/api/places/search', tokenB, search)).status, 404);
    assert.equal(calls, 0);
    assert.equal((await request('/api/places/search', tokenA, { ...search, name: '' })).status, 400);
    const found = await request('/api/places/search', tokenA, search);
    assert.equal(found.status, 200); assert.equal(found.data.items.length, 2); assert.equal(found.data.items[0].latitude, 45.81);
    assert.equal(found.data.items[0].providerId, 'N123'); assert.equal(calls, 1);
    await request('/api/places/search', tokenA, search); assert.equal(calls, 1);
    await stopApi(); await startApi(); await request('/api/places/search', tokenA, search); assert.equal(calls, 1);
    pass('place search: authenticated membership, explicit name+city, bounded validated candidates and durable cache across restart');

    await client.query('UPDATE "PlaceSearchCache" SET "UpdatedAt"=now() WHERE "Id"=$1', ['upstream']);
    assert.equal((await request('/api/places/search', tokenA, { ...search, name: 'Uncached' })).status, 429);
    assert.equal(calls, 1);
    await client.query('UPDATE "PlaceSearchCache" SET "UpdatedAt"=now()-interval \'5 seconds\' WHERE "Id"=$1', ['upstream']);
    await client.query('DELETE FROM "PlaceSearchCache" WHERE length("Id")=64');
    fail = true;
    assert.equal((await request('/api/places/search', tokenA, search)).status, 503); fail = false;
    await client.query('UPDATE "PlaceSearchCache" SET "UpdatedAt"=now()-interval \'5 seconds\' WHERE "Id"=$1', ['upstream']);
    assert.equal((await request('/api/places/search', tokenA, search)).status, 200);
    pass('place search: application-wide upstream throttle, provider failure and deliberate retry without fabricated coordinates');

    const push = { operationId: randomUUID(), placeId: randomUUID(), tripId: search.tripId, kind: 'place.create', baseVersion: 0, data: { ...data, location: found.data.items[0] } };
    const saved = await request('/api/places/push', tokenA, push); assert.equal(saved.status, 200);
    assert.deepEqual((await request('/api/places/push', tokenA, push)).data, saved.data);
    await stopApi(); await startApi();
    assert.deepEqual((await request('/api/places/push', tokenA, push)).data.location, push.data.location);
    assert.equal((await request('/api/places/push', tokenA, { ...push, data: { ...push.data, location: { ...push.data.location, latitude: 46 } } })).status, 409);
    assert.equal((await request('/api/places/push', tokenA, { ...push, operationId: randomUUID(), placeId: randomUUID(), data: { ...data, location: { ...push.data.location, longitude: 181 } } })).status, 400);
    assert.equal((await request('/api/places/push', tokenB, { ...push, operationId: randomUUID() })).status, 404);
    const stale = await request('/api/places/push', tokenA, { ...push, operationId: randomUUID(), kind: 'place.update', baseVersion: 0 });
    assert.equal(stale.status, 409); assert.deepEqual(stale.data.current.location, push.data.location);
    const deleted = await request('/api/places/push', tokenA, { ...push, operationId: randomUUID(), kind: 'place.delete', data: null, baseVersion: saved.data.version });
    assert.equal(deleted.status, 200); assert.equal(deleted.data.location, null);
    const resurrect = await request('/api/places/push', tokenA, { ...push, operationId: randomUUID(), kind: 'place.update', baseVersion: deleted.data.version });
    assert.equal(resurrect.status, 409); assert.equal(resurrect.data.current.deleted, true);
    pass('place coordinates: persistence, duplicate replay, changed replay, validation, conflict, access and deletion without resurrection');
  } finally {
    await stopApi(); delete env.Tripora__Maps__SearchUrl;
    await new Promise(resolve => upstream.close(resolve)); await startApi();
  }
}
