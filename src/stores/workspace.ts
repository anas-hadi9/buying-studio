import { create } from 'zustand'
import { buildCatalogIndex, type CatalogIndex } from '@/domain/catalog/buildIndex'
import type { ColumnFilter } from '@/domain/catalog/query'
import type { SortState } from '@/domain/catalog/sortGroup'
import * as collectionOps from '@/domain/collections'
import { presetFromView, viewFromPreset, type FilterPreset, type ViewState } from '@/domain/presets'
import { createId } from '@/domain/text'
import type { Collection, LineList } from '@/domain/types'
import { getRepositories } from '@/services/registry'
import { useSettings } from './settings'

export const EMPTY_VIEW: ViewState = { filters: {}, search: '', sort: null, groupBy: [] }

/** Which products the detail dialog can step through (catalogue order or a collection's order). */
export interface DetailContext {
  keys: string[]
  position: number
}

interface WorkspaceState {
  status: 'idle' | 'loading' | 'ready' | 'missing'
  lineList: LineList | null
  index: CatalogIndex | null
  view: ViewState
  selectedOnly: boolean
  collapsedGroups: Set<string>
  selection: Set<string>
  collections: Collection[]
  presets: FilterPreset[]
  detail: DetailContext | null

  open: (lineListId: string) => Promise<void>
  /** Forget the open line list (e.g. after it was deleted). */
  close: () => void
  rebuildIndex: () => void

  setSearch: (search: string) => void
  setFilter: (columnId: string, filter: ColumnFilter | null) => void
  clearFilters: () => void
  setSort: (sort: SortState | null) => void
  setGroupBy: (groupBy: string[]) => void
  toggleGroup: (groupId: string) => void
  setSelectedOnly: (on: boolean) => void

  toggleSelected: (key: string) => void
  select: (keys: string[]) => void
  deselect: (keys: string[]) => void
  clearSelection: () => void

  createCollection: (name: string, keys?: string[]) => Promise<Collection>
  addToCollection: (collectionId: string, keys: string[]) => Promise<number>
  saveCollection: (collection: Collection) => void
  deleteCollection: (collectionId: string) => Promise<void>

  savePreset: (name: string) => Promise<FilterPreset | null>
  applyPreset: (preset: FilterPreset) => string[]
  deletePreset: (id: string) => Promise<void>

  openDetail: (keys: string[], key: string) => void
  stepDetail: (delta: number) => void
  closeDetail: () => void
}

const viewKey = (lineListId: string) => `bs.view.${lineListId}`

function loadView(lineListId: string): ViewState {
  try {
    const raw = localStorage.getItem(viewKey(lineListId))
    return raw ? { ...EMPTY_VIEW, ...(JSON.parse(raw) as Partial<ViewState>) } : EMPTY_VIEW
  } catch {
    return EMPTY_VIEW
  }
}

function persistView(lineListId: string | undefined, view: ViewState) {
  if (!lineListId) return
  try {
    localStorage.setItem(viewKey(lineListId), JSON.stringify(view))
  } catch {
    // Storage full or blocked: the view simply isn't remembered.
  }
}

let selectionTimer: ReturnType<typeof setTimeout> | undefined
const collectionTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useWorkspace = create<WorkspaceState>()((set, get) => {
  const updateView = (patch: Partial<ViewState>) => {
    const view = { ...get().view, ...patch }
    set({ view })
    persistView(get().lineList?.id, view)
  }

  const persistSelection = () => {
    const { lineList, selection } = get()
    if (!lineList) return
    clearTimeout(selectionTimer)
    selectionTimer = setTimeout(() => void getRepositories().selections.save(lineList.id, [...selection]), 250)
  }

  const setSelection = (selection: Set<string>) => {
    set({ selection, ...(selection.size === 0 ? { selectedOnly: false } : {}) })
    persistSelection()
  }

  return {
    status: 'idle',
    lineList: null,
    index: null,
    view: EMPTY_VIEW,
    selectedOnly: false,
    collapsedGroups: new Set(),
    selection: new Set(),
    collections: [],
    presets: [],
    detail: null,

    async open(lineListId) {
      if (get().lineList?.id === lineListId && get().status === 'ready') return
      set({ status: 'loading', detail: null })
      const repos = getRepositories()
      await useSettings.getState().load()
      const [lineList, selected, collections, presets] = await Promise.all([
        repos.lineLists.get(lineListId),
        repos.selections.get(lineListId),
        repos.collections.listByLineList(lineListId),
        repos.presets.list(),
      ])
      if (!lineList) {
        set({ status: 'missing', lineList: null, index: null })
        return
      }
      const index = buildCatalogIndex(lineList, useSettings.getState().settings)
      // Drop filters for columns that no longer exist (e.g. after a settings change).
      const saved = loadView(lineListId)
      const filters = Object.fromEntries(Object.entries(saved.filters).filter(([id]) => index.byId.has(id)))
      set({
        status: 'ready',
        lineList,
        index,
        view: { ...saved, filters },
        selection: new Set(selected),
        selectedOnly: false,
        collapsedGroups: new Set(),
        collections,
        presets,
      })
    },

    close() {
      set({ status: 'idle', lineList: null, index: null, collections: [], selection: new Set(), detail: null })
    },

    rebuildIndex() {
      const { lineList } = get()
      if (!lineList) return
      set({ index: buildCatalogIndex(lineList, useSettings.getState().settings) })
    },

    setSearch: (search) => updateView({ search }),
    setFilter(columnId, filter) {
      const filters = { ...get().view.filters }
      if (filter) filters[columnId] = filter
      else delete filters[columnId]
      updateView({ filters })
    },
    clearFilters: () => updateView({ filters: {}, search: '' }),
    setSort: (sort) => updateView({ sort }),
    setGroupBy: (groupBy) => {
      set({ collapsedGroups: new Set() })
      updateView({ groupBy })
    },
    toggleGroup(groupId) {
      const next = new Set(get().collapsedGroups)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      set({ collapsedGroups: next })
    },
    setSelectedOnly: (selectedOnly) => set({ selectedOnly }),

    toggleSelected(key) {
      const next = new Set(get().selection)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setSelection(next)
    },
    select(keys) {
      const next = new Set(get().selection)
      for (const k of keys) next.add(k)
      setSelection(next)
    },
    deselect(keys) {
      const next = new Set(get().selection)
      for (const k of keys) next.delete(k)
      setSelection(next)
    },
    clearSelection: () => setSelection(new Set()),

    async createCollection(name, keys = []) {
      const { lineList } = get()
      if (!lineList) throw new Error('No line list is open.')
      const collection = collectionOps.addItems(collectionOps.createCollection(lineList.id, name), keys).collection
      set({ collections: [...get().collections, collection] })
      await getRepositories().collections.save(collection)
      return collection
    },
    async addToCollection(collectionId, keys) {
      const current = get().collections.find((c) => c.id === collectionId)
      if (!current) return 0
      const { collection, added } = collectionOps.addItems(current, keys)
      if (added > 0) {
        set({ collections: get().collections.map((c) => (c.id === collectionId ? collection : c)) })
        await getRepositories().collections.save(collection)
      }
      return added
    },
    saveCollection(collection) {
      set({ collections: get().collections.map((c) => (c.id === collection.id ? collection : c)) })
      // Drag-and-drop produces bursts of updates; write the final state only.
      clearTimeout(collectionTimers.get(collection.id))
      collectionTimers.set(
        collection.id,
        setTimeout(() => {
          collectionTimers.delete(collection.id)
          const latest = get().collections.find((c) => c.id === collection.id)
          if (latest) void getRepositories().collections.save(latest)
        }, 300),
      )
    },
    async deleteCollection(collectionId) {
      clearTimeout(collectionTimers.get(collectionId))
      set({ collections: get().collections.filter((c) => c.id !== collectionId) })
      await getRepositories().collections.delete(collectionId)
    },

    async savePreset(name) {
      const { index, view } = get()
      if (!index) return null
      const preset = presetFromView(index, view, { id: createId('preset'), name: name.trim(), createdAt: new Date().toISOString() })
      await getRepositories().presets.save(preset)
      set({ presets: [...get().presets.filter((p) => p.name !== preset.name), preset].sort((a, b) => a.name.localeCompare(b.name)) })
      return preset
    },
    applyPreset(preset) {
      const { index } = get()
      if (!index) return []
      const { view, missing } = viewFromPreset(index, preset)
      set({ collapsedGroups: new Set() })
      updateView(view)
      return missing
    },
    async deletePreset(id) {
      set({ presets: get().presets.filter((p) => p.id !== id) })
      await getRepositories().presets.delete(id)
    },

    openDetail(keys, key) {
      const position = keys.indexOf(key)
      set({ detail: { keys, position: position < 0 ? 0 : position } })
    },
    stepDetail(delta) {
      const { detail } = get()
      if (!detail || detail.keys.length === 0) return
      const position = (detail.position + delta + detail.keys.length) % detail.keys.length
      set({ detail: { ...detail, position } })
    },
    closeDetail: () => set({ detail: null }),
  }
})

// Pricing and material settings feed derived columns; rebuild when they change.
useSettings.subscribe((state, prev) => {
  if (state.settings !== prev.settings) useWorkspace.getState().rebuildIndex()
})
