import { describe, expect, it } from 'vitest'
import { collectCodes, DEFAULT_MATERIAL_NAMES, describeMaterial, parseComposition } from './materials'

describe('parseComposition', () => {
  it('parses code-style compositions and orders by share', () => {
    expect(parseComposition('6% EA 73% CO 21% PES')).toEqual([
      { code: 'CO', percent: 73 },
      { code: 'PES', percent: 21 },
      { code: 'EA', percent: 6 },
    ])
  })
  it('parses spelled-out names with separators', () => {
    expect(parseComposition('60% Cotton, 40% Recycled Polyester')).toEqual([
      { code: 'Cotton', percent: 60 },
      { code: 'Recycled Polyester', percent: 40 },
    ])
  })
  it('parses name-before-percentage style', () => {
    expect(parseComposition('Cotton 60%, Polyester 40%')).toEqual([
      { code: 'Cotton', percent: 60 },
      { code: 'Polyester', percent: 40 },
    ])
  })
  it('handles decimals and blanks', () => {
    expect(parseComposition('99,5% CO 0,5% EA')[0]).toEqual({ code: 'CO', percent: 99.5 })
    expect(parseComposition('')).toEqual([])
    expect(parseComposition('Leather')).toEqual([])
  })
})

describe('describeMaterial', () => {
  it('derives main material and mix using the name dictionary', () => {
    expect(describeMaterial('97% CO 3% EA', DEFAULT_MATERIAL_NAMES)).toEqual({
      main: 'Cotton',
      mix: 'Cotton / Elastane',
      contains: ['Cotton', 'Elastane'],
    })
  })
  it('keeps unknown codes as-is rather than guessing', () => {
    expect(describeMaterial('80% ZR 20% BRS', DEFAULT_MATERIAL_NAMES).mix).toBe('ZR / Brass')
  })
  it('collects codes for the settings editor', () => {
    expect(collectCodes(['100% CO', '97% CO 3% EA'])).toEqual(
      new Map([
        ['CO', 2],
        ['EA', 1],
      ]),
    )
  })
})
