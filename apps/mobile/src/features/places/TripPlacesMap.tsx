import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type * as MapLibre from '@maplibre/maplibre-react-native';
import { markerLabel, MapProps } from './mapPresentation';
import { Place } from '../../core/placeStore';
import { Button, Loading } from '../../ui/components';
import { tokens, ui } from '../../ui/theme';
type Config = { tileUrl: string; attribution: string; attributionUrl: string };

export function TripPlacesMap({ places, api, onSelect, filters, overlay, onCloseOverlay }: MapProps) {
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
  if (error) return <View style={ui.errorBox}>{filters}<Text style={ui.error}>{error}</Text><Button title="Pokušaj učitati kartu ponovno" variant="secondary" onPress={() => setAttempt(v => v + 1)} />{overlay?.(false)}</View>;
  if (!config) return <View>{filters}<Loading />{overlay?.(false)}</View>;
  // Keep saved lists usable in Expo Go/older installed builds lacking this native module.
  let native: typeof MapLibre;
  try { native = require('@maplibre/maplibre-react-native'); }
  catch { return <View>{filters}<Text style={ui.muted}>Za kartu treba nova instalacijska verzija aplikacije. Spremljeni popis i dalje radi.</Text>{overlay?.(false)}</View>; }
  return <NativePlacesMap filters={filters} overlay={overlay} onCloseOverlay={onCloseOverlay} native={native} config={config} places={located} onSelect={onSelect} onError={() => setError('Podloga karte nije dostupna. Spremljeni popis ostaje dostupan.')} />;
}

function NativePlacesMap({ native, config, places, onSelect, onError, filters, overlay, onCloseOverlay }: Omit<MapProps, 'api'> & { native: typeof MapLibre; config: Config; onError: () => void }) {
  const { Map, Camera, Marker, TransformRequestManager } = native;
  const [networkReady, setNetworkReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const viewport = useRef<MapLibre.InitialViewState | undefined>(undefined);
  const selectPlace = onSelect;
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
  const mapFilters = <>{filters}{!places.length ? <Text style={ui.muted}>Nema mjesta s položajem za odabrane filtre.</Text> : null}</>;
  const map = <Map key={places.map(p => p.id + ':' + p.location!.latitude + ':' + p.location!.longitude).join('|') + config.tileUrl}
      style={fullscreen ? { flex: 1 } : { height: 380, borderRadius: 16, overflow: 'hidden' }}
      mapStyle={{ version: 8, sources: { osm: { type: 'raster', tiles: [config.tileUrl], tileSize: 256, maxzoom: 19, attribution: config.attribution } }, layers: [{ id: 'base', type: 'raster', source: 'osm' }] }}
      attribution onDidFailLoadingMap={onError}
      onRegionIsChanging={event => { const { center, zoom, bearing, pitch } = event.nativeEvent; viewport.current = { center, zoom, bearing, pitch }; }}
      onRegionDidChange={event => { const { center, zoom, bearing, pitch } = event.nativeEvent; viewport.current = { center, zoom, bearing, pitch }; }}>
      <Camera maxZoom={19} initialViewState={viewport.current ?? (!places.length ? undefined : samePoint
        ? { center: [xs[0], ys[0]], zoom: 14 }
        : { bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], padding: { top: 48, bottom: 48, left: 48, right: 48 } })} />
      {places.map((p) => <Marker key={p.id} id={p.id} lngLat={[p.location!.longitude, p.location!.latitude]} onPress={() => selectPlace(p.id)}>
        <View accessibilityLabel={`${markerLabel(p)}. ${p.name}`} style={{ minWidth: 40, minHeight: 40, padding: 8, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: tokens.color.surface,
          backgroundColor: p.category === 'food' ? tokens.color.accentInk : p.category === 'nightlife' ? tokens.color.text : tokens.color.primaryInk }}>
          <Text style={{ color: tokens.color.surface, fontWeight: '700' }}>{markerLabel(p)}</Text>
        </View>
      </Marker>)}
    </Map>;
  return <View style={{ gap: 8 }}>
    <Button title="Otvori kartu preko cijelog zaslona" variant="secondary" icon="expand" onPress={() => setFullscreen(true)} />
    {!fullscreen ? <>{mapFilters}<View>{map}{overlay?.(false)}</View></> : null}
    <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => overlay ? onCloseOverlay?.() : setFullscreen(false)}>
      {fullscreen ?
      <SafeAreaView style={ui.safe}>
        <View style={{ padding: 12, gap: 4 }}>
          <Text accessibilityRole="header" style={ui.subheading}>Karta putovanja</Text>
          <Button title="Zatvori kartu" variant="secondary" icon="close" onPress={() => setFullscreen(false)} />
        </View>
        {mapFilters}
        {map}
        {overlay?.(true)}
      </SafeAreaView> : null}
    </Modal>
    <Text style={ui.caption}>M: mjesta · H: hrana · I: izlasci. Slova iza točke su inicijali naziva. Dodirni oznaku za detalje.</Text>
    <Text style={ui.caption}>Karta treba internet. Mjesta bez položaja prikazana su samo u popisu.</Text>
    <Button title={config.attribution} variant="ghost" onPress={() => {
      if (config.attributionUrl.startsWith('https://')) void Linking.openURL(config.attributionUrl).catch(onError);
    }} />
  </View>;
}
