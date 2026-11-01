import type { SongStorage, StoredSong, UserSongAnnotations } from './types';

export const SONG_DB_NAME = 'guitar-aid-songs-db';
export const SONG_DB_VERSION = 1;

/**
 * Adaptador en memoria para pruebas unitarias y entornos sin IndexedDB (Node.js/SSR).
 */
export function createMemorySongStorage(): SongStorage {
  const songs = new Map<string, StoredSong>();
  const annotations = new Map<string, UserSongAnnotations>();

  return {
    async saveSong(song: StoredSong): Promise<void> {
      songs.set(song.id, structuredClone(song));
    },

    async getSong(id: string): Promise<StoredSong | undefined> {
      const found = songs.get(id);
      return found ? structuredClone(found) : undefined;
    },

    async listSongs(): Promise<StoredSong[]> {
      const list = Array.from(songs.values()).map((s) => structuredClone(s));
      list.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
      return list;
    },

    async deleteSong(id: string): Promise<void> {
      songs.delete(id);
    },

    async saveAnnotations(ann: UserSongAnnotations): Promise<void> {
      annotations.set(ann.songId, structuredClone(ann));
    },

    async getAnnotations(songId: string): Promise<UserSongAnnotations | undefined> {
      const found = annotations.get(songId);
      return found ? structuredClone(found) : undefined;
    },

    async deleteAnnotations(songId: string): Promise<void> {
      annotations.delete(songId);
    },

    async clear(): Promise<void> {
      songs.clear();
      annotations.clear();
    },
  };
}

/**
 * Abre o inicializa la base de datos IndexedDB ('guitar-aid-songs-db', versión 1).
 */
function openIndexedDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SONG_DB_NAME, SONG_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('annotations')) {
        db.createObjectStore('annotations', { keyPath: 'songId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'));
  });
}

/**
 * Repositorio de persistencia en IndexedDB del Modo Canción (plan_fase3.md §7 C4).
 * Permite inyectar un IDBFactory alternativo para pruebas.
 */
export function createIndexedDbSongStorage(dbFactory?: IDBFactory): SongStorage {
  const factory = dbFactory ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
  if (!factory) {
    throw new Error('IndexedDB no está disponible en este entorno.');
  }
  const idbFactory: IDBFactory = factory;

  async function exec<T>(
    storeName: 'songs' | 'annotations',
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T> {
    const db = await openIndexedDb(idbFactory);
    return new Promise<T>((resolve, reject) => {
      let result: T;
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error(`Error en transacción sobre almacén '${storeName}'`));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error ?? new Error(`Transacción abortada en '${storeName}'`));
      };

      try {
        const req = operation(store);
        if (req) {
          req.onsuccess = () => {
            result = req.result;
          };
          req.onerror = () => {
            reject(req.error ?? new Error(`Error en operación sobre '${storeName}'`));
          };
        }
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  }

  return {
    async saveSong(song: StoredSong): Promise<void> {
      await exec('songs', 'readwrite', (store) => store.put(song));
    },

    async getSong(id: string): Promise<StoredSong | undefined> {
      return exec<StoredSong | undefined>('songs', 'readonly', (store) => store.get(id));
    },

    async listSongs(): Promise<StoredSong[]> {
      const list = await exec<StoredSong[]>('songs', 'readonly', (store) => store.getAll());
      list.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
      return list;
    },

    async deleteSong(id: string): Promise<void> {
      await exec('songs', 'readwrite', (store) => store.delete(id));
    },

    async saveAnnotations(annotations: UserSongAnnotations): Promise<void> {
      await exec('annotations', 'readwrite', (store) => store.put(annotations));
    },

    async getAnnotations(songId: string): Promise<UserSongAnnotations | undefined> {
      return exec<UserSongAnnotations | undefined>('annotations', 'readonly', (store) =>
        store.get(songId),
      );
    },

    async deleteAnnotations(songId: string): Promise<void> {
      await exec('annotations', 'readwrite', (store) => store.delete(songId));
    },

    async clear(): Promise<void> {
      const db = await openIndexedDb(idbFactory);
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['songs', 'annotations'], 'readwrite');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Error al limpiar base de datos IndexedDB'));
        };
        tx.objectStore('songs').clear();
        tx.objectStore('annotations').clear();
      });
    },
  };
}

/**
 * Resuelve el repositorio adecuado para el entorno actual:
 * IndexedDB si `window.indexedDB` / `globalThis.indexedDB` está presente,
 * o adaptador en memoria si se ejecuta en Node.js o sin soporte.
 */
export function resolveDefaultSongStorage(): SongStorage {
  if (typeof indexedDB !== 'undefined') {
    try {
      return createIndexedDbSongStorage();
    } catch {
      return createMemorySongStorage();
    }
  }
  return createMemorySongStorage();
}
