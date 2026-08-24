import { Note, Settings } from "./types";
const DB = "paperline-db",
  STORE = "app";
const defaults: Settings = {
  theme: "light",
  defaultBackground: "plain",
  smoothing: "standard",
  color: "#202124",
  width: 3,
  favorites: [],
  lastTool: "pen",
};
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function read<T>(key: string, fallback: T) {
  try {
    const db = await open();
    return await new Promise<T>((res) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res((r.result as T) ?? fallback);
      r.onerror = () => res(fallback);
    });
  } catch {
    return fallback;
  }
}
async function write(key: string, value: unknown) {
  const db = await open();
  db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
}
export const loadNotes = () => read<Note[]>("notes", []);
export const loadSettings = () => read<Settings>("settings", defaults);
export const saveNotes = (notes: Note[]) => write("notes", notes);
export const saveSettings = (s: Settings) => write("settings", s);
