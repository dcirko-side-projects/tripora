const { test } = require('node:test');
const assert = require('node:assert/strict');
const { featureHarness, places } = require('./featureUiHarness.cjs');
const point = { latitude: 45.81, longitude: 15.98, displayName: 'Synthetic cafe, QA island', provider: 'osm', providerId: 'N123' };
const config = { tileUrl: 'https://tile.example.test/{z}/{x}/{y}.png', attribution: 'Synthetic attribution', attributionUrl: 'https://example.test/copyright' };

test('map UI searches only on button, confirms exact candidate, saves coordinates and invalidates a renamed location', async () => {
  const h = await featureHarness('places', { requests: async path => path.endsWith('/search') ? { items: [point] } : config });
  try {
    await h.press('Dodaj mjesto'); await h.fill('Naziv mjesta', 'Synthetic cafe');
    assert.equal(h.control.apiCalls.length, 0);
    await h.press('Pronađi mjesto');
    assert.equal(h.control.apiCalls[0].body.city, 'QA island');
    assert.equal(h.control.apiCalls[0].body.name, 'Synthetic cafe');
    assert.equal(places.placeSnapshot(h.db).places.length, 0);
    await h.press(point.displayName); await h.press('Spremi mjesto');
    const saved = places.placeSnapshot(h.db).places[0]; assert.deepEqual(saved.location, point);
    await h.press('Karta');
    const marker = h.root.findByType('MapMarker'); assert.deepEqual(marker.props.lngLat, [15.98, 45.81]);
    await h.run(() => marker.props.onPress());
    assert.match(h.text(), /Otvori navigaciju/);
    await h.press('Uredi mjesto'); await h.fill('Naziv mjesta', 'Changed synthetic cafe');
    assert.doesNotMatch(h.text(), /Potvrđen položaj/); await h.press('Spremi mjesto');
    assert.equal(places.placeSnapshot(h.db).places[0].location, null);
  } finally { await h.close(); }
});

test('late search response cannot select the previous query; provider errors preserve the editable draft', async () => {
  let resolve;
  const h = await featureHarness('places', { requests: () => new Promise(r => { resolve = r; }) });
  try {
    await h.press('Dodaj mjesto'); await h.fill('Naziv mjesta', 'Old query');
    await h.press('Pronađi mjesto'); await h.fill('Naziv mjesta', 'Current query');
    await h.run(() => resolve({ items: [point] }));
    assert.ok(!h.button(point.displayName));
    h.control.requests = async () => { throw Error('Offline'); };
    await h.press('Pronađi mjesto'); assert.match(h.text(), /Nacrt je sačuvan/);
    assert.equal(h.root.findByProps({ accessibilityLabel: 'Naziv mjesta' }).props.value, 'Current query');
    await h.press('Spremi mjesto');
    assert.equal(places.placeSnapshot(h.db).places[0].name, 'Current query');
    assert.ok(!places.placeSnapshot(h.db).places[0].location);
  } finally { await h.close(); }
});
