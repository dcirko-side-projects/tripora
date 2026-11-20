import type { LocationFix, LocationFailure } from './locationTypes';

export async function watchDeviceLocation(update: (fix: LocationFix) => void, fail: (reason: LocationFailure) => void, signal: AbortSignal) {
  const geolocation = navigator.geolocation;
  if (!geolocation) { fail('unavailable'); return; }
  const watch = geolocation.watchPosition(({ coords }) => update({ latitude: coords.latitude, longitude: coords.longitude }),
    error => fail(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  signal.addEventListener('abort', () => geolocation.clearWatch(watch), { once: true });
}
