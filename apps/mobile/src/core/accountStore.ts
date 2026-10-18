import { LocalDatabase, TripInput, validateTrip, InputError } from './localStore';

export type SyncedTrip = TripInput & { id: string; createdAt: string; version: number; deleted: boolean };
export type Mutation = { operationId: string; tripId: string; kind: 'trip.create' | 'trip.update' | 'trip.delete'; baseVersion: number; data: TripInput | null };
export type Pending = { operation: Mutation; conflict: SyncedTrip | null; error: string | null };
export type AccountSnapshot = { trips: SyncedTrip[]; pending: Pending[]; cursor: number };
type OutboxRow = { body: string; conflict: string | null; error: string | null };

export function initAccountStore(db: LocalDatabase): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const version = db.all<{ user_version: number }>('PRAGMA user_version')[0].user_version;
  if (version > 1) throw new Error('Baza računa zahtijeva noviju aplikaciju.');
  if (version === 1) return;
  db.transaction(() => db.exec(`
    CREATE TABLE account_trips (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);
    CREATE TABLE pending_mutations (
      operation_id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL UNIQUE REFERENCES account_trips(id),
      body TEXT NOT NULL, conflict TEXT, error TEXT
    );
    CREATE TABLE sync_meta (id INTEGER PRIMARY KEY CHECK(id = 1), cursor INTEGER NOT NULL);
    INSERT INTO sync_meta VALUES (1, 0);
    PRAGMA user_version = 1;
  `));
}
function put(db: LocalDatabase, trip: SyncedTrip) {
  db.run('INSERT INTO account_trips (id, body) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
    [trip.id, JSON.stringify(trip)]);
}
function pendingFor(db: LocalDatabase, id: string): boolean {
  return db.all('SELECT 1 FROM pending_mutations WHERE trip_id = ?', [id]).length > 0;
}
function insertMutation(db: LocalDatabase, operation: Mutation) {
  db.run('INSERT INTO pending_mutations (operation_id, trip_id, body) VALUES (?, ?, ?)',
    [operation.operationId, operation.tripId, JSON.stringify(operation)]);
}
export function saveAccountTrip(db: LocalDatabase, input: TripInput, newId: () => string, id?: string): void {
  const data = validateTrip(input);
  db.transaction(() => {
    if (id && pendingFor(db, id)) throw new InputError('Prvo sinkroniziraj ili riješi postojeću promjenu ovog putovanja.');
    const old = id ? db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [id])[0] : undefined;
    if (id && !old) throw new InputError('Putovanje nije dostupno.');
    const previous: SyncedTrip | undefined = old && JSON.parse(old.body);
    if (previous?.deleted) throw new InputError('Obrisano putovanje nije moguće uređivati.');
    const trip: SyncedTrip = { ...data, id: id ?? newId(), createdAt: previous?.createdAt ?? new Date().toISOString(), version: previous?.version ?? 0, deleted: false };
    put(db, trip);
    insertMutation(db, { operationId: newId(), tripId: trip.id, kind: previous ? 'trip.update' : 'trip.create', baseVersion: trip.version, data });
  });
}
export function deleteAccountTrip(db: LocalDatabase, id: string, newId: () => string): void {
  db.transaction(() => {
    if (pendingFor(db, id)) throw new InputError('Prvo sinkroniziraj ili riješi postojeću promjenu.');
    const row = db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [id])[0];
    if (!row) throw new InputError('Putovanje nije dostupno.');
    const trip: SyncedTrip = JSON.parse(row.body);
    if (trip.deleted) throw new InputError('Putovanje je već obrisano.');
    put(db, { ...trip, deleted: true });
    insertMutation(db, { operationId: newId(), tripId: id, kind: 'trip.delete', baseVersion: trip.version, data: null });
  });
}
export function accountSnapshot(db: LocalDatabase): AccountSnapshot {
  return {
    trips: db.all<{ body: string }>('SELECT body FROM account_trips').map(r => JSON.parse(r.body) as SyncedTrip)
      .filter(t => !t.deleted).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)),
    pending: db.all<OutboxRow>('SELECT body, conflict, error FROM pending_mutations ORDER BY rowid')
      .map(r => ({ operation: JSON.parse(r.body), conflict: r.conflict ? JSON.parse(r.conflict) : null, error: r.error })),
    cursor: db.all<{ cursor: number }>('SELECT cursor FROM sync_meta WHERE id = 1')[0].cursor,
  };
}
export function acknowledge(db: LocalDatabase, operationId: string, remote: SyncedTrip): void {
  db.transaction(() => {
    const row = db.all<{ trip_id: string }>('SELECT trip_id FROM pending_mutations WHERE operation_id = ?', [operationId])[0];
    if (!row || row.trip_id !== remote.id) throw new Error('Potvrda ne pripada poslanoj promjeni.');
    put(db, remote);
    db.run('DELETE FROM pending_mutations WHERE operation_id = ?', [operationId]);
  });
}
export function markSyncError(db: LocalDatabase, id: string, message: string, conflict: SyncedTrip | null = null): void {
  db.run('UPDATE pending_mutations SET error = ?, conflict = ? WHERE operation_id = ?', [message, conflict ? JSON.stringify(conflict) : null, id]);
}
export function applyPage(db: LocalDatabase, items: SyncedTrip[], cursor: number): void {
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
      } else put(db, remote);
    }
    db.run('UPDATE sync_meta SET cursor = ? WHERE id = 1', [cursor]);
  });
}
export function resolveConflict(db: LocalDatabase, operationId: string, choice: 'server' | 'local', newId: () => string): void {
  db.transaction(() => {
    const row = db.all<OutboxRow>('SELECT body, conflict, error FROM pending_mutations WHERE operation_id = ?', [operationId])[0];
    if (!row?.conflict) throw new Error('Sukob nije dostupan.');
    const remote: SyncedTrip = JSON.parse(row.conflict);
    const local: Mutation = JSON.parse(row.body);
    if (choice === 'local' && remote.deleted) throw new InputError('Putovanje je obrisano na serveru. Prihvati brisanje; lokalna verzija se neće automatski vratiti.');
    db.run('DELETE FROM pending_mutations WHERE operation_id = ?', [operationId]);
    if (choice === 'server') put(db, remote);
    else {
      insertMutation(db, { ...local, operationId: newId(), baseVersion: remote.version, kind: local.kind === 'trip.delete' ? 'trip.delete' : 'trip.update' });
    }
  });
}
