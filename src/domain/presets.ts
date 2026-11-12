import type { CatalogIndex } from './catalog/buildIndex'
import type { ColumnFilter, FilterState } from './catalog/query'
import type { SortState } from './catalog/sortGroup'
import { normalizeHeader } from './text'

/** The parts of a catalogue view that can be saved and re-applied. */
export interface ViewState {
  filters: FilterState
  search: string
  sort: SortState | null
  groupBy: string[]
}

/**
 * Presets reference columns by normalised header rather than column id, so a
 * preset saved on one file applies to next season's file with the same headers.
 */
export interface FilterPreset {
  id: string
  name: string
  createdAt: string
  filters: Record<string, ColumnFilter>
  search: string
  sort: { header: string; direction: 'asc' | 'desc' } | null
  groupBy: string[]
}

function headerOf(index: CatalogIndex, columnId: string): string | null {
  const col = index.byId.get(columnId)
  return col ? normalizeHeader(col.def.header) : null
}

function columnFor(index: CatalogIndex, header: string): string | null {
  for (const col of index.columns) if (normalizeHeader(col.def.header) === header) return col.def.id
  return null
}

export function presetFromView(
  index: CatalogIndex,
  view: ViewState,
  meta: { id: string; name: string; createdAt: string },
): FilterPreset {
  const filters: Record<string, ColumnFilter> = {}
  for (const [id, f] of Object.entries(view.filters)) {
    const h = headerOf(index, id)
    if (h) filters[h] = f
  }
  const sortHeader = view.sort ? headerOf(index, view.sort.columnId) : null
  return {
    ...meta,
    filters,
    search: view.search,
    sort: view.sort && sortHeader ? { header: sortHeader, direction: view.sort.direction } : null,
    groupBy: view.groupBy.map((id) => headerOf(index, id)).filter((h): h is string => h !== null),
  }
}

/** Maps a preset onto the current line list. Unknown columns are reported, not fatal. */
export function viewFromPreset(index: CatalogIndex, preset: FilterPreset): { view: ViewState; missing: string[] } {
  const missing: string[] = []
  const filters: FilterState = {}
  for (const [header, f] of Object.entries(preset.filters)) {
    const id = columnFor(index, header)
    if (id) filters[id] = f
    else missing.push(header)
  }
  const sortId = preset.sort ? columnFor(index, preset.sort.header) : null
  if (preset.sort && !sortId) missing.push(preset.sort.header)
  const groupBy: string[] = []
  for (const h of preset.groupBy) {
    const id = columnFor(index, h)
    if (id) groupBy.push(id)
    else missing.push(h)
  }
  return {
    view: {
      filters,
      search: preset.search,
      sort: preset.sort && sortId ? { columnId: sortId, direction: preset.sort.direction } : null,
      groupBy,
    },
    missing,
  }
}
