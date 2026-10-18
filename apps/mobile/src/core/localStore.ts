// No network/native imports: the same SQL is exercised against real SQLite in tests.
export type SqlValue = string | number | null;
export interface LocalDatabase {
  exec(sql: string): void;
  run(sql: string, params: SqlValue[]): void;
  all<T>(sql: string, params?: SqlValue[]): T[];
  transaction(action: () => void): void;
}
export type TripInput = { name: string; destination: string; startDate: string; endDate: string };
export type Trip = TripInput & { id: string; createdAt: string };
export type LocalSnapshot = { trips: Trip[]; pendingCount: number };
export class InputError extends Error {}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateTrip(input: TripInput): TripInput {
  const clean = { ...input, name: input.name.trim(), destination: input.destination.trim() };
  if (!clean.name || clean.name.length > 100) throw new InputError('Naziv mora imati 1–100 znakova.');
  if (!clean.destination || clean.destination.length > 120) throw new InputError('Destinacija mora imati 1–120 znakova.');
  if (!isDate(clean.startDate) || !isDate(clean.endDate)) throw new InputError('Unesi ispravne datume u obliku GGGG-MM-DD.');
  if (clean.endDate < clean.startDate) throw new InputError('Završetak ne može biti prije početka putovanja.');
  return clean;
}

export function migrate(db: LocalDatabase): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const version = db.all<{ user_version: number }>('PRAGMA user_version;')[0].user_version;
  if (version > 1) throw new Error('Baza je novija od ove aplikacije. Potrebna je nadogradnja.');
  if (version === 1) return;
  db.transaction(() => {
    db.exec(`
      CREATE TABLE trips (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
        destination TEXT NOT NULL CHECK(length(trim(destination)) BETWEEN 1 AND 120),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL CHECK(end_date >= start_date),
        created_at TEXT NOT NULL
      );
      CREATE TABLE outbox (
        operation_id TEXT PRIMARY KEY NOT NULL,
        trip_id TEXT NOT NULL REFERENCES trips(id),
        kind TEXT NOT NULL CHECK(kind = 'trip.create'),
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  });
}

export function createTrip(
  db: LocalDatabase, input: TripInput, newId: () => string,
  now: () => string = () => new Date().toISOString(),
): Trip {
  const data = validateTrip(input);
  const trip: Trip = { ...data, id: newId(), createdAt: now() };
  const operationId = newId();
  db.transaction(() => {
    db.run(
      'INSERT INTO trips (id, name, destination, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [trip.id, trip.name, trip.destination, trip.startDate, trip.endDate, trip.createdAt],
    );
    db.run(
      'INSERT INTO outbox (operation_id, trip_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      [operationId, trip.id, 'trip.create', JSON.stringify(trip), trip.createdAt],
    );
  });
  return trip;
}

export function readSnapshot(db: LocalDatabase): LocalSnapshot {
  return {
    trips: db.all<Trip>(`SELECT id, name, destination, start_date AS startDate,
      end_date AS endDate, created_at AS createdAt FROM trips ORDER BY start_date, created_at, id`),
    pendingCount: db.all<{ count: number }>('SELECT COUNT(*) AS count FROM outbox')[0].count,
  };
}
