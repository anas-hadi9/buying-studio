/**
 * Collections files: how buyers share collections between devices (and,
 * later, how a server import/export would look). Products are referenced by
 * their key (e.g. Item No), so a file built on one device opens on another
 * that imported the same line list.
 */
import { createId, safeFileBase } from './text'
import type { Collection, LineList } from './types'

export const COLLECTIONS_FILE_FORMAT = 'buying-studio-collections'

export interface CollectionsFile {
  format: typeof COLLECTIONS_FILE_FORMAT
  version: 1
  exportedAt: string
  /** Where the collections were built, for display only. */
  lineList: { name: string; brand: string | null; fileName: string; sheetName: string }
  collections: { name: string; note?: string; groups: { name: string; itemKeys: string[] }[] }[]
}

export function exportCollections(lineList: LineList, collections: Collection[]): CollectionsFile {
  return {
    format: COLLECTIONS_FILE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    lineList: { name: lineList.name, brand: lineList.brand, fileName: lineList.source.fileName, sheetName: lineList.source.sheetName },
    collections: collections.map((c) => ({
      name: c.name,
      ...(c.note ? { note: c.note } : {}),
      groups: c.groups.map((g) => ({ name: g.name, itemKeys: [...g.itemKeys] })),
    })),
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseCollectionsFile(text: string): CollectionsFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid collections file (it is not JSON).')
  }
  if (!isRecord(data) || data.format !== COLLECTIONS_FILE_FORMAT) throw new Error('This is not a Buying Studio collections file.')
  if (!Array.isArray(data.collections) || data.collections.length === 0) throw new Error('The file contains no collections.')
  const collections = data.collections.map((c, i) => {
    if (!isRecord(c) || typeof c.name !== 'string' || !Array.isArray(c.groups)) throw new Error(`Collection ${i + 1} is malformed.`)
    const groups = c.groups.map((g, j) => {
      if (!isRecord(g) || typeof g.name !== 'string' || !Array.isArray(g.itemKeys) || !g.itemKeys.every((k) => typeof k === 'string')) {
        throw new Error(`Group ${j + 1} of “${c.name}” is malformed.`)
      }
      return { name: g.name, itemKeys: g.itemKeys as string[] }
    })
    return { name: c.name, note: typeof c.note === 'string' ? c.note : undefined, groups }
  })
  const ll = isRecord(data.lineList) ? data.lineList : {}
  return {
    format: COLLECTIONS_FILE_FORMAT,
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    lineList: {
      name: typeof ll.name === 'string' ? ll.name : '',
      brand: typeof ll.brand === 'string' ? ll.brand : null,
      fileName: typeof ll.fileName === 'string' ? ll.fileName : '',
      sheetName: typeof ll.sheetName === 'string' ? ll.sheetName : '',
    },
    collections,
  }
}

export interface ImportResult {
  collections: Collection[]
  products: number
  /** Product keys in the file that this line list doesn't contain (kept, shown as missing). */
  missing: number
}

/**
 * Turns a file into new collections for a line list. Imports never overwrite:
 * a name already in use gets " (imported)" appended. Duplicated product keys
 * inside a collection are kept once, in their first position.
 */
export function importCollections(
  file: CollectionsFile,
  lineListId: string,
  existingNames: string[],
  hasProduct: (key: string) => boolean,
): ImportResult {
  const names = new Set(existingNames)
  const now = new Date().toISOString()
  let products = 0
  let missing = 0
  const collections = file.collections.map((c): Collection => {
    let name = c.name.trim() || 'Imported collection'
    while (names.has(name)) name = `${name} (imported)`
    names.add(name)
    const seen = new Set<string>()
    const groups = c.groups.map((g) => {
      const itemKeys = g.itemKeys.filter((k) => !seen.has(k) && (seen.add(k), true))
      return { id: createId('grp'), name: g.name.trim() || 'Group', itemKeys }
    })
    for (const k of seen) {
      products++
      if (!hasProduct(k)) missing++
    }
    return {
      id: createId('col'),
      lineListId,
      name,
      ...(c.note ? { note: c.note } : {}),
      groups: groups.length ? groups : [{ id: createId('grp'), name: 'Unsorted', itemKeys: [] }],
      createdAt: now,
      updatedAt: now,
    }
  })
  return { collections, products, missing }
}

/** File name like "Network SS27 - collections.json". */
export function collectionsFileName(lineListName: string, collectionName?: string): string {
  return `${safeFileBase([lineListName, collectionName]) || 'collections'} - collections.json`
}
