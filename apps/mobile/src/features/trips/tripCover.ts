import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { saveEntry, type Actor, type Entry } from '../../core/entryStore';
import { attachPhoto, discardUnattachedPhoto, type LocalMedia, type MediaIO } from '../../core/mediaQueue';
import type { LocalDatabase } from '../../core/localStore';
import * as picker from '../../core/photoPicker';

export function tripCover(tripId: string, entries: Entry[], media: LocalMedia[]) {
  const entry = entries.find(item => item.tripId === tripId && item.feature === 'cover' && !item.deleted);
  const id = entry?.feature === 'cover' ? entry.data.mediaId : null;
  return { id, image: id ? media.find(item => item.id === id && item.tripId === tripId) : undefined };
}

export async function changeTripCover(db: LocalDatabase, tripId: string, actor: Actor, io: MediaIO, remove: boolean) {
  if (remove) {
    saveEntry(db, tripId, 'cover', { mediaId: null }, actor, randomUUID, await coverEntryId(tripId));
    return true;
  }
  const permission = await picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw Error('Dopusti pristup fotografijama za odabir naslovne fotografije.');
  const result = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, exif: false, quality: 1 });
  if (result.canceled) return false;
  const entryId = await coverEntryId(tripId);
  const photo = await attachPhoto(db, tripId, actor, io, result.assets[0], randomUUID());
  try {
    saveEntry(db, tripId, 'cover', { mediaId: photo.id }, actor, randomUUID, entryId);
  } catch (error) {
    await discardUnattachedPhoto(db, photo.id, io);
    throw error;
  }
  return true;
}

async function coverEntryId(tripId: string) {
  const hex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, 'tripora:cover:' + tripId.toLowerCase());
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
