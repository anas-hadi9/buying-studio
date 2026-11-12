/** Raw cell as produced by the Excel reader (before normalisation). */
export type RawCell = string | number | boolean | Date | null | undefined

export interface RawSheet {
  name: string
  hidden: boolean
  data: RawCell[][]
}

/** A sheet reduced to a header row and data rows. */
export interface SheetTable {
  headerRowIndex: number
  headers: string[]
  rows: RawCell[][]
}

const HEADER_SCAN_ROWS = 15

export function isBlank(value: RawCell): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

/**
 * Finds the header row: the row (among the first few) with the most text cells.
 * Pivot-style sheets often have titles above the real header; this skips them.
 */
export function detectHeaderRow(data: RawCell[][]): number {
  let best = 0
  let bestScore = -1
  const limit = Math.min(HEADER_SCAN_ROWS, data.length)
  for (let r = 0; r < limit; r++) {
    const row = data[r] ?? []
    let score = 0
    for (const cell of row) if (typeof cell === 'string' && cell.trim() !== '') score++
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best
}

/** Converts a raw sheet into headers + data rows, dropping empty rows/columns. */
export function toTable(data: RawCell[][]): SheetTable {
  const headerRowIndex = detectHeaderRow(data)
  const headerRow = data[headerRowIndex] ?? []
  const body = data.slice(headerRowIndex + 1).filter((row) => row.some((c) => !isBlank(c)))

  const width = Math.max(headerRow.length, ...body.map((r) => r.length), 0)
  const keep: number[] = []
  for (let c = 0; c < width; c++) {
    const hasHeader = !isBlank(headerRow[c])
    const hasData = body.some((r) => !isBlank(r[c]))
    if (hasHeader || hasData) keep.push(c)
  }

  const seen = new Map<string, number>()
  const headers = keep.map((c) => {
    const raw = headerRow[c]
    let header =
      raw instanceof Date
        ? raw.toISOString().slice(0, 10)
        : isBlank(raw)
          ? `Column ${columnLetter(c)}`
          : String(raw).replace(/\s+/g, ' ').trim()
    const count = seen.get(header.toLowerCase()) ?? 0
    seen.set(header.toLowerCase(), count + 1)
    if (count > 0) header = `${header} (${count + 1})`
    return header
  })

  const rows = body.map((r) => keep.map((c) => r[c] ?? null))
  return { headerRowIndex, headers, rows }
}

export function columnLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
