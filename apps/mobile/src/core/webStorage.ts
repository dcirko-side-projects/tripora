// IndexedDB transaction completion, rather than request success, is the durability boundary.
const name = 'tripora-web-v1';
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  return opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('session');
      request.result.createObjectStore('media');
    };
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => { opening = undefined; reject(Error('Zatvori druge Tripora kartice pa pokušaj ponovno.')); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); opening = undefined; };
      resolve(request.result);
    };
  });
}
export async function stored<T>(store: 'session' | 'media', key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error ?? Error('Čitanje lokalne pohrane nije uspjelo.'));
  });
}
export async function changeStored(store: 'session' | 'media', values: { key: string; value?: unknown }[]): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    try {
      for (const { key, value } of values) {
        if (value === undefined) tx.objectStore(store).delete(key);
        else tx.objectStore(store).put(value, key);
      }
    } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? Error('Spremanje nije uspjelo. Provjeri slobodan prostor.'));
  });
}
export async function deleteStoredPrefix(store: 'media', prefix: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const cursor = tx.objectStore(store).openKeyCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
    cursor.onsuccess = () => { if (cursor.result) { tx.objectStore(store).delete(cursor.result.primaryKey); cursor.result.continue(); } };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}
