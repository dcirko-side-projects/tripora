import { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import * as L from 'leaflet';
import { markerAppearance, markerSvg, MapProps } from './mapPresentation';
import { Place } from '../../core/placeStore';
import { Button, Loading } from '../../ui/components';
import { tokens, ui } from '../../ui/theme';
import { FullscreenMapFrame } from './FullscreenMapFrame';
type Config = { tileUrl: string; attribution: string; attributionUrl: string };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function WebMap({ places, config, fullscreen, onSelect, selectedId, viewport }: { places: Place[]; config: Config; fullscreen: boolean; onSelect: (id: string) => void; selectedId?: string; viewport: { current: { center: L.LatLng; zoom: number } | undefined } }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const select = useRef(onSelect); select.current = onSelect;
  const markers = useRef(new Map<string, { marker: L.Marker; ring: HTMLElement }>());
  const key = places.map(p => [p.id, p.name, p.category, p.location?.latitude, p.location?.longitude].join(':')).join('|');
  useEffect(() => {
    if (!container.current) return;
    setFailed(false);
    // ResizeObserver handles the actual map box, including orientation/keyboard changes.
    const map = L.map(container.current, { scrollWheelZoom: false, trackResize: false });
    L.tileLayer(config.tileUrl, { maxZoom: 19, crossOrigin: 'anonymous',
      attribution: escapeHtml(config.attribution) }).on('tileerror', () => setFailed(true)).addTo(map);
    const bounds: L.LatLngTuple[] = [];
    places.forEach((place) => {
      const coordinate: L.LatLngTuple = [place.location!.latitude, place.location!.longitude];
      bounds.push(coordinate);
      const appearance = markerAppearance(place.category);
      const ring = document.createElement('span');
      ring.style.cssText = 'display:grid;place-items:center;box-sizing:border-box;width:52px;height:52px;border:3px solid transparent;border-radius:50%';
      const face = document.createElement('span');
      face.dataset.icon = appearance.icon;
      face.innerHTML = markerSvg(appearance.icon);
      face.style.cssText = `display:grid;place-items:center;box-sizing:border-box;width:40px;height:40px;border:2px solid ${tokens.color.surface};border-radius:50%;color:${tokens.color.surface};background:${appearance.color};box-shadow:0 2px 5px #15334340`;
      ring.appendChild(face);
      const marker = L.marker(coordinate, { title: `${appearance.label}: ${place.name}`, alt: place.name,
        icon: L.divIcon({ html: ring, className: 'tripora-marker', iconSize: [52,52], iconAnchor: [26,26] }) })
        .on('click', () => select.current(place.id)).addTo(map);
      marker.getElement()?.setAttribute('aria-label', `${appearance.label}: ${place.name}`);
      markers.current.set(place.id, { marker, ring });
    });
    if (viewport.current) map.setView(viewport.current.center, viewport.current.zoom);
    else if (bounds.length && bounds.every(c => c[0] === bounds[0][0] && c[1] === bounds[0][1])) map.setView(bounds[0], 14);
    else if (bounds.length) map.fitBounds(bounds, { paddingTopLeft: [40,40], paddingBottomRight: [40, fullscreen ? 160 : 40], maxZoom: 16 });
    if (!bounds.length && !viewport.current) map.setView([0, 0], 2);
    const remember = () => { viewport.current = { center: map.getCenter(), zoom: map.getZoom() }; };
    map.on('moveend zoomend', remember);
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    return () => { remember(); observer.disconnect(); markers.current.clear(); map.off('moveend zoomend', remember); map.remove(); };
  }, [key, config, fullscreen]);
  useEffect(() => {
    for (const [id, { marker, ring }] of markers.current) {
      const selected = id === selectedId;
      ring.style.borderColor = selected ? tokens.color.primaryInk : 'transparent';
      ring.style.background = selected ? tokens.color.surface : 'transparent';
      marker.setZIndexOffset(selected ? 1000 : 0);
      marker.getElement()?.setAttribute('aria-pressed', String(selected));
    }
  }, [selectedId, key, config, fullscreen]);
  return <View style={fullscreen ? { flex: 1, minHeight: 0 } : undefined}>
    {failed ? <Text accessibilityRole="alert" style={ui.error}>Dio karte nije dostupan. Provjeri internet; spremljeni popis ostaje dostupan.</Text> : null}
    <div ref={container} role="region" aria-label="Karta spremljenih mjesta" style={{ height: fullscreen ? '100%' : 380, minHeight: fullscreen ? 0 : 200, flex: 1, borderRadius: fullscreen ? 0 : 16, isolation: 'isolate' }} />
  </View>;
}
export function TripPlacesMap({ places, api, onSelect, filters, fullscreenSearch, fullscreenFilters, overlay, onCloseOverlay }: MapProps) {
  const viewport = useRef<{ center: L.LatLng; zoom: number } | undefined>(undefined);
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const located = places.filter(p => !p.deleted && p.location);
  useEffect(() => {
    let active = true;
    setConfig(undefined); setError('');
    if (!api) { setError('Za kartu se poveži sa serverom.'); return; }
    void api.request<Config>('/api/maps/config').then(value => {
      if (!/^https:\/\//.test(value.tileUrl) || !['{x}', '{y}', '{z}'].every(part => value.tileUrl.includes(part))) throw Error('config');
      if (active) setConfig(value);
    }).catch(() => { if (active) setError('Karta nije dostupna. Provjeri internet ili koristi spremljeni popis.'); });
    return () => { active = false; };
  }, [api, attempt]);
  if (error) return <View>{filters}<Text style={ui.error}>{error}</Text><Button title="Pokušaj učitati kartu ponovno" onPress={() => setAttempt(n => n + 1)} />{overlay?.(false)}</View>;
  if (!config) return <View>{filters}<Loading />{overlay?.(false)}</View>;
  const mapFilters = <>{filters}{!located.length ? <Text style={ui.muted}>Nema mjesta s položajem za odabrane filtre.</Text> : null}</>;
  const select = (id: string) => { setSelectedId(id); onSelect(id); };
  return <View style={{ gap: 8 }}>
    <Button title="Otvori kartu preko cijelog zaslona" variant="secondary" icon="expand" onPress={() => setFullscreen(true)} />
    {!fullscreen ? <>{mapFilters}<View><WebMap viewport={viewport} places={located} config={config} fullscreen={false} selectedId={selectedId} onSelect={select} />{overlay?.(false)}</View></> : null}
    <Modal visible={fullscreen} onRequestClose={() => overlay ? onCloseOverlay?.() : setFullscreen(false)}>
      {fullscreen ? <FullscreenMapFrame search={fullscreenSearch} filters={fullscreenFilters} empty={!located.length}
        onClose={() => setFullscreen(false)} overlay={overlay?.(true)}>
        <WebMap viewport={viewport} places={located} config={config} fullscreen selectedId={selectedId} onSelect={select} />
      </FullscreenMapFrame> : null}
    </Modal>
    <Text style={ui.caption}>Pin: mjesta · pribor za jelo: hrana · čaša: izlasci. Dodirni oznaku za detalje; prsten označava odabrano mjesto. Karta treba internet.</Text>
    {config.attributionUrl.startsWith('https://') ? <a href={config.attributionUrl} target="_blank" rel="noopener noreferrer">{config.attribution}</a> : <Text>{config.attribution}</Text>}
  </View>;
}
