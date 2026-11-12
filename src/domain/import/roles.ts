import type { CellValue, ColumnDef, ColumnKind, FieldRole, RoleMap } from '../types'
import { normalizeHeader } from '../text'

/**
 * Header synonyms per role, most specific first. Headers are compared after
 * normalizeHeader() (lower-case, accents stripped, punctuation → space).
 * English and Turkish variants are included because vendor files mix both.
 */
const ROLE_PATTERNS: Record<Exclude<FieldRole, 'image' | 'key'>, { patterns: RegExp[]; kinds: ColumnKind[] }> = {
  style: {
    patterns: [/^style$/, /^style (no|nr|code|number|nbr|id)$/, /^model( (no|nr|code))?$/, /^stil( no)?$/],
    kinds: ['text', 'number'],
  },
  description: {
    patterns: [
      /^style desc(ription)?$/,
      /^(product|item|article) (name|desc(ription)?)$/,
      /^desc(ription)?$/,
      /^(urun )?aciklama/,
      /desc(ription)?/,
    ],
    kinds: ['text'],
  },
  color: {
    patterns: [/^colou?r desc(ription)?$/, /^colou?r name$/, /^colou?r$/, /^renk( adi)?$/, /colou?r/],
    kinds: ['text'],
  },
  gender: {
    patterns: [/^gender/, /^cinsiyet/, /gender/, /^division desc(ription)?$/],
    kinds: ['text'],
  },
  category: {
    patterns: [/^category$/, /^(product )?category/, /^kategori/, /^class desc(ription)?$/],
    kinds: ['text'],
  },
  line: {
    patterns: [/^line$/, /^(product )?line\b/, /^department desc(ription)?$/],
    kinds: ['text'],
  },
  price: {
    patterns: [/^psf$/, /retail price/, /^(rrp|msrp)$/, /^price/, /price/],
    kinds: ['number'],
  },
  vat: {
    patterns: [/^vat\b/, /^kdv/, /^tax( rate)?\b/],
    kinds: ['number'],
  },
  composition: {
    patterns: [/^composition/, /^(fabric|material)( composition)?$/, /^kompozisyon/, /icerik/],
    kinds: ['text'],
  },
}

const ROLE_ORDER: Exclude<FieldRole, 'image' | 'key'>[] = [
  'color',
  'style',
  'description',
  'gender',
  'category',
  'line',
  'price',
  'vat',
  'composition',
]

const KEY_PATTERNS = [
  /^item (no|nr|number|code|id)$/,
  /^sku$/,
  /^(article|art) (no|nr|number|code)$/,
  /^product (id|code|no)$/,
  /^(ean|gtin|barcode)$/,
]

export const COMPOSITION_VALUE = /^\s*\d{1,3}(?:[.,]\d+)?\s*%\s*\p{L}/u

interface ColumnWithValues {
  def: ColumnDef
  values: CellValue[]
}

function isUnique(col: ColumnWithValues, rowCount: number): boolean {
  if (col.def.stats.filled !== rowCount || rowCount === 0) return false
  return col.def.stats.distinct === rowCount
}

/** Auto-maps semantic roles to columns. Every mapping is editable by the user. */
export function detectRoles(columns: ColumnWithValues[], rowCount: number): RoleMap {
  const roles: RoleMap = {}
  const used = new Set<string>()
  const headers = new Map(columns.map((c) => [c.def.id, normalizeHeader(c.def.header)]))

  const images = columns.filter((c) => c.def.kind === 'image')
  if (images.length > 0) {
    const best = images.find((c) => /photo|image|foto|picture/.test(headers.get(c.def.id) ?? '')) ?? images[0]
    roles.image = best.def.id
    used.add(best.def.id)
  }

  const keyByName = KEY_PATTERNS.flatMap((p) =>
    columns.filter((c) => p.test(headers.get(c.def.id) ?? '') && isUnique(c, rowCount)),
  )[0]
  const keyFallback = columns.find(
    (c) => (c.def.kind === 'text' || c.def.kind === 'number') && isUnique(c, rowCount),
  )
  const key = keyByName ?? keyFallback
  if (key) {
    roles.key = key.def.id
    used.add(key.def.id)
  }

  for (const role of ROLE_ORDER) {
    const { patterns, kinds } = ROLE_PATTERNS[role]
    let match: ColumnWithValues | undefined
    for (const pattern of patterns) {
      match = columns.find(
        (c) => !used.has(c.def.id) && kinds.includes(c.def.kind) && pattern.test(headers.get(c.def.id) ?? ''),
      )
      if (match) break
    }
    if (!match && role === 'composition') {
      match = columns.find((c) => {
        if (used.has(c.def.id) || c.def.kind !== 'text') return false
        const filled = c.values.filter((v) => typeof v === 'string')
        if (filled.length === 0) return false
        const hits = filled.filter((v) => COMPOSITION_VALUE.test(v as string)).length
        return hits / filled.length >= 0.8
      })
    }
    if (match) {
      roles[role] = match.def.id
      used.add(match.def.id)
    }
  }
  return roles
}
