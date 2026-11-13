import { describe, expect, it } from 'vitest'
import { buildDraft, finalizeLineList } from '../import/analyze'
import { EMPTY_PRICING } from '../pricing'
import { DEFAULT_MATERIAL_NAMES } from '../materials'
import { lineListSheet } from '../test/fixtures'
import { buildCatalogIndex } from './buildIndex'
import { colourCode, colourwayRows, styleFilter } from './colourways'
import { runQuery } from './query'

function index() {
  const draft = buildDraft(lineListSheet())
  const ll = finalizeLineList(draft, { name: 'SS27', brand: 'Brand', fileName: 'f.xlsx', roles: draft.roles })
  return buildCatalogIndex(ll, { pricing: EMPTY_PRICING, materialNames: DEFAULT_MATERIAL_NAMES })
}

describe('colourways', () => {
  it('finds every colour of a style', () => {
    const idx = index()
    const row = idx.keyToRow.get('1001-170')!
    expect(colourwayRows(idx, row).map((r) => idx.keys[r])).toEqual(['1001-052', '1001-170'])
    expect(colourwayRows(idx, idx.keyToRow.get('1002-291')!)).toHaveLength(1)
  })

  it('reads the colour code from "<style>-<code>" keys', () => {
    const idx = index()
    expect(colourCode(idx, idx.keyToRow.get('1001-170')!)).toBe('170')
    expect(colourCode(idx, idx.keyToRow.get('1004-107')!)).toBe('107')
  })

  it('builds a filter that shows all colours of the style', () => {
    const idx = index()
    const sf = styleFilter(idx, idx.keyToRow.get('1001-052')!)!
    const result = runQuery(idx, { filters: { [sf.columnId]: sf.filter }, search: '', restrictTo: null })
    expect(result.matchCount).toBe(2)
  })
})
