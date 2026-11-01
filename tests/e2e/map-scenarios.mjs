import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export async function verifyMaps({ request, startApi, stopApi, env, client, tokenA, tokenB, pass }) {
  let calls = 0, fail = false, expectedQuery = 'Synthetic tower, Synthetic city', responseRows;
  const queries = [], callTimes = [];
  const upstream = createServer((req, res) => {
    calls++;
    callTimes.push(Date.now());
    assert.match(req.headers['user-agent'], /Tripora/);
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.searchParams.get('format'), 'jsonv2');
    queries.push(url.searchParams.get('q'));
    if (expectedQuery) assert.equal(url.searchParams.get('q'), expectedQuery);
    assert.equal(url.searchParams.has('notes'), false);
    res.setHeader('Content-Type', 'application/json');
    if (fail) { res.writeHead(typeof fail === 'number' ? fail : 503).end('{}'); return; }
    if (responseRows !== undefined) { res.end(JSON.stringify(typeof responseRows === 'function' ? responseRows(url.searchParams.get('q')) : responseRows)); return; }
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
    assert.equal((await request('/api/places/search', tokenA, { ...search, name: '', city: '' })).status, 400);
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

    const expireGate = () => client.query('UPDATE "PlaceSearchCache" SET "UpdatedAt"=now()-interval \'5 seconds\' WHERE "Id"=$1', ['upstream']);
    // Restart resets only the account limiter; the persisted upstream gate/cache remain.
    await stopApi(); await startApi();
    const fixture = { osm_type: 'node', osm_id: 987, lat: '45.81', lon: '15.98', display_name: 'Sintetičko mjesto č ć ž š đ, Zagreb' };
    responseRows = [fixture];
    for (const [fields, query] of [
      [{ name: 'Sintetički kafić', city: '' }, 'Sintetički kafić'],
      [{ name: '', address: 'Ulica sintetičkog mjesta 12', city: 'Zagreb' }, 'Ulica sintetičkog mjesta 12, Zagreb'],
      [{ name: '', city: 'Šibenik' }, 'Šibenik'],
      [{ name: 'Đakovo, Hrvatska', city: 'Đakovo' }, 'Đakovo, Hrvatska'],
      [{ name: '  ČĆŽŠĐ  ', address: '  Sintetička   ulica  12 ', city: ' Zagreb ' }, 'ČĆŽŠĐ, Sintetička ulica 12, Zagreb'],
      [{ name: 'Cafe\u0301', city: '' }, 'Café'],
    ]) {
      await expireGate(); expectedQuery = query;
      const result = await request('/api/places/search', tokenA, { tripId: search.tripId, ...fields });
      assert.equal(result.status, 200); assert.equal(result.data.items[0].displayName, fixture.display_name);
    }
    pass('search transmits name/address/city combinations, Croatian diacritics and normalized Unicode without duplicate city tokens');

    await expireGate(); expectedQuery = null;
    responseRows = q => q.startsWith('Moj naziv') ? [] : [fixture];
    const beforeFallback = calls;
    const addressSearch = { tripId: search.tripId, name: 'Moj naziv', address: 'Sintetička ulica 42', city: 'Zagreb' };
    const fallbackResult = await request('/api/places/search', tokenA, addressSearch);
    assert.equal(fallbackResult.status, 200); assert.equal(fallbackResult.data.items.length, 1);
    assert.deepEqual(queries.slice(-2), ['Moj naziv, Sintetička ulica 42, Zagreb', 'Sintetička ulica 42, Zagreb']);
    assert.ok(callTimes.at(-1) - callTimes.at(-2) >= 1050);
    assert.equal(calls, beforeFallback + 2);
    await request('/api/places/search', tokenA, addressSearch); assert.equal(calls, beforeFallback + 2);
    pass('unindexed venue name falls back to supplied public address with global spacing and cached explicit candidates');

    await stopApi(); await startApi(); await expireGate();
    responseRows = [];
    const emptySearch = { tripId: search.tripId, name: 'Sintetički nepostojeći objekt' };
    assert.deepEqual((await request('/api/places/search', tokenA, emptySearch)).data, { items: [] });
    const beforeEmpty = calls;
    await request('/api/places/search', tokenA, emptySearch); assert.equal(calls, beforeEmpty);
    await client.query('UPDATE "PlaceSearchCache" SET "UpdatedAt"=now()-interval \'6 minutes\' WHERE "ResultsJson"=$1', ['{"items":[]}']);
    responseRows = [null, { lat: {} }, fixture]; await expireGate();
    assert.equal((await request('/api/places/search', tokenA, emptySearch)).data.items.length, 1);
    assert.equal(calls, beforeEmpty + 1);
    await expireGate(); responseRows = [{ lat: 'bad' }];
    assert.equal((await request('/api/places/search', tokenA, { tripId: search.tripId, name: 'Malformed fixture' })).status, 503);
    await expireGate(); responseRows = { error: 'not an array' };
    assert.equal((await request('/api/places/search', tokenA, { tripId: search.tripId, name: 'Wrong shape fixture' })).status, 503);
    pass('empty searches expire after five minutes; malformed provider data is unavailable rather than a false no-result');
    await expireGate(); fail = 429;
    const limitedSearch = { tripId: search.tripId, name: 'Provider quota fixture' };
    assert.equal((await request('/api/places/search', tokenA, limitedSearch)).status, 429);
    await expireGate(); fail = false; responseRows = [fixture];
    assert.equal((await request('/api/places/search', tokenA, limitedSearch)).status, 200);
    const beforeDailyLimit = calls;
    await client.query('UPDATE "PlaceSearchCache" SET "UpdatedAt"=now(), "ResultsJson"=$1 WHERE "Id"=$2', ['200', 'daily']);
    await expireGate();
    assert.equal((await request('/api/places/search', tokenA, { tripId: search.tripId, city: 'Daily quota fixture' })).status, 429);
    assert.equal(calls, beforeDailyLimit);
    await client.query('UPDATE "PlaceSearchCache" SET "ResultsJson"=$1 WHERE "Id"=$2', ['199', 'daily']);
    await expireGate(); responseRows = [];
    const lastBudgetSearch = { tripId: search.tripId, name: 'Last daily call', address: 'Uncached address' };
    assert.equal((await request('/api/places/search', tokenA, lastBudgetSearch)).status, 429);
    assert.equal(calls, beforeDailyLimit + 1);
    await expireGate();
    assert.equal((await request('/api/places/search', tokenA, lastBudgetSearch)).status, 429);
    assert.equal(calls, beforeDailyLimit + 1);
    await client.query('DELETE FROM "PlaceSearchCache" WHERE "Id"=$1', ['daily']);
    pass('provider 429 remains a visible quota error, retries are not poisoned by cache and the daily budget prevents upstream requests');
  } finally {
    await stopApi(); delete env.Tripora__Maps__SearchUrl;
    await new Promise(resolve => upstream.close(resolve)); await startApi();
  }
  // Deliberate, opt-in live checks only: never send a test grid or autocomplete traffic.
  if (process.env.TRIPORA_TEST_LIVE_PLACES === '1') {
    const cases = [
      { city: 'Šibenik' },
      { name: 'Đakovo' },
      { address: 'Ćirilometodska ulica 2', city: 'Zagreb' },
      { name: 'Trg bana Josipa Jelačića', city: 'Zagreb' },
      { name: 'Muzej prekinutih veza', address: 'Ćirilometodska ulica 2', city: 'Zagreb' },
      { name: 'Trg žrtava fašizma, Zagreb' },
    ];
    await stopApi(); await startApi();
    let chosen;
    for (const fields of cases) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const found = await request('/api/places/search', tokenA, { tripId: search.tripId, ...fields });
      assert.equal(found.status, 200, 'live search status: ' + JSON.stringify(fields));
      assert.ok(found.data.items.length > 0, 'live search candidates: ' + JSON.stringify(fields));
      // Unqualified names can legitimately have candidates in other countries.
      chosen = found.data.items.find(p => p.latitude > 42 && p.latitude < 47 && p.longitude > 13 && p.longitude < 20);
      assert.ok(chosen, 'live Croatian candidate: ' + JSON.stringify({ fields, items: found.data.items }));
    }
    const savedId = randomUUID();
    const saved = await request('/api/places/push', tokenA, {
      operationId: randomUUID(), placeId: savedId, tripId: search.tripId, kind: 'place.create', baseVersion: 0,
      data: { ...data, name: 'Synthetic live lookup fixture', location: chosen },
    });
    assert.equal(saved.status, 200);
    await stopApi(); await startApi();
    let cursor = 0, persisted;
    while (true) {
      const pulled = await request('/api/places/pull?after=' + cursor, tokenA);
      persisted ??= pulled.data.items.find(p => p.id === savedId);
      cursor = pulled.data.cursor;
      if (!pulled.data.hasMore) break;
    }
    assert.deepEqual(persisted.location, chosen);
    assert.equal((await request('/api/places/push', tokenA, {
      operationId: randomUUID(), placeId: savedId, tripId: search.tripId, kind: 'place.delete', baseVersion: saved.data.version, data: null,
    })).status, 200);
    pass('LIVE Nominatim: six public Croatian name/address/city queries with č ć ž š đ, real adapter parsing, save and pull after API restart');
  }
}
