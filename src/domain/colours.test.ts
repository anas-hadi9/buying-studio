import { describe, expect, it } from 'vitest'
import { swatchBackground, swatchFor } from './colours'

describe('swatchFor', () => {
  it('recognises single colours, ignoring case, texture words and "color"', () => {
    expect(swatchFor('Mink')).toEqual({ kind: 'solid', colours: ['#8b7a6b'] })
    expect(swatchFor('Dark Blue')).toEqual(swatchFor('NAVY'))
    expect(swatchFor('Beige Melange')).toEqual(swatchFor('beige'))
    expect(swatchFor('Powder color')).toEqual(swatchFor('Powder'))
  })

  it('splits two- and three-colour names on the longest known phrase', () => {
    expect(swatchFor('Navy Blue-White')).toEqual({ kind: 'solid', colours: ['#1f2a44', '#ffffff'] })
    expect(swatchFor('Bitter Coffee - Off  White')).toEqual({ kind: 'solid', colours: ['#3d2a20', '#f3efe4'] })
    expect(swatchFor('Dark Blue Gold')?.kind).toBe('solid')
    expect(swatchFor('Black White Striped')).toEqual({ kind: 'solid', colours: ['#1c1c1c', '#ffffff'] })
  })

  it('handles multi-colour and prints, and gives up on unknown names', () => {
    expect(swatchFor('Multi Color')).toEqual({ kind: 'multi' })
    expect(swatchFor('Leopard Pattern')?.kind).toBe('print')
    expect(swatchFor('Animal Print')?.kind).toBe('print')
    expect(swatchFor('Brown Pattern')).toEqual(swatchFor('Brown'))
    expect(swatchFor('Zorblax')).toBeNull()
    expect(swatchFor('')).toBeNull()
    expect(swatchFor(null)).toBeNull()
  })

  it('renders backgrounds for one, two and three colours', () => {
    expect(swatchBackground({ kind: 'solid', colours: ['#000'] })).toBe('#000')
    expect(swatchBackground({ kind: 'solid', colours: ['#000', '#fff'] })).toContain('linear-gradient')
    expect(swatchBackground({ kind: 'solid', colours: ['#000', '#fff', '#f00'] })).toContain('conic-gradient')
  })
})
