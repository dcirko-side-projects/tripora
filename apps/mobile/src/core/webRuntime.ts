import { initializeSql } from './webSql';

export async function initializeWebStorage(): Promise<void> {
  if (!window.isSecureContext || !navigator.locks || !window.indexedDB || !window.localStorage)
    throw Error('Ovaj preglednik ne podržava Tripora offline pohranu. Otvori poveznicu u novijem Safariju putem HTTPS-a.');
  // Only one tab may mutate the durable account snapshots at a time.
  await new Promise<void>((resolve, reject) => {
    void navigator.locks.request('tripora-storage-v1', { ifAvailable: true }, async lock => {
      if (!lock) { reject(Error('Tripora je već otvorena u drugoj kartici ili prozoru. Zatvori je tamo i ponovno učitaj ovu stranicu.')); return; }
      try {
        await initializeSql();
        resolve();
        await new Promise(() => {}); // Browser releases the lock when this page closes.
      } catch (error) { reject(error); }
    }).catch(reject);
  });
  // A refused persistence request must not prevent use; the UI explains the limit.
  void navigator.storage.persist?.().catch(() => false);
}
