/**
 * Links from a product to its page on a brand website. Buyers paste the
 * address of any product page or search on the site; the product's ref no in
 * it becomes a placeholder, so every product gets its own link.
 *
 * Placeholders: {key} (ref no / Item No), {style}, {code} (colour code).
 */

export interface LinkParts {
  key: string
  style?: string | null
  code?: string | null
}

const PLACEHOLDER = /\{(key|style|code)\}/

/** Ways a value can appear in a link: as typed, URL-encoded or lower-cased. */
const variants = (value: string) => [...new Set([value, encodeURIComponent(value), value.toLowerCase()])]

export function isLinkTemplate(text: string): boolean {
  return PLACEHOLDER.test(text)
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The shape of a ref no, e.g. "1101311-052" → 7 digits, "-", 3 digits. Used to
 * spot ref nos of products that aren't in the line list (a carry-over the
 * buyer looked up on the website). Null for keys too plain to be distinctive.
 */
export function keyShape(key: string): RegExp | null {
  if (key.length < 5 || !/\d/.test(key) || !/[^\d]/.test(key)) return null
  const source = key.replace(/\d+|[A-Za-z]+|[^\dA-Za-z]/g, (m) =>
    /\d/.test(m[0]) ? `\\d{${m.length}}` : /[A-Za-z]/.test(m[0]) ? `[A-Za-z]{${m.length}}` : escapeRegex(m),
  )
  return new RegExp(`(?<![\\dA-Za-z])${source}(?![\\dA-Za-z])`)
}

/**
 * Turns a pasted example link into a template. `examples` are products to
 * look for in it (ref no first, then style); failing that, anything shaped
 * like their ref nos counts. Returns null when nothing is found.
 */
export function toLinkTemplate(url: string, examples: LinkParts[]): string | null {
  const text = url.trim()
  if (!/^https?:\/\//i.test(text)) return null
  if (isLinkTemplate(text)) return text
  const sorted = [...examples].sort((a, b) => b.key.length - a.key.length)
  for (const e of sorted) {
    for (const v of variants(e.key)) {
      const at = text.indexOf(v)
      if (at >= 0) return text.slice(0, at) + '{key}' + text.slice(at + v.length)
    }
  }
  const shapes = new Map<string, RegExp>()
  for (const e of examples) {
    const shape = keyShape(e.key)
    if (shape && !shapes.has(shape.source)) shapes.set(shape.source, shape)
    if (shapes.size >= 5) break
  }
  for (const shape of shapes.values()) {
    const m = shape.exec(text)
    if (m) return text.slice(0, m.index) + '{key}' + text.slice(m.index + m[0].length)
  }
  for (const e of sorted) {
    if (!e.style) continue
    for (const v of variants(e.style)) {
      const at = text.indexOf(v)
      if (at >= 0) return text.slice(0, at) + '{style}' + text.slice(at + v.length)
    }
  }
  return null
}

/** The product's link, or null when the template needs a part the product doesn't have. */
export function productLink(template: string | null | undefined, parts: LinkParts): string | null {
  if (!template) return null
  let missing = false
  const url = template.replace(/\{(key|style|code)\}/g, (_, name: keyof LinkParts) => {
    const v = parts[name]
    if (!v) missing = true
    return encodeURIComponent(v ?? '')
  })
  return missing ? null : url
}

/** "www.network.example" → "network.example", for button labels. */
export function linkHost(template: string): string {
  try {
    return new URL(template.replace(/\{(key|style|code)\}/g, 'x')).hostname.replace(/^www\./, '')
  } catch {
    return 'website'
  }
}
