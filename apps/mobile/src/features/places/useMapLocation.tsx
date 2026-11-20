import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../ui/components';
import { ui } from '../../ui/theme';
import { watchDeviceLocation } from './deviceLocation';
import type { LocationFailure, LocationFix } from './locationTypes';

const messages: Record<LocationFailure, string> = {
  denied: 'Dozvola za lokaciju je odbijena. Dopusti lokaciju u postavkama uređaja ili preglednika.',
  unavailable: 'Lokacija nije dostupna. Provjeri jesu li uključene usluge lokacije.',
  timeout: 'Položaj još nije pronađen. Pokušaj ponovno na otvorenom.',
  error: 'Nije moguće očitati lokaciju. Pokušaj ponovno.',
};

export function useMapLocation(center: (fix: LocationFix) => void) {
  const [fix, setFix] = useState<LocationFix>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LocationFailure>();
  const watch = useRef<AbortController>(null);
  const centerMap = useRef(center);
  centerMap.current = center;
  useEffect(() => () => watch.current?.abort(), []);

  function locate() {
    if (fix) { centerMap.current(fix); return; }
    if (watch.current && !watch.current.signal.aborted) return;
    const controller = new AbortController();
    watch.current = controller;
    setError(undefined);
    setBusy(true);
    let first = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearTimer = () => clearTimeout(timer);
    const fail = (reason: LocationFailure) => {
      if (controller.signal.aborted) return;
      controller.abort();
      setFix(undefined);
      setBusy(false);
      setError(reason);
    };
    controller.signal.addEventListener('abort', clearTimer, { once: true });
    void watchDeviceLocation(point => {
      if (controller.signal.aborted) return;
      if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90
        || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) { fail('error'); return; }
      setFix(point);
      if (!first) return;
      first = false;
      clearTimer();
      setBusy(false);
      centerMap.current(point);
    }, fail, controller.signal).then(() => {
      if (first && !controller.signal.aborted) timer = setTimeout(() => fail('timeout'), 15000);
    }).catch(() => fail('error'));
  }

  const title = busy ? 'Tražim lokaciju…' : 'Centriraj na moju lokaciju';
  const status = error ? <Text accessibilityRole="alert" style={ui.error}>{messages[error]}</Text> : null;
  return { fix, locate, title, busy, status, control: <View>
    <Button title={title} icon="locate" variant="secondary" disabled={busy} onPress={locate} />
    {status}
  </View> };
}
