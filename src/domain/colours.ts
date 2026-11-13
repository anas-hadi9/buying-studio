/**
 * Approximate swatches for colour names as they appear in line lists
 * ("Dark Blue", "Mink", "Navy Blue-White", "Beige Melange"). The goal is a
 * quick visual cue next to the name, not colour accuracy: unknown names get
 * no swatch rather than a guess.
 */

const NAMED: Record<string, string> = {
  black: '#1c1c1c',
  white: '#ffffff',
  'off white': '#f3efe4',
  offwhite: '#f3efe4',
  ivory: '#f6f1e1',
  cream: '#f1e8d0',
  ecru: '#ece2cc',
  vanilla: '#f2e6c4',
  natural: '#e6d8bb',
  beige: '#d8c4a2',
  'light beige': '#e6d9c0',
  'dark beige': '#b9a07c',
  sand: '#d6c19c',
  stone: '#c7bcaa',
  camel: '#b8895a',
  tan: '#c09a6b',
  khaki: '#a99c6f',
  'light khaki': '#cbbf95',
  mink: '#8b7a6b',
  'dark mink': '#6c5d50',
  taupe: '#8b7d70',
  brown: '#6b4a33',
  'light brown': '#9b7556',
  'dark brown': '#4a3020',
  chocolate: '#4a2e20',
  coffee: '#5a3e2b',
  'bitter coffee': '#3d2a20',
  tobacco: '#7a5230',
  cinnamon: '#a0582c',
  grey: '#8e8e8e',
  gray: '#8e8e8e',
  'light grey': '#c4c4c4',
  'light gray': '#c4c4c4',
  'dark grey': '#4f4f4f',
  'dark gray': '#4f4f4f',
  anthracite: '#3b3e42',
  silver: '#c3c3c3',
  gold: '#c9a54c',
  bronze: '#a5713b',
  blue: '#3b6db0',
  'light blue': '#a9c9e9',
  'dark blue': '#1f2a44',
  navy: '#1f2a44',
  'navy blue': '#1f2a44',
  'dark navy blue': '#151c2f',
  indigo: '#2f3b6c',
  'indigo blue': '#33437a',
  'dark indigo blue': '#262f55',
  'light indigo blue': '#5d70a3',
  sax: '#3d84c6',
  turquoise: '#2fb3b0',
  petrol: '#1f5661',
  'light petrol': '#4d8691',
  green: '#3f7a4a',
  'dark green': '#244a30',
  'oil green': '#5d5b2f',
  olive: '#6b6b3a',
  mint: '#a6dbc3',
  'sea green': '#2e8b74',
  red: '#c0322d',
  burgundy: '#6d1a2a',
  bordeaux: '#6d1a2a',
  claret: '#7a1f2b',
  crimson: '#a3142e',
  cherry: '#8e1b2c',
  'pomegranate flower': '#c8323c',
  tile: '#b5543b',
  coral: '#f07a64',
  salmon: '#f29f86',
  orange: '#e8792b',
  mustard: '#c9a227',
  yellow: '#f0cf43',
  pink: '#f0a8bd',
  'light pink': '#f7cdd8',
  'dusty rose': '#c98b8f',
  powder: '#eccac3',
  'dark powder': '#d3a49d',
  damson: '#5a2f4a',
  purple: '#6a3d8f',
  lilac: '#c3a6d6',
  lavender: '#b9a7dc',
}

/** Words that describe texture or pattern rather than colour. */
const IGNORED = new Set(['color', 'colour', 'colored', 'coloured', 'melange', 'striped', 'stripe', 'pattern', 'patterned', 'and', 'with', 'tone'])

const MULTI = new Set(['multi', 'multicolor', 'multicolour', 'colorful', 'colourful', 'rainbow'])
const PRINT = ['animal print', 'leopard', 'zebra', 'snake']

export type Swatch = { kind: 'solid'; colours: string[] } | { kind: 'multi' } | { kind: 'print'; colours: string[] }

const MAX_WORDS = 3

/** Swatch for a colour name, or null when the name isn't recognised. */
export function swatchFor(name: string | null | undefined): Swatch | null {
  if (!name) return null
  const text = name.toLowerCase().replace(/[-/&+,_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (PRINT.some((p) => text.includes(p))) return { kind: 'print', colours: ['#c79a5b', '#3a2a1f'] }
  const words = text.split(' ').filter((w) => !IGNORED.has(w))
  if (words.some((w) => MULTI.has(w)) || /\bmulti\s?colou?r\b/.test(text)) return { kind: 'multi' }

  // Longest known phrase first, left to right: "navy blue white" → navy blue + white.
  const colours: string[] = []
  for (let i = 0; i < words.length; ) {
    let matched = 0
    for (let n = Math.min(MAX_WORDS, words.length - i); n > 0; n--) {
      const hex = NAMED[words.slice(i, i + n).join(' ')]
      if (hex) {
        if (!colours.includes(hex)) colours.push(hex)
        matched = n
        break
      }
    }
    i += matched || 1
  }
  return colours.length ? { kind: 'solid', colours: colours.slice(0, 3) } : null
}

/** CSS background for a swatch dot. */
export function swatchBackground(swatch: Swatch): string {
  if (swatch.kind === 'multi') return 'conic-gradient(#e04b4b, #f0b43c, #4fae5b, #3b7dd8, #8e5bc8, #e04b4b)'
  const c = swatch.colours
  if (swatch.kind === 'print') return `radial-gradient(circle at 30% 30%, ${c[1]} 18%, transparent 20%), radial-gradient(circle at 70% 65%, ${c[1]} 16%, transparent 18%), ${c[0]}`
  if (c.length === 1) return c[0]
  if (c.length === 2) return `linear-gradient(135deg, ${c[0]} 50%, ${c[1]} 50%)`
  return `conic-gradient(${c[0]} 0 120deg, ${c[1]} 0 240deg, ${c[2]} 0)`
}
