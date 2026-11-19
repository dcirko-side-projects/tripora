import type { SyncedTrip } from "./accountStore";
import type { Entry } from "./entryStore";
import type { Place } from "./placeStore";

export type PlacesScope =
  | { kind: "all" }
  | { kind: "trip" | "plan"; tripId: string }
  | { kind: "day"; tripId: string; date: string };

export function planPlaceIds(entries: Entry[], tripId: string, date?: string) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.feature === "plan" && entry.tripId === tripId && !entry.deleted
      && entry.data.placeId && (date === undefined || entry.data.date === date)) {
      ids.add(entry.data.placeId);
    }
  }
  return ids;
}

export function collectPlaces(trips: SyncedTrip[], places: Place[], entries: Entry[], scope: PlacesScope) {
  const includedTrips = trips.filter(trip => !trip.deleted && !trip.accessRevoked &&
    (scope.kind === "all" || trip.id === scope.tripId));
  const tripIds = new Set(includedTrips.map(trip => trip.id));
  const visits = new Map<string, { date: string | null; time: string | null; title: string; notes: string; done: boolean }[]>();
  for (const entry of entries) {
    if (entry.feature !== "plan" || entry.deleted || !entry.data.placeId || !tripIds.has(entry.tripId)
      || (scope.kind === "day" && entry.data.date !== scope.date)) continue;
    const { placeId, date, time, title, notes, done } = entry.data;
    const key = `${entry.tripId}/${placeId}`;
    const scheduled = visits.get(key) ?? [];
    scheduled.push({ date: date || null, time: time || null, title, notes, done });
    visits.set(key, scheduled);
  }
  const plannedOnly = scope.kind === "plan" || scope.kind === "day";
  const includedPlaces = places.flatMap(place => {
    if (place.deleted || !tripIds.has(place.tripId)) return [];
    const plan = visits.get(`${place.tripId}/${place.id}`) ?? [];
    if (plannedOnly && !plan.length) return [];
    plan.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.time ?? "").localeCompare(b.time ?? ""));
    const { id, tripId, name, category, address, notes, link, visited, location } = place;
    return [{ id, tripId, name, category, address, notes, link, visited, location: location ?? null, plan }];
  });
  return {
    schemaVersion: 1,
    scope,
    trips: includedTrips.map(({ id, name, destination, startDate, endDate }) => ({ id, name, destination, startDate, endDate })),
    places: includedPlaces,
  };
}

export type PlacesExportFormat = "json" | "geojson";

export function serializePlaces(data: ReturnType<typeof collectPlaces>, format: PlacesExportFormat, includeNotes = true) {
  if (format === "json") return JSON.stringify(data, null, 2);
  const { places, ...metadata } = data;
  const features = places.flatMap(({ location, notes, plan, ...properties }) => location ? [{
    type: "Feature",
    id: properties.id,
    geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
    properties: {
      ...properties,
      ...(includeNotes ? { notes, plan } : { plan: plan.map(({ notes: _notes, ...visit }) => visit) }),
      displayName: location.displayName, provider: location.provider, providerId: location.providerId,
    },
  }] : []);
  return JSON.stringify({
    type: "FeatureCollection",
    ...metadata,
    attribution: "© OpenStreetMap contributors",
    features,
  }, null, 2);
}
