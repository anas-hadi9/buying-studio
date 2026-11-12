import { create } from 'zustand'
import type { LineList, LineListSummary } from '@/domain/types'
import { getRepositories } from '@/services/registry'
import { useWorkspace } from './workspace'

interface LibraryState {
  lineLists: LineListSummary[]
  collectionCounts: Record<string, number>
  loaded: boolean
  load: () => Promise<void>
  add: (lineList: LineList) => Promise<void>
  rename: (id: string, name: string, brand: string | null) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  lineLists: [],
  collectionCounts: {},
  loaded: false,
  async load() {
    const repos = getRepositories()
    const [lineLists, collectionCounts] = await Promise.all([repos.lineLists.list(), repos.collections.countByLineList()])
    set({ lineLists, collectionCounts, loaded: true })
  },
  async add(lineList) {
    await getRepositories().lineLists.save(lineList)
    await get().load()
  },
  async rename(id, name, brand) {
    await getRepositories().lineLists.rename(id, name, brand)
    const open = useWorkspace.getState().lineList
    if (open?.id === id) useWorkspace.setState({ lineList: { ...open, name, brand } })
    await get().load()
  },
  async remove(id) {
    await getRepositories().lineLists.delete(id)
    if (useWorkspace.getState().lineList?.id === id) useWorkspace.getState().close()
    await get().load()
  },
}))

/** Distinct brand names already in use (for suggestions when importing). */
export function knownBrands(lineLists: LineListSummary[]): string[] {
  return [...new Set(lineLists.map((l) => l.brand).filter((b): b is string => !!b))].sort()
}
