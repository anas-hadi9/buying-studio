import type { FilterPreset } from '@/domain/presets'
import type { AppSettings } from '@/domain/settings'
import type { Collection, LineList, LineListSummary } from '@/domain/types'
import type { KeyValueStore } from './keyValue'
import type { Repositories } from './repositories'

/**
 * Key layout (one IndexedDB object store):
 *   ll:meta:<id>   LineListSummary  (small; listing never loads product data)
 *   ll:data:<id>   LineList
 *   col:<lineListId>:<id>  Collection
 *   sel:<lineListId>       string[]
 *   preset:<id>            FilterPreset
 *   settings               AppSettings
 */
const K = {
  meta: (id: string) => `ll:meta:${id}`,
  data: (id: string) => `ll:data:${id}`,
  collection: (lineListId: string, id: string) => `col:${lineListId}:${id}`,
  selection: (lineListId: string) => `sel:${lineListId}`,
  preset: (id: string) => `preset:${id}`,
  settings: 'settings',
}

const COVER_IMAGES = 4

function summarize(ll: LineList): LineListSummary {
  const imageIndex = ll.columns.findIndex((c) => c.id === ll.roles.image)
  const coverImages: string[] = []
  if (imageIndex >= 0) {
    for (const row of ll.rows) {
      const url = row[imageIndex]
      if (typeof url === 'string' && url) coverImages.push(url)
      if (coverImages.length === COVER_IMAGES) break
    }
  }
  return {
    id: ll.id,
    name: ll.name,
    brand: ll.brand,
    fileName: ll.source.fileName,
    sheetName: ll.source.sheetName,
    importedAt: ll.source.importedAt,
    productCount: ll.rows.length,
    coverImages,
  }
}

export function createLocalRepositories(kv: KeyValueStore): Repositories {
  return {
    lineLists: {
      async list() {
        const items = await kv.entries<LineListSummary>('ll:meta:')
        return items.map(([, v]) => v).sort((a, b) => b.importedAt.localeCompare(a.importedAt))
      },
      get: (id) => kv.get<LineList>(K.data(id)),
      async save(ll) {
        await kv.setMany([
          [K.data(ll.id), ll],
          [K.meta(ll.id), summarize(ll)],
        ])
      },
      async rename(id, name, brand) {
        const [meta, data] = await Promise.all([kv.get<LineListSummary>(K.meta(id)), kv.get<LineList>(K.data(id))])
        if (!meta || !data) return
        await kv.setMany([
          [K.meta(id), { ...meta, name, brand }],
          [K.data(id), { ...data, name, brand }],
        ])
      },
      async delete(id) {
        const related = [...(await kv.keys(`col:${id}:`)), K.selection(id)]
        await kv.delMany([K.meta(id), K.data(id), ...related])
      },
    },
    collections: {
      async listByLineList(lineListId) {
        const items = await kv.entries<Collection>(`col:${lineListId}:`)
        return items.map(([, v]) => v).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      },
      async countByLineList() {
        const counts: Record<string, number> = {}
        for (const key of await kv.keys('col:')) {
          const lineListId = key.split(':')[1]
          counts[lineListId] = (counts[lineListId] ?? 0) + 1
        }
        return counts
      },
      save: (c) => kv.set(K.collection(c.lineListId, c.id), c),
      async delete(id) {
        const key = (await kv.keys('col:')).find((k) => k.endsWith(`:${id}`))
        if (key) await kv.del(key)
      },
      async deleteByLineList(lineListId) {
        await kv.delMany(await kv.keys(`col:${lineListId}:`))
      },
    },
    selections: {
      get: async (lineListId) => (await kv.get<string[]>(K.selection(lineListId))) ?? [],
      save: (lineListId, keys) => kv.set(K.selection(lineListId), keys),
      delete: (lineListId) => kv.del(K.selection(lineListId)),
    },
    presets: {
      async list() {
        const items = await kv.entries<FilterPreset>('preset:')
        return items.map(([, v]) => v).sort((a, b) => a.name.localeCompare(b.name))
      },
      save: (p) => kv.set(K.preset(p.id), p),
      delete: (id) => kv.del(K.preset(id)),
    },
    settings: {
      get: () => kv.get<AppSettings>(K.settings),
      save: (s) => kv.set(K.settings, s),
    },
  }
}
