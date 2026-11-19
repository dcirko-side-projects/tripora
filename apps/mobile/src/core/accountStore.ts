import { LocalDatabase, TripInput, validateTrip, InputError } from './localStore';
import { initPlaceStore } from './placeStore';
import { initEntryStore, entrySnapshot } from './entryStore';

export type SyncedTrip = TripInput & { id: string; createdAt: string; version: number; deleted: boolean; ownerId?: string; role?: 'owner' | 'member'; accessRevoked?: boolean; offlinePreparedAt?: string };
export type TripAccess = { id: string; role: 'owner' | 'member' };
export const ACCESS_REMOVED = 'Pristup je uklonjen. Lokalna promjena je sačuvana i neće se slati.';
export type Mutation = { operationId: string; tripId: string; kind: 'trip.create' | 'trip.update' | 'trip.delete'; baseVersion: number; data: TripInput | null };
export type Pending = { operation: Mutation; conflict: SyncedTrip | null; error: string | null; desired?: Pick<Mutation, 'kind' | 'data'> };
export type AccountSnapshot = { trips: SyncedTrip[]; pending: Pending[]; cursor: number };
type OutboxRow = { body: string; conflict: string | null; error: string | null; followup_id: string | null };

export function initAccountStore(db: LocalDatabase): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const version = db.all<{ user_version: number }>('PRAGMA user_version')[0].user_version;
  if (version > 4) throw new Error('Baza računa zahtijeva noviju aplikaciju.');
  if (version === 4) return;
  db.transaction(() => { if (version === 0) db.exec(`
    CREATE TABLE account_trips (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);
    CREATE TABLE pending_mutations (
      operation_id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL UNIQUE REFERENCES account_trips(id),
      body TEXT NOT NULL, conflict TEXT, error TEXT
    );
    CREATE TABLE sync_meta (id INTEGER PRIMARY KEY CHECK(id = 1), cursor INTEGER NOT NULL);
    INSERT INTO sync_meta VALUES (1, 0);
  `);
    if (version < 2) initPlaceStore(db);
    if (version < 3) {
      initEntryStore(db);
      for (const row of db.all<{body:string}>('SELECT body FROM account_trips')) {
        const trip=JSON.parse(row.body); delete trip.offlinePreparedAt; db.run('UPDATE account_trips SET body=? WHERE id=?',[JSON.stringify(trip),trip.id]);
      }
    }
    db.exec('ALTER TABLE pending_mutations ADD COLUMN followup_id TEXT; PRAGMA user_version = 4;');
  });
}
function put(db: LocalDatabase, trip: SyncedTrip) {
  db.run('INSERT INTO account_trips (id, body) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
    [trip.id, JSON.stringify(trip)]);
}
function desiredChange(trip: SyncedTrip): Pick<Mutation, 'kind' | 'data'> {
  const { name, destination, startDate, endDate } = trip;
  return trip.deleted ? { kind: 'trip.delete', data: null } : { kind: 'trip.update', data: { name, destination, startDate, endDate } };
}
function stage(db: LocalDatabase, trip: SyncedTrip, newId: () => string, creating = false) {
  const queued = db.all<OutboxRow>('SELECT conflict, error, followup_id FROM pending_mutations WHERE trip_id = ?', [trip.id])[0];
  if (queued?.error || queued?.conflict) throw new InputError('Prvo riješi označenu promjenu ovog putovanja.');
  put(db, trip);
  if (queued) db.run('UPDATE pending_mutations SET followup_id = ? WHERE trip_id = ?', [queued.followup_id ?? newId(), trip.id]);
  else {
    const desired = desiredChange(trip);
    insertMutation(db, { ...desired, kind: creating ? 'trip.create' : desired.kind, operationId: newId(), tripId: trip.id, baseVersion: trip.version });
  }
}
function insertMutation(db: LocalDatabase, operation: Mutation) {
  db.run('INSERT INTO pending_mutations (operation_id, trip_id, body) VALUES (?, ?, ?)',
    [operation.operationId, operation.tripId, JSON.stringify(operation)]);
}
export function saveAccountTrip(db: LocalDatabase, input: TripInput, newId: () => string, id?: string): void {
  const data = validateTrip(input);
  db.transaction(() => {
    const old = id ? db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [id])[0] : undefined;
    if (id && !old) throw new InputError('Putovanje nije dostupno.');
    const previous: SyncedTrip | undefined = old && JSON.parse(old.body);
    if (previous?.accessRevoked || previous?.role === 'member') throw new InputError('Nemaš ovlast za uređivanje ovog putovanja.');
    if (previous?.deleted) throw new InputError('Obrisano putovanje nije moguće uređivati.');
    if (id && entrySnapshot(db).entries.some(e => e.tripId === id && e.feature === 'plan' && !e.deleted && e.data.date && (e.data.date < data.startDate || e.data.date > data.endDate)))
      throw new InputError('Prvo prilagodi ili rasporedi iznova aktivnosti izvan novih datuma putovanja.');
    const trip: SyncedTrip = { ...previous, ...data, id: id ?? newId(), createdAt: previous?.createdAt ?? new Date().toISOString(), version: previous?.version ?? 0, deleted: false };
    stage(db, trip, newId, !previous);
  });
}
export function deleteAccountTrip(db: LocalDatabase, id: string, newId: () => string): void {
  db.transaction(() => {
    const row = db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [id])[0];
    if (!row) throw new InputError('Putovanje nije dostupno.');
    const trip: SyncedTrip = JSON.parse(row.body);
    if (trip.accessRevoked || trip.role === 'member') throw new InputError('Nemaš ovlast za brisanje ovog putovanja.');
    if (trip.deleted) throw new InputError('Putovanje je već obrisano.');
    stage(db, { ...trip, deleted: true }, newId);
  });
}
export function pendingTripChanges(db: LocalDatabase): Pending[] {
  return db.all<OutboxRow & { trip_body: string }>(`SELECT p.body, p.conflict, p.error, p.followup_id, t.body AS trip_body
      FROM pending_mutations p JOIN account_trips t ON t.id = p.trip_id ORDER BY p.rowid`)
    .map(r => ({ operation: JSON.parse(r.body), conflict: r.conflict ? JSON.parse(r.conflict) : null, error: r.error,
      ...(r.followup_id ? { desired: desiredChange(JSON.parse(r.trip_body)) } : {}) }));
}
export function accountSnapshot(db: LocalDatabase): AccountSnapshot {
  return {
    trips: db.all<{ body: string }>('SELECT body FROM account_trips').map(r => JSON.parse(r.body) as SyncedTrip)
      .filter(t => !t.deleted).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)),
    pending: pendingTripChanges(db),
    cursor: db.all<{ cursor: number }>('SELECT cursor FROM sync_meta WHERE id = 1')[0].cursor,
  };
}
export function acknowledge(db: LocalDatabase, operationId: string, remote: SyncedTrip): void {
  db.transaction(() => {
    const row = db.all<{ trip_id: string; followup_id: string | null }>('SELECT trip_id, followup_id FROM pending_mutations WHERE operation_id = ?', [operationId])[0];
    if (!row || row.trip_id !== remote.id) throw new Error('Potvrda ne pripada poslanoj promjeni.');
    const local: SyncedTrip = JSON.parse(db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [row.trip_id])[0].body);
    db.run('DELETE FROM pending_mutations WHERE operation_id = ?', [operationId]);
    if (row.followup_id && !remote.deleted) {
      const desired = desiredChange(local);
      put(db, { ...remote, ...desired.data, deleted: local.deleted, offlinePreparedAt: local.offlinePreparedAt });
      insertMutation(db, { ...desired, operationId: row.followup_id, tripId: local.id, baseVersion: remote.version });
    } else put(db, { ...remote, offlinePreparedAt: local.offlinePreparedAt });
  });
}
export function markSyncError(db: LocalDatabase, id: string, message: string, conflict: SyncedTrip | null = null): void {
  db.run('UPDATE pending_mutations SET error = ?, conflict = ? WHERE operation_id = ?', [message, conflict ? JSON.stringify(conflict) : null, id]);
}
export function applyPage(db: LocalDatabase, items: SyncedTrip[], cursor: number, access?: TripAccess[]): void {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || items.some(t => t.version > cursor))
    throw new Error('Neispravna stranica sinkronizacije.');
  db.transaction(() => {
    const previous = accountSnapshot(db).cursor;
    if (cursor < previous) throw new Error('Kursor sinkronizacije ne smije ići unatrag.');
    for (const remote of items) {
      const row = db.all<{ body: string }>('SELECT body FROM pending_mutations WHERE trip_id = ?', [remote.id])[0];
      if (row) {
        const operation: Mutation = JSON.parse(row.body);
        if (remote.version > operation.baseVersion) markSyncError(db, operation.operationId, 'Sukob verzija', remote);
      } else {
        const stored = db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [remote.id])[0];
        put(db, { ...remote, offlinePreparedAt: stored ? JSON.parse(stored.body).offlinePreparedAt : undefined });
      }
    }
    if (access) {
      const available = new Map(access.map(a => [a.id, a.role]));
      for (const row of db.all<{ body: string }>('SELECT body FROM account_trips')) {
        const trip: SyncedTrip = JSON.parse(row.body);
        // Unsynced local creates have not been granted a server identity yet.
        if (trip.version === 0 && !trip.ownerId) continue;
        const role = available.get(trip.id);
        put(db, { ...trip, ...(role ? { role } : {}), accessRevoked: !role });
        if (!role) db.run('UPDATE pending_mutations SET error = ? WHERE trip_id = ?', [ACCESS_REMOVED, trip.id]);
        else db.run('UPDATE pending_mutations SET error = NULL WHERE trip_id = ? AND error = ?', [trip.id, ACCESS_REMOVED]);
      }
    }
    db.run('UPDATE sync_meta SET cursor = ? WHERE id = 1', [cursor]);
  });
}
export function resolveConflict(db: LocalDatabase, operationId: string, choice: 'server' | 'local', newId: () => string): void {
  db.transaction(() => {
    const row = db.all<OutboxRow>('SELECT body, conflict, error, followup_id FROM pending_mutations WHERE operation_id = ?', [operationId])[0];
    if (!row?.conflict) throw new Error('Sukob nije dostupan.');
    const remote: SyncedTrip = JSON.parse(row.conflict);
    const local: Mutation = JSON.parse(row.body);
    const current = db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [local.tripId])[0];
    const currentTrip: SyncedTrip | undefined = current && JSON.parse(current.body);
    if (currentTrip?.accessRevoked) throw new InputError('Pristup je uklonjen. Lokalna promjena ostaje sačuvana.');
    if (choice === 'local' && currentTrip?.role === 'member') throw new InputError('Nemaš ovlast za uređivanje ovog putovanja. Prihvati serversku verziju.');
    if (choice === 'local' && remote.deleted) throw new InputError('Putovanje je obrisano na serveru. Prihvati brisanje; lokalna verzija se neće automatski vratiti.');
    db.run('DELETE FROM pending_mutations WHERE operation_id = ?', [operationId]);
    if (choice === 'server') put(db, { ...remote, role: currentTrip?.role, accessRevoked: currentTrip?.accessRevoked, offlinePreparedAt: currentTrip?.offlinePreparedAt });
    else if (currentTrip) {
      put(db, { ...currentTrip, version: remote.version, ownerId: remote.ownerId ?? currentTrip.ownerId });
      insertMutation(db, { ...desiredChange(currentTrip), tripId: local.tripId, operationId: newId(), baseVersion: remote.version });
    }
  });
}
