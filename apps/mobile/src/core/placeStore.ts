import { InputError, LocalDatabase } from './localStore';

export type PlaceCategory = 'place' | 'food' | 'nightlife';
export type PlaceLocation = { latitude: number; longitude: number; displayName: string; provider: 'osm'; providerId: string };
export type PlaceInput = { category: PlaceCategory; name: string; notes: string; address: string; link: string; visited: boolean; location?: PlaceLocation | null };
export type Place = PlaceInput & { id: string; tripId: string; createdAt: string; version: number; deleted: boolean };
export type PlaceOperation = { operationId: string; placeId: string; tripId: string; kind: 'place.create' | 'place.update' | 'place.delete'; baseVersion: number; data: PlaceInput | null };
export type PlacePending = { operation: PlaceOperation; conflict: Place | null; error: string | null; followupId: string | null };
export type PlaceSnapshot = { places: Place[]; pending: PlacePending[]; cursor: number };
export const PLACE_ACCESS_REMOVED = 'Pristup mjestima je uklonjen. Lokalne promjene su sačuvane.';
type Row = { body: string; conflict: string | null; error: string | null; followup_id: string | null };
type Parent = { id: string; version: number; deleted: boolean; accessRevoked?: boolean };
export function initPlaceStore(db: LocalDatabase): void {
  db.exec(`CREATE TABLE account_places (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL REFERENCES account_trips(id), body TEXT NOT NULL);
    CREATE TABLE pending_places (operation_id TEXT PRIMARY KEY NOT NULL, place_id TEXT NOT NULL UNIQUE REFERENCES account_places(id), body TEXT NOT NULL, conflict TEXT, error TEXT, followup_id TEXT);
    CREATE TABLE place_meta (id INTEGER PRIMARY KEY CHECK(id=1), cursor INTEGER NOT NULL);
    INSERT INTO place_meta VALUES (1, 0);`);
}
export function validatePlace(input: PlaceInput): PlaceInput {
  if (!['place', 'food', 'nightlife'].includes(input.category)) throw new InputError('Odaberi kategoriju mjesta.');
  const data = { ...input, name: input.name.trim(), notes: input.notes.trim(), address: input.address.trim(), link: input.link.trim() };
  if (!data.name || data.name.length > 120) throw new InputError('Naziv mjesta je obavezan, do 120 znakova.');
  if (data.notes.length > 2000 || data.address.length > 300 || data.link.length > 1000) throw new InputError('Bilješka, adresa ili poveznica je preduga.');
  if (typeof data.visited !== 'boolean') throw new InputError('Neispravan status posjeta.');
  if (data.location != null) {
    const p = data.location;
    if (!Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 || !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
      p.provider !== 'osm' || typeof p.providerId !== 'string' || !/^[NWR][0-9]{1,20}$/.test(p.providerId) ||
      typeof p.displayName !== 'string' || !p.displayName.trim() || p.displayName.length > 1000)
      throw new InputError('Položaj mjesta nije ispravan. Pronađi mjesto ponovno.');
  }
  if (data.link) {
    try { const url = new URL(data.link); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); }
    catch { throw new InputError('Poveznica mora biti potpuna HTTP ili HTTPS adresa.'); }
  }
  return data;
}
function parent(db: LocalDatabase, id: string): Parent {
  const row = db.all<{ body: string }>('SELECT body FROM account_trips WHERE id = ?', [id])[0];
  if (!row) throw new InputError('Putovanje nije dostupno na uređaju.');
  return JSON.parse(row.body);
}
export function canWritePlaces(db: LocalDatabase, tripId: string): boolean {
  const trip = parent(db, tripId); return !trip.deleted && !trip.accessRevoked;
}
function requireAccess(db: LocalDatabase, id: string) {
  if (!canWritePlaces(db, id)) throw new InputError('Putovanje je obrisano ili je pristup uklonjen. Lokalne promjene su sačuvane.');
}
function put(db: LocalDatabase, place: Place) {
  db.run('INSERT INTO account_places (id, trip_id, body) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body', [place.id, place.tripId, JSON.stringify(place)]);
}
function read(db: LocalDatabase, id: string): Place | undefined {
  const row = db.all<{ body: string }>('SELECT body FROM account_places WHERE id = ?', [id])[0]; return row && JSON.parse(row.body);
}
function pending(db: LocalDatabase, id: string): Row | undefined {
  return db.all<Row>('SELECT body, conflict, error, followup_id FROM pending_places WHERE place_id = ?', [id])[0];
}
function enqueue(db: LocalDatabase, operation: PlaceOperation) {
  db.run('INSERT INTO pending_places (operation_id, place_id, body) VALUES (?, ?, ?)', [operation.operationId, operation.placeId, JSON.stringify(operation)]);
}
function dataFor(p: Place): PlaceInput { return { category: p.category, name: p.name, notes: p.notes, address: p.address, link: p.link, visited: p.visited, ...(p.location ? { location: p.location } : {}) }; }
function stage(db: LocalDatabase, place: Place, newId: () => string, kind: PlaceOperation['kind']) {
  const queued = pending(db, place.id);
  if (queued?.conflict || queued?.error) throw new InputError('Prvo riješi označenu promjenu ovog mjesta.');
  put(db, place);
  if (queued) db.run('UPDATE pending_places SET followup_id = ? WHERE place_id = ?', [queued.followup_id ?? newId(), place.id]);
  else enqueue(db, { operationId: newId(), placeId: place.id, tripId: place.tripId, kind, baseVersion: place.version, data: kind === 'place.delete' ? null : dataFor(place) });
}
export function savePlace(db: LocalDatabase, tripId: string, input: PlaceInput, newId: () => string, id?: string): void {
  const data = validatePlace(input);
  db.transaction(() => {
    requireAccess(db, tripId);
    const old = id ? read(db, id) : undefined;
    if (id && (!old || old.tripId !== tripId || old.deleted)) throw new InputError('Mjesto nije dostupno za uređivanje.');
    const place: Place = { ...data, id: id ?? newId(), tripId, createdAt: old?.createdAt ?? new Date().toISOString(), version: old?.version ?? 0, deleted: false };
    stage(db, place, newId, old ? 'place.update' : 'place.create');
  });
}
export function deletePlace(db: LocalDatabase, id: string, newId: () => string): void {
  db.transaction(() => {
    const place = read(db, id); if (!place || place.deleted) throw new InputError('Mjesto nije dostupno.');
    requireAccess(db, place.tripId); stage(db, { ...place, deleted: true }, newId, 'place.delete');
  });
}
export function placeSnapshot(db: LocalDatabase): PlaceSnapshot {
  return {
    places: db.all<{ body: string }>('SELECT body FROM account_places').map(r => JSON.parse(r.body) as Place).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    pending: db.all<Row>('SELECT body, conflict, error, followup_id FROM pending_places ORDER BY rowid').map(r => ({ operation: JSON.parse(r.body), conflict: r.conflict ? JSON.parse(r.conflict) : null, error: r.error, followupId: r.followup_id })),
    cursor: db.all<{ cursor: number }>('SELECT cursor FROM place_meta WHERE id=1')[0].cursor,
  };
}
export function acknowledgePlace(db: LocalDatabase, operationId: string, remote: Place): void {
  db.transaction(() => {
    const row = db.all<Row>('SELECT body, conflict, error, followup_id FROM pending_places WHERE operation_id = ?', [operationId])[0];
    if (!row) throw new Error('Potvrda mjesta nema pripadajuću promjenu.');
    const op: PlaceOperation = JSON.parse(row.body);
    if (op.placeId !== remote.id || op.tripId !== remote.tripId) throw new Error('Potvrda mjesta ne pripada poslanoj promjeni.');
    const local = read(db, op.placeId)!;
    db.run('DELETE FROM pending_places WHERE operation_id = ?', [operationId]);
    if (row.followup_id && !remote.deleted) {
      put(db, { ...local, version: remote.version, createdAt: remote.createdAt });
      enqueue(db, { operationId: row.followup_id, placeId: local.id, tripId: local.tripId, kind: local.deleted ? 'place.delete' : 'place.update', baseVersion: remote.version, data: local.deleted ? null : dataFor(local) });
    } else put(db, remote);
  });
}
export function markPlaceError(db: LocalDatabase, id: string, error: string, conflict: Place | null = null): void {
  db.run('UPDATE pending_places SET error = ?, conflict = ? WHERE operation_id = ?', [error, conflict ? JSON.stringify(conflict) : null, id]);
}
export function refreshPlaceAccess(db: LocalDatabase): void {
  for (const row of db.all<Row>('SELECT body, error, conflict, followup_id FROM pending_places')) {
    const op: PlaceOperation = JSON.parse(row.body); const trip = parent(db, op.tripId);
    if (trip.accessRevoked) db.run('UPDATE pending_places SET error = ? WHERE operation_id = ?', [PLACE_ACCESS_REMOVED, op.operationId]);
    else if (row.error === PLACE_ACCESS_REMOVED) db.run('UPDATE pending_places SET error = ? WHERE operation_id = ?', [row.conflict ? 'Sukob verzija mjesta.' : null, op.operationId]);
  }
}
export function applyPlacePage(db: LocalDatabase, items: Place[], cursor: number): void {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || items.some(p => p.version > cursor)) throw new Error('Neispravna stranica mjesta.');
  db.transaction(() => {
    if (cursor < placeSnapshot(db).cursor) throw new Error('Kursor mjesta ne smije ići unatrag.');
    for (const remote of items) {
      parent(db, remote.tripId);
      const old = read(db, remote.id); if (old && old.tripId !== remote.tripId) throw new Error('Mjesto ne smije promijeniti putovanje.');
      const queued = pending(db, remote.id);
      if (queued) {
        const op: PlaceOperation = JSON.parse(queued.body);
        if (remote.version > op.baseVersion) markPlaceError(db, op.operationId, 'Sukob verzija mjesta.', remote);
      } else put(db, remote);
    }
    refreshPlaceAccess(db); db.run('UPDATE place_meta SET cursor = ? WHERE id=1', [cursor]);
  });
}
export function resolvePlaceConflict(db: LocalDatabase, id: string, choice: 'local' | 'server', newId: () => string): void {
  db.transaction(() => {
    const row = db.all<Row>('SELECT body, conflict, error, followup_id FROM pending_places WHERE operation_id = ?', [id])[0];
    if (!row?.conflict) throw new InputError('Sukob mjesta nije dostupan.');
    const op: PlaceOperation = JSON.parse(row.body); const remote: Place = JSON.parse(row.conflict); const local = read(db, op.placeId)!;
    if (parent(db, local.tripId).accessRevoked) throw new InputError(PLACE_ACCESS_REMOVED);
    if (choice === 'local') {
      requireAccess(db, local.tripId);
      if (remote.deleted) throw new InputError('Mjesto je obrisano na serveru i neće se automatski vratiti.');
    }
    db.run('DELETE FROM pending_places WHERE operation_id = ?', [id]);
    if (choice === 'server') put(db, remote);
    else {
      put(db, { ...local, version: remote.version });
      enqueue(db, { ...op, operationId: newId(), kind: local.deleted ? 'place.delete' : 'place.update', baseVersion: remote.version, data: local.deleted ? null : dataFor(local) });
    }
  });
}
