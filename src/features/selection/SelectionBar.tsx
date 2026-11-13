import { Eye, EyeOff, FileSpreadsheet, FolderPlus, GitCompareArrows, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { rowsForKeys, summarize } from '@/domain/selection/summary'
import { AddToCollectionMenu } from '@/features/collections/AddToCollectionMenu'
import { useExcelExport } from '@/features/export/useExcelExport'
import { useWorkspace } from '@/stores/workspace'
import { CompareDialog, MAX_COMPARE } from './CompareDialog'
import { plural } from '@/lib/plural'
import { moneyFormatter } from '@/features/catalog/useCatalogView'

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col leading-tight" title={hint}>
      <span className="text-[10px] font-medium tracking-wide text-ink-fg/55 uppercase">{label}</span>
      <span className="text-sm font-semibold tabular">{value}</span>
    </div>
  )
}

/** Floating summary of the selection. Selections persist across filters and reloads. */
export function SelectionBar({ index }: { index: CatalogIndex }) {
  const selection = useWorkspace((s) => s.selection)
  const selectedOnly = useWorkspace((s) => s.selectedOnly)
  const setSelectedOnly = useWorkspace((s) => s.setSelectedOnly)
  const clearSelection = useWorkspace((s) => s.clearSelection)
  const [comparing, setComparing] = useState(false)
  const { exportProducts } = useExcelExport()

  const keys = useMemo(() => [...selection], [selection])
  const summary = useMemo(() => summarize(index, rowsForKeys(index, keys)), [index, keys])
  if (selection.size === 0) return null

  const unpriced = summary.fullPrice ? summary.products - summary.fullPrice.priced : 0
  const formatFull = moneyFormatter(index, 'fullPrice')
  const formatPsf = moneyFormatter(index, 'price')

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex animate-slide-up flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-ink py-2.5 pr-2.5 pl-5 text-ink-fg shadow-float">
        <Metric label="Selected" value={plural(summary.products, 'product')} />
        <Metric label="Styles" value={summary.styles.toLocaleString('en-GB')} />
        {summary.fullPrice && (
          <>
            <Metric label="Retail value" value={formatFull(summary.fullPrice.total)} hint="Sum of full prices, one unit each" />
            <Metric
              label="Avg retail"
              value={formatFull(summary.fullPrice.average)}
              hint={unpriced > 0 ? `${unpriced} products without a price are excluded` : undefined}
            />
          </>
        )}
        {!summary.fullPrice && summary.psf && (
          <>
            <Metric label="PSF value" value={formatPsf(summary.psf.total)} />
            <Metric label="Avg PSF" value={formatPsf(summary.psf.average)} />
          </>
        )}
        <div className="flex items-center gap-1 border-l border-ink-fg/15 pl-3">
          <Tooltip content={selectedOnly ? 'Show all products' : 'Show only selected'} side="top">
            <Button
              size="sm"
              variant="ghost"
              className="text-ink-fg/80 hover:bg-ink-fg/10 hover:text-ink-fg"
              onClick={() => setSelectedOnly(!selectedOnly)}
              aria-pressed={selectedOnly}
            >
              {selectedOnly ? <EyeOff /> : <Eye />}
              {selectedOnly ? 'Show all' : 'View selected'}
            </Button>
          </Tooltip>
          <AddToCollectionMenu
            keys={keys}
            align="end"
            trigger={
              <Button size="sm" variant="ghost" className="text-ink-fg/80 hover:bg-ink-fg/10 hover:text-ink-fg">
                <FolderPlus /> Add to collection
              </Button>
            }
          />
          <Tooltip content={selection.size > MAX_COMPARE ? `Select up to ${MAX_COMPARE} products to compare` : 'Compare side by side'} side="top">
            <span>
              <Button
                size="sm"
                variant="ghost"
                className="text-ink-fg/80 hover:bg-ink-fg/10 hover:text-ink-fg"
                disabled={selection.size < 2 || selection.size > MAX_COMPARE}
                onClick={() => setComparing(true)}
              >
                <GitCompareArrows /> Compare
              </Button>
            </span>
          </Tooltip>
          <Tooltip content="Export selected products to Excel" side="top">
            <Button
              size="sm"
              variant="ghost"
              className="text-ink-fg/80 hover:bg-ink-fg/10 hover:text-ink-fg"
              onClick={() => void exportProducts(rowsForKeys(index, keys).sort((a, b) => a - b), `${plural(summary.products, 'selected product')}`)}
            >
              <FileSpreadsheet /> Excel
            </Button>
          </Tooltip>
          <Tooltip content="Clear selection" side="top">
            <Button size="icon-sm" variant="ghost" className="text-ink-fg/70 hover:bg-ink-fg/10 hover:text-ink-fg" onClick={clearSelection} aria-label="Clear selection">
              <X />
            </Button>
          </Tooltip>
        </div>
      </div>
      <CompareDialog index={index} keys={keys} open={comparing} onOpenChange={setComparing} />
    </div>
  )
}
