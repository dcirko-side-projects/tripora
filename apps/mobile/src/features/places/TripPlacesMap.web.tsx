import { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import * as L from 'leaflet';
import { Place } from '../../core/placeStore';
import { ApiClient } from '../../core/sync';
import { Button, Loading } from '../../ui/components';
import { tokens, ui } from '../../ui/theme';
type Config = { tileUrl: string; attribution: string; attributionUrl: string };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function WebMap({ places, config, fullscreen, onSelect }: { places: Place[]; config: Config; fullscreen: boolean; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const select = useRef(onSelect); select.current = onSelect;
  const key = places.map(p => [p.id, p.name, p.category, p.location?.latitude, p.location?.longitude].join(':')).join('|');
  useEffect(() => {
    if (!container.current) return;
    setFailed(false);
    const map = L.map(container.current, { scrollWheelZoom: false });
    L.tileLayer(config.tileUrl, { maxZoom: 19, crossOrigin: 'anonymous',
      attribution: escapeHtml(config.attribution) }).on('tileerror', () => setFailed(true)).addTo(map);
    const bounds: L.LatLngTuple[] = [];
    places.forEach((place, index) => {
      const coordinate: L.LatLngTuple = [place.location!.latitude, place.location!.longitude];
      bounds.push(coordinate);
      const marker = document.createElement('span');
      marker.textContent = String(index + 1);
      marker.style.cssText = `display:grid;place-items:center;width:36px;height:36px;border:2px solid white;border-radius:50%;color:white;font-weight:700;background:${place.category === 'food' ? tokens.color.accentInk : place.category === 'nightlife' ? tokens.color.text : tokens.color.primaryInk}`;
      L.marker(coordinate, { title: `${index + 1}. ${place.name}`, alt: place.name,
        icon: L.divIcon({ html: marker, className: 'tripora-marker', iconSize: [40,40], iconAnchor: [20,20] }) })
        .on('click', () => select.current(place.id)).addTo(map);
    });
    if (bounds.every(c => c[0] === bounds[0][0] && c[1] === bounds[0][1])) map.setView(bounds[0], 14);
    else map.fitBounds(bounds, { padding: [40,40], maxZoom: 16 });
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [key, config, fullscreen]);
  return <View style={fullscreen ? { flex: 1, minHeight: 200 } : undefined}>
    {failed ? <Text accessibilityRole="alert" style={ui.error}>Dio karte nije dostupan. Provjeri internet; spremljeni popis ostaje dostupan.</Text> : null}
    <div ref={container} role="region" aria-label="Karta spremljenih mjesta" style={{ height: fullscreen ? '100%' : 380, minHeight: 200, flex: 1, borderRadius: fullscreen ? 0 : 16, isolation: 'isolate' }} />
  </View>;
}
export function TripPlacesMap({ places, api, onSelect }: { places: Place[]; api?: ApiClient; onSelect: (id: string) => void }) {
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
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
  if (!located.length) return <Text style={ui.muted}>Još nema mjesta s potvrđenim položajem. U obrascu mjesta odaberi „Pronađi mjesto”.</Text>;
  if (error) return <View><Text style={ui.error}>{error}</Text><Button title="Pokušaj učitati kartu ponovno" onPress={() => setAttempt(n => n + 1)} /></View>;
  if (!config) return <Loading />;
  const select = (id: string) => { setFullscreen(false); onSelect(id); };
  return <View style={{ gap: 8 }}>
    <Button title="Otvori kartu preko cijelog zaslona" variant="secondary" icon="expand" onPress={() => setFullscreen(true)} />
    {!fullscreen ? <WebMap places={located} config={config} fullscreen={false} onSelect={select} /> : null}
    <Modal visible={fullscreen} onRequestClose={() => setFullscreen(false)}>
      {fullscreen ? <View style={[ui.safe, { paddingTop: 16 }]}><Button title="Zatvori kartu" variant="secondary" onPress={() => setFullscreen(false)} /><WebMap places={located} config={config} fullscreen onSelect={select} /></View> : null}
    </Modal>
    <Text style={ui.caption}>Plavo: mjesta · ružičasto: hrana · tamno: izlasci. Dodirni oznaku za detalje. Karta treba internet.</Text>
    {config.attributionUrl.startsWith('https://') ? <a href={config.attributionUrl} target="_blank" rel="noopener noreferrer">{config.attribution}</a> : <Text>{config.attribution}</Text>}
  </View>;
}
