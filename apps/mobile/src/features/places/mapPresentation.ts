import type { ReactNode } from 'react';
import type { ApiClient } from '../../core/sync';
import type { Place } from '../../core/placeStore';
import { iconPaths, type IconName } from '../../ui/Icon';
import { tokens } from '../../ui/theme';

export type MapProps = {
  places: Place[];
  api?: ApiClient;
  onSelect: (id: string) => void;
  filters?: ReactNode;
  fullscreenSearch?: ReactNode;
  fullscreenFilters?: ReactNode;
  overlay?: (fullscreen: boolean) => ReactNode;
  onCloseOverlay?: () => void;
};
// Use only persisted categories; never infer a restaurant/cafe/etc. from its name.
export function markerAppearance(category?: string): { icon: IconName; color: string; label: string } {
  switch (category) {
    case 'food': return { icon: 'food', color: tokens.color.accentInk, label: 'Hrana' };
    case 'nightlife': return { icon: 'nightlife', color: tokens.color.text, label: 'Izlasci' };
    default: return { icon: 'pin', color: tokens.color.primaryInk, label: 'Mjesto' };
  }
}

// Fixed application-owned paths only; saved names/notes never enter SVG markup.
export function markerSvg(icon: IconName): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[icon]}"/>${icon === 'pin' ? '<circle cx="12" cy="10" r="2"/>' : ''}</svg>`;
}
