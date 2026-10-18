import * as SQLite from 'expo-sqlite';
import { LocalDatabase, migrate } from './localStore';

let database: LocalDatabase | undefined;
// Explicit prototype database. Do not reuse as an authenticated account database later.
export function getDatabase(): LocalDatabase {
  if (database) return database;
  const sqlite = SQLite.openDatabaseSync('tripora-prototype.db');
  const adapter: LocalDatabase = {
    exec: sql => sqlite.execSync(sql),
    run: (sql, params) => { sqlite.runSync(sql, params); },
    all: <T>(sql: string, params = []) => sqlite.getAllSync<T>(sql, params),
    transaction: action => sqlite.withTransactionSync(action),
  };
  try {
    migrate(adapter);
    database = adapter;
    return adapter;
  } catch (error) {
    sqlite.closeSync();
    throw error;
  }
}
