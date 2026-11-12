import { describe, expect, it } from 'vitest'
import { finalizeLineList, buildDraft } from '../import/analyze'
import { DEFAULT_MATERIAL_NAMES } from '../materials'
import { EMPTY_PRICING, type PricingSettings } from '../pricing'
import { summarize } from '../selection/summary'
import { lineListSheet } from '../test/fixtures'
import { BLANK, buildCatalogIndex, DERIVED, priceFieldId } from './buildIndex'
import { runQuery } from './query'
import { groupRows, orderRows } from './sortGroup'

// A neutral test formula; real pricing formulas live in a private file.
const PRICING: PricingSettings = {
  ...EMPTY_PRICING,
  priceColumnCurrency: 'EUR',
  fields: [{ name: 'Full Price', currency: 'GBP', decimals: 0, formula: 'ROUND(PSF / (1 + VAT) / 100, 0)' }],
}
const FULL = priceFieldId(0)

function makeIndex(pricing: PricingSettings = PRICING) {
  const draft = buildDraft(lineListSheet())
  const lineList = finalizeLineList(draft, { name: 'Test', brand: 'Brand', fileName: 't.xlsx', roles: draft.roles })
  return buildCatalogIndex(lineList, { pricing, materialNames: DEFAULT_MATERIAL_NAMES })
}

const idOf = (index: ReturnType<typeof makeIndex>, header: string) =>
  index.columns.find((c) => c.def.header === header)!.def.id
const all = { filters: {}, search: '', restrictTo: null }

describe('buildCatalogIndex', () => {
  const index = makeIndex()

  it('uses the key column for product identity', () => {
    expect(index.keys).toEqual(['1001-052', '1001-170', '1002-291', '1003-052', '1004-107'])
  })

  it('adds derived material and price columns next to their sources', () => {
    const headers = index.columns.map((c) => c.def.header)
    const comp = headers.indexOf('Composition In Percentage')
    expect(headers.slice(comp + 1, comp + 4)).toEqual(['Main Material', 'Material Mix', 'Contains Material'])
    const psf = headers.indexOf('Psf')
    expect(headers[psf + 1]).toBe('Full Price (GBP)')
    expect(index.byId.get(DERIVED.mainMaterial)!.values).toEqual(['Linen', 'Linen', 'Cotton', 'Cotton', 'Leather'])
    expect(index.byId.get(FULL)!.values).toEqual([82, 82, 109, 24, 33])
    expect(index.byId.get(index.roles.price!)!.def.format.unit).toBe('EUR')
  })

  it('has no price columns until a pricing file is loaded', () => {
    const bare = makeIndex(EMPTY_PRICING)
    expect(bare.roles.fullPrice).toBeUndefined()
    expect(bare.columns.some((c) => c.def.id.startsWith('x-price'))).toBe(false)
  })

  it('chooses filter presentation per column', () => {
    expect(index.byId.get(idOf(index, 'Photo Hyperlink'))!.filter).toBe('none')
    expect(index.byId.get(idOf(index, 'Gender'))!.filter).toBe('values')
    expect(index.byId.get(DERIVED.containsMaterial)!.groupable).toBe(false)
    // Numeric-code text columns (Style "1001") stay filterable but not prominent.
    expect(index.byId.get(idOf(index, 'Style'))!.prominent).toBe(false)
    expect(index.byId.get(idOf(index, 'Gender'))!.prominent).toBe(true)
  })

  it('buckets dates by month and orders seasons chronologically', () => {
    expect(index.byId.get(idOf(index, 'Available to Ship'))!.dict.map((v) => v.label)).toEqual([
      'Jan 2027',
      'Feb 2027',
      'Mar 2027',
    ])
    expect(index.byId.get(idOf(index, 'Season'))!.dict.map((v) => v.key)).toEqual(['SS26', 'FW26', 'SS27'])
  })
})

describe('runQuery', () => {
  const index = makeIndex()
  const gender = idOf(index, 'Gender')
  const line = idOf(index, 'Line')

  it('filters with multi-select values and reports disjunctive facet counts', () => {
    const r = runQuery(index, { ...all, filters: { [gender]: { type: 'values', keys: ['MAN'] } } })
    expect(r.matchCount).toBe(3)
    const genderCol = index.byId.get(gender)!
    const counts = r.facetCounts.get(gender)!
    // Own filter ignored: WOMEN still shows 2 so the buyer can add it.
    expect(genderCol.dict.map((v, i) => [v.key, counts[i]])).toEqual([
      ['MAN', 3],
      ['WOMEN', 2],
    ])
    const lineCounts = r.facetCounts.get(line)!
    const lineCol = index.byId.get(line)!
    expect(lineCounts[lineCol.dict.findIndex((v) => v.key === 'SHIRT')]).toBe(0)
  })

  it('combines filters across columns with AND', () => {
    const r = runQuery(index, {
      ...all,
      filters: { [gender]: { type: 'values', keys: ['MAN'] }, [line]: { type: 'values', keys: ['BELT', 'PANTS'] } },
    })
    expect(r.matchCount).toBe(2)
  })

  it('filters multi-valued material facets', () => {
    const r = runQuery(index, { ...all, filters: { [DERIVED.containsMaterial]: { type: 'values', keys: ['Elastane'] } } })
    expect(r.matchCount).toBe(2)
  })

  it('applies numeric ranges and excludes blanks', () => {
    const r = runQuery(index, { ...all, filters: { [FULL]: { type: 'range', min: 80, max: null } } })
    expect(r.matchCount).toBe(3)
  })

  it('searches every column, accent- and Turkish-insensitively', () => {
    expect(runQuery(index, { ...all, search: 'coastal view' }).matchCount).toBe(2)
    expect(runQuery(index, { ...all, search: 'black man' }).matchCount).toBe(1)
    expect(runQuery(index, { ...all, search: '1004-107' }).matchCount).toBe(1)
    expect(runQuery(index, { ...all, search: 'elastane' }).matchCount).toBe(2)
  })

  it('restricts to selected products', () => {
    expect(runQuery(index, { ...all, restrictTo: new Set(['1001-052']) }).matchCount).toBe(1)
  })
})

describe('sorting and grouping', () => {
  const index = makeIndex()
  const everything = runQuery(index, all).matches

  it('sorts numbers both ways and keeps blanks last', () => {
    const asc = orderRows(index, everything, { columnId: FULL, direction: 'asc' })
    expect(asc.map((r) => index.keys[r])).toEqual(['1003-052', '1004-107', '1001-052', '1001-170', '1002-291'])
    const trp = idOf(index, 'Turkey Retail Price, Tl')
    const desc = orderRows(index, everything, { columnId: trp, direction: 'desc' })
    expect(index.keys[desc[0]]).toBe('1001-170')
  })

  it('sorts seasons chronologically', () => {
    const rows = orderRows(index, everything, { columnId: idOf(index, 'Season'), direction: 'asc' })
    expect(rows.map((r) => index.keys[r])[0]).toBe('1003-052') // SS26
  })

  it('groups by two levels', () => {
    const rows = orderRows(index, everything, null)
    const groups = groupRows(index, rows, [idOf(index, 'Gender'), DERIVED.mainMaterial])
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['MAN', 3],
      ['WOMEN', 2],
    ])
    expect(groups[0].children!.map((g) => g.label)).toEqual(['Cotton', 'Leather'])
  })

  it('puts blank values in a trailing group and never groups by links', () => {
    const rows = orderRows(index, everything, null)
    const groups = groupRows(index, rows, [idOf(index, 'Story')])
    expect(groups.at(-1)).toMatchObject({ key: BLANK, label: '(Blank)', rows: [3] })
    expect(groupRows(index, rows, [idOf(index, 'Photo Hyperlink')])).toEqual([])
  })
})

describe('summarize', () => {
  it('computes buying metrics excluding unpriced products from averages', () => {
    const index = makeIndex()
    const s = summarize(index, [0, 1, 2])
    expect(s.products).toBe(3)
    expect(s.styles).toBe(2)
    expect(s.fullPrice!.total).toBe(82 + 82 + 109)
    expect(s.fullPrice!.priced).toBe(3)
    expect(s.psf!.average).toBeCloseTo((8999 * 2 + 11999) / 3)
  })
})
