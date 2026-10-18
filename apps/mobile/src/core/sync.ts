import { LocalDatabase } from './localStore';
import { accountSnapshot, acknowledge, applyPage, markSyncError, SyncedTrip } from './accountStore';
export class ApiError extends Error {
  constructor(public status: number, public body: { code?: string; current?: SyncedTrip } = {}) {
    super(status === 401 ? 'Prijava je istekla. Prijavi se ponovno; lokalne promjene su sačuvane.' :
      status === 429 ? 'Previše pokušaja. Pričekaj pa pokušaj ponovno.' : 'Server nije prihvatio zahtjev (' + status + ').');
  }
}
export interface ApiClient { request<T>(path: string, body?: unknown): Promise<T> }
export async function synchronize(db: LocalDatabase, api: ApiClient): Promise<{ conflicts: number; errors: number }> {
  for (const pending of accountSnapshot(db).pending) {
    if (pending.conflict) continue;
    try {
      const remote = await api.request<SyncedTrip>('/api/sync/push', pending.operation);
      acknowledge(db, pending.operation.operationId, remote);
    } catch (error) {
      if (error instanceof ApiError && [400, 403, 404, 409].includes(error.status)) {
        markSyncError(db, pending.operation.operationId,
          error.status === 409 ? 'Sukob promjene; potreban je pregled.' : 'Promjena nije prihvaćena. Sačuvana je na uređaju.',
          error.body.current ?? null);
        continue;
      }
      // Network errors and expired authentication leave the exact mutation intact.
      throw error;
    }
  }
  let more = true;
  while (more) {
    const before = accountSnapshot(db).cursor;
    const page = await api.request<{ items: SyncedTrip[]; cursor: number; hasMore: boolean }>('/api/sync/pull?after=' + before);
    if (page.hasMore && page.cursor <= before) throw new Error('Server nije pomaknuo kursor.');
    applyPage(db, page.items, page.cursor); more = page.hasMore;
  }
  const pending = accountSnapshot(db).pending;
  return { conflicts: pending.filter(p => p.conflict).length, errors: pending.filter(p => p.error && !p.conflict).length };
}
