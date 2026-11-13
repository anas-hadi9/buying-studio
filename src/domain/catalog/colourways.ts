/**
 * Colourways: products that share a style (e.g. every colour of jacket
 * 1101311). Works from the style role, so it follows whichever column a line
 * list uses for the style.
 */
import type { ColumnFilter } from './query'
import type { CatalogIndex, IndexedColumn } from './buildIndex'

const byStyleCache = new WeakMap<CatalogIndex, Map<string, number[]>>()

function styleText(index: CatalogIndex, row: number): string | null {
  const col = index.roles.style ? index.byId.get(index.roles.style) : undefined
  const v = col?.values[row]
  return v === null || v === undefined || v === '' ? null : String(v)
}

function rowsByStyle(index: CatalogIndex): Map<string, number[]> {
  let map = byStyleCache.get(index)
  if (!map) {
    map = new Map()
    for (let r = 0; r < index.rowCount; r++) {
      const s = styleText(index, r)
      if (s === null) continue
      const list = map.get(s)
      if (list) list.push(r)
      else map.set(s, [r])
    }
    byStyleCache.set(index, map)
  }
  return map
}

/** Every product of the same style as `row` (itself included), in file order. */
export function colourwayRows(index: CatalogIndex, row: number): number[] {
  const s = styleText(index, row)
  return (s !== null && rowsByStyle(index).get(s)) || [row]
}

/**
 * The colour code when the product key is "<style>-<code>" (e.g. 2200001-123 → 123),
 * as most line lists number their items.
 */
export function colourCode(index: CatalogIndex, row: number): string | null {
  const s = styleText(index, row)
  const key = index.keys[row]
  if (s === null || !key.startsWith(s) || key.length === s.length) return null
  const rest = key.slice(s.length)
  return /^[-_./ ]\w{1,6}$/.test(rest) ? rest.slice(1) : null
}

/** A filter that keeps only products with the same value as `row` in `col`, if the column can do that. */
export function sameValueFilter(col: IndexedColumn, row: number): ColumnFilter | null {
  if (col.filter === 'values' && col.codes) {
    const code = col.codes[row]
    return code >= 0 ? { type: 'values', keys: [col.dict[code].key] } : null
  }
  if (col.filter === 'range' && col.numbers) {
    const n = col.numbers[row]
    return Number.isNaN(n) ? null : { type: 'range', min: n, max: n }
  }
  return null
}

/** The filter that shows every colour of `row`'s style, or null when there is no style column. */
export function styleFilter(index: CatalogIndex, row: number): { columnId: string; filter: ColumnFilter } | null {
  const col = index.roles.style ? index.byId.get(index.roles.style) : undefined
  if (!col) return null
  const filter = sameValueFilter(col, row)
  return filter ? { columnId: col.def.id, filter } : null
}
