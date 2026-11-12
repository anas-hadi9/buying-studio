import { describe, expect, it } from 'vitest'
import { lineListSheet, pivotSheet } from '../test/fixtures'
import { analyzeWorkbook, buildDraft, recheckQuality } from './analyze'
import { detectHeaderRow, toTable } from './sheet'

describe('header detection', () => {
  it('skips title rows above the real header in pivot sheets', () => {
    expect(detectHeaderRow(pivotSheet().data)).toBe(2)
  })
  it('trims headers and de-duplicates them', () => {
    const t = toTable([
      ['A ', 'A', null],
      [1, 2, null],
    ])
    expect(t.headers).toEqual(['A', 'A (2)'])
  })
})

describe('buildDraft', () => {
  const draft = buildDraft(lineListSheet())
  const col = (header: string) => draft.columns.find((c) => c.header === header)!

  it('infers column kinds from values', () => {
    expect(col('Style').kind).toBe('text') // mixed text + numbers = identifier
    expect(col('Psf').kind).toBe('number')
    expect(col('Available to Ship').kind).toBe('date')
    expect(col('Deadline').kind).toBe('text') // month names + dates
    expect(col('Photo Hyperlink').kind).toBe('image')
    expect(col('Vat %').format.style).toBe('percent')
    expect(col('Type Of Production').header).toBe('Type Of Production')
  })

  it('normalises values', () => {
    const style = draft.columns.indexOf(col('Style'))
    expect(draft.rows[4][style]).toBe('1004')
    const deadline = draft.columns.indexOf(col('Deadline'))
    expect(draft.rows[4][deadline]).toBe('2027-02-20')
    const ship = draft.columns.indexOf(col('Available to Ship'))
    expect(draft.rows[0][ship]).toBe(Date.UTC(2027, 0, 1))
  })

  it('maps field roles from headers', () => {
    const header = (id?: string) => draft.columns.find((c) => c.id === id)?.header
    expect(header(draft.roles.image)).toBe('Photo Hyperlink')
    expect(header(draft.roles.key)).toBe('Item No')
    expect(header(draft.roles.style)).toBe('Style')
    expect(header(draft.roles.description)).toBe('Style Description')
    expect(header(draft.roles.color)).toBe('Color Desc')
    expect(header(draft.roles.price)).toBe('Psf')
    expect(header(draft.roles.vat)).toBe('Vat %')
    expect(header(draft.roles.composition)).toBe('Composition In Percentage')
    expect(header(draft.roles.gender)).toBe('Gender')
    expect(header(draft.roles.category)).toBe('Category')
    expect(header(draft.roles.line)).toBe('Line')
  })

  it('reports data-quality issues', () => {
    const codes = draft.quality.map((q) => q.code)
    expect(codes).toContain('missing-images')
    expect(codes).toContain('mixed-types')
    expect(codes).not.toContain('price-gaps') // PSF is always filled
    const trp = draft.columns.find((c) => c.header === 'Turkey Retail Price, Tl')!.id
    const recheck = recheckQuality(draft.columns, draft.rows, { ...draft.roles, price: trp })
    expect(recheck.find((q) => q.code === 'price-gaps')?.message).toContain('3 of 5')
  })
})

describe('analyzeWorkbook', () => {
  it('recommends the product sheet and down-ranks hidden sheets', () => {
    const items = lineListSheet()
    const hiddenCopy = { ...lineListSheet(), name: 'ss27', hidden: true }
    const result = analyzeWorkbook([pivotSheet(), items, hiddenCopy])
    expect(result.recommended).toBe('Items')
    const pivot = result.sheets.find((s) => s.name === 'WOMAN')!
    expect(pivot.headerRow).toBe(3)
    expect(pivot.imageColumn).toBeNull()
  })
})
