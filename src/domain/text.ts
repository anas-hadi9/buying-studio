/**
 * Text helpers that behave well with Turkish data (İ, ı, ş, ğ…) and accents.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g

/**
 * Lower-cases and strips accents so that "İSTANBUL" matches "istanbul",
 * "Şal" matches "sal" and "ışık" matches "isik".
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
}

/** Normalises a header for matching against synonyms. */
export function normalizeHeader(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
}

export function slugify(input: string): string {
  const slug = normalizeText(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'column'
}

/** Collator for human-friendly ordering ("D2" before "D10"). */
export const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefix}_${random}`
}

/**
 * Joins parts into a download file name (without extension). Only letters,
 * digits and plain punctuation are kept: browsers drop the whole name (saving
 * the file as "download") when it contains characters such as "·".
 */
export function safeFileBase(parts: (string | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(' - ')
    .replace(/[^\p{L}\p{N} _().,&'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
