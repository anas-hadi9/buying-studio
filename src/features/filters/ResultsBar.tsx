import { ArrowLeft, FileLock2, FileSpreadsheet, X } from 'lucide-react'
import { Tooltip } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { formatNumber } from '@/domain/catalog/format'
import { isFilterActive, type ColumnFilter } from '@/domain/catalog/query'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { plural } from '@/lib/plural'

function describe(index: CatalogIndex, columnId: string, f: ColumnFilter): string {
  const col = index.byId.get(columnId)
  if (!col) return ''
  if (f.type === 'values') {
    const labels = f.keys.map((k) => col.dict.find((v) => v.key === k)?.label ?? k)
    return labels.length > 3 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ')
  }
  const fmt = (n: number) => formatNumber(n, col.def)
  if (f.min !== null && f.max !== null) return `${fmt(f.min)} – ${fmt(f.max)}`
  if (f.min !== null) return `≥ ${fmt(f.min)}`
  return `≤ ${fmt(f.max!)}`
}

interface ResultsBarProps {
  index: CatalogIndex
  matchCount: number
  styleCount: number
  /** Exports the products shown (filters, search and sort applied). */
  onExport?: () => void
}

/** Result count plus removable chips for every active filter. */
export function ResultsBar({ index, matchCount, styleCount, onExport }: ResultsBarProps) {
  const filters = useWorkspace((s) => s.view.filters)
  const search = useWorkspace((s) => s.view.search)
  const selectedOnly = useWorkspace((s) => s.selectedOnly)
  const setFilter = useWorkspace((s) => s.setFilter)
  const setSearch = useWorkspace((s) => s.setSearch)
  const setSelectedOnly = useWorkspace((s) => s.setSelectedOnly)
  const clearFilters = useWorkspace((s) => s.clearFilters)
  const stashedView = useWorkspace((s) => s.stashedView)
  const restoreView = useWorkspace((s) => s.restoreView)
  const openSettings = useUi((s) => s.openSettings)

  const active = Object.entries(filters).filter(([id, f]) => isFilterActive(f) && index.byId.has(id))

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 px-6 pt-3 pb-1">
      <p className="mr-2 text-sm text-muted tabular" aria-live="polite">
        <b className="font-semibold text-fg">{matchCount.toLocaleString('en-GB')}</b> of {plural(index.rowCount, 'product')}
        <span className="text-subtle"> · {plural(styleCount, 'style')}</span>
      </p>
      {selectedOnly && <Chip label="Showing" value="selected only" onRemove={() => setSelectedOnly(false)} />}
      {search && <Chip label="Search" value={`“${search}”`} onRemove={() => setSearch('')} />}
      {active.map(([id, f]) => (
        <Chip key={id} label={index.byId.get(id)!.def.header} value={describe(index, id, f)} onRemove={() => setFilter(id, null)} />
      ))}
      <div className="order-last ml-auto flex items-center gap-2">
        {index.roles.price && !index.roles.fullPrice && (
          <button
            type="button"
            onClick={() => openSettings('pricing')}
            className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn hover:opacity-80"
          >
            <FileLock2 className="size-3.5" /> Full prices hidden — load pricing file
          </button>
        )}
        {onExport && (
          <Tooltip content="Download the products shown, with every column, as an Excel file">
            <button
              type="button"
              onClick={onExport}
              disabled={matchCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-sm hover:border-line-strong hover:text-fg disabled:opacity-50"
            >
              <FileSpreadsheet className="size-3.5" /> Export to Excel
            </button>
          </Tooltip>
        )}
      </div>
      {stashedView && (
        <button
          type="button"
          onClick={restoreView}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-ink-fg hover:opacity-90"
        >
          <ArrowLeft className="size-3.5" /> Back to your filters
        </button>
      )}
      {(active.length > 0 || search) && (
        <button type="button" onClick={clearFilters} className="ml-1 text-xs font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
          Clear all
        </button>
      )}
    </div>
  )
}

function Chip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-80 animate-pop-in items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2.5 text-xs shadow-sm">
      <span className="text-muted">{label}:</span>
      <span className="truncate font-medium">{value}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`} className="rounded-full p-0.5 text-subtle hover:bg-surface-2 hover:text-fg">
        <X className="size-3" />
      </button>
    </span>
  )
}
