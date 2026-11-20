const assert = require('node:assert/strict');
const { test } = require('node:test');
const { collectPlaces } = require('../.test-build/core/placesExport.js');
const { mapsStops, mapsUrl, serializeMyMaps } = require('../.test-build/core/mapsExport.js');

const trip = { id: 'trip', name: 'Synthetic', destination: 'Zagreb' };
const places = [
  { id: 'late', tripId: trip.id, name: 'Muškat "park"', location: { latitude: 45.8, longitude: -16 }, address: 'Reserved', notes: 'Private note' },
  { id: 'early', tripId: trip.id, name: '=1+1', address: 'Trg žrtava, Zagreb' },
  { id: 'other', tripId: trip.id, name: 'Other day', address: 'Ulica 4' },
  { id: 'empty', tripId: trip.id, name: 'No address', address: '' },
];
const visits = [['late', '2027-05-01', '12:00'], ['early', '2027-05-01', '09:00'],
  ['early', '2027-05-01', '14:30'], ['other', '2027-05-02', '09:00'], ['empty', '2027-05-01', '08:00']]
  .map(([placeId, date, time]) => ({ tripId: trip.id, feature: 'plan', data: { placeId, date, time } }));

test('both providers use the selected day, itinerary order and coordinates before addresses', () => {
  const day = collectPlaces([trip], places, visits, { kind: 'day', tripId: trip.id, date: '2027-05-01' });
  const stops = mapsStops(day);
  const google = new URL(mapsUrl('google', stops));
  const apple = new URL(mapsUrl('apple', stops));
  assert.equal(stops.length, 2);
  assert.equal(google.searchParams.get('api'), '1');
  assert.equal(google.searchParams.get('origin'), places[1].address);
  assert.equal(google.searchParams.get('destination'), '45.8,-16');
  assert.equal(apple.searchParams.get('source'), places[1].address);
  assert.equal(apple.searchParams.get('destination'), '45.8,-16');
  assert.equal(new URL(mapsUrl('google', stops.slice(1))).pathname, '/maps/search/');
  assert.equal(new URL(mapsUrl('apple', stops.slice(1))).searchParams.get('ll'), '45.8,-16');
  assert.equal(serializeMyMaps(stops), "Name,Location\r\n\"'=1+1\",\"Trg žrtava, Zagreb\"\r\n\"Muškat \"\"park\"\"\",\"45.8,-16\"\r\n");
});

test('route limits are enforced without dropping destinations from the CSV', () => {
  const stops = Array.from({ length: 6 }, (_, i) => ({ name: 'Place ' + i, location: '45,' + i }));
  const google = new URL(mapsUrl('google', stops.slice(0, 5)));
  const apple = new URL(mapsUrl('apple', stops.slice(0, 5)));
  assert.equal(google.searchParams.get('waypoints'), '45,1|45,2|45,3');
  assert.deepEqual(apple.searchParams.getAll('waypoint'), ['45,1', '45,2', '45,3']);
  assert.equal(mapsUrl('google', stops), undefined);
  assert.equal(mapsUrl('apple', stops), undefined);
  assert.equal(mapsUrl('google', [{ name: 'Long address', location: 'Ž'.repeat(400) }]), undefined);
  assert.equal(serializeMyMaps(stops).trim().split('\r\n').length, 7);
  assert.equal(mapsUrl('google', []), undefined);
});
