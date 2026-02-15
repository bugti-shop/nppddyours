import { Note } from '@/types/note';

const DB_NAME = 'nota-notes-db';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open notes database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('folderId', 'folderId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
};

export const loadNotesFromDB = async (): Promise<Note[]> => {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result.map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt),
          archivedAt: note.archivedAt ? new Date(note.archivedAt) : undefined,
          deletedAt: note.deletedAt ? new Date(note.deletedAt) : undefined,
          reminderTime: note.reminderTime ? new Date(note.reminderTime) : undefined,
          lastSyncedAt: note.lastSyncedAt ? new Date(note.lastSyncedAt) : undefined,
          voiceRecordings: note.voiceRecordings?.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
          })) || [],
          // Ensure sync fields exist (migration for existing notes)
          syncVersion: note.syncVersion ?? 1,
          syncStatus: note.syncStatus ?? 'synced',
          isDirty: note.isDirty ?? false,
          deviceId: note.deviceId ?? undefined,
        }));
        resolve(notes);
      };

      request.onerror = () => {
        console.error('Failed to load notes:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error loading notes from IndexedDB:', error);
    return [];
  }
};

export const saveNotesToDB = async (notes: Note[]): Promise<void> => {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Clear existing and add all
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        notes.forEach(note => {
          store.put({
            ...note,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString(),
            archivedAt: note.archivedAt?.toISOString(),
            deletedAt: note.deletedAt?.toISOString(),
            reminderTime: note.reminderTime?.toISOString(),
            lastSyncedAt: note.lastSyncedAt?.toISOString(),
            voiceRecordings: note.voiceRecordings?.map(r => ({
              ...r,
              timestamp: r.timestamp.toISOString(),
            })) || [],
            // Ensure sync fields are saved
            syncVersion: note.syncVersion ?? 1,
            syncStatus: note.syncStatus ?? 'synced',
            isDirty: note.isDirty ?? false,
            deviceId: note.deviceId,
          });
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error saving notes to IndexedDB:', error);
    // DO NOT fallback to localStorage - it causes quota errors with large notes
    // Just log the error and continue
  }
};

export const saveNoteToDBSingle = async (note: Note): Promise<void> => {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      store.put({
        ...note,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        archivedAt: note.archivedAt?.toISOString(),
        deletedAt: note.deletedAt?.toISOString(),
        reminderTime: note.reminderTime?.toISOString(),
        lastSyncedAt: note.lastSyncedAt?.toISOString(),
        voiceRecordings: note.voiceRecordings?.map(r => ({
          ...r,
          timestamp: r.timestamp.toISOString(),
        })) || [],
        // Ensure sync fields are saved
        syncVersion: note.syncVersion ?? 1,
        syncStatus: note.syncStatus ?? 'pending',
        isDirty: note.isDirty ?? true,
        deviceId: note.deviceId,
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error saving single note to IndexedDB:', error);
  }
};

export const deleteNoteFromDB = async (noteId: string): Promise<void> => {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(noteId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error deleting note from IndexedDB:', error);
  }
};

// Migration from localStorage to IndexedDB (one-time)
export const migrateNotesToIndexedDB = async (): Promise<boolean> => {
  const { getSetting, setSetting } = await import('@/utils/settingsStorage');
  try {
    const migrated = await getSetting('notes_migrated_to_indexeddb', false);
    if (migrated) return false;

    // Check if there are notes in old localStorage (for backward compatibility during migration)
    let oldNotes: Note[] = [];
    try {
      const saved = localStorage.getItem('notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        oldNotes = parsed.map((n: Note) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
          voiceRecordings: n.voiceRecordings?.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
          })) || [],
        }));
      }
    } catch {}

    if (oldNotes.length > 0) {
      await saveNotesToDB(oldNotes);
      await setSetting('notes_migrated_to_indexeddb', true);
      // Clear localStorage
      try { localStorage.removeItem('notes'); } catch {}
      console.log(`Migrated ${oldNotes.length} notes to IndexedDB`);
      return true;
    }
    
    await setSetting('notes_migrated_to_indexeddb', true);
    return false;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
};

// Debounced save function to prevent excessive writes
let saveTimeout: NodeJS.Timeout | null = null;
export const debouncedSaveNotes = (notes: Note[], delay: number = 500): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveNotesToDB(notes);
  }, delay);
};

// Content compression for large notes
export const compressContent = (content: string): string => {
  // Simple compression: remove excessive whitespace
  return content
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
};

// Split large content into chunks for storage
export const splitLargeContent = (content: string, maxChunkSize: number = 500000): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    chunks.push(content.slice(start, start + maxChunkSize));
    start += maxChunkSize;
  }
  return chunks;
};

// Get storage usage estimate
export const getStorageUsage = async (): Promise<{ used: number; quota: number }> => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { used: 0, quota: 0 };
};
