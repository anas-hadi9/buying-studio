import { describe, expect, it } from 'vitest'
import { addGroup, addItems, createCollection } from '../collections'
import { buildDraft, finalizeLineList } from '../import/analyze'
import { DEFAULT_MATERIAL_NAMES } from '../materials'
import { parsePricingFile } from '../pricing'
import { lineListSheet } from '../test/fixtures'
import { buildCatalogIndex } from './buildIndex'
import { collectionsTables, productTable } from './exportTable'

const pricing = parsePricingFile(
  JSON.stringify({
    format: 'buying-studio-pricing',
    version: 1,
    priceColumnCurrency: 'TRY',
    fields: [{ name: 'Full Price', currency: 'JOD', decimals: 0, formula: 'ROUND(PSF / 100, 0)' }],
  }),
  'pricing.json',
)

function index() {
  const draft = buildDraft(lineListSheet())
  const ll = finalizeLineList(draft, { name: 'SS27', brand: 'Brand', fileName: 'f.xlsx', roles: draft.roles })
  return buildCatalogIndex(ll, { pricing, materialNames: DEFAULT_MATERIAL_NAMES })
}

describe('productTable', () => {
  it('exports every column in file order, calculated prices as plain numbers', () => {
    const idx = index()
    const t = productTable(idx, 'Products', [2, 0])
    const headers = t.columns.map((c) => c.header)
    expect(headers.slice(0, 3)).toEqual(['Style', 'Item No', 'Color Desc'])
    expect(headers).toContain('Full Price (JOD)')
    expect(headers).toContain('Main Material')
    expect(headers).not.toContain('Contains Material')
    const at = (row: number, header: string) => t.rows[row][headers.indexOf(header)]
    expect(at(0, 'Item No')).toBe('1002-291')
    expect(at(1, 'Item No')).toBe('1001-052')
    expect(at(0, 'Full Price (JOD)')).toBe(120)
    expect(t.columns[headers.indexOf('Full Price (JOD)')].format).toBe('#,##0 "JOD"')
    expect(t.columns[headers.indexOf('Psf')].format).toBe('#,##0 "TRY"')
    expect(t.columns[headers.indexOf('Photo Hyperlink')].link).toBe(true)
  })

  it('writes dates as Excel day numbers', () => {
    const idx = index()
    const t = productTable(idx, 'Products', [0])
    const c = t.columns.findIndex((col) => col.header === 'Available to Ship')
    expect(t.columns[c].format).toBe('d mmm yyyy')
    // 1 Jan 2027 is day 46388 in Excel.
    expect(t.rows[0][c]).toBe(46388)
  })
})

describe('collectionsTables', () => {
  it('builds a summary and lists products by group, skipping products not in the line list', () => {
    const idx = index()
    let c = addItems(createCollection('ll', 'Coastal'), ['1001-052', '1001-170', 'gone']).collection
    c = addGroup(c, 'Belts')
    c = addItems(c, ['1004-107'], c.groups[1].id).collection
    c = { ...c, note: 'Linen for spring' }
    const out = collectionsTables(idx, [c])
    expect(out.products).toBe(3)
    expect(out.missing).toBe(1)
    const [summary, products] = out.tables
    expect(summary.columns.map((col) => col.header)).toEqual(['Collection', 'Group', 'Products', 'Styles', 'Total Full Price (JOD)', 'Note'])
    expect(summary.rows).toEqual([
      ['Coastal', 'All groups', 3, 2, 90 + 90 + 40, 'Linen for spring'],
      ['Coastal', 'Unsorted', 2, 1, 180, null],
      ['Coastal', 'Belts', 1, 1, 40, null],
    ])
    expect(products.name).toBe('Coastal')
    expect(products.columns[0].header).toBe('Group')
    expect(products.rows.map((r) => r[0])).toEqual(['Unsorted', 'Unsorted', 'Belts'])
  })

  it('adds a Collection column when exporting several collections', () => {
    const idx = index()
    const a = addItems(createCollection('ll', 'A'), ['1001-052']).collection
    const b = addItems(createCollection('ll', 'B'), ['1002-291']).collection
    const [summary, products] = collectionsTables(idx, [a, b]).tables
    expect(summary.rows.map((r) => r[0])).toEqual(['A', 'B'])
    expect(products.name).toBe('Products')
    expect(products.rows.map((r) => r.slice(0, 2))).toEqual([
      ['A', 'Unsorted'],
      ['B', 'Unsorted'],
    ])
  })
})
