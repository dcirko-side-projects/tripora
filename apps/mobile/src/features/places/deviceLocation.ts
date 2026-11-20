import type { LocationFix, LocationFailure } from './locationTypes';

export async function watchDeviceLocation(update: (fix: LocationFix) => void, fail: (reason: LocationFailure) => void, signal: AbortSignal) {
  const location = await import('expo-location');
  if (signal.aborted) return;
  const permission = await location.requestForegroundPermissionsAsync();
  if (signal.aborted) return;
  if (!permission.granted) { fail('denied'); return; }
  if (!await location.hasServicesEnabledAsync()) { fail('unavailable'); return; }
  if (signal.aborted) return;
  const subscription = await location.watchPositionAsync({ accuracy: location.Accuracy.Balanced, mayShowUserSettingsDialog: false },
    ({ coords }) => update({ latitude: coords.latitude, longitude: coords.longitude }), () => fail('unavailable'));
  if (signal.aborted) subscription.remove();
  else signal.addEventListener('abort', () => subscription.remove(), { once: true });
}
