import { describeMaterial } from '../materials'
import { compileFormula, sameHeader, type RefResolver } from '../formula'
import { normalizeVat, priceFieldHeader, type PricingSettings } from '../pricing'
import { naturalCollator, normalizeText } from '../text'
import type { CellValue, ColumnDef, LineList, RoleMap } from '../types'
import { formatDate, formatMonthKey, formatNumber, monthKey } from './format'
import { isSeasonal, seasonRank } from './season'

/** Facet key used for empty cells. */
export const BLANK = '\u0000blank'
export const BLANK_LABEL = '(Blank)'

export interface FacetValue {
  key: string
  label: string
}

export type FilterMode = 'values' | 'range' | 'none'

export interface IndexedColumn {
  def: ColumnDef
  /** Cell per row (for multi-valued columns, the values joined by ", "). */
  values: CellValue[]
  /** Dictionary of facet values, already in display order (blank last). */
  dict: FacetValue[]
  /** Single-valued: dictionary code per row. Because `dict` is sorted, codes double as sort ranks. */
  codes: Int32Array | null
  /** Multi-valued (CSR): row r owns flat[offsets[r] .. offsets[r + 1]). */
  offsets: Int32Array | null
  flat: Int32Array | null
  /** Numeric view for number/date columns (NaN = blank). */
  numbers: Float64Array | null
  filter: FilterMode
  /** Shown in the main filter list (others sit under "More filters"). */
  prominent: boolean
  groupable: boolean
  sortable: boolean
}

export interface CatalogRoles extends RoleMap {
  /** The headline calculated price (first field of the pricing file). */
  fullPrice?: string
  material?: string
}

export interface CatalogSettings {
  pricing: PricingSettings
  materialNames: Record<string, string>
}

export interface CatalogIndex {
  lineList: LineList
  rowCount: number
  columns: IndexedColumn[]
  byId: Map<string, IndexedColumn>
  roles: CatalogRoles
  keys: string[]
  keyToRow: Map<string, number>
  /** Normalised text of every searchable column, per row. */
  haystack: string[]
}

export const DERIVED = {
  mainMaterial: 'x-main-material',
  materialMix: 'x-material-mix',
  containsMaterial: 'x-contains-material',
} as const

export const priceFieldId = (i: number) => `x-price-${i}`

interface ColumnSource {
  def: ColumnDef
  values: CellValue[]
  multi?: string[][]
}

const MAX_PROMINENT_VALUES = 150
const MAX_LIST_NUMBERS = 12

function deriveColumns(lineList: LineList, settings: CatalogSettings, source: Map<string, ColumnSource>) {
  const derived: ColumnSource[] = []
  const roles: CatalogRoles = { ...lineList.roles }
  const n = lineList.rows.length

  const composition = roles.composition ? source.get(roles.composition) : undefined
  if (composition) {
    const main = Array.from<CellValue>({ length: n })
    const mix = Array.from<CellValue>({ length: n })
    const contains = Array.from<string[]>({ length: n })
    for (let r = 0; r < n; r++) {
      const v = composition.values[r]
      const facts = describeMaterial(typeof v === 'string' ? v : null, settings.materialNames)
      main[r] = facts.main
      mix[r] = facts.mix
      contains[r] = facts.contains
    }
    const base = { kind: 'text' as const, format: { style: 'plain' as const }, derived: true, sourceColumnId: composition.def.id }
    derived.push(
      { def: { ...base, id: DERIVED.mainMaterial, header: 'Main Material', stats: emptyStats() }, values: main },
      { def: { ...base, id: DERIVED.materialMix, header: 'Material Mix', stats: emptyStats() }, values: mix },
      {
        def: { ...base, id: DERIVED.containsMaterial, header: 'Contains Material', multi: true, stats: emptyStats() },
        values: contains.map((c) => (c.length ? c.join(', ') : null)),
        multi: contains,
      },
    )
    roles.material = DERIVED.mainMaterial
  }

  // Calculated price fields from the private pricing file (none are built in).
  const price = roles.price ? source.get(roles.price) : undefined
  const vat = roles.vat ? source.get(roles.vat) : undefined
  const computed: ColumnSource[] = []
  const resolve: RefResolver = (name, bracketed) => {
    const alias = bracketed ? '' : name.toUpperCase()
    if ((alias === 'PSF' || alias === 'PRICE') && price) return numberAt(price.values)
    if (alias === 'VAT' && vat) {
      return (r) => {
        const v = vat.values[r]
        return typeof v === 'number' ? normalizeVat(v) : null
      }
    }
    // Any numeric column, or an earlier price field, by header.
    for (const col of [...source.values(), ...computed]) {
      if (col.def.kind === 'number' && (sameHeader(name, col.def.header) || (col.def.derived && sameHeader(name, col.def.header.replace(/\s*\([^)]*\)$/, ''))))) {
        return numberAt(col.values)
      }
    }
    return null
  }
  settings.pricing.fields.forEach((field, i) => {
    let values: CellValue[]
    try {
      const f = compileFormula(field.formula, resolve)
      values = Array.from({ length: n }, (_, r) => f.evaluate(r))
    } catch {
      values = Array.from<CellValue>({ length: n }).fill(null)
    }
    const col: ColumnSource = {
      def: {
        id: priceFieldId(i),
        header: priceFieldHeader(field),
        kind: 'number',
        format: { style: field.decimals > 0 ? 'decimal' : 'plain', decimals: field.decimals, unit: field.currency ?? undefined },
        stats: emptyStats(),
        derived: true,
        sourceColumnId: price?.def.id,
      },
      values,
    }
    computed.push(col)
    derived.push(col)
  })
  if (computed.length > 0) roles.fullPrice = priceFieldId(0)
  return { derived, roles }
}

const numberAt = (values: CellValue[]) => (r: number) => {
  const v = values[r]
  return typeof v === 'number' ? v : null
}

function emptyStats(): ColumnDef['stats'] {
  return { filled: 0, distinct: 0, mixedTypes: false }
}

function facetKey(def: ColumnDef, value: CellValue): string {
  if (value === null || value === '') return BLANK
  if (def.kind === 'date' && typeof value === 'number') return monthKey(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function facetLabel(def: ColumnDef, key: string): string {
  if (key === BLANK) return BLANK_LABEL
  if (def.kind === 'date') return formatMonthKey(key)
  if (def.kind === 'number') return formatNumber(Number(key), def)
  if (def.kind === 'boolean') return key === 'true' ? 'Yes' : 'No'
  return key
}

function keyComparator(def: ColumnDef, keys: string[]): (a: string, b: string) => number {
  if (def.kind === 'number') return (a, b) => Number(a) - Number(b)
  if (def.kind === 'date') return (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  if (def.kind === 'text' && isSeasonal(keys)) {
    return (a, b) => {
      const ra = seasonRank(a)
      const rb = seasonRank(b)
      if (ra !== null && rb !== null && ra !== rb) return ra - rb
      return naturalCollator.compare(a, b)
    }
  }
  return (a, b) => naturalCollator.compare(a, b)
}

function buildDictionary(def: ColumnDef, rowKeys: Iterable<string>) {
  const unique = new Set(rowKeys)
  const hasBlank = unique.delete(BLANK)
  const keys = [...unique]
  keys.sort(keyComparator(def, keys))
  if (hasBlank) keys.push(BLANK)
  const dict = keys.map((key) => ({ key, label: facetLabel(def, key) }))
  const codeOf = new Map(keys.map((k, i) => [k, i]))
  return { dict, codeOf, nonBlank: keys.length - (hasBlank ? 1 : 0) }
}

function indexColumn(src: ColumnSource, rowCount: number, roles: CatalogRoles): IndexedColumn {
  const { def } = src
  const isLink = def.kind === 'image' || def.kind === 'url'
  let codes: Int32Array | null = null
  let offsets: Int32Array | null = null
  let flat: Int32Array | null = null
  let dict: FacetValue[] = []
  let nonBlank = 0
  let filled = 0

  if (src.multi) {
    const built = buildDictionary(def, src.multi.flatMap((vals) => (vals.length ? vals : [BLANK])))
    dict = built.dict
    nonBlank = built.nonBlank
    offsets = new Int32Array(rowCount + 1)
    const flatCodes: number[] = []
    for (let r = 0; r < rowCount; r++) {
      offsets[r] = flatCodes.length
      const vals = src.multi[r]
      if (vals.length === 0) flatCodes.push(built.codeOf.get(BLANK)!)
      else {
        filled++
        for (const v of vals) flatCodes.push(built.codeOf.get(v)!)
      }
    }
    offsets[rowCount] = flatCodes.length
    flat = Int32Array.from(flatCodes)
  } else if (!isLink) {
    const rowKeys = src.values.map((v) => facetKey(def, v))
    const built = buildDictionary(def, rowKeys)
    dict = built.dict
    nonBlank = built.nonBlank
    codes = new Int32Array(rowCount)
    for (let r = 0; r < rowCount; r++) {
      codes[r] = built.codeOf.get(rowKeys[r])!
      if (rowKeys[r] !== BLANK) filled++
    }
  } else {
    for (const v of src.values) if (v !== null && v !== '') filled++
  }

  let numbers: Float64Array | null = null
  if (def.kind === 'number' || def.kind === 'date') {
    numbers = new Float64Array(rowCount)
    for (let r = 0; r < rowCount; r++) {
      const v = src.values[r]
      numbers[r] = typeof v === 'number' ? v : Number.NaN
    }
  }

  let filter: FilterMode = 'values'
  if (isLink) filter = 'none'
  else if (def.kind === 'number' && !src.multi && nonBlank > MAX_LIST_NUMBERS) filter = 'range'

  const nearlyUnique = filled >= 20 && nonBlank >= 0.9 * filled
  const isIdentity = def.id === roles.key || def.id === roles.image
  // Text columns made of numeric codes (e.g. colour sequence "052") are
  // identifiers: still filterable, but not headline filters.
  const codeLike =
    def.kind === 'text' && !src.multi && nonBlank > 0 && dict.filter((v) => /^\d+$/.test(v.key)).length >= 0.9 * nonBlank
  const prominent =
    filter === 'range' ||
    (filter === 'values' && !isIdentity && !codeLike && nonBlank > 0 && nonBlank <= MAX_PROMINENT_VALUES && !nearlyUnique)

  const stats = def.derived ? { ...def.stats, filled, distinct: nonBlank } : def.stats

  return {
    def: { ...def, stats },
    values: src.values,
    dict,
    codes,
    offsets,
    flat,
    numbers,
    filter,
    prominent,
    groupable: filter !== 'none' && !src.multi,
    sortable: !src.multi && !isLink,
  }
}

function searchText(col: IndexedColumn, row: number): string {
  const v = col.values[row]
  if (v === null || v === '' || typeof v === 'boolean') return ''
  if (col.def.kind === 'image' || col.def.kind === 'url') return ''
  if (col.def.kind === 'date' && typeof v === 'number') return formatDate(v)
  return String(v)
}

/**
 * Builds the in-memory index for a line list. Runs once per open (and again
 * when pricing or material settings change); every filter, search and sort
 * afterwards works on typed arrays.
 */
export function buildCatalogIndex(lineList: LineList, settings: CatalogSettings): CatalogIndex {
  const rowCount = lineList.rows.length
  const source = new Map<string, ColumnSource>()
  lineList.columns.forEach((def, c) => {
    let d = def
    if (def.id === lineList.roles.price && !def.format.unit && settings.pricing.priceColumnCurrency) {
      d = { ...def, format: { ...def.format, unit: settings.pricing.priceColumnCurrency } }
    }
    source.set(def.id, { def: d, values: lineList.rows.map((r) => r[c] ?? null) })
  })

  const { derived, roles } = deriveColumns(lineList, settings, source)

  // File order, with each derived column placed straight after its source column.
  const ordered: ColumnSource[] = []
  for (const def of lineList.columns) {
    ordered.push(source.get(def.id)!)
    for (const d of derived) if (d.def.sourceColumnId === def.id) ordered.push(d)
  }
  for (const d of derived) if (!d.def.sourceColumnId) ordered.push(d)

  const columns = ordered.map((src) => indexColumn(src, rowCount, roles))
  const byId = new Map(columns.map((c) => [c.def.id, c]))

  const keyCol = roles.key ? byId.get(roles.key) : undefined
  const keys = Array.from<string>({ length: rowCount })
  const keyToRow = new Map<string, number>()
  for (let r = 0; r < rowCount; r++) {
    let key = keyCol && keyCol.values[r] !== null ? String(keyCol.values[r]) : `row-${r + 1}`
    for (let i = 2; keyToRow.has(key); i++) key = `${key}#${i}`
    keys[r] = key
    keyToRow.set(key, r)
  }

  const haystack = Array.from<string>({ length: rowCount })
  for (let r = 0; r < rowCount; r++) {
    const parts: string[] = []
    for (const col of columns) {
      const t = searchText(col, r)
      if (t) parts.push(t)
    }
    haystack[r] = normalizeText(parts.join(' \u0001 '))
  }

  return { lineList, rowCount, columns, byId, roles, keys, keyToRow, haystack }
}
