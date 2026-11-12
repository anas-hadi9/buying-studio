/**
 * Core domain types. Framework-free: shared by the import worker, stores and UI,
 * and reusable by a future backend.
 */

/** A normalised cell. Date columns store UTC epoch milliseconds. */
export type CellValue = string | number | boolean | null

export type ColumnKind = 'text' | 'number' | 'date' | 'boolean' | 'url' | 'image'

export interface ColumnStats {
  /** Non-blank cells. */
  filled: number
  distinct: number
  min?: number
  max?: number
  zeros?: number
  /** The source column mixed value types (e.g. numbers and text). */
  mixedTypes: boolean
}

export interface ColumnFormat {
  style: 'plain' | 'percent' | 'decimal'
  decimals?: number
  /** Currency or unit label shown next to the value, e.g. "EUR". */
  unit?: string
}

export interface ColumnDef {
  /** Stable id derived from the header; unique within a line list. */
  id: string
  /** Header as shown to users (trimmed). */
  header: string
  kind: ColumnKind
  format: ColumnFormat
  stats: ColumnStats
  /** Computed by the app rather than read from the file. */
  derived?: boolean
  /** Each product can hold several values (e.g. "Contains material"). */
  multi?: boolean
  /** Column this one is derived from (for ordering next to it). */
  sourceColumnId?: string
}

/**
 * Semantic roles the buying UI needs. Each maps to whichever column plays that
 * role in a given file, so the UI never hardcodes headers.
 */
export const FIELD_ROLES = [
  'image',
  'key',
  'style',
  'description',
  'color',
  'gender',
  'category',
  'line',
  'price',
  'vat',
  'composition',
] as const
export type FieldRole = (typeof FIELD_ROLES)[number]
export type RoleMap = Partial<Record<FieldRole, string>>

export const ROLE_LABELS: Record<FieldRole, string> = {
  image: 'Product image',
  key: 'Unique product key',
  style: 'Style',
  description: 'Description',
  color: 'Colour',
  gender: 'Gender',
  category: 'Category',
  line: 'Line',
  price: 'Retail price (PSF)',
  vat: 'VAT rate',
  composition: 'Composition / material',
}

export interface QualityIssue {
  level: 'warning' | 'info'
  code: string
  message: string
  columnId?: string
}

/** An imported workbook sheet: the vendor's offer for a brand/season. */
export interface LineList {
  schemaVersion: 1
  id: string
  name: string
  brand: string | null
  source: {
    fileName: string
    sheetName: string
    headerRow: number
    importedAt: string
  }
  columns: ColumnDef[]
  /** Row-major cells aligned with `columns`. */
  rows: CellValue[][]
  roles: RoleMap
  quality: QualityIssue[]
}

export interface LineListSummary {
  id: string
  name: string
  brand: string | null
  fileName: string
  sheetName: string
  importedAt: string
  productCount: number
  coverImages: string[]
}

/** A buyer-built assortment, organised into groups the buyer can reorder. */
export interface Collection {
  id: string
  lineListId: string
  name: string
  groups: CollectionGroup[]
  createdAt: string
  updatedAt: string
}

export interface CollectionGroup {
  id: string
  name: string
  /** Product keys, in the buyer's chosen order. */
  itemKeys: string[]
}
