import { describe, expect, it } from 'vitest'
import { addGroup, addItems, createCollection } from './collections'
import { collectionsFileName, exportCollections, importCollections, parseCollectionsFile } from './collectionsFile'
import { buildDraft, finalizeLineList } from './import/analyze'
import { lineListSheet } from './test/fixtures'

function lineList() {
  const draft = buildDraft(lineListSheet())
  return finalizeLineList(draft, { name: 'SS27', brand: 'Brand', fileName: 'f.xlsx', roles: draft.roles })
}

describe('collections files', () => {
  it('round-trips collections and groups through JSON', () => {
    const ll = lineList()
    let c = addItems(createCollection(ll.id, 'Capsule'), ['1001-052', '1002-291']).collection
    c = addGroup(c, 'Drop 2')
    c = addItems(c, ['1004-107'], c.groups[1].id).collection
    const file = parseCollectionsFile(JSON.stringify(exportCollections(ll, [c])))
    expect(file.lineList).toMatchObject({ name: 'SS27', brand: 'Brand' })
    expect(file.collections).toEqual([
      {
        name: 'Capsule',
        note: undefined,
        groups: [
          { name: 'Unsorted', itemKeys: ['1001-052', '1002-291'] },
          { name: 'Drop 2', itemKeys: ['1004-107'] },
        ],
      },
    ])
  })

  it('imports as new collections, never overwriting, and counts missing products', () => {
    const file = parseCollectionsFile(
      JSON.stringify({
        format: 'buying-studio-collections',
        version: 1,
        collections: [{ name: 'Capsule', groups: [{ name: 'A', itemKeys: ['x', 'y', 'x', 'gone'] }] }],
      }),
    )
    const r = importCollections(file, 'll_1', ['Capsule'], (k) => k !== 'gone')
    expect(r.collections[0].name).toBe('Capsule (imported)')
    expect(r.collections[0].lineListId).toBe('ll_1')
    expect(r.collections[0].groups[0].itemKeys).toEqual(['x', 'y', 'gone'])
    expect(r.products).toBe(3)
    expect(r.missing).toBe(1)
  })

  it('rejects other files with clear messages', () => {
    expect(() => parseCollectionsFile('nope')).toThrow(/not JSON/)
    expect(() => parseCollectionsFile('{"format":"buying-studio-pricing"}')).toThrow(/not a Buying Studio collections file/)
    expect(() => parseCollectionsFile('{"format":"buying-studio-collections","collections":[]}')).toThrow(/no collections/)
  })

  it('makes safe file names', () => {
    expect(collectionsFileName('SS27: Men/Women')).toBe('SS27 Men Women - collections.json')
    expect(collectionsFileName('SS27', 'Eid edit')).toBe('SS27 - Eid edit - collections.json')
    expect(collectionsFileName('Network SS27', 'Men · Eid al-Fitr')).toBe('Network SS27 - Men Eid al-Fitr - collections.json')
    expect(collectionsFileName('İstanbul Şube')).toBe('İstanbul Şube - collections.json')
  })
})
