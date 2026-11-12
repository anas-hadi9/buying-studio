import { strFromU8, unzipSync } from 'fflate'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return ENTITIES[e.toLowerCase()] ?? _
  })
}

/**
 * Reads which sheets are hidden from xl/workbook.xml. The Excel reader does not
 * expose this, and hidden sheets are usually helper/template data, not the range.
 */
export function readHiddenSheets(buffer: ArrayBuffer): Set<string> {
  const hidden = new Set<string>()
  try {
    const files = unzipSync(new Uint8Array(buffer), { filter: (f) => f.name === 'xl/workbook.xml' })
    const xml = files['xl/workbook.xml']
    if (!xml) return hidden
    for (const tag of strFromU8(xml).match(/<sheet\b[^>]*>/g) ?? []) {
      const name = /\bname="([^"]*)"/.exec(tag)?.[1]
      const state = /\bstate="([^"]*)"/.exec(tag)?.[1]
      if (name && state && state !== 'visible') hidden.add(decodeXml(name))
    }
  } catch {
    // Not fatal: treat every sheet as visible.
  }
  return hidden
}
