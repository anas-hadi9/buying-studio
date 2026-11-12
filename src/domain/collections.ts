/**
 * Pure operations on buyer-built collections. Every function returns a new
 * Collection (no mutation), which keeps undo/redo and server sync simple later.
 */
import type { CatalogIndex } from './catalog/buildIndex'
import { groupRows } from './catalog/sortGroup'
import { createId } from './text'
import type { Collection, CollectionGroup } from './types'

export const DEFAULT_GROUP_NAME = 'Unsorted'
export const MISSING_GROUP_NAME = 'Not in line list'

const now = () => new Date().toISOString()

function touch(c: Collection, groups: CollectionGroup[]): Collection {
  return { ...c, groups, updatedAt: now() }
}

export function createCollection(lineListId: string, name: string): Collection {
  const ts = now()
  return {
    id: createId('col'),
    lineListId,
    name: name.trim() || 'Untitled collection',
    groups: [{ id: createId('grp'), name: DEFAULT_GROUP_NAME, itemKeys: [] }],
    createdAt: ts,
    updatedAt: ts,
  }
}

export function collectionKeys(c: Collection): Set<string> {
  return new Set(c.groups.flatMap((g) => g.itemKeys))
}

export function itemCount(c: Collection): number {
  return c.groups.reduce((n, g) => n + g.itemKeys.length, 0)
}

/** Adds products (skipping ones already in the collection) to a group (default: first). */
export function addItems(c: Collection, keys: string[], groupId?: string): { collection: Collection; added: number } {
  const existing = collectionKeys(c)
  const fresh = [...new Set(keys)].filter((k) => !existing.has(k))
  if (fresh.length === 0) return { collection: c, added: 0 }
  const target = groupId ?? c.groups[0]?.id
  const groups = c.groups.length
    ? c.groups.map((g) => (g.id === target ? { ...g, itemKeys: [...g.itemKeys, ...fresh] } : g))
    : [{ id: createId('grp'), name: DEFAULT_GROUP_NAME, itemKeys: fresh }]
  return { collection: touch(c, groups), added: fresh.length }
}

export function removeItems(c: Collection, keys: string[]): Collection {
  const drop = new Set(keys)
  return touch(
    c,
    c.groups.map((g) => ({ ...g, itemKeys: g.itemKeys.filter((k) => !drop.has(k)) })),
  )
}

/** Moves a product to a position in a group (works within and across groups). */
export function moveItem(c: Collection, key: string, toGroupId: string, toIndex: number): Collection {
  const without = c.groups.map((g) => ({ ...g, itemKeys: g.itemKeys.filter((k) => k !== key) }))
  return touch(
    c,
    without.map((g) => {
      if (g.id !== toGroupId) return g
      const items = [...g.itemKeys]
      items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, key)
      return { ...g, itemKeys: items }
    }),
  )
}

export function addGroup(c: Collection, name: string): Collection {
  return touch(c, [...c.groups, { id: createId('grp'), name: name.trim() || 'New group', itemKeys: [] }])
}

export function renameGroup(c: Collection, groupId: string, name: string): Collection {
  return touch(
    c,
    c.groups.map((g) => (g.id === groupId ? { ...g, name: name.trim() || g.name } : g)),
  )
}

/** Deletes a group; its products move to the first remaining group. */
export function deleteGroup(c: Collection, groupId: string): Collection {
  if (c.groups.length <= 1) return c
  const removed = c.groups.find((g) => g.id === groupId)
  const rest = c.groups.filter((g) => g.id !== groupId)
  if (!removed) return c
  rest[0] = { ...rest[0], itemKeys: [...rest[0].itemKeys, ...removed.itemKeys] }
  return touch(c, rest)
}

export function moveGroup(c: Collection, groupId: string, toIndex: number): Collection {
  const groups = [...c.groups]
  const from = groups.findIndex((g) => g.id === groupId)
  if (from < 0) return c
  const [g] = groups.splice(from, 1)
  groups.splice(Math.max(0, Math.min(toIndex, groups.length)), 0, g)
  return touch(c, groups)
}

/**
 * Re-arranges a collection into one group per value of a column (e.g. Story or
 * Main Material). Products keep their relative order. Products no longer in the
 * line list go to a "Not in line list" group so nothing is silently lost.
 */
export function regroupBy(c: Collection, index: CatalogIndex, columnId: string): Collection {
  const ordered = c.groups.flatMap((g) => g.itemKeys)
  const rows: number[] = []
  const missing: string[] = []
  for (const k of ordered) {
    const r = index.keyToRow.get(k)
    if (r === undefined) missing.push(k)
    else rows.push(r)
  }
  const nodes = groupRows(index, rows, [columnId])
  const groups: CollectionGroup[] = nodes.map((n) => ({
    id: createId('grp'),
    name: n.label,
    itemKeys: n.rows.map((r) => index.keys[r]),
  }))
  if (missing.length) groups.push({ id: createId('grp'), name: MISSING_GROUP_NAME, itemKeys: missing })
  if (groups.length === 0) groups.push({ id: createId('grp'), name: DEFAULT_GROUP_NAME, itemKeys: [] })
  return touch(c, groups)
}
