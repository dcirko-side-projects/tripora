import { LocalDatabase } from './localStore';
import { ApiClient, synchronize } from './sync';
import { synchronizePlaces } from './placeSync';
import { synchronizeEntries } from './entrySync';
import { cleanupLocalMedia, downloadTripCovers, MediaIO, synchronizeMedia } from './mediaQueue';
import { Actor } from './entryStore';
type AccountSyncResult = { conflicts: number; errors: number; cleanupFailed?: true; coverDownloadFailed?: true };
const running = new WeakMap<LocalDatabase, Promise<AccountSyncResult>>();
export function synchronizeAccount(db: LocalDatabase, api: ApiClient, options: { actor?: Actor; media?: MediaIO; onPrepared?: () => void } = {}): Promise<AccountSyncResult> {
  const existing = running.get(db); if (existing) return existing;
  const task = (async () => {
    // Parent trips and current access must be reconciled before child operations/pages.
    const trips = await synchronize(db, api); const places = await synchronizePlaces(db, api);
    const mediaErrors = await synchronizeMedia(db, api, options.media);
    const entries = await synchronizeEntries(db, api, options.actor);
    // Record readiness after all metadata pulls, before optional maintenance.
    db.transaction(() => {
      const preparedAt = new Date().toISOString();
      for (const row of db.all<{ body: string }>('SELECT body FROM account_trips')) {
        const trip = JSON.parse(row.body);
        if (trip.version > 0 && !trip.deleted && !trip.accessRevoked)
          db.run('UPDATE account_trips SET body = ? WHERE id = ?', [JSON.stringify({ ...trip, offlinePreparedAt: preparedAt }), trip.id]);
      }
    });
    options.onPrepared?.();
    const result: AccountSyncResult = { conflicts: trips.conflicts + places.conflicts + entries.conflicts, errors: trips.errors + places.errors + entries.errors + mediaErrors };
    if (options.media) {
      const coverDownloadFailed = options.actor && await downloadTripCovers(db, options.actor, api, options.media);
      if (coverDownloadFailed) result.coverDownloadFailed = true;
      const cleanup = await Promise.allSettled([cleanupLocalMedia(db, options.media), api.request('/api/media/cleanup', {})]);
      if (cleanup.some(item => item.status === 'rejected')) return { ...result, cleanupFailed: true } as const;
    }
    return result;
  })().finally(() => running.delete(db));
  running.set(db, task); return task;
}
