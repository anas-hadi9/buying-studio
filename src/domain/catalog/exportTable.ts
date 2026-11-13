/**
 * Turns products and collections into plain tables for export. The tables are
 * format-neutral; `services/xlsx` writes them as Excel. Values are exported,
 * never formulas: calculated prices appear as numbers only.
 */
import type { CellValue, Collection, ColumnDef } from '../types'
import type { CatalogIndex, IndexedColumn } from './buildIndex'

export interface ExportColumn {
  header: string
  /** Excel-style number format code, e.g. `#,##0 "JOD"` or `d mmm yyyy`. */
  format?: string
  /** Text in this column is a link (e.g. the photo URL). */
  link?: boolean
}

export interface ExportTable {
  name: string
  columns: ExportColumn[]
  rows: CellValue[][]
}

const DAY_MS = 86_400_000
/** Excel's day number for a UTC epoch-milliseconds date. */
const excelDay = (ms: number) => ms / DAY_MS + 25_569

/** Excel number format matching how the app shows a column. */
export function numberFormat(def: ColumnDef, values: CellValue[]): string | undefined {
  if (def.kind === 'date') return 'd mmm yyyy'
  if (def.kind !== 'number') return undefined
  let code: string
  if (def.format.style === 'percent') code = '0.0%'
  else if (def.format.style === 'decimal') code = def.format.decimals ? `#,##0.${'0'.repeat(def.format.decimals)}` : '#,##0'
  else code = values.every((v) => typeof v !== 'number' || Number.isInteger(v)) ? '#,##0' : '#,##0.00'
  const unit = def.format.unit?.replace(/"/g, '')
  return unit ? `${code} "${unit}"` : code
}

/** Every column except multi-valued helpers (e.g. "Contains material", a filter aid). */
function exportedColumns(index: CatalogIndex): IndexedColumn[] {
  return index.columns.filter((c) => !c.def.multi)
}

function cellValue(col: IndexedColumn, row: number): CellValue {
  const v = col.values[row] ?? null
  return col.def.kind === 'date' && typeof v === 'number' ? excelDay(v) : v
}

export interface LeadingColumn {
  header: string
  /** One value per exported row. */
  values: CellValue[]
}

/** One row per product, with every column of the line list (plus app-calculated ones). */
export function productTable(index: CatalogIndex, name: string, rows: number[], leading: LeadingColumn[] = []): ExportTable {
  const cols = exportedColumns(index)
  return {
    name,
    columns: [
      ...leading.map((l) => ({ header: l.header })),
      ...cols.map((c) => ({
        header: c.def.header,
        format: numberFormat(c.def, c.values),
        link: c.def.kind === 'url' || c.def.kind === 'image',
      })),
    ],
    rows: rows.map((r, i) => [...leading.map((l) => l.values[i] ?? null), ...cols.map((c) => cellValue(c, r))]),
  }
}

/** The headline price column (calculated full price if loaded, else the price column). */
function valueColumn(index: CatalogIndex): IndexedColumn | undefined {
  const id = index.roles.fullPrice ?? index.roles.price
  return id ? index.byId.get(id) : undefined
}

function styleCount(index: CatalogIndex, rows: number[]): number {
  const style = index.roles.style ? index.byId.get(index.roles.style) : undefined
  if (!style) return rows.length
  return new Set(rows.map((r) => style.values[r]).filter((v) => v !== null && v !== '')).size
}

export interface CollectionsExport {
  tables: ExportTable[]
  products: number
  /** Products in the collections that this line list doesn't contain (left out). */
  missing: number
}

/**
 * A "Summary" sheet (products, styles and value per collection and group, plus
 * notes) and a products sheet listing each product under its collection and group.
 */
export function collectionsTables(index: CatalogIndex, collections: Collection[]): CollectionsExport {
  const many = collections.length > 1
  const rows: number[] = []
  const collectionNames: string[] = []
  const groupNames: string[] = []
  const value = valueColumn(index)
  const valueFormat = value ? numberFormat(value.def, value.values) : undefined
  const total = (rs: number[]) => {
    if (!value) return null
    let sum = 0
    for (const r of rs) {
      const v = value.values[r]
      if (typeof v === 'number') sum += v
    }
    return sum
  }

  const summary: CellValue[][] = []
  let missing = 0
  for (const c of collections) {
    const all: number[] = []
    const groupRows: CellValue[][] = []
    for (const g of c.groups) {
      const gRows: number[] = []
      for (const key of g.itemKeys) {
        const r = index.keyToRow.get(key)
        if (r === undefined) {
          missing++
          continue
        }
        gRows.push(r)
        rows.push(r)
        collectionNames.push(c.name)
        groupNames.push(g.name)
      }
      all.push(...gRows)
      if (c.groups.length > 1) groupRows.push([c.name, g.name, gRows.length, styleCount(index, gRows), total(gRows), null])
    }
    summary.push([c.name, c.groups.length > 1 ? 'All groups' : (c.groups[0]?.name ?? ''), all.length, styleCount(index, all), total(all), c.note ?? null])
    summary.push(...groupRows)
  }

  const summaryTable: ExportTable = {
    name: 'Summary',
    columns: [
      { header: 'Collection' },
      { header: 'Group' },
      { header: 'Products', format: '#,##0' },
      { header: 'Styles', format: '#,##0' },
      { header: value ? `Total ${value.def.header}` : 'Total value', format: valueFormat },
      { header: 'Note' },
    ],
    rows: summary,
  }
  const leading: LeadingColumn[] = [...(many ? [{ header: 'Collection', values: collectionNames }] : []), { header: 'Group', values: groupNames }]
  const products = productTable(index, many ? 'Products' : collections[0]?.name || 'Products', rows, leading)
  return { tables: [summaryTable, products], products: rows.length, missing }
}
