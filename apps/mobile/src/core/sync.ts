import { LocalDatabase } from './localStore';
import { ACCESS_REMOVED, accountSnapshot, acknowledge, applyPage, markSyncError, SyncedTrip, TripAccess } from './accountStore';
export class ApiError extends Error {
  constructor(public status: number, public body: { code?: string; current?: SyncedTrip | import('./placeStore').Place | import('./entryStore').Entry } = {}) {
    super(status === 401 ? 'Prijava je istekla. Prijavi se ponovno; lokalne promjene su sačuvane.' :
      body.code === 'email_confirmation_required' ? 'Račun je kreiran. Potvrdi e-mail prije prijave.' :
      body.code === 'invalid_confirmation' ? 'Kod za potvrdu nije valjan ili je istekao. Zatraži novu potvrdu.' :
      body.code === 'recipient_unavailable' ? 'Suputnik mora imati drugi, registrirani probni račun. Provjeri e-mail.' :
      body.code === 'already_member' ? 'Ovaj račun već je član putovanja.' :
      body.code === 'invitation_unavailable' ? 'Pozivnica nije dostupna: provjeri račun, kod, rok valjanosti ili opoziv.' :
      body.code === 'owner_required' ? 'Samo vlasnik može mijenjati osnovne podatke putovanja.' :
      body.code === 'activities_outside_dates' ? 'Prvo prilagodi aktivnosti izvan novih datuma putovanja.' :
      body.code === 'media_limit' ? 'Razvojna granica je 100 fotografija po putovanju. Obriši nepotrebne uspomene i očisti fotografije.' :
      status === 429 ? 'Previše pokušaja. Pričekaj pa pokušaj ponovno.' : 'Server nije prihvatio zahtjev (' + status + ').');
  }
}
export interface ApiClient { request<T>(path: string, body?: unknown): Promise<T> }
const running = new WeakMap<LocalDatabase, Promise<{ conflicts: number; errors: number }>>();
export function synchronize(db: LocalDatabase, api: ApiClient): Promise<{ conflicts: number; errors: number }> {
  const existing = running.get(db);
  if (existing) return existing;
  const task = runSynchronization(db, api).finally(() => running.delete(db));
  running.set(db, task);
  return task;
}
async function runSynchronization(db: LocalDatabase, api: ApiClient): Promise<{ conflicts: number; errors: number }> {
  for (const pending of accountSnapshot(db).pending) {
    if (pending.conflict || pending.error === ACCESS_REMOVED) continue;
    try {
      const remote = await api.request<SyncedTrip>('/api/sync/push', pending.operation);
      acknowledge(db, pending.operation.operationId, remote);
    } catch (error) {
      if (error instanceof ApiError && [400, 403, 404, 409].includes(error.status)) {
        markSyncError(db, pending.operation.operationId,
          error.status === 409 ? 'Sukob promjene; potreban je pregled.' : 'Promjena nije prihvaćena. Sačuvana je na uređaju.',
          error.body.current && !('tripId' in error.body.current) ? error.body.current : null);
        continue;
      }
      // Network errors and expired authentication leave the exact mutation intact.
      throw error;
    }
  }
  let more = true;
  while (more) {
    const before = accountSnapshot(db).cursor;
    const page = await api.request<{ items: SyncedTrip[]; cursor: number; hasMore: boolean; access?: TripAccess[] }>('/api/sync/pull?after=' + before);
    if (page.hasMore && page.cursor <= before) throw new Error('Server nije pomaknuo kursor.');
    applyPage(db, page.items, page.cursor, page.access); more = page.hasMore;
  }
  const pending = accountSnapshot(db).pending;
  return { conflicts: pending.filter(p => p.conflict).length, errors: pending.filter(p => p.error && !p.conflict).length };
}
