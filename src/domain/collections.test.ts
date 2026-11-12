import { describe, expect, it } from 'vitest'
import { buildCatalogIndex } from './catalog/buildIndex'
import {
  addGroup,
  addItems,
  createCollection,
  deleteGroup,
  itemCount,
  MISSING_GROUP_NAME,
  moveItem,
  regroupBy,
  removeItems,
} from './collections'
import { buildDraft, finalizeLineList } from './import/analyze'
import { DEFAULT_MATERIAL_NAMES } from './materials'
import { EMPTY_PRICING } from './pricing'
import { lineListSheet } from './test/fixtures'

describe('collections', () => {
  it('adds products once and keeps order', () => {
    const c = createCollection('ll_1', 'Summer capsule')
    const { collection, added } = addItems(c, ['a', 'b', 'a'])
    expect(added).toBe(2)
    expect(addItems(collection, ['b', 'c']).added).toBe(1)
    expect(collection.groups[0].itemKeys).toEqual(['a', 'b'])
  })

  it('moves products within and across groups', () => {
    let c = addItems(createCollection('ll_1', 'x'), ['a', 'b', 'c']).collection
    c = addGroup(c, 'Drop 2')
    const [g1, g2] = c.groups
    c = moveItem(c, 'c', g1.id, 0)
    expect(c.groups[0].itemKeys).toEqual(['c', 'a', 'b'])
    c = moveItem(c, 'a', g2.id, 0)
    expect(c.groups.map((g) => g.itemKeys)).toEqual([['c', 'b'], ['a']])
    expect(itemCount(c)).toBe(3)
  })

  it('keeps products when a group is deleted', () => {
    let c = addGroup(addItems(createCollection('ll_1', 'x'), ['a']).collection, 'G2')
    c = addItems(c, ['b'], c.groups[1].id).collection
    c = deleteGroup(c, c.groups[1].id)
    expect(c.groups).toHaveLength(1)
    expect(c.groups[0].itemKeys).toEqual(['a', 'b'])
    expect(removeItems(c, ['a']).groups[0].itemKeys).toEqual(['b'])
  })

  it('regroups by any column and preserves products missing from the line list', () => {
    const draft = buildDraft(lineListSheet())
    const ll = finalizeLineList(draft, { name: 'T', brand: null, fileName: 't.xlsx', roles: draft.roles })
    const index = buildCatalogIndex(ll, { pricing: EMPTY_PRICING, materialNames: DEFAULT_MATERIAL_NAMES })
    const c = addItems(createCollection(ll.id, 'x'), ['1002-291', '1001-052', 'gone-1', '1004-107']).collection
    const gender = index.columns.find((col) => col.def.header === 'Gender')!.def.id
    const regrouped = regroupBy(c, index, gender)
    expect(regrouped.groups.map((g) => [g.name, g.itemKeys])).toEqual([
      ['MAN', ['1002-291', '1004-107']],
      ['WOMEN', ['1001-052']],
      [MISSING_GROUP_NAME, ['gone-1']],
    ])
  })
})
