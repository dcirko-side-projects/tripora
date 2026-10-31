import { InputError, LocalDatabase } from './localStore';
import { Actor, Entry, entrySnapshot, readParent } from './entryStore';
import { ApiClient, ApiError } from './sync';
import { actionError } from './actionError';
export type MediaPrepared = {
    uri: string;
    thumbnailUri: string;
    sha256: string;
    thumbnailSha256: string;
};
export type LocalMedia = MediaPrepared & {
    recoveryCopies?: MediaPrepared;
    id: string;
    tripId: string;
    authorId: string;
    createdAt: string;
    state: 'pending' | 'uploaded' | 'downloaded';
    error: string | null;
};
export interface MediaIO {
    prepare(uri: string, width: number, height: number, id: string): Promise<MediaPrepared>;
    repairOversized?(item: LocalMedia): Promise<MediaPrepared | null>;
    base64(uri: string): Promise<string>;
    write(id: string, base64: string, thumbnail: boolean, expectedHash: string): Promise<string>;
    remove(uri: string): Promise<void>;
}
export function mediaSnapshot(db: LocalDatabase): LocalMedia[] { return db.all<{
    body: string;
}>('SELECT body FROM local_media').map(r => JSON.parse(r.body)); }
function put(db: LocalDatabase, m: LocalMedia) { db.run('INSERT INTO local_media (id,trip_id,body) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body', [m.id, m.tripId, JSON.stringify(m)]); }
export async function attachPhoto(db: LocalDatabase, tripId: string, actor: Actor, io: MediaIO, selection: {
    uri: string;
    width: number;
    height: number;
}, id: string): Promise<LocalMedia> {
    const trip = readParent(db, tripId);
    if (trip.deleted || trip.accessRevoked)
        throw new InputError('Pristup putovanju nije dostupan.');
    if (mediaSnapshot(db).filter(m => m.tripId === tripId).length >= 100)
        throw new InputError('Razvojna granica je 100 fotografija po putovanju. Prvo obriši nepotrebne uspomene.');
    const prepared = await io.prepare(selection.uri, selection.width, selection.height, id);
    const item: LocalMedia = { ...prepared, id, tripId, authorId: actor.id, createdAt: new Date().toISOString(), state: 'pending', error: null };
    try {
        put(db, item);
    }
    catch (error) {
        await io.remove(item.uri);
        await io.remove(item.thumbnailUri);
        throw error;
    }
    return item;
}
function references(entries: Entry[], includeDeleted = false): Set<string> { return new Set(entries.filter(e => e.feature === 'memory' && (includeDeleted || !e.deleted)).flatMap(e => e.feature === 'memory' && e.data.mediaId ? [e.data.mediaId] : [])); }
function pendingReferences(db: LocalDatabase): Set<string> {
    const snapshot = entrySnapshot(db);
    const result = references(snapshot.entries.filter(e => snapshot.pending.some(p => p.operation.entryId === e.id)), true);
    for (const p of snapshot.pending)
        if (p.operation.feature === 'memory' && p.operation.data && 'mediaId' in p.operation.data && p.operation.data.mediaId)
            result.add(p.operation.data.mediaId);
    return result;
}
export async function synchronizeMedia(db: LocalDatabase, api: ApiClient, io?: MediaIO): Promise<number> {
    const needed = pendingReferences(db);
    let errors = 0;
    for (let item of mediaSnapshot(db)) {
        if (!needed.has(item.id) || item.state === 'downloaded')
            continue;
        const trip = readParent(db, item.tripId);
        if (trip.accessRevoked || trip.deleted) {
            put(db, { ...item, error: 'Slanje fotografije je pauzirano jer pristup nije dostupan.' });
            errors++;
            continue;
        }
        if (trip.version === 0)
            continue;
        if (!io) {
            put(db, { ...item, error: 'Pohrana fotografija nije dostupna u ovoj sesiji.' });
            errors++;
            continue;
        }
        try {
            const send = async () => api.request('/api/media/push', { id: item.id, tripId: item.tripId, pngBase64: await io.base64(item.uri), thumbnailBase64: await io.base64(item.thumbnailUri), sha256: item.sha256, thumbnailSha256: item.thumbnailSha256 });
            try {
                await send();
            }
            catch (error) {
                // Oversized PNGs cannot have been accepted by the server. Keep entry IDs/outbox intact.
                if (!(error instanceof ApiError) || error.status !== 400 || error.body.code !== 'invalid_media' || item.state !== 'pending' || !io.repairOversized)
                    throw error;
                const prepared = await io.repairOversized(item);
                if (!prepared)
                    throw error;
                const repaired = { ...item, ...prepared, recoveryCopies: item.recoveryCopies ?? { uri: item.uri, thumbnailUri: item.thumbnailUri, sha256: item.sha256, thumbnailSha256: item.thumbnailSha256 }, error: null };
                try { put(db, repaired); }
                catch (storageError) {
                    await io.remove(prepared.uri);
                    await io.remove(prepared.thumbnailUri);
                    throw storageError;
                }
                item = repaired;
                await send();
            }
            put(db, { ...item, state: 'uploaded', error: null });
        }
        catch (error) {
            if (error instanceof ApiError && error.status === 401)
                throw error;
            put(db, { ...item, error: actionError(error) });
            errors++;
        }
    }
    return errors;
}
export function mediaReady(db: LocalDatabase, id: string | null): boolean { if (!id)
    return true; const item = mediaSnapshot(db).find(m => m.id === id); return !item || ((item.state === 'uploaded' || item.state === 'downloaded') && !item.error); }
export async function downloadPhoto(db: LocalDatabase, entry: Entry, actor: Actor, api: ApiClient, io: MediaIO): Promise<void> {
    if (entry.feature !== 'memory' || !entry.data.mediaId || entry.deleted)
        throw new InputError('Fotografija nije dostupna.');
    const trip = readParent(db, entry.tripId);
    if (trip.accessRevoked || trip.deleted)
        throw new InputError('Pristup fotografiji je uklonjen.');
    const id = entry.data.mediaId;
    const image = await api.request<{
        base64: string;
        sha256: string;
    }>(`/api/media/${id}`);
    const previous = mediaSnapshot(db).find(m => m.id === id);
    const thumbnail = await api.request<{
        base64: string;
        sha256: string;
    }>(`/api/media/${id}?thumbnail=true`);
    const uri = await io.write(id, image.base64, false, image.sha256);
    let thumbnailUri: string;
    try {
        thumbnailUri = await io.write(id, thumbnail.base64, true, thumbnail.sha256);
    }
    catch (error) {
        if (!previous)
            await io.remove(uri);
        throw error;
    }
    try {
        put(db, { id, tripId: entry.tripId, authorId: entry.authorId || actor.id, createdAt: entry.createdAt, uri, thumbnailUri, sha256: image.sha256, thumbnailSha256: thumbnail.sha256, state: 'downloaded', error: null, ...(previous?.recoveryCopies ? { recoveryCopies: previous.recoveryCopies } : {}) });
    }
    catch (error) {
        if (!previous) {
            await io.remove(uri);
            await io.remove(thumbnailUri);
        }
        throw error;
    }
}
export async function cleanupLocalMedia(db: LocalDatabase, io: MediaIO): Promise<void> {
    const all = entrySnapshot(db);
    const used = references(all.entries);
    for (const id of pendingReferences(db))
        used.add(id);
    const confirmedDeleted = references(all.entries.filter(e => e.deleted && !all.pending.some(p => p.operation.entryId === e.id)), true);
    for (const item of mediaSnapshot(db))
        if (!used.has(item.id) && (confirmedDeleted.has(item.id) || Date.parse(item.createdAt) < Date.now() - 7 * 86400000)) {
            try {
                await io.remove(item.uri);
                await io.remove(item.thumbnailUri);
                if (item.recoveryCopies) {
                    await io.remove(item.recoveryCopies.uri);
                    await io.remove(item.recoveryCopies.thumbnailUri);
                }
                db.run('DELETE FROM local_media WHERE id=?', [item.id]);
            }
            catch {
                put(db, { ...item, error: 'Lokalna kopija čeka ponovno čišćenje.' });
            }
        }
}
export async function discardUnattachedPhoto(db: LocalDatabase, id: string, io: MediaIO): Promise<void> {
    if (references(entrySnapshot(db).entries).has(id) || pendingReferences(db).has(id))
        return;
    const item = mediaSnapshot(db).find(m => m.id === id);
    if (!item)
        return;
    await io.remove(item.uri);
    await io.remove(item.thumbnailUri);
    if (item.recoveryCopies) {
        await io.remove(item.recoveryCopies.uri);
        await io.remove(item.recoveryCopies.thumbnailUri);
    }
    db.run('DELETE FROM local_media WHERE id=?', [id]);
}
