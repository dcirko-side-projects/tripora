import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import type * as MapLibre from '@maplibre/maplibre-react-native';
import { Place } from '../../core/placeStore';
import { ApiClient } from '../../core/sync';
import { Button, Loading } from '../../ui/components';
import { tokens, ui } from '../../ui/theme';
type Config = { tileUrl: string; attribution: string; attributionUrl: string };

export function TripPlacesMap({ places, api, onSelect }: { places: Place[]; api?: ApiClient; onSelect: (id: string) => void }) {
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const located = places.filter(p => p.location && !p.deleted);
  useEffect(() => {
    let active = true;
    setConfig(undefined); setError('');
    if (!api) { setError('Za kartu se poveži sa serverom. Popis ostaje dostupan bez interneta.'); return; }
    void api.request<Config>('/api/maps/config').then(value => {
      if (!/^https:\/\//.test(value.tileUrl) || !value.tileUrl.includes('{z}') || !value.tileUrl.includes('{x}') || !value.tileUrl.includes('{y}')) throw Error('config');
      if (active) setConfig(value);
    }).catch(() => { if (active) setError('Karta nije dostupna. Provjeri internet ili nastavi koristiti spremljeni popis.'); });
    return () => { active = false; };
  }, [api, attempt]);
  if (!located.length) return <Text style={ui.muted}>Još nema mjesta s potvrđenim položajem. U obrascu mjesta odaberi „Pronađi mjesto”.</Text>;
  if (error) return <View style={ui.errorBox}><Text style={ui.error}>{error}</Text><Button title="Pokušaj učitati kartu ponovno" variant="secondary" onPress={() => setAttempt(v => v + 1)} /></View>;
  if (!config) return <Loading />;
  // Keep saved lists usable in Expo Go/older installed builds lacking this native module.
  let native: typeof MapLibre;
  try { native = require('@maplibre/maplibre-react-native'); }
  catch { return <Text style={ui.muted}>Za kartu treba nova instalacijska verzija aplikacije. Spremljeni popis i dalje radi.</Text>; }
  return <NativePlacesMap native={native} config={config} places={located} onSelect={onSelect} onError={() => setError('Podloga karte nije dostupna. Spremljeni popis ostaje dostupan.')} />;
}

function NativePlacesMap({ native, config, places, onSelect, onError }: { native: typeof MapLibre; config: Config; places: Place[]; onSelect: (id: string) => void; onError: () => void }) {
  const { Map, Camera, Marker, TransformRequestManager } = native;
  const [networkReady, setNetworkReady] = useState(false);
  const coordinates = places.map(p => [p.location!.longitude, p.location!.latitude]);
  const xs = coordinates.map(c => c[0]), ys = coordinates.map(c => c[1]);
  const samePoint = Math.max(...xs) === Math.min(...xs) && Math.max(...ys) === Math.min(...ys);
  useEffect(() => {
    // No auth headers/credentials are sent to tile providers.
    TransformRequestManager.addHeader({ id: 'tripora-user-agent', name: 'User-Agent', value: 'Tripora/0.1' });
    setNetworkReady(true);
    return () => { TransformRequestManager.removeHeader('tripora-user-agent'); };
  }, [TransformRequestManager]);
  if (!networkReady) return <Loading />;
  return <View style={{ gap: 8 }}>
    <Map key={places.map(p => p.id + ':' + p.location!.latitude + ':' + p.location!.longitude).join('|') + config.tileUrl}
      style={{ height: 380, borderRadius: 16, overflow: 'hidden' }}
      mapStyle={{ version: 8, sources: { osm: { type: 'raster', tiles: [config.tileUrl], tileSize: 256, maxzoom: 19, attribution: config.attribution } }, layers: [{ id: 'base', type: 'raster', source: 'osm' }] }}
      attribution onDidFailLoadingMap={onError}>
      <Camera maxZoom={19} initialViewState={samePoint
        ? { center: [xs[0], ys[0]], zoom: 14 }
        : { bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], padding: { top: 48, bottom: 48, left: 48, right: 48 } }} />
      {places.map((p, index) => <Marker key={p.id} id={p.id} lngLat={[p.location!.longitude, p.location!.latitude]} onPress={() => onSelect(p.id)}>
        <View accessibilityLabel={`${index + 1}. ${p.name}`} style={{ minWidth: 40, minHeight: 40, padding: 8, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: tokens.color.surface,
          backgroundColor: p.category === 'food' ? tokens.color.accentInk : p.category === 'nightlife' ? tokens.color.text : tokens.color.primaryInk }}>
          <Text style={{ color: tokens.color.surface, fontWeight: '700' }}>{index + 1}</Text>
        </View>
      </Marker>)}
    </Map>
    <Text style={ui.caption}>Plavo: mjesta · ružičasto: hrana · tamno: izlasci. Dodirni oznaku za detalje.</Text>
    <Text style={ui.caption}>Karta treba internet. Mjesta bez položaja prikazana su samo u popisu.</Text>
    <Button title={config.attribution} variant="ghost" onPress={() => {
      if (config.attributionUrl.startsWith('https://')) void Linking.openURL(config.attributionUrl).catch(onError);
    }} />
  </View>;
}
