import { ArrowDownWideNarrow, ArrowUpNarrowWide, Columns3, Grid2x2, Grid3x3, LayoutGrid, Layers, PanelLeft, PanelRight, Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Popover } from '@/components/ui/overlays'
import { Kbd, Segmented, Select, Tooltip } from '@/components/ui/primitives'
import type { CatalogIndex, IndexedColumn } from '@/domain/catalog/buildIndex'
import { cn } from '@/lib/cn'
import { usePreferences, type CardSize } from '@/stores/preferences'
import { useWorkspace } from '@/stores/workspace'

function columnOptions(columns: IndexedColumn[]) {
  const derived = columns.filter((c) => c.def.derived)
  const source = columns.filter((c) => !c.def.derived)
  return (
    <>
      {derived.length > 0 && (
        <optgroup label="Calculated">
          {derived.map((c) => (
            <option key={c.def.id} value={c.def.id}>
              {c.def.header}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="From the file">
        {source.map((c) => (
          <option key={c.def.id} value={c.def.id}>
            {c.def.header}
          </option>
        ))}
      </optgroup>
    </>
  )
}

export function SearchBox() {
  const search = useWorkspace((s) => s.view.search)
  const setSearch = useWorkspace((s) => s.setSearch)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative max-w-xl min-w-48 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={ref}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (setSearch(''), ref.current?.blur())}
        placeholder="Search style, colour, story, material, item no…"
        aria-label="Search products"
        className="h-10 w-full rounded-xl border border-line bg-surface pr-16 pl-9 text-sm shadow-sm outline-none placeholder:text-subtle hover:border-line-strong focus:border-fg/40"
      />
      <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
        {search ? (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="rounded p-0.5 text-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        ) : (
          <Kbd>/</Kbd>
        )}
      </div>
    </div>
  )
}

function GroupByControl({ index }: { index: CatalogIndex }) {
  const groupBy = useWorkspace((s) => s.view.groupBy)
  const setGroupBy = useWorkspace((s) => s.setGroupBy)
  const groupable = index.columns.filter((c) => c.groupable)
  const label = groupBy.map((id) => index.byId.get(id)?.def.header).filter(Boolean).join(' › ')

  const set = (level: number, id: string) => {
    const next = [...groupBy]
    if (!id) next.splice(level)
    else next[level] = id
    setGroupBy(next.filter(Boolean).slice(0, 2))
  }

  const quick = [index.roles.material, index.roles.category, index.roles.line, index.roles.color]
    .filter((id): id is string => !!id && !!index.byId.get(id)?.groupable)
    .concat(groupable.filter((c) => /story|theme|drop|season|fit/i.test(c.def.header)).map((c) => c.def.id))
  const quickUnique = [...new Set(quick)].slice(0, 6)

  return (
    <Popover
      align="end"
      className="w-80"
      trigger={
        <Button variant={groupBy.length ? 'secondary' : 'outline'} className={cn(groupBy.length && 'border border-line-strong')}>
          <Layers />
          <span className="max-w-40 truncate">{groupBy.length ? label : 'Group'}</span>
        </Button>
      }
    >
      <h3 className="text-sm font-semibold">Group products</h3>
      <p className="mt-0.5 mb-3 text-xs text-muted">Combine products into sections by any column — material, story, colour, delivery…</p>
      <div className="space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Group by</span>
          <Select value={groupBy[0] ?? ''} onChange={(e) => set(0, e.target.value)}>
            <option value="">No grouping</option>
            {columnOptions(groupable)}
          </Select>
        </label>
        {groupBy[0] && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Then by</span>
            <Select value={groupBy[1] ?? ''} onChange={(e) => set(1, e.target.value)}>
              <option value="">—</option>
              {columnOptions(groupable.filter((c) => c.def.id !== groupBy[0]))}
            </Select>
          </label>
        )}
      </div>
      {quickUnique.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-subtle uppercase">Quick</span>
          <div className="flex flex-wrap gap-1.5">
            {quickUnique.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setGroupBy([id])}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  groupBy[0] === id && groupBy.length === 1 ? 'border-ink bg-ink text-ink-fg' : 'border-line hover:border-line-strong',
                )}
              >
                {index.byId.get(id)?.def.header}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  )
}

function SortControl({ index }: { index: CatalogIndex }) {
  const sort = useWorkspace((s) => s.view.sort)
  const setSort = useWorkspace((s) => s.setSort)
  const sortable = index.columns.filter((c) => c.sortable)
  const DirIcon = sort?.direction === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide
  return (
    <div className="flex items-center">
      <Select
        aria-label="Sort by"
        value={sort?.columnId ?? ''}
        onChange={(e) => setSort(e.target.value ? { columnId: e.target.value, direction: sort?.direction ?? 'asc' } : null)}
        className={cn('w-44', sort && 'rounded-r-none')}
      >
        <option value="">Sort: file order</option>
        {columnOptions(sortable)}
      </Select>
      {sort && (
        <Tooltip content={sort.direction === 'asc' ? 'Ascending' : 'Descending'}>
          <Button
            aria-label="Toggle sort direction"
            size="icon"
            className="-ml-px rounded-l-none"
            onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
          >
            <DirIcon />
          </Button>
        </Tooltip>
      )}
    </div>
  )
}

export function CatalogToolbar({ index }: { index: CatalogIndex }) {
  const { filtersOpen, setFiltersOpen, dockOpen, setDockOpen, cardSize, setCardSize } = usePreferences()
  const collections = useWorkspace((s) => s.collections.length)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur lg:px-6">
      <Tooltip content={filtersOpen ? 'Hide filters' : 'Show filters'}>
        <Button variant="ghost" size="icon" aria-label="Toggle filters" onClick={() => setFiltersOpen(!filtersOpen)}>
          <PanelLeft />
        </Button>
      </Tooltip>
      <SearchBox />
      <div className="ml-auto flex items-center gap-2">
        <GroupByControl index={index} />
        <SortControl index={index} />
        <Segmented<CardSize>
          label="Card size"
          value={cardSize}
          onChange={setCardSize}
          options={[
            { value: 's', label: <Grid3x3 />, title: 'Small cards' },
            { value: 'm', label: <Grid2x2 />, title: 'Medium cards' },
            { value: 'l', label: <LayoutGrid />, title: 'Large cards' },
          ]}
        />
        <Tooltip content={dockOpen ? 'Hide collections' : 'Show collections'}>
          <Button variant={dockOpen ? 'secondary' : 'outline'} onClick={() => setDockOpen(!dockOpen)} aria-label="Toggle collections panel">
            {dockOpen ? <PanelRight /> : <Columns3 />}
            <span className="hidden lg:inline">Collections</span>
            {collections > 0 && <span className="text-xs text-muted tabular">{collections}</span>}
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
