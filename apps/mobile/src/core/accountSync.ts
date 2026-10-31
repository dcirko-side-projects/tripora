import { LocalDatabase } from './localStore';
import { ApiClient, synchronize } from './sync';
import { synchronizePlaces } from './placeSync';
import { synchronizeEntries } from './entrySync';
import { cleanupLocalMedia, MediaIO, synchronizeMedia } from './mediaQueue';
import { Actor } from './entryStore';
const running = new WeakMap<LocalDatabase, Promise<{ conflicts: number; errors: number }>>();
export function synchronizeAccount(db: LocalDatabase, api: ApiClient, options: {actor?:Actor;media?:MediaIO} = {}): Promise<{ conflicts: number; errors: number }> {
  const existing = running.get(db); if (existing) return existing;
  const task = (async () => {
    // Parent trips and current access must be reconciled before child operations/pages.
    const trips = await synchronize(db, api); const places = await synchronizePlaces(db, api);
    const mediaErrors = await synchronizeMedia(db, api, options.media);
    const entries = await synchronizeEntries(db, api, options.actor);
    if (options.media) {
      await cleanupLocalMedia(db, options.media);
      await api.request('/api/media/cleanup', {});
    }
    // Only mark downloaded snapshots after BOTH paginated pulls have completed successfully.
    db.transaction(() => {
      const preparedAt = new Date().toISOString();
      for (const row of db.all<{ body: string }>('SELECT body FROM account_trips')) {
        const trip = JSON.parse(row.body);
        if (trip.version > 0 && !trip.deleted && !trip.accessRevoked)
          db.run('UPDATE account_trips SET body = ? WHERE id = ?', [JSON.stringify({ ...trip, offlinePreparedAt: preparedAt }), trip.id]);
      }
    });
    return { conflicts: trips.conflicts + places.conflicts + entries.conflicts, errors: trips.errors + places.errors + entries.errors + mediaErrors };
  })().finally(() => running.delete(db));
  running.set(db, task); return task;
}
