import { normalizeText } from '../text'
import type { CatalogIndex, IndexedColumn } from './buildIndex'

export type ColumnFilter =
  | { type: 'values'; keys: string[] }
  | { type: 'range'; min: number | null; max: number | null }

/** Active filters keyed by column id. */
export type FilterState = Record<string, ColumnFilter>

export interface QueryInput {
  filters: FilterState
  search: string
  /** When set, only these product keys are eligible ("show selected only"). */
  restrictTo: ReadonlySet<string> | null
}

export interface QueryResult {
  /** 1 when the row passes every filter. */
  matches: Uint8Array
  matchCount: number
  /**
   * Per values-facet column, product count per dictionary code. Counts for a
   * column ignore that column's own filter (disjunctive faceting), so they
   * answer "how many would match if I also ticked this?".
   */
  facetCounts: Map<string, Int32Array>
}

export function isFilterActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false
  return f.type === 'values' ? f.keys.length > 0 : f.min !== null || f.max !== null
}

export function searchTokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean)
}

type Predicate = { columnId: string | null; test: (row: number) => boolean }

function columnPredicate(col: IndexedColumn, f: ColumnFilter): Predicate['test'] | null {
  if (f.type === 'values') {
    const lookup = new Uint8Array(col.dict.length)
    let any = false
    col.dict.forEach((v, i) => {
      if (f.keys.includes(v.key)) {
        lookup[i] = 1
        any = true
      }
    })
    if (!any) return () => false
    if (col.codes) {
      const codes = col.codes
      return (r) => lookup[codes[r]] === 1
    }
    if (col.offsets && col.flat) {
      const { offsets, flat } = col
      return (r) => {
        for (let i = offsets[r]; i < offsets[r + 1]; i++) if (lookup[flat[i]] === 1) return true
        return false
      }
    }
    return null
  }
  if (!col.numbers) return null
  const nums = col.numbers
  const min = f.min ?? -Infinity
  const max = f.max ?? Infinity
  return (r) => {
    const n = nums[r]
    return n >= min && n <= max // NaN (blank) fails both comparisons
  }
}

export function runQuery(index: CatalogIndex, input: QueryInput): QueryResult {
  const n = index.rowCount
  const predicates: Predicate[] = []

  for (const [columnId, f] of Object.entries(input.filters)) {
    if (!isFilterActive(f)) continue
    const col = index.byId.get(columnId)
    if (!col) continue
    const test = columnPredicate(col, f)
    if (test) predicates.push({ columnId, test })
  }

  const tokens = searchTokens(input.search)
  if (tokens.length > 0) {
    const hay = index.haystack
    predicates.push({ columnId: null, test: (r) => tokens.every((t) => hay[r].includes(t)) })
  }
  if (input.restrictTo) {
    const allowed = input.restrictTo
    const keys = index.keys
    predicates.push({ columnId: null, test: (r) => allowed.has(keys[r]) })
  }

  // Count failures per row, remembering the last failed predicate. A row is
  // in "all filters except P" when it fails nothing, or fails only P.
  const failCount = new Uint8Array(n)
  const lastFail = new Int16Array(n).fill(-1)
  predicates.forEach((p, pi) => {
    for (let r = 0; r < n; r++) {
      if (!p.test(r)) {
        if (failCount[r] < 255) failCount[r]++
        lastFail[r] = pi
      }
    }
  })

  const matches = new Uint8Array(n)
  let matchCount = 0
  for (let r = 0; r < n; r++) {
    if (failCount[r] === 0) {
      matches[r] = 1
      matchCount++
    }
  }

  const facetCounts = new Map<string, Int32Array>()
  for (const col of index.columns) {
    if (col.filter !== 'values') continue
    const counts = new Int32Array(col.dict.length)
    const own = predicates.findIndex((p) => p.columnId === col.def.id)
    for (let r = 0; r < n; r++) {
      const eligible = failCount[r] === 0 || (own >= 0 && failCount[r] === 1 && lastFail[r] === own)
      if (!eligible) continue
      if (col.codes) counts[col.codes[r]]++
      else if (col.offsets && col.flat) {
        for (let i = col.offsets[r]; i < col.offsets[r + 1]; i++) counts[col.flat[i]]++
      }
    }
    facetCounts.set(col.def.id, counts)
  }

  return { matches, matchCount, facetCounts }
}
