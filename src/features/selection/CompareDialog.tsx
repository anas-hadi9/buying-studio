import { useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/overlays'
import { Checkbox } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { formatCell } from '@/domain/catalog/format'
import { rowsForKeys } from '@/domain/selection/summary'
import { productTitle, roleText } from '@/features/catalog/useCatalogView'
import { ProductImage } from '@/features/product/ProductImage'
import { cn } from '@/lib/cn'

export const MAX_COMPARE = 4

export function CompareDialog({ index, keys, open, onOpenChange }: { index: CatalogIndex; keys: string[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [diffOnly, setDiffOnly] = useState(false)
  const rows = useMemo(() => rowsForKeys(index, keys).slice(0, MAX_COMPARE), [index, keys])

  const fields = useMemo(
    () =>
      index.columns
        .filter((c) => c.def.kind !== 'image')
        .map((c) => {
          const values = rows.map((r) => formatCell(c.def, c.values[r]))
          return { col: c, values, differs: new Set(values).size > 1 }
        }),
    [index, rows],
  )
  const shown = diffOnly ? fields.filter((f) => f.differs) : fields

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Compare products" description={`${rows.length} products side by side`} className="h-[min(900px,92dvh)] max-w-6xl">
      <div className="sticky top-0 z-10 border-b border-line bg-surface px-6 py-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox checked={diffOnly} onCheckedChange={setDiffOnly} /> Only show fields that differ
        </label>
      </div>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-44">
              <span className="sr-only">Field</span>
            </th>
            {rows.map((r) => (
              <th key={r} className="p-3 align-top font-normal">
                <ProductImage src={roleText(index, 'image', r) || null} alt={productTitle(index, r)} className="aspect-[4/5] w-full rounded-lg" />
                <div className="mt-2 text-left">
                  <div className="truncate font-medium">{productTitle(index, r)}</div>
                  <div className="text-xs text-muted">{index.keys[r]}</div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(({ col, values, differs }) => (
            <tr key={col.def.id} className={cn('border-t border-line', differs && 'bg-brand-soft/35')}>
              <th scope="row" className="px-6 py-2 text-left text-xs font-medium text-muted">
                {col.def.header}
              </th>
              {values.map((v, i) => (
                <td key={i} className="px-3 py-2 break-words tabular">
                  {v || <span className="text-subtle">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  )
}
