import * as SQLite from 'expo-sqlite';
import { LocalDatabase } from './localStore';
import { initAccountStore } from './accountStore';

export function openAccountDatabase(scope: string): { db: LocalDatabase; close: () => void } {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw new Error('Neispravan identifikator računa.');
  const sqlite = SQLite.openDatabaseSync('tripora-account-' + scope + '.db');
  const db: LocalDatabase = {
    exec: sql => sqlite.execSync(sql),
    run: (sql, params) => { sqlite.runSync(sql, params); },
    all: <T>(sql: string, params = []) => sqlite.getAllSync<T>(sql, params),
    transaction: action => sqlite.withTransactionSync(action),
  };
  try { initAccountStore(db); return { db, close: () => sqlite.closeSync() }; }
  catch (error) { sqlite.closeSync(); throw error; }
}
export async function deleteAccountDatabase(scope: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw new Error('Neispravan identifikator računa.');
  await SQLite.deleteDatabaseAsync('tripora-account-' + scope + '.db');
}
