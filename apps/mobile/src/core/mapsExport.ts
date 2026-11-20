import type { collectPlaces } from './placesExport';

export type MapsProvider = 'google' | 'apple';
type PlacesData = ReturnType<typeof collectPlaces>;
const maxStops = 5;
export const myMapsRows = 1999; // The import limit includes the column header.

export function mapsStops(data: PlacesData) {
  const planned = data.scope.kind === 'plan' || data.scope.kind === 'day';
  const places = planned ? [...data.places].sort((a, b) =>
    (a.plan[0]?.date ?? '9999').localeCompare(b.plan[0]?.date ?? '9999')
      || (a.plan[0]?.time ?? '99:99').localeCompare(b.plan[0]?.time ?? '99:99')) : data.places;
  return places.flatMap(place => {
    const coordinate = place.location && `${place.location.latitude},${place.location.longitude}`;
    const address = place.address.trim();
    return coordinate || address ? [{ name: place.name, location: coordinate || address, coordinate }] : [];
  });
}

export function mapsUrl(provider: MapsProvider, stops: ReturnType<typeof mapsStops>) {
  const [first] = stops;
  if (!first || stops.length > maxStops) return undefined;
  const points = stops.map(stop => stop.location.replaceAll('|', ' '));
  const query = new URLSearchParams();
  let base: string;
  if (provider === 'google') {
    query.set('api', '1');
    if (stops.length === 1) {
      base = 'https://www.google.com/maps/search/';
      query.set('query', points[0]);
    } else {
      base = 'https://www.google.com/maps/dir/';
      query.set('origin', points[0]);
      query.set('destination', points.at(-1)!);
      if (points.length > 2) query.set('waypoints', points.slice(1, -1).join('|'));
    }
  } else if (stops.length === 1) {
    base = 'https://maps.apple.com/';
    if (first.coordinate) query.set('ll', first.coordinate);
    query.set('q', first.coordinate ? first.name : first.location);
  } else {
    base = 'https://maps.apple.com/directions';
    query.set('source', points[0]);
    query.set('destination', points.at(-1)!);
    for (const point of points.slice(1, -1)) query.append('waypoint', point);
  }
  const url = `${base}?${query}`;
  return url.length <= 2048 ? url : undefined;
}

function csvCell(text: string, guardFormula = true) {
  const value = guardFormula && /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + value.replaceAll('"', '""') + '"';
}

export function serializeMyMaps(stops: ReturnType<typeof mapsStops>) {
  return ['Name,Location', ...stops.map(stop => `${csvCell(stop.name)},${csvCell(stop.location, !stop.coordinate)}`)].join('\r\n') + '\r\n';
}
