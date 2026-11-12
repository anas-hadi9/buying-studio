import { describe, expect, it } from 'vitest'
import { excelRound, normalizeVat, parsePricingFile, priceFieldHeader } from './pricing'

describe('excelRound', () => {
  it('rounds half away from zero like Excel', () => {
    expect(excelRound(2.5, 0)).toBe(3)
    expect(excelRound(-2.5, 0)).toBe(-3)
    expect(excelRound(140.01, 0)).toBe(140)
  })
  it('is not fooled by binary floating point', () => {
    expect(excelRound(1.005, 2)).toBe(1.01)
    expect(excelRound(1.255, 2)).toBe(1.26)
  })
})

describe('normalizeVat', () => {
  it('accepts fractions and percentages', () => {
    expect(normalizeVat(0.2)).toBe(0.2)
    expect(normalizeVat(20)).toBe(0.2)
  })
})

const file = (body: object) => JSON.stringify({ format: 'buying-studio-pricing', version: 1, ...body })

describe('parsePricingFile', () => {
  it('reads fields, currencies and decimals', () => {
    const p = parsePricingFile(
      file({ priceColumnCurrency: 'EUR', fields: [{ name: 'Retail', currency: 'GBP', decimals: 0, formula: 'ROUND(PSF * 2, 0)' }] }),
      'pricing.json',
    )
    expect(p.fields).toEqual([{ name: 'Retail', currency: 'GBP', decimals: 0, formula: 'ROUND(PSF * 2, 0)' }])
    expect(p.priceColumnCurrency).toBe('EUR')
    expect(p.source).toBe('pricing.json')
    expect(priceFieldHeader(p.fields[0])).toBe('Retail (GBP)')
  })

  it('rejects files that are not pricing files, with actionable messages', () => {
    expect(() => parsePricingFile('nope', 'x')).toThrow(/not JSON/)
    expect(() => parsePricingFile('{"format":"other"}', 'x')).toThrow(/not a Buying Studio pricing file/)
    expect(() => parsePricingFile(file({ fields: [] }), 'x')).toThrow(/no price fields/)
    expect(() => parsePricingFile(file({ fields: [{ name: 'A' }] }), 'x')).toThrow(/needs a "name" and a "formula"/)
    expect(() => parsePricingFile(file({ fields: [{ name: 'A', formula: 'PSF *' }] }), 'x')).toThrow(/formula for “A” is invalid/)
  })
})
