import type { CellValue, ColumnDef, QualityIssue, RoleMap } from '../types'

interface ColumnWithValues {
  def: ColumnDef
  values: CellValue[]
}

const pct = (n: number, total: number) => (total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`)
const fmt = (n: number) => n.toLocaleString('en-US')

/** Builds the data-quality report shown before a line list is opened. */
export function buildQualityReport(columns: ColumnWithValues[], roles: RoleMap, rowCount: number): QualityIssue[] {
  const issues: QualityIssue[] = []
  const byId = new Map(columns.map((c) => [c.def.id, c]))

  const image = roles.image ? byId.get(roles.image) : undefined
  if (!image) {
    issues.push({
      level: 'warning',
      code: 'no-image-column',
      message: 'No column with image URLs was found. Products will show a placeholder image.',
    })
  } else {
    const missing = rowCount - image.def.stats.filled
    if (missing > 0) {
      issues.push({
        level: 'warning',
        code: 'missing-images',
        columnId: image.def.id,
        message: `${fmt(missing)} products have no image URL.`,
      })
    }
    const counts = new Map<string, number>()
    for (const v of image.values) if (typeof v === 'string') counts.set(v, (counts.get(v) ?? 0) + 1)
    let sharedProducts = 0
    let sharedUrls = 0
    for (const n of counts.values()) {
      if (n > 1) {
        sharedUrls++
        sharedProducts += n
      }
    }
    if (sharedUrls > 0) {
      issues.push({
        level: 'warning',
        code: 'shared-images',
        columnId: image.def.id,
        message: `${fmt(sharedProducts)} products share ${fmt(sharedUrls)} image URLs with other products — some may show another colour's photo.`,
      })
    }
  }

  if (!roles.key) {
    issues.push({
      level: 'warning',
      code: 'no-unique-key',
      message:
        'No column uniquely identifies each product. Products are identified by row number, so collections may not carry over to an updated file.',
    })
  }

  const price = roles.price ? byId.get(roles.price) : undefined
  if (!price) {
    issues.push({ level: 'warning', code: 'no-price', message: 'No retail price column was mapped. Totals and averages are unavailable.' })
  } else {
    const blankOrZero = rowCount - price.def.stats.filled + (price.def.stats.zeros ?? 0)
    if (blankOrZero > 0) {
      issues.push({
        level: 'warning',
        code: 'price-gaps',
        columnId: price.def.id,
        message: `“${price.def.header}” is 0 or blank for ${fmt(blankOrZero)} of ${fmt(rowCount)} products (${pct(blankOrZero, rowCount)}). These are excluded from averages.`,
      })
    }
  }

  for (const c of columns) {
    if (c.def.stats.mixedTypes) {
      issues.push({
        level: 'info',
        code: 'mixed-types',
        columnId: c.def.id,
        message: `“${c.def.header}” mixes text with numbers or dates; values are treated as text.`,
      })
    }
  }
  return issues
}
