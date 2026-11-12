import { BLANK, type CatalogIndex } from './buildIndex'

export interface SortState {
  columnId: string
  direction: 'asc' | 'desc'
}

/**
 * Returns matching rows in display order. Without a sort, file order is kept
 * (it usually reflects how the vendor organised the range). Blanks always sort
 * last, in both directions.
 */
export function orderRows(index: CatalogIndex, matches: Uint8Array, sort: SortState | null): number[] {
  const rows: number[] = []
  for (let r = 0; r < index.rowCount; r++) if (matches[r]) rows.push(r)
  if (!sort) return rows
  const col = index.byId.get(sort.columnId)
  if (!col || !col.sortable) return rows
  const dir = sort.direction === 'asc' ? 1 : -1

  if (col.numbers) {
    const nums = col.numbers
    rows.sort((a, b) => {
      const x = nums[a]
      const y = nums[b]
      const xb = Number.isNaN(x)
      const yb = Number.isNaN(y)
      if (xb || yb) return xb === yb ? a - b : xb ? 1 : -1
      return x === y ? a - b : (x - y) * dir
    })
    return rows
  }
  if (col.codes) {
    const codes = col.codes
    const blank = col.dict.length - 1
    const hasBlank = col.dict[blank]?.key === BLANK
    rows.sort((a, b) => {
      const x = codes[a]
      const y = codes[b]
      if (hasBlank && (x === blank || y === blank)) return x === y ? a - b : x === blank ? 1 : -1
      return x === y ? a - b : (x - y) * dir
    })
  }
  return rows
}

export interface GroupNode {
  /** Stable path id, e.g. "story=SUMMER|category=SHIRT". */
  id: string
  columnId: string
  key: string
  label: string
  depth: number
  rows: number[]
  children: GroupNode[] | null
}

/**
 * Groups ordered rows by one or more columns (depth-first). Group order follows
 * the column's natural value order (season-aware, blanks last); row order inside
 * each group keeps the incoming sort.
 */
export function groupRows(index: CatalogIndex, rows: number[], groupBy: string[], depth = 0, parentId = ''): GroupNode[] {
  const columnId = groupBy[depth]
  const col = columnId ? index.byId.get(columnId) : undefined
  if (!col || !col.codes) return []
  const codes = col.codes
  const buckets = new Map<number, number[]>()
  for (const r of rows) {
    const c = codes[r]
    let b = buckets.get(c)
    if (!b) buckets.set(c, (b = []))
    b.push(r)
  }
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((code) => {
      const value = col.dict[code]
      const id = `${parentId}${parentId ? '|' : ''}${columnId}=${value.key}`
      const bucket = buckets.get(code)!
      const children = depth + 1 < groupBy.length ? groupRows(index, bucket, groupBy, depth + 1, id) : null
      return { id, columnId, key: value.key, label: value.label, depth, rows: bucket, children }
    })
}
