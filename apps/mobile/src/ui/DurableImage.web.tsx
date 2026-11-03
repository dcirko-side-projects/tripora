import { useEffect, useState } from 'react';
import { Image, ImageProps, Text } from 'react-native';
import { stored } from '../core/webStorage';
export function DurableImage(props: ImageProps) {
  const original = props.source && !Array.isArray(props.source) && typeof props.source === 'object' ? props.source.uri : undefined;
  const [resolved, setResolved] = useState<{ uri: string; objectUrl: string }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, objectUrl: string | undefined;
    setResolved(undefined); setFailed(false);
    if (original?.startsWith('tripora-media:')) {
      void stored<Blob>('media', original).then(blob => {
        if (!blob) throw Error('missing');
        if (active) { objectUrl = URL.createObjectURL(blob); setResolved({ uri: original, objectUrl }); }
      }).catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [original]);
  if (!original?.startsWith('tripora-media:')) return <Image {...props} />;
  if (failed) return <Text accessibilityRole="alert">Lokalna fotografija nije dostupna. Pokušaj je ponovno preuzeti.</Text>;
  return resolved?.uri === original ? <Image {...props} source={{ uri: resolved.objectUrl }} /> : null;
}
