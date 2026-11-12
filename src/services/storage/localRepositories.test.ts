import { describe, expect, it } from 'vitest'
import { addItems, createCollection } from '@/domain/collections'
import { buildDraft, finalizeLineList } from '@/domain/import/analyze'
import { lineListSheet } from '@/domain/test/fixtures'
import { memoryStore } from './keyValue'
import { createLocalRepositories } from './localRepositories'

function setup() {
  const repos = createLocalRepositories(memoryStore())
  const draft = buildDraft(lineListSheet())
  const ll = finalizeLineList(draft, { name: 'SS27', brand: 'Network', fileName: 'f.xlsx', roles: draft.roles })
  return { repos, ll }
}

describe('local repositories', () => {
  it('stores line lists with a light summary for listing', async () => {
    const { repos, ll } = setup()
    await repos.lineLists.save(ll)
    const [summary] = await repos.lineLists.list()
    expect(summary).toMatchObject({ id: ll.id, name: 'SS27', brand: 'Network', productCount: 5 })
    expect(summary.coverImages).toHaveLength(4)
    expect((await repos.lineLists.get(ll.id))?.rows).toHaveLength(5)
  })

  it('deletes a line list together with its collections and selection', async () => {
    const { repos, ll } = setup()
    await repos.lineLists.save(ll)
    await repos.collections.save(addItems(createCollection(ll.id, 'Capsule'), ['1001-052']).collection)
    await repos.selections.save(ll.id, ['1001-052'])
    expect(await repos.collections.countByLineList()).toEqual({ [ll.id]: 1 })
    await repos.lineLists.delete(ll.id)
    expect(await repos.lineLists.list()).toEqual([])
    expect(await repos.collections.listByLineList(ll.id)).toEqual([])
    expect(await repos.selections.get(ll.id)).toEqual([])
  })

  it('renames a line list in both summary and data', async () => {
    const { repos, ll } = setup()
    await repos.lineLists.save(ll)
    await repos.lineLists.rename(ll.id, 'SS27 Final', 'NETWORK')
    expect((await repos.lineLists.list())[0].name).toBe('SS27 Final')
    expect((await repos.lineLists.get(ll.id))?.brand).toBe('NETWORK')
  })
})
