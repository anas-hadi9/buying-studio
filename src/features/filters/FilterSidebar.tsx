import { ChevronDown, Search, Sparkles } from 'lucide-react'
import { Slider } from 'radix-ui'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/primitives'
import type { CatalogIndex, IndexedColumn } from '@/domain/catalog/buildIndex'
import { formatNumber } from '@/domain/catalog/format'
import { isFilterActive, type ColumnFilter, type QueryResult } from '@/domain/catalog/query'
import { normalizeText } from '@/domain/text'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/stores/workspace'
import { PresetMenu } from './PresetMenu'

const VISIBLE_VALUES = 8

export function FilterSidebar({ index, result }: { index: CatalogIndex; result: QueryResult }) {
  const filters = useWorkspace((s) => s.view.filters)
  const clearFilters = useWorkspace((s) => s.clearFilters)
  const [moreOpen, setMoreOpen] = useState(false)
  const [query, setQuery] = useState('')

  const defaultOpen = useMemo(() => {
    const r = index.roles
    return new Set([r.gender, r.line, r.category, r.material, r.fullPrice].filter(Boolean) as string[])
  }, [index])

  const filterable = index.columns.filter((c) => c.filter !== 'none')
  const q = normalizeText(query.trim())
  const matchesQuery = (c: IndexedColumn) => !q || normalizeText(c.def.header).includes(q)
  const main = filterable.filter((c) => c.prominent && matchesQuery(c))
  const more = filterable.filter((c) => !c.prominent && matchesQuery(c))
  const activeCount = Object.values(filters).filter(isFilterActive).length

  return (
    <aside className="flex h-full w-[288px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        {activeCount > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-ink-fg tabular">{activeCount}</span>}
        <div className="ml-auto flex items-center gap-1">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          )}
          <PresetMenu />
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a filter…" className="h-8 pl-8 text-[13px]" aria-label="Find a filter" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border-t border-line pb-24">
        {main.map((col) => (
          <FacetSection
            key={col.def.id}
            col={col}
            counts={result.facetCounts.get(col.def.id)}
            filter={filters[col.def.id]}
            defaultOpen={defaultOpen.has(col.def.id) || isFilterActive(filters[col.def.id]) || !!q}
          />
        ))}
        {more.length > 0 && (
          <div className="border-b border-line">
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium text-muted hover:text-fg"
              aria-expanded={moreOpen || !!q}
            >
              <ChevronDown className={cn('size-4 transition-transform', !(moreOpen || q) && '-rotate-90')} />
              More filters
              <span className="text-xs text-subtle">({more.length})</span>
            </button>
            {(moreOpen || !!q) && (
              <div className="border-t border-line bg-canvas/50">
                <p className="px-4 pt-3 text-[11px] text-subtle">Columns with many distinct values. Global search is often faster for these.</p>
                {more.map((col) => (
                  <FacetSection
                    key={col.def.id}
                    col={col}
                    counts={result.facetCounts.get(col.def.id)}
                    filter={filters[col.def.id]}
                    defaultOpen={isFilterActive(filters[col.def.id])}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function FacetSection({ col, counts, filter, defaultOpen }: { col: IndexedColumn; counts?: Int32Array; filter?: ColumnFilter; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [wasDefault, setWasDefault] = useState(defaultOpen)
  if (defaultOpen !== wasDefault) {
    setWasDefault(defaultOpen)
    if (defaultOpen) setOpen(true)
  }
  const active = isFilterActive(filter)
  const selectedCount = filter?.type === 'values' ? filter.keys.length : 0

  return (
    <section className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-2/60"
      >
        <span className={cn('flex-1 truncate text-[13px]', active ? 'font-semibold' : 'font-medium')}>{col.def.header}</span>
        {col.def.derived && <Sparkles className="size-3 text-brand" aria-label="Calculated" />}
        {active && (
          <span className="rounded-full bg-ink px-1.5 text-[10px] font-semibold text-ink-fg tabular">{selectedCount || '•'}</span>
        )}
        <ChevronDown className={cn('size-4 text-subtle transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          {col.filter === 'range' ? (
            <RangeFacet col={col} filter={filter?.type === 'range' ? filter : undefined} />
          ) : (
            <ValuesFacet col={col} counts={counts} selected={filter?.type === 'values' ? filter.keys : []} />
          )}
        </div>
      )}
    </section>
  )
}

function ValuesFacet({ col, counts, selected }: { col: IndexedColumn; counts?: Int32Array; selected: string[] }) {
  const setFilter = useWorkspace((s) => s.setFilter)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const selectedSet = new Set(selected)

  const q = normalizeText(query.trim())
  const values = col.dict
    .map((v, i) => ({ ...v, count: counts?.[i] ?? 0 }))
    .filter((v) => !q || normalizeText(v.label).includes(q))
  const visible = showAll || q ? values : values.slice(0, VISIBLE_VALUES)

  const toggle = (key: string, on: boolean) => {
    const next = on ? [...selected, key] : selected.filter((k) => k !== key)
    setFilter(col.def.id, next.length ? { type: 'values', keys: next } : null)
  }
  const only = (key: string) => setFilter(col.def.id, { type: 'values', keys: [key] })

  // "Select all" works on the values listed: all of them, or those matching the search.
  const listedSelected = values.filter((v) => selectedSet.has(v.key)).length
  const allState = listedSelected === 0 ? false : listedSelected === values.length ? true : 'indeterminate'
  const toggleAll = (on: boolean) => {
    const listed = new Set(values.map((v) => v.key))
    const next = on ? [...selected, ...values.filter((v) => !selectedSet.has(v.key)).map((v) => v.key)] : selected.filter((k) => !listed.has(k))
    setFilter(col.def.id, next.length ? { type: 'values', keys: next } : null)
  }

  return (
    <div>
      {col.dict.length > VISIBLE_VALUES && (
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${col.dict.length} values…`} className="mb-2 h-8 text-[13px]" />
      )}
      {values.length > 1 && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
          <Checkbox checked={allState} onCheckedChange={toggleAll} />
          <span className="flex-1 truncate">{q ? `Select all ${values.length} matching` : 'Select all'}</span>
        </label>
      )}
      <ul className={cn('space-y-px', (showAll || q) && 'max-h-72 overflow-auto pr-1')}>
        {visible.map((v) => {
          const checked = selectedSet.has(v.key)
          return (
            <li key={v.key} className="group/value relative">
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-surface-2',
                  v.count === 0 && !checked && 'opacity-45',
                )}
              >
                <Checkbox checked={checked} onCheckedChange={(c) => toggle(v.key, c)} />
                <span className={cn('flex-1 truncate', v.key.startsWith('\u0000') && 'text-muted italic')} title={v.label}>
                  {v.label}
                </span>
                <span className="text-xs text-subtle tabular group-focus-within/value:invisible group-hover/value:invisible">{v.count.toLocaleString('en-GB')}</span>
              </label>
              <button
                type="button"
                onClick={() => only(v.key)}
                aria-label={`Only ${v.label}`}
                className="absolute top-1/2 right-1 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted opacity-0 group-focus-within/value:opacity-100 group-hover/value:opacity-100 hover:bg-surface-3 hover:text-fg focus-visible:opacity-100"
              >
                Only
              </button>
            </li>
          )
        })}
        {visible.length === 0 && <li className="px-1.5 py-1 text-xs text-subtle">No values match.</li>}
      </ul>
      {!q && values.length > VISIBLE_VALUES && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1.5 px-1.5 text-xs font-medium text-muted hover:text-fg">
          {showAll ? 'Show fewer' : `Show all ${values.length}`}
        </button>
      )}
    </div>
  )
}

function RangeFacet({ col, filter }: { col: IndexedColumn; filter?: Extract<ColumnFilter, { type: 'range' }> }) {
  const setFilter = useWorkspace((s) => s.setFilter)
  const [lo, hi] = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const n of col.numbers ?? []) {
      if (Number.isNaN(n)) continue
      if (n < min) min = n
      if (n > max) max = n
    }
    return Number.isFinite(min) ? [min, max] : [0, 0]
  }, [col])
  const step = col.def.format.style === 'decimal' ? 0.01 : lo === hi ? 1 : Math.max(1, Math.round((hi - lo) / 200))
  const current: [number, number] = [filter?.min ?? lo, filter?.max ?? hi]

  const commit = ([a, b]: number[]) => {
    const min = a <= lo ? null : a
    const max = b >= hi ? null : b
    setFilter(col.def.id, min === null && max === null ? null : { type: 'range', min, max })
  }
  const unit = col.def.format.unit

  return (
    <div className="pt-1">
      <Slider.Root
        className="relative flex h-5 touch-none items-center select-none"
        min={lo}
        max={hi}
        step={step}
        value={current}
        minStepsBetweenThumbs={0}
        onValueChange={commit}
        aria-label={col.def.header}
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-surface-3">
          <Slider.Range className="absolute h-full rounded-full bg-ink" />
        </Slider.Track>
        {[0, 1].map((i) => (
          <Slider.Thumb
            key={i}
            className="block size-4 rounded-full border-2 border-ink bg-surface shadow-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            aria-label={i === 0 ? 'Minimum' : 'Maximum'}
          />
        ))}
      </Slider.Root>
      <div className="mt-2.5 flex items-center gap-2">
        <NumberBox value={current[0]} onCommit={(v) => commit([Math.min(v, current[1]), current[1]])} label="Minimum" />
        <span className="text-subtle">–</span>
        <NumberBox value={current[1]} onCommit={(v) => commit([current[0], Math.max(v, current[0])])} label="Maximum" />
      </div>
      <p className="mt-1.5 text-[11px] text-subtle tabular">
        Range {formatNumber(lo, col.def)} – {formatNumber(hi, col.def)} {unit}
      </p>
    </div>
  )
}

function NumberBox({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      inputMode="decimal"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft?.replace(',', '.'))
        if (draft !== null && Number.isFinite(n)) onCommit(n)
        setDraft(null)
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-8 text-[13px] tabular"
    />
  )
}
