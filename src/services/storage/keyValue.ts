import { createStore, del, delMany, entries, get, keys, set, setMany, type UseStore } from 'idb-keyval'

/** Minimal async key-value contract the repositories are written against. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  setMany(items: [string, unknown][]): Promise<void>
  del(key: string): Promise<void>
  delMany(keys: string[]): Promise<void>
  keys(prefix: string): Promise<string[]>
  entries<T>(prefix: string): Promise<[string, T][]>
}

export function indexedDbStore(dbName = 'buying-studio', storeName = 'data'): KeyValueStore {
  const store: UseStore = createStore(dbName, storeName)
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    setMany: (items) => setMany(items, store),
    del: (key) => del(key, store),
    delMany: (ks) => delMany(ks, store),
    keys: async (prefix) => (await keys<string>(store)).filter((k) => k.startsWith(prefix)),
    entries: async <T>(prefix: string) =>
      (await entries<string, T>(store)).filter(([k]) => k.startsWith(prefix)),
  }
}

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v))

/** In-memory store for tests and for running without IndexedDB. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => clone(map.get(key)) as T | undefined,
    set: async (key, value) => void map.set(key, clone(value)),
    setMany: async (items) => items.forEach(([k, v]) => map.set(k, clone(v))),
    del: async (key) => void map.delete(key),
    delMany: async (ks) => ks.forEach((k) => map.delete(k)),
    keys: async (prefix) => [...map.keys()].filter((k) => k.startsWith(prefix)),
    entries: async <T>(prefix: string) =>
      [...map.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)] as [string, T]),
  }
}
