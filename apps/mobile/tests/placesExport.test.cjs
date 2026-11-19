const { test } = require("node:test");
const assert = require("node:assert/strict");
const { collectPlaces, serializePlaces } = require("../.test-build/core/placesExport.js");

test("JSON and GeoJSON export only eligible places, retaining repeated visits and trip context", () => {
  const location = { latitude: 45.81, longitude: 15.98, displayName: "Sintetički hotel", provider: "osm", providerId: "N123" };
  const dayOne = "2026-11-18";
  const dayTwo = "2026-11-19";
  const trips = [
    { id: "one", name: "QA trip", destination: "QA island", startDate: dayOne, endDate: dayTwo, ownerId: "private-owner" },
    { id: "two", name: "QA second trip", destination: "QA coast" },
    { id: "revoked", accessRevoked: true },
    { id: "deleted", deleted: true },
  ];
  const places = [
    { id: "hotel", tripId: "one", name: "QA hotel", category: "accommodation", notes: "Prijava u 15 h", address: "Testna ulica", link: "https://example.test", visited: true, location },
    { id: "unlocated", tripId: "one", name: "Pending coordinates" },
    { id: "unplanned", tripId: "one", name: "Unplanned" },
    { id: "elsewhere", tripId: "two" },
    { id: "cached", tripId: "revoked" },
    { id: "deleted-trip-place", tripId: "deleted" },
    { id: "tombstone", tripId: "one", deleted: true },
  ];
  const visit = (placeId, date, fields) => ({
    tripId: "one", feature: "plan", authorEmail: "qa@example.test",
    data: { placeId, date, time: "10:00", title: "QA visit", notes: "QA note", done: false }, ...fields,
  });
  const entries = [
    visit("hotel", dayTwo), visit("hotel", dayOne), visit("unlocated", dayOne),
    visit("hotel", ""), visit("unplanned", dayOne, { deleted: true }),
    visit("unplanned", dayOne, { feature: "memory" }), visit("tombstone", dayOne),
    visit("elsewhere", dayTwo), // Broken cross-trip reference.
  ];
  const cases = [
    [{ kind: "all" }, ["hotel", "unlocated", "unplanned", "elsewhere"], [null, dayOne, dayTwo]],
    [{ kind: "trip", tripId: "one" }, ["hotel", "unlocated", "unplanned"], [null, dayOne, dayTwo]],
    [{ kind: "plan", tripId: "one" }, ["hotel", "unlocated"], [null, dayOne, dayTwo]],
    [{ kind: "day", tripId: "one", date: dayOne }, ["hotel", "unlocated"], [dayOne]],
    [{ kind: "day", tripId: "one", date: "" }, ["hotel"], [null]],
  ];
  for (const [scope, expected, dates] of cases) {
    const data = collectPlaces(trips, places, entries, scope);
    const json = JSON.parse(serializePlaces(data, "json"));
    assert.deepEqual(json.scope, scope);
    assert.deepEqual(json.trips.map(trip => trip.id), scope.kind === "all" ? ["one", "two"] : ["one"]);
    assert.deepEqual(json.places.map(place => place.id), expected);
    assert.deepEqual(json.places[0].plan.map(visit => visit.date), dates);
    assert.deepEqual(json.places.find(place => place.id === "hotel"), {
      ...places[0], plan: dates.map(date => ({ date, time: "10:00", title: "QA visit", notes: "QA note", done: false })),
    });
    if (expected.includes("unlocated")) assert.equal(json.places[1].location, null);
    assert.doesNotMatch(JSON.stringify(json), /private-owner|qa@example.test/);

    const map = JSON.parse(serializePlaces(data, "geojson"));
    assert.equal(map.type, "FeatureCollection");
    assert.equal(map.features.length, 1);
    const [hotel] = map.features;
    assert.equal(hotel.properties.category, "accommodation");
    assert.deepEqual(hotel.geometry, { type: "Point", coordinates: [15.98, 45.81] });
    assert.deepEqual(hotel.properties.plan.map(visit => visit.date), dates);
    const withoutNotes = JSON.parse(serializePlaces(data, "geojson", false)).features[0];
    assert.equal(hotel.properties.notes, "Prijava u 15 h");
    assert.equal(withoutNotes.properties.notes, undefined);
    assert.ok(withoutNotes.properties.plan.every(visit => !("notes" in visit)));
    assert.deepEqual(withoutNotes.geometry, hotel.geometry);
    assert.equal(withoutNotes.properties.address, hotel.properties.address);
  }
  assert.deepEqual(collectPlaces(trips, places, entries, { kind: "trip", tripId: "revoked" }).places, []);
});
