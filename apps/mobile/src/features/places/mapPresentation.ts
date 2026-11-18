import type { ReactNode } from 'react';
import type { ApiClient } from '../../core/sync';
import { placeCategories, type Place, type PlaceCategory } from '../../core/placeStore';
import { iconPaths, type IconName } from '../../ui/Icon';
import { tokens } from '../../ui/theme';

export type MapProps = {
  places: Place[];
  scopeKey?: string;
  api?: ApiClient;
  onSelect: (id: string) => void;
  filters?: ReactNode;
  fullscreenSearch?: ReactNode;
  fullscreenFilters?: ReactNode;
  overlay?: (fullscreen: boolean) => ReactNode;
  onCloseOverlay?: () => void;
};
export const fullscreenMapBottomPadding = 200;
const appearances: Record<PlaceCategory, { icon: IconName; color: string; label: string }> = {
  place: { icon: 'pin', color: tokens.color.primaryInk, label: 'Mjesto' },
  food: { icon: 'food', color: tokens.color.accentInk, label: 'Hrana' },
  nightlife: { icon: 'nightlife', color: tokens.color.text, label: 'Izlasci' },
  accommodation: { icon: 'bed', color: '#58438D', label: 'Smještaj' },
};
export const categoryOptions = placeCategories.map(category => [category, category === 'place' ? 'Mjesta' : appearances[category].label] as const);

export function markerAppearance(category?: string) {
  return placeCategories.includes(category as PlaceCategory) ? appearances[category as PlaceCategory] : appearances.place;
}

// Fixed application-owned paths only; saved names/notes never enter SVG markup.
export function markerSvg(icon: IconName): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[icon]}"/>${icon === 'pin' ? '<circle cx="12" cy="10" r="2"/>' : ''}</svg>`;
}
