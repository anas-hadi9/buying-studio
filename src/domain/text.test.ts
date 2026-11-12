import { describe, expect, it } from 'vitest'
import { normalizeHeader, normalizeText, slugify } from './text'

describe('normalizeText', () => {
  it('folds Turkish characters and accents', () => {
    expect(normalizeText('İSTANBUL VİEW')).toBe('istanbul view')
    expect(normalizeText('Işık Şal Göğüs Çanta')).toBe('isik sal gogus canta')
    expect(normalizeText('Crème')).toBe('creme')
  })
  it('normalises headers and slugs', () => {
    expect(normalizeHeader('Turkey Retail Price, Tl')).toBe('turkey retail price tl')
    expect(normalizeHeader('Multi Part Set?')).toBe('multi part set')
    expect(slugify('Vat %')).toBe('vat')
  })
})
