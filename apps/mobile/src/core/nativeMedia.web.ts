import { MediaIO, MediaPrepared } from './mediaQueue';
import { InputError } from './localStore';
import { stored, changeStored, deleteStoredPrefix } from './webStorage';

function prefix(scope: string) {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw Error('Neispravna pohrana računa.');
  return 'tripora-media://' + scope + '/';
}
async function hash(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())))
    .map(v => v.toString(16).padStart(2, '0')).join('');
}
async function encode(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function png(image: HTMLImageElement, edge: number): Promise<Blob> {
  const ratio = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Obrada fotografije nije dostupna.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Obrada fotografije nije uspjela.')), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; }
}
export async function deleteNativeMediaScope(scope: string) { await deleteStoredPrefix('media', prefix(scope)); }
export function createNativeMediaIO(scope: string): MediaIO {
  const base = prefix(scope);
  function destination(id: string, thumb: boolean) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new InputError('Neispravan identifikator slike.');
    return base + id + (thumb ? '.thumb.png' : '.png');
  }
  function own(uri: string) {
    if (!uri.startsWith(base) || !/^[a-f0-9-]{36}(\.thumb)?\.png$/i.test(uri.slice(base.length)))
      throw new InputError('Fotografija ne pripada pohrani ovog računa.');
    return uri;
  }
  async function read(uri: string) {
    const blob = await stored<Blob>('media', own(uri));
    if (!blob) throw new InputError('Lokalna fotografija nije dostupna. Pokušaj ponovno preuzimanje.');
    return blob;
  }
  async function validate(blob: Blob, thumbnail: boolean, expectedHash?: string) {
    if (!blob.size || blob.size > (thumbnail ? 1024 * 1024 : 8 * 1024 * 1024)) throw new InputError('Fotografija je prevelika. Spremi manju sliku ili tekstualnu uspomenu.');
    const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    if (bytes.length !== 24 || ![137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].every((v, i) => bytes[i] === v)) throw new InputError('Fotografija nije ispravan PNG.');
    const view = new DataView(bytes.buffer);
    const w = view.getUint32(16), h = view.getUint32(20), max = thumbnail ? 320 : 1280;
    if (!w || !h || w > max || h > max || (expectedHash && await hash(blob) !== expectedHash)) throw new InputError('Fotografija je oštećena ili prevelika.');
  }
  return {
    async prepare(uri, width, height, id): Promise<MediaPrepared> {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 64000000) throw new InputError('Odaberi manju ili ispravnu fotografiju.');
      const image = new window.Image();
      image.src = uri.startsWith('tripora-media:') ? URL.createObjectURL(await read(uri)) : uri;
      try {
        try { await image.decode(); } catch { throw new InputError('Preglednik ne može otvoriti ovu fotografiju. Odaberi JPEG/PNG ili spremi tekstualnu uspomenu.'); }
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64000000) throw new InputError('Odaberi manju fotografiju.');
        const full = await png(image, 1280), thumbnail = await png(image, 320);
        await validate(full, false); await validate(thumbnail, true);
        const result = { uri: destination(id, false), thumbnailUri: destination(id, true), sha256: await hash(full), thumbnailSha256: await hash(thumbnail) };
        // Both files commit together. The outbox is written only after this resolves.
        await changeStored('media', [{ key: result.uri, value: full }, { key: result.thumbnailUri, value: thumbnail }]);
        return result;
      } finally { if (uri.startsWith('tripora-media:')) URL.revokeObjectURL(image.src); image.src = ''; }
    },
    async base64(uri) { return encode(await read(uri)); },
    async write(id, base64, thumbnail, expectedHash) {
      if (base64.length > (thumbnail ? 1400000 : 11200000)) throw new InputError('Fotografija je prevelika.');
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); } catch { throw new InputError('Fotografija je oštećena.'); }
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' });
      await validate(blob, thumbnail, expectedHash);
      const key = destination(id, thumbnail);
      await changeStored('media', [{ key, value: blob }]);
      return key;
    },
    async remove(uri) { await changeStored('media', [{ key: own(uri) }]); },
  };
}
