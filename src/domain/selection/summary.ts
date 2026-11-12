import type { CatalogIndex } from '../catalog/buildIndex'

export interface MoneyStat {
  total: number
  /** Average over products with a positive value. */
  average: number | null
  /** Products with a positive value (zeros and blanks are excluded). */
  priced: number
}

export interface Summary {
  products: number
  styles: number
  psf: MoneyStat | null
  fullPrice: MoneyStat | null
}

function money(nums: Float64Array | null | undefined, rows: number[]): MoneyStat | null {
  if (!nums) return null
  let total = 0
  let priced = 0
  for (const r of rows) {
    const v = nums[r]
    if (v > 0) {
      total += v
      priced++
    }
  }
  return { total, average: priced ? total / priced : null, priced }
}

/** Buying metrics for any set of rows (selection, a group, a collection). */
export function summarize(index: CatalogIndex, rows: number[]): Summary {
  const styleCol = index.roles.style ? index.byId.get(index.roles.style) : undefined
  let styles = rows.length
  if (styleCol?.codes) {
    const seen = new Set<number>()
    for (const r of rows) seen.add(styleCol.codes[r])
    styles = seen.size
  }
  const num = (id?: string) => (id ? index.byId.get(id)?.numbers : null)
  return {
    products: rows.length,
    styles,
    psf: money(num(index.roles.price), rows),
    fullPrice: money(num(index.roles.fullPrice), rows),
  }
}

export function rowsForKeys(index: CatalogIndex, keys: Iterable<string>): number[] {
  const rows: number[] = []
  for (const k of keys) {
    const r = index.keyToRow.get(k)
    if (r !== undefined) rows.push(r)
  }
  return rows
}
