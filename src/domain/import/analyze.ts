import type { CellValue, ColumnDef, LineList, QualityIssue, RoleMap } from '../types'
import { createId } from '../text'
import { inferColumns } from './columns'
import { buildQualityReport } from './quality'
import { detectRoles } from './roles'
import { toTable, type RawSheet } from './sheet'

export interface SheetCandidate {
  name: string
  hidden: boolean
  rowCount: number
  columnCount: number
  headerRow: number
  headers: string[]
  imageColumn: string | null
  keyColumn: string | null
  score: number
}

export interface WorkbookAnalysis {
  sheets: SheetCandidate[]
  recommended: string | null
}

/** Everything the import wizard needs for one sheet, before the user confirms. */
export interface LineListDraft {
  sheetName: string
  headerRow: number
  columns: ColumnDef[]
  rows: CellValue[][]
  roles: RoleMap
  quality: QualityIssue[]
}

function analyzeTable(sheet: RawSheet) {
  const table = toTable(sheet.data)
  const inferred = inferColumns(table.headers, table.rows)
  const rowCount = table.rows.length
  const roles = detectRoles(inferred, rowCount)
  return { table, inferred, rowCount, roles }
}

/**
 * Scores how likely a sheet is to be the product list: an image column
 * matters most, then a unique key, size and header quality. Hidden sheets
 * are down-ranked but still selectable.
 */
export function scoreSheet(c: Omit<SheetCandidate, 'score'>): number {
  if (c.rowCount < 1 || c.columnCount < 2) return 0
  let score = 0
  if (c.imageColumn) score += 50
  if (c.keyColumn) score += 20
  score += (Math.min(c.rowCount, 5000) / 5000) * 20
  score += Math.min(c.columnCount, 20) / 2
  if (c.hidden) score -= 40
  return Math.max(0, Math.round(score * 10) / 10)
}

export function analyzeWorkbook(sheets: RawSheet[]): WorkbookAnalysis {
  const candidates = sheets.map((sheet): SheetCandidate => {
    const { table, inferred, rowCount, roles } = analyzeTable(sheet)
    const header = (id: string | undefined) => inferred.find((c) => c.def.id === id)?.def.header ?? null
    const base = {
      name: sheet.name,
      hidden: sheet.hidden,
      rowCount,
      columnCount: table.headers.length,
      headerRow: table.headerRowIndex + 1,
      headers: table.headers,
      imageColumn: header(roles.image),
      keyColumn: header(roles.key),
    }
    return { ...base, score: scoreSheet(base) }
  })
  const best = [...candidates].sort((a, b) => b.score - a.score)[0]
  return { sheets: candidates, recommended: best && best.score > 0 ? best.name : null }
}

export function buildDraft(sheet: RawSheet): LineListDraft {
  const { table, inferred, rowCount, roles } = analyzeTable(sheet)
  const columns = inferred.map((c) => c.def)
  const rows: CellValue[][] = Array.from({ length: rowCount }, (_, r) => inferred.map((c) => c.values[r] ?? null))
  return {
    sheetName: sheet.name,
    headerRow: table.headerRowIndex + 1,
    columns,
    rows,
    roles,
    quality: buildQualityReport(inferred, roles, rowCount),
  }
}

/** Re-runs the quality report after the user edits role mappings. */
export function recheckQuality(columns: ColumnDef[], rows: CellValue[][], roles: RoleMap): QualityIssue[] {
  const withValues = columns.map((def, c) => ({ def, values: rows.map((r) => r[c] ?? null) }))
  return buildQualityReport(withValues, roles, rows.length)
}

export function finalizeLineList(
  draft: LineListDraft,
  meta: { name: string; brand: string | null; fileName: string; roles: RoleMap; id?: string },
): LineList {
  return {
    schemaVersion: 1,
    id: meta.id ?? createId('ll'),
    name: meta.name.trim() || draft.sheetName,
    brand: meta.brand?.trim() || null,
    source: {
      fileName: meta.fileName,
      sheetName: draft.sheetName,
      headerRow: draft.headerRow,
      importedAt: new Date().toISOString(),
    },
    columns: draft.columns,
    rows: draft.rows,
    roles: meta.roles,
    quality: recheckQuality(draft.columns, draft.rows, meta.roles),
  }
}
