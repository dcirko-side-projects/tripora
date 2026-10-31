import { LocalDatabase } from './localStore';
import { Actor, Entry, ENTRY_ACCESS_REMOVED, acknowledgeEntry, applyEntryPage, entrySnapshot, markEntryError, readParent, refreshEntryAccess } from './entryStore';
import { mediaReady } from './mediaQueue';
import { ApiClient, ApiError } from './sync';
export async function synchronizeEntries(db: LocalDatabase, api: ApiClient, actor?: Actor): Promise<{
    conflicts: number;
    errors: number;
}> {
    db.transaction(() => refreshEntryAccess(db));
    const attempted = new Set<string>();
    for (let count = 0; count < 200; count++) {
        const pending = entrySnapshot(db).pending.filter(p => !attempted.has(p.operation.operationId) && !p.conflict && p.error !== ENTRY_ACCESS_REMOVED).sort((a, b) => Number(b.operation.feature === 'budget') - Number(a.operation.feature === 'budget'))[0];
        if (!pending)
            break;
        const op = pending.operation;
        attempted.add(op.operationId);
        const trip = readParent(db, op.tripId);
        if (trip.deleted || trip.accessRevoked) {
            markEntryError(db, op.operationId, 'Putovanje je obrisano ili pristup nije dostupan. Promjena je sačuvana.');
            continue;
        }
        if (trip.version === 0)
            continue;
        if (op.data && 'placeId' in op.data && op.data.placeId) {
            const row = db.all<{
                body: string;
            }>('SELECT body FROM account_places WHERE id=?', [op.data.placeId])[0];
            if (row && JSON.parse(row.body).version === 0)
                continue;
        }
        if (op.feature === 'expense' && entrySnapshot(db).pending.some(p => p.operation.tripId === op.tripId && p.operation.feature === 'budget'))
            continue;
        if (op.feature === 'memory' && op.data && 'mediaId' in op.data && !mediaReady(db, op.data.mediaId))
            continue;
        try {
            acknowledgeEntry(db, op.operationId, await api.request<Entry>('/api/entries/push', op));
        }
        catch (error) {
            if (!(error instanceof ApiError) || ![400, 403, 404, 409].includes(error.status))
                throw error;
            const current = error.body.current;
            markEntryError(db, op.operationId, error.status === 400 ? 'Podaci nisu prihvaćeni. Uredi zapis i pokušaj ponovno.' : error.status === 409 ? 'Sukob zapisa; potreban je pregled.' : 'Promjena nije prihvaćena. Podaci su sačuvani.', current && 'feature' in current ? current as Entry : null);
        }
    }
    let more = true;
    while (more) {
        const before = entrySnapshot(db).cursor;
        const page = await api.request<{
            items: Entry[];
            cursor: number;
            hasMore: boolean;
        }>('/api/entries/pull?after=' + before);
        if (page.hasMore && page.cursor <= before)
            throw new Error('Server nije pomaknuo kursor zapisa.');
        applyEntryPage(db, page.items, page.cursor, actor);
        more = page.hasMore;
    }
    const pending = entrySnapshot(db).pending;
    return { conflicts: pending.filter(p => p.conflict).length, errors: pending.filter(p => p.error && !p.conflict).length };
}
