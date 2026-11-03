import { type Database } from 'sql.js';
import { LocalDatabase } from './localStore';
import { initAccountStore } from './accountStore';
import { sqlEngine } from './webSql';

function keyFor(scope: string) {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw Error('Neispravan identifikator računa.');
  return 'tripora.db.v1.' + scope;
}
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function decode(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }

export function openAccountDatabase(scope: string): { db: LocalDatabase; close: () => void } {
  const key = keyFor(scope), SQL = sqlEngine(), saved = localStorage.getItem(key);
  let sqlite: Database;
  try { sqlite = saved ? new SQL.Database(decode(saved)) : new SQL.Database(); }
  catch { throw Error('Lokalnu bazu nije moguće otvoriti. Nemoj brisati podatke stranice ako postoje neposlane promjene.'); }
  let transaction = false;
  const configure = () => sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE;');
  configure();
  function snapshot(): Uint8Array {
    // sql.js export reopens its handle, so restore connection-local FK enforcement.
    sqlite.exec('PRAGMA journal_mode = DELETE;');
    const bytes = sqlite.export(); configure(); return bytes;
  }
  function restore(bytes: Uint8Array) { sqlite.close(); sqlite = new SQL.Database(bytes); configure(); }
  function mutate(action: () => void) {
    if (transaction) { action(); return; }
    const before = snapshot();
    try { action(); localStorage.setItem(key, encode(snapshot())); }
    catch (error) { restore(before); throw error; }
  }
  const db: LocalDatabase = {
    exec: sql => mutate(() => { sqlite.exec(sql); }),
    run: (sql, params) => mutate(() => { sqlite.run(sql, params); }),
    all: <T>(sql: string, params = []) => {
      const statement = sqlite.prepare(sql);
      try { statement.bind(params); const rows: T[] = []; while (statement.step()) rows.push(statement.getAsObject() as T); return rows; }
      finally { statement.free(); }
    },
    transaction: action => {
      if (transaction) throw Error('Ugniježđena transakcija nije podržana.');
      const before = snapshot(); transaction = true;
      try {
        sqlite.exec('BEGIN'); action(); sqlite.exec('COMMIT');
        localStorage.setItem(key, encode(snapshot()));
      } catch (error) { restore(before); throw error; }
      finally { transaction = false; }
    },
  };
  try { initAccountStore(db); return { db, close: () => sqlite.close() }; }
  catch (error) { sqlite.close(); throw error; }
}
export async function deleteAccountDatabase(scope: string): Promise<void> { localStorage.removeItem(keyFor(scope)); }
