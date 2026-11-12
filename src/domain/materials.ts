/**
 * Parses fibre compositions such as "97% CO 3% EA" or "60% Cotton, 40% Polyester"
 * so products can be filtered and grouped by material.
 */

export interface Fibre {
  code: string
  percent: number
}

/**
 * Names for composition codes. Only codes whose meaning is unambiguous are
 * included (standard textile labelling abbreviations plus common metals);
 * anything else is shown as its raw code until a name is added in Settings.
 */
export const DEFAULT_MATERIAL_NAMES: Record<string, string> = {
  ACR: 'Acrylic',
  AL: 'Aluminium',
  BRS: 'Brass',
  CLY: 'Lyocell',
  CMD: 'Modal',
  CO: 'Cotton',
  CPR: 'Copper',
  CV: 'Viscose',
  EA: 'Elastane',
  GLS: 'Glass',
  LEA: 'Leather',
  LI: 'Linen',
  NY: 'Nylon',
  OTH: 'Other',
  PA: 'Polyamide',
  PES: 'Polyester',
  PP: 'Polypropylene',
  PU: 'Polyurethane',
  PVC: 'PVC',
  SE: 'Silk',
  STL: 'Steel',
  SUE: 'Suede',
  WO: 'Wool',
}

const PERCENT = /(\d{1,3}(?:[.,]\d+)?)\s*%/g
const SEPARATORS = /^[\s,;/+&|-]+|[\s,;/+&|-]+$/g

function cleanName(raw: string): string {
  return raw.replace(SEPARATORS, '').replace(/\s+/g, ' ').trim()
}

/** Returns fibres ordered by percentage (highest first); [] if unparseable. */
export function parseComposition(text: string | null | undefined): Fibre[] {
  if (!text) return []
  const matches = [...text.matchAll(PERCENT)]
  if (matches.length === 0) return []

  const before = cleanName(text.slice(0, matches[0].index))
  // "Cotton 60%, Polyester 40%" puts the name before the number.
  const nameFirst = before !== '' && /\p{L}/u.test(before)

  const fibres: Fibre[] = matches.map((m, i) => {
    const start = m.index + m[0].length
    let name: string
    if (nameFirst) {
      const prevEnd = i === 0 ? 0 : matches[i - 1].index + matches[i - 1][0].length
      name = cleanName(text.slice(prevEnd, m.index))
    } else {
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length
      name = cleanName(text.slice(start, end))
    }
    return { code: name, percent: Number(m[1].replace(',', '.')) }
  })

  const merged = new Map<string, Fibre>()
  for (const f of fibres) {
    if (!f.code) continue
    const key = f.code.toUpperCase()
    const existing = merged.get(key)
    if (existing) existing.percent += f.percent
    else merged.set(key, { code: f.code, percent: f.percent })
  }
  return [...merged.values()].sort((a, b) => b.percent - a.percent)
}

export function materialName(code: string, names: Record<string, string>): string {
  return names[code.toUpperCase()] ?? names[code] ?? code
}

export interface MaterialFacts {
  main: string | null
  mix: string | null
  contains: string[]
}

export function describeMaterial(text: string | null | undefined, names: Record<string, string>): MaterialFacts {
  const fibres = parseComposition(text)
  if (fibres.length === 0) return { main: null, mix: null, contains: [] }
  const labels = fibres.map((f) => materialName(f.code, names))
  return {
    main: labels[0],
    mix: [...new Set(labels)].join(' / '),
    contains: [...new Set(labels)],
  }
}

/** All codes found in a set of compositions (for the settings editor). */
export function collectCodes(texts: Iterable<string | null | undefined>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of texts) {
    for (const f of parseComposition(t)) {
      const key = f.code.toUpperCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}
