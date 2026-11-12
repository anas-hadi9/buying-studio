import type { CellValue, ColumnDef, ColumnFormat, ColumnKind } from '../types'
import { normalizeHeader, slugify } from '../text'
import { isBlank, type RawCell } from './sheet'

const URL_PATTERN = /^https?:\/\/\S+$/i
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?.*)?$/i
const IMAGE_HEADER = /\b(photo|image|img|picture|pic|foto|resim|gorsel|thumbnail)\b/

export interface InferredColumn {
  def: ColumnDef
  values: CellValue[]
}

/** ISO date (YYYY-MM-DD) for a Date at UTC midnight, as Excel dates arrive. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function rawToText(value: RawCell): string | null {
  if (isBlank(value)) return null
  if (value instanceof Date) return isoDate(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value).trim()
}

function decideKind(header: string, raw: RawCell[]): { kind: ColumnKind; mixed: boolean } {
  let dates = 0
  let numbers = 0
  let booleans = 0
  let strings = 0
  let urls = 0
  let imageUrls = 0
  for (const v of raw) {
    if (isBlank(v)) continue
    if (v instanceof Date) dates++
    else if (typeof v === 'number') numbers++
    else if (typeof v === 'boolean') booleans++
    else {
      strings++
      const s = String(v).trim()
      if (URL_PATTERN.test(s)) {
        urls++
        if (IMAGE_EXT.test(s)) imageUrls++
      }
    }
  }
  const filled = dates + numbers + booleans + strings
  const typesPresent = [dates, numbers, booleans, strings].filter((n) => n > 0).length
  const mixed = typesPresent > 1
  if (filled === 0) return { kind: 'text', mixed: false }
  if (dates === filled) return { kind: 'date', mixed }
  if (numbers === filled) return { kind: 'number', mixed }
  if (booleans === filled) return { kind: 'boolean', mixed }
  if (strings === filled && urls / filled >= 0.9) {
    const looksLikeImage = IMAGE_HEADER.test(normalizeHeader(header)) || imageUrls / urls >= 0.6
    return { kind: looksLikeImage ? 'image' : 'url', mixed }
  }
  // Mixed or textual: numbers stored as text are identifiers (style codes etc.).
  return { kind: 'text', mixed }
}

function normalizeCell(kind: ColumnKind, value: RawCell): CellValue {
  if (isBlank(value)) return null
  switch (kind) {
    case 'date':
      return value instanceof Date ? value.getTime() : null
    case 'number':
      return typeof value === 'number' ? value : null
    case 'boolean':
      return typeof value === 'boolean' ? value : null
    default:
      return rawToText(value)
  }
}

function decideFormat(header: string, kind: ColumnKind, values: CellValue[]): ColumnFormat {
  if (kind !== 'number') return { style: 'plain' }
  const nums = values.filter((v): v is number => typeof v === 'number')
  if (header.includes('%') && nums.every((n) => n >= 0 && n <= 1)) {
    return { style: 'percent' }
  }
  const integers = nums.every((n) => Number.isInteger(n))
  return integers ? { style: 'plain' } : { style: 'decimal', decimals: 2 }
}

/** Infers types, stats and normalised values for every column of a table. */
export function inferColumns(headers: string[], rows: RawCell[][]): InferredColumn[] {
  const usedIds = new Set<string>()
  return headers.map((header, c) => {
    const raw = rows.map((r) => r[c] ?? null)
    const { kind, mixed } = decideKind(header, raw)
    const values = raw.map((v) => normalizeCell(kind, v))

    let id = slugify(header)
    for (let i = 2; usedIds.has(id); i++) id = `${slugify(header)}-${i}`
    usedIds.add(id)

    const distinct = new Set<string>()
    let filled = 0
    let min = Infinity
    let max = -Infinity
    let zeros = 0
    for (const v of values) {
      if (v === null) continue
      filled++
      distinct.add(String(v))
      if (typeof v === 'number') {
        if (v < min) min = v
        if (v > max) max = v
        if (v === 0) zeros++
      }
    }
    const numeric = kind === 'number' || kind === 'date'
    const def: ColumnDef = {
      id,
      header,
      kind,
      format: decideFormat(header, kind, values),
      stats: {
        filled,
        distinct: distinct.size,
        mixedTypes: mixed,
        ...(numeric && filled > 0 ? { min, max, zeros } : {}),
      },
    }
    return { def, values }
  })
}
