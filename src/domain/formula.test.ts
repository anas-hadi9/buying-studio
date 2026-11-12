import { describe, expect, it } from 'vitest'
import { compileFormula, formulaError, type RefResolver } from './formula'

const columns: Record<string, (number | null)[]> = {
  PSF: [1000, 2500, null],
  VAT: [0.1, 0.2, 0.1],
  'Turkey Retail Price, Tl': [900, 0, 50],
}

const resolve: RefResolver = (name) => {
  const key = Object.keys(columns).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? (r) => columns[key][r] ?? null : null
}

const run = (src: string, row = 0) => compileFormula(src, resolve).evaluate(row)

describe('formula language', () => {
  it('follows arithmetic precedence', () => {
    expect(run('1 + 2 * 3')).toBe(7)
    expect(run('(1 + 2) * 3')).toBe(9)
    expect(run('-2 ^ 2')).toBe(-4)
    expect(run('10 / 4 - 1')).toBe(1.5)
  })

  it('rounds like Excel, including nested ROUND', () => {
    expect(run('ROUND(2.5)')).toBe(3)
    expect(run('ROUND(1.005, 2)')).toBe(1.01)
    expect(run('ROUND(ROUND(PSF / (1 + VAT) / 7, 2) * 1.5, 0)')).toBe(195) // 129.87 × 1.5 = 194.805
    expect(run('ROUNDUP(1.21, 1)')).toBe(1.3)
    expect(run('ROUNDDOWN(1.29, 1)')).toBe(1.2)
  })

  it('supports functions, comparisons and IF', () => {
    expect(run('MAX(PSF, 1500)')).toBe(1500)
    expect(run('MIN(3; 2; 5)')).toBe(2) // semicolons as in Turkish-locale Excel
    expect(run('IF(PSF > 2000, 1, 0)', 1)).toBe(1)
    expect(run('ABS(-4)')).toBe(4)
  })

  it('references columns by alias, name or [bracketed header]', () => {
    expect(run('psf')).toBe(1000)
    expect(run('[Turkey Retail Price, Tl] * 2')).toBe(1800)
  })

  it('propagates blanks and guards division by zero', () => {
    expect(run('PSF * 2', 2)).toBeNull()
    expect(run('PSF / [Turkey Retail Price, Tl]', 1)).toBeNull()
  })

  it('reports unknown columns instead of failing', () => {
    const f = compileFormula('PSF * [Missing column]', resolve)
    expect(f.missing).toEqual(['Missing column'])
    expect(f.evaluate(0)).toBeNull()
  })

  it('rejects invalid formulas with a readable message', () => {
    expect(formulaError('PSF *')).toMatch(/ends unexpectedly/)
    expect(formulaError('FOO(1)')).toMatch(/Unknown function/)
    expect(formulaError('ROUND(1, 2, 3)')).toMatch(/wrong number of arguments/)
    expect(formulaError('alert("x")')).toMatch(/Unknown function|Unexpected/)
    expect(formulaError('')).toMatch(/empty/)
    expect(formulaError('ROUND(PSF / 2, 0)')).toBeNull()
  })
})
