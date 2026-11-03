import initSqlJs, { type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm';
let ready: Promise<void> | undefined;
let engine: SqlJsStatic | undefined;
export function initializeSql(): Promise<void> {
  return ready ??= initSqlJs({ locateFile: () => wasmUrl }).then(value => { engine = value; });
}
export function sqlEngine(): SqlJsStatic {
  if (!engine) throw Error('Pohrana još nije spremna. Pokušaj ponovno.');
  return engine;
}
