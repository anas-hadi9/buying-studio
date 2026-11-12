/**
 * Fashion season ordering: SS26 < FW26 < SS27. Plain alphabetical order would
 * put every FW season before every SS season.
 */
const SEASON = /^(SS|SU|PS|FW|AW|WI|HW|PF)\s*-?\s*(\d{2}|\d{4})$/i
const SEASON_SPAN = /^(\d{2})\s*\/\s*(\d{2})\s*(SS|FW|AW)$/i
const FIRST_HALF = new Set(['SS', 'SU', 'PS'])

export function seasonRank(value: string): number | null {
  const v = value.trim()
  const m = SEASON.exec(v)
  if (m) {
    const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
    return year * 2 + (FIRST_HALF.has(m[1].toUpperCase()) ? 0 : 1)
  }
  const span = SEASON_SPAN.exec(v)
  if (span) {
    return (2000 + Number(span[1])) * 2 + (FIRST_HALF.has(span[3].toUpperCase()) ? 0 : 1)
  }
  return null
}

/** True when nearly all distinct values look like season codes. */
export function isSeasonal(distinctValues: string[]): boolean {
  if (distinctValues.length === 0) return false
  const hits = distinctValues.filter((v) => seasonRank(v) !== null).length
  return hits / distinctValues.length >= 0.9
}
