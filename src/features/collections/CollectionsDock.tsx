import { useDndContext, useDroppable } from '@dnd-kit/core'
import { Download, FileSpreadsheet, FolderPlus, GripVertical, Layers, MoreHorizontal, Plus, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/overlays'
import { EmptyState } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { itemCount } from '@/domain/collections'
import { rowsForKeys, summarize } from '@/domain/selection/summary'
import type { Collection } from '@/domain/types'
import { ProductImage } from '@/features/product/ProductImage'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/stores/workspace'
import { NewCollectionDialog } from './AddToCollectionMenu'
import { useExcelExport } from '@/features/export/useExcelExport'
import { useCollectionFiles } from './useCollectionFiles'
import { plural } from '@/lib/plural'
import { moneyFormatter } from '@/features/catalog/useCatalogView'

export const NEW_COLLECTION_DROP_ID = 'new-collection'
export const collectionDropId = (id: string) => `collection:${id}`

export function CollectionsDock({ index }: { index: CatalogIndex }) {
  const collections = useWorkspace((s) => s.collections)
  const [creating, setCreating] = useState(false)
  const { exportFile, importFile, canExport } = useCollectionFiles()
  const { exportCollections: exportExcel } = useExcelExport()
  const { active } = useDndContext()
  const dragging = !!active

  return (
    <aside className="flex h-full w-[296px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold">Collections</h2>
        <span className="text-xs text-subtle tabular">{collections.length}</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> New
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Import or export collections">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => void importFile()}>
              <Upload /> Import collections file…
            </MenuItem>
            <MenuItem disabled={!canExport} onSelect={() => exportFile()}>
              <Download /> Export all collections (to share)
            </MenuItem>
            <MenuItem disabled={!canExport} onSelect={() => void exportExcel()}>
              <FileSpreadsheet /> Export all collections to Excel
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <p className={cn('px-4 pb-3 text-xs text-muted transition-colors', dragging && 'font-medium text-brand')}>
        {dragging ? 'Drop on a collection to add.' : 'Drag products here. Selected products move together.'}
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 pb-24">
        {collections.length === 0 && !dragging && (
          <EmptyState icon={<Layers />} title="No collections yet">
            Build capsules, drops or a buy plan by dragging products in.
          </EmptyState>
        )}
        {collections.map((c) => (
          <DockCollection key={c.id} collection={c} index={index} />
        ))}
        <NewCollectionDrop dragging={dragging} onClick={() => setCreating(true)} />
      </div>
      <NewCollectionDialog open={creating} onOpenChange={setCreating} />
    </aside>
  )
}

function DockCollection({ collection, index }: { collection: Collection; index: CatalogIndex }) {
  const { setNodeRef, isOver } = useDroppable({ id: collectionDropId(collection.id), data: { collectionId: collection.id } })
  const keys = useMemo(() => collection.groups.flatMap((g) => g.itemKeys), [collection])
  const summary = useMemo(() => summarize(index, rowsForKeys(index, keys)), [index, keys])
  const imageCol = index.roles.image ? index.byId.get(index.roles.image) : undefined
  const thumbs = keys.slice(0, 5).map((k) => {
    const r = index.keyToRow.get(k)
    const v = r !== undefined ? imageCol?.values[r] : null
    return typeof v === 'string' ? v : null
  })

  return (
    <Link
      ref={setNodeRef}
      to={`/l/${collection.lineListId}/c/${collection.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-all',
        isOver ? 'scale-[1.02] border-brand bg-brand-soft shadow-card' : 'border-line bg-surface hover:border-line-strong hover:shadow-card',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{collection.name}</span>
        <span className="text-xs text-muted tabular">{itemCount(collection)}</span>
      </div>
      <div className="mt-2 flex h-11 gap-1">
        {thumbs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line text-[11px] text-subtle">Empty — drop products</div>
        ) : (
          thumbs.map((src, i) => <ProductImage key={i} src={src} alt="" compact className="aspect-[4/5] h-full rounded-md" />)
        )}
      </div>
      {summary.products > 0 && (
        <div className="mt-2 flex gap-3 text-[11px] text-muted tabular">
          <span>{plural(summary.styles, 'style')}</span>
          {summary.fullPrice && <span>{moneyFormatter(index, 'fullPrice')(summary.fullPrice.total)}</span>}
          <span className="ml-auto">{plural(collection.groups.length, 'group')}</span>
        </div>
      )}
    </Link>
  )
}

function NewCollectionDrop({ dragging, onClick }: { dragging: boolean; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: NEW_COLLECTION_DROP_ID })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm transition-all',
        isOver ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-muted hover:text-fg',
        !dragging && 'py-3',
      )}
    >
      {dragging ? <FolderPlus className="size-4" /> : <GripVertical className="size-4 opacity-0" />}
      {dragging ? 'Drop to create a new collection' : 'New collection'}
    </button>
  )
}
