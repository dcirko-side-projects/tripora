import type { ReactNode } from 'react';
import type { Place } from '../../core/placeStore';
import type { ApiClient } from '../../core/sync';

export type MapProps = {
  places: Place[];
  api?: ApiClient;
  onSelect: (id: string) => void;
  filters?: ReactNode;
  overlay?: (fullscreen: boolean) => ReactNode;
  onCloseOverlay?: () => void;
};
// Category letters remain recognizable without color; initials identify the saved spot.
export function markerLabel(place: Place): string {
  const category = { place: 'M', food: 'H', nightlife: 'I' }[place.category];
  const initials = place.name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('hr');
  return `${category}\u00b7${initials}`;
}
