import { LocalDatabase } from './localStore';
import { ApiClient, ApiError } from './sync';
import { acknowledgePlace, applyPlacePage, canWritePlaces, markPlaceError, Place, placeSnapshot, refreshPlaceAccess, PLACE_ACCESS_REMOVED } from './placeStore';
const running = new WeakMap<LocalDatabase, Promise<{ conflicts: number; errors: number }>>();
export function synchronizePlaces(db: LocalDatabase, api: ApiClient): Promise<{ conflicts: number; errors: number }> {
  const existing = running.get(db); if (existing) return existing;
  const task = run(db, api).finally(() => running.delete(db)); running.set(db, task); return task;
}
async function run(db: LocalDatabase, api: ApiClient): Promise<{ conflicts: number; errors: number }> {
  db.transaction(() => refreshPlaceAccess(db));
  const attempted = new Set<string>();
  // Drain immutable operations plus any locally staged follow-up, bounded per foreground pass.
  for (let count = 0; count < 200; count++) {
    const pending = placeSnapshot(db).pending.find(p => !attempted.has(p.operation.operationId) && !p.conflict && p.error !== PLACE_ACCESS_REMOVED);
    if (!pending) break;
    const op = pending.operation; attempted.add(op.operationId);
    if (!canWritePlaces(db, op.tripId)) {
      markPlaceError(db, op.operationId, 'Putovanje je obrisano ili nedostupno. Lokalna promjena mjesta je sačuvana.'); continue;
    }
    const parent = db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [op.tripId])[0];
    if (!parent || JSON.parse(parent.body).version === 0) continue;
    try { acknowledgePlace(db, op.operationId, await api.request<Place>('/api/places/push', op)); }
    catch (error) {
      if (!(error instanceof ApiError) || ![400, 403, 404, 409].includes(error.status)) throw error;
      const current = error.body.current;
      markPlaceError(db, op.operationId, error.status === 409 ? 'Sukob mjesta; potreban je pregled.' : 'Mjesto nije prihvaćeno. Lokalna promjena je sačuvana.',
        current && 'tripId' in current ? current as Place : null);
    }
  }
  let more = true;
  while (more) {
    const before = placeSnapshot(db).cursor;
    const page = await api.request<{ items: Place[]; cursor: number; hasMore: boolean }>('/api/places/pull?after=' + before);
    if (page.hasMore && page.cursor <= before) throw new Error('Server nije pomaknuo kursor mjesta.');
    applyPlacePage(db, page.items, page.cursor); more = page.hasMore;
  }
  const pending = placeSnapshot(db).pending;
  return { conflicts: pending.filter(p => p.conflict).length, errors: pending.filter(p => p.error && !p.conflict).length };
}
