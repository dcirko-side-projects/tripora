const { test } = require('node:test');
const assert = require('node:assert/strict');
const { featureHarness, places } = require('./featureUiHarness.cjs');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const point = { latitude: 45.81, longitude: 15.98, displayName: 'Synthetic cafe, QA island', provider: 'osm', providerId: 'N123' };
const config = { tileUrl: 'https://tile.example.test/{z}/{x}/{y}.png', attribution: 'Synthetic attribution', attributionUrl: 'https://example.test/copyright' };

for (const platform of ['android', 'ios']) test(`${platform} fullscreen map is isolated from scrolling, closes with back/button and opens marker details`, async () => {
  const h = await featureHarness('places', { platform, requests: async path => path.endsWith('/search') ? { items: [point] } : config });
  try {
    await h.press('Dodaj mjesto'); await h.fill('Naziv mjesta', 'Synthetic cafe');
    await h.press('Pronađi mjesto'); await h.press(point.displayName); await h.press('Spremi mjesto');
    await h.press('Karta'); await h.press('Otvori kartu preko cijelog zaslona');
    const fullscreen = h.root.findAllByType('Modal').find(n => n.props.presentationStyle === 'fullScreen');
    assert.ok(fullscreen);
    assert.equal(fullscreen.findAllByType('ScrollView').length, 0);
    assert.equal(fullscreen.findByType('NativeMap').props.style.flex, 1);
    assert.equal(h.root.findAllByType('NativeMap').length, 1);
    await h.run(() => fullscreen.props.onRequestClose());
    assert.equal(h.root.findByType('NativeMap').props.style.height, 380);
    await h.press('Otvori kartu preko cijelog zaslona'); await h.press('Zatvori kartu');
    assert.equal(h.root.findAllByType('Modal').filter(n => n.props.presentationStyle === 'fullScreen' && n.props.visible).length, 0);
    await h.press('Otvori kartu preko cijelog zaslona');
    await h.run(() => h.root.findByType('MapMarker').props.onPress());
    assert.match(h.text(), /Otvori navigaciju/);
    assert.equal(h.root.findAllByType('Modal').filter(n => n.props.presentationStyle === 'fullScreen' && n.props.visible).length, 1);
    const nativeMap = h.root.findByType('NativeMap');
    await h.press('Uredi mjesto');
    assert.match(h.text(), /Uredi mjesto/);
    assert.equal(h.root.findAllByType('Modal').filter(n => n.props.presentationStyle === 'pageSheet').length, 0, 'editor stays inside fullscreen map');
    if (platform === 'android') {
      h.control.keyboardVisible = true;
      await h.run(() => fullscreen.props.onRequestClose());
      assert.equal(h.control.keyboardVisible, false);
      assert.ok(h.button('Spremi mjesto'), 'keyboard back retains editor draft');
    }
    await h.press('Zatvori obrazac');
    assert.equal(h.root.findByType('NativeMap'), nativeMap, 'details do not remount the map');
    assert.equal(h.root.findAllByType('Modal').filter(n => n.props.presentationStyle === 'fullScreen' && n.props.visible).length, 1);
    await h.run(() => h.root.findByType('MapMarker').props.onPress());
    await h.run(() => fullscreen.props.onRequestClose());
    assert.doesNotMatch(h.text(), /Otvori navigaciju/);
    assert.equal(h.root.findAllByType('Modal').filter(n => n.props.presentationStyle === 'fullScreen' && n.props.visible).length, 1);
    const camera = { center: [16.2, 45.5], zoom: 11, bearing: 20, pitch: 10 };
    await h.run(() => nativeMap.props.onRegionDidChange({ nativeEvent: camera }));
    await h.press('Zatvori kartu');
    assert.deepEqual(h.root.findByType('MapCamera').props.initialViewState, camera);
    await h.press('Otvori kartu preko cijelog zaslona');
    assert.deepEqual(h.root.findByType('MapCamera').props.initialViewState, camera);
    await h.fill('Filtriraj grad, naziv ili adresu', 'no synthetic match');
    assert.equal(h.root.findAllByType('MapMarker').length, 0);
    assert.equal(h.root.findAllByType('Modal').filter(n => n.props.presentationStyle === 'fullScreen' && n.props.visible).length, 1);
    await h.fill('Filtriraj grad, naziv ili adresu', 'QA island');
    assert.equal(h.root.findAllByType('MapMarker').length, 1);

  } finally { await h.close(); }
});

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

test('address-only and city-only searches allow explicit selection, naming and reopening on the map', async () => {
  const h = await featureHarness('places', { requests: async path => path.endsWith('/search') ? { items: [point] } : config });
  try {
    await h.press('Dodaj mjesto');
    await h.fill('Grad ili odredište za pretragu', '');
    assert.equal(h.button('Pronađi mjesto').props.disabled, true);
    await h.fill('Adresa', 'Sintetička ulica č ć ž š đ 12');
    await h.press('Pronađi mjesto');
    assert.deepEqual(h.control.apiCalls[0].body, { tripId: 'qa-trip', name: '', address: 'Sintetička ulica č ć ž š đ 12', city: '' });
    await h.press(point.displayName); await h.press('Spremi mjesto');
    const saved = places.placeSnapshot(h.db).places[0];
    assert.equal(saved.name, 'Synthetic cafe'); assert.deepEqual(saved.location, point);
    await h.refresh(); await h.press('Karta');
    assert.deepEqual(h.root.findByType('MapMarker').props.lngLat, [point.longitude, point.latitude]);
    await h.run(() => h.root.findByType('MapMarker').props.onPress());
    assert.match(h.text(), /Potvrđen|Otvori navigaciju/);
    await h.press('Uredi mjesto'); await h.fill('Naziv mjesta', ''); await h.fill('Adresa', '');
    await h.fill('Grad ili odredište za pretragu', 'Šibenik'); await h.press('Pronađi mjesto');
    assert.equal(h.control.apiCalls.at(-1).body.city, 'Šibenik');
  } finally { await h.close(); }
});

test('no-result differs from provider failure and changing the address discards stale candidates', async () => {
  const h = await featureHarness('places', { requests: async () => ({ items: [] }) });
  try {
    await h.press('Dodaj mjesto'); await h.fill('Naziv mjesta', 'Sintetičko mjesto');
    await h.press('Pronađi mjesto'); assert.match(h.text(), /Nema rezultata za unesene podatke/);
    assert.doesNotMatch(h.text(), /Pretraga trenutačno nije dostupna/);
    let resolve;
    h.control.requests = () => new Promise(r => { resolve = r; });
    await h.press('Pronađi mjesto'); await h.fill('Adresa', 'Druga sintetička adresa');
    await h.run(() => resolve({ items: [point] })); assert.ok(!h.button(point.displayName));
    h.control.requests = async () => { throw Error('Synthetic unavailable'); };
    await h.press('Pronađi mjesto'); assert.match(h.text(), /Pretraga trenutačno nije dostupna/);
    assert.doesNotMatch(h.text(), /Nema rezultata za unesene podatke/);
    assert.equal(h.root.findByProps({ accessibilityLabel: 'Adresa' }).props.value, 'Druga sintetička adresa');
  } finally { await h.close(); }
});

test('selected search result survives SQLite close/reopen and renders the same map marker and details', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'tripora-map-'));
  const databaseFile = join(folder, 'account.sqlite');
  let h;
  try {
    h = await featureHarness('places', { databaseFile, requests: async () => ({ items: [point] }) });
    await h.press('Dodaj mjesto'); await h.fill('Naziv mjesta', 'Sintetičko mjesto č ć ž š đ');
    await h.fill('Adresa', 'Sintetička ulica 12'); await h.press('Pronađi mjesto');
    await h.press(point.displayName); await h.press('Spremi mjesto');
    const pending = places.placeSnapshot(h.db).pending[0].operation;
    await h.close(); h = undefined;
    h = await featureHarness('places', { databaseFile, requests: async () => config });
    assert.deepEqual(places.placeSnapshot(h.db).pending[0].operation, pending);
    await h.press('Karta');
    const marker = h.root.findByType('MapMarker');
    assert.deepEqual(marker.props.lngLat, [point.longitude, point.latitude]);
    await h.run(() => marker.props.onPress());
    assert.match(h.text(), /Sintetičko mjesto č ć ž š đ/);
    assert.match(h.text(), /Otvori navigaciju/);
  } finally { await h?.close(); rmSync(folder, { recursive: true, force: true }); }
});

 test('map filters combine category, visit status and accent-insensitive city/name/address; labels identify each category', async () => {
  const h = await featureHarness('places', { requests: async () => config });
  try {
    for (const [category, name, address, visited] of [
      ['place', 'Synthetic Museum', 'Test street, \u0160ibenik', false],
      ['food', 'Synthetic Cafe', 'Other street, Zadar', true],
      ['nightlife', 'Synthetic Bar', 'Night street, \u0160ibenik', false],
    ]) places.savePlace(h.db, 'qa-trip', { category, name, address, visited, notes: '', link: '', location: { ...point, displayName: address } }, require('node:crypto').randomUUID);
    await h.refresh(); await h.press('Karta');
    assert.equal(h.root.findAllByType('MapMarker').length, 3);
    assert.match(h.text(), /M\u00b7SM/); assert.match(h.text(), /H\u00b7SC/); assert.match(h.text(), /I\u00b7SB/);
    await h.fill('Filtriraj grad, naziv ili adresu', 'sibenik');
    assert.equal(h.root.findAllByType('MapMarker').length, 2);
    await h.press('Hrana'); assert.equal(h.root.findAllByType('MapMarker').length, 0);
    await h.fill('Filtriraj grad, naziv ili adresu', 'ZADAR');
    assert.equal(h.root.findAllByType('MapMarker').length, 1);
    await h.press('Za posjetiti'); assert.equal(h.root.findAllByType('MapMarker').length, 0);
    await h.press('Posje\u0107eno'); assert.equal(h.root.findAllByType('MapMarker').length, 1);
    await h.fill('Filtriraj grad, naziv ili adresu', 'Synthetic Cafe');
    assert.equal(h.root.findAllByType('MapMarker').length, 1);
  } finally { await h.close(); }
});
