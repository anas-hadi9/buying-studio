import type { CellValue, ColumnDef } from '../types'

const LOCALE = 'en-GB'

// Excel dates arrive as UTC midnight; formatting in UTC keeps the calendar day
// identical for buyers in every time zone.
const dateFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short', year: 'numeric' })
const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const percentFormat = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 })
const decimalFormats = new Map<number, Intl.NumberFormat>()

function decimalFormat(decimals: number) {
  let f = decimalFormats.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    decimalFormats.set(decimals, f)
  }
  return f
}

export function formatDate(ms: number): string {
  return dateFormat.format(new Date(ms))
}

/** "2027-01" → "Jan 2027". */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return monthFormat.format(new Date(Date.UTC(y, m - 1, 1)))
}

export function monthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Formats a number per the column format, without the unit. */
export function formatNumber(value: number, col: Pick<ColumnDef, 'format'>): string {
  switch (col.format.style) {
    case 'percent':
      return percentFormat.format(value)
    case 'decimal':
      return decimalFormat(col.format.decimals ?? 2).format(value)
    default:
      return Number.isInteger(value) ? integerFormat.format(value) : decimalFormat(2).format(value)
  }
}

export function formatMoney(value: number | null, currency?: string, decimals = 0): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const n = decimalFormat(decimals).format(value)
  return currency ? `${currency} ${n}` : n
}

/** Human-readable value for any cell. */
export function formatCell(col: Pick<ColumnDef, 'kind' | 'format'>, value: CellValue): string {
  if (value === null || value === '') return ''
  if (col.kind === 'date' && typeof value === 'number') return formatDate(value)
  if (typeof value === 'number') {
    const n = formatNumber(value, col)
    return col.format.unit ? `${n} ${col.format.unit}` : n
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return value
}
