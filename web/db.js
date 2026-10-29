// Stockage local des fiches (IndexedDB) : tout est enregistré sur le téléphone
// avant d'être envoyé, ce qui permet de travailler sans connexion.

const DB_NAME = 'fsh-terrain';
const STORE = 'fiches';

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function putFiche(fiche) {
  return run('readwrite', (store) => store.put(fiche)).then(() => fiche);
}

export function getFiche(id) {
  return run('readonly', (store) => store.get(id));
}

export function deleteFiche(id) {
  return run('readwrite', (store) => store.delete(id));
}

export async function allFiches() {
  const list = (await run('readonly', (store) => store.getAll())) || [];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
