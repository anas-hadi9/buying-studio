import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { FileQuestion } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, Spinner } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { summarize } from '@/domain/selection/summary'
import { announceAdded } from '@/features/collections/AddToCollectionMenu'
import { CollectionsDock, NEW_COLLECTION_DROP_ID } from '@/features/collections/CollectionsDock'
import { ResultsBar } from '@/features/filters/ResultsBar'
import { FilterSidebar } from '@/features/filters/FilterSidebar'
import { ProductDetailDialog } from '@/features/product/ProductDetailDialog'
import { ProductImage } from '@/features/product/ProductImage'
import { SelectionBar } from '@/features/selection/SelectionBar'
import { usePreferences } from '@/stores/preferences'
import { useWorkspace } from '@/stores/workspace'
import { CatalogToolbar } from './CatalogToolbar'
import type { DragData } from './ProductCard'
import { ProductGrid } from './ProductGrid'
import { useCatalogView } from './useCatalogView'

/** Loads the line list for the route and renders `children` once ready. */
export function useOpenLineList() {
  const { lineListId } = useParams()
  const open = useWorkspace((s) => s.open)
  const status = useWorkspace((s) => s.status)
  const index = useWorkspace((s) => s.index)
  const lineList = useWorkspace((s) => s.lineList)
  useEffect(() => {
    if (lineListId) void open(lineListId)
  }, [lineListId, open])
  const ready = status === 'ready' && lineList?.id === lineListId && index
  return { status: ready ? 'ready' : status === 'missing' ? 'missing' : 'loading', index: ready ? index : null } as const
}

export function WorkspaceFallback({ status }: { status: 'loading' | 'missing' }) {
  if (status === 'missing') {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title="Line list not found"
        action={
          <Link to="/" className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-sm font-medium text-ink-fg hover:opacity-90">
            Back to line lists
          </Link>
        }
      >
        It may have been deleted on this device.
      </EmptyState>
    )
  }
  return (
    <div className="grid h-full place-items-center">
      <Spinner className="size-5 text-muted" />
    </div>
  )
}

export function CatalogPage() {
  const { status, index } = useOpenLineList()
  if (!index) return <WorkspaceFallback status={status === 'missing' ? 'missing' : 'loading'} />
  return <Catalog index={index} />
}

function Catalog({ index }: { index: CatalogIndex }) {
  const { filtersOpen, dockOpen, setDockOpen } = usePreferences()
  const collections = useWorkspace((s) => s.collections)
  const addToCollection = useWorkspace((s) => s.addToCollection)
  const createCollection = useWorkspace((s) => s.createCollection)
  const { result, rows, groups, keys } = useCatalogView(index)
  const styleCount = useMemo(() => summarize(index, rows).styles, [index, rows])
  const [dragging, setDragging] = useState<DragData | null>(null)

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of collections) for (const g of c.groups) for (const k of g.itemKeys) counts.set(k, (counts.get(k) ?? 0) + 1)
    return counts
  }, [collections])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined
    if (!data) return
    setDragging({ keys: data.keys, image: data.image, title: data.title })
    if (!dockOpen) setDockOpen(true)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    const data = dragging
    setDragging(null)
    if (!data || !e.over) return
    const overId = String(e.over.id)
    if (overId === NEW_COLLECTION_DROP_ID) {
      const c = await createCollection(`Collection ${collections.length + 1}`, data.keys)
      toast.success(`Created “${c.name}” with ${data.keys.length} product${data.keys.length === 1 ? '' : 's'}`)
      return
    }
    const collectionId = e.over.data.current?.collectionId as string | undefined
    const target = collections.find((c) => c.id === collectionId)
    if (target) announceAdded(await addToCollection(target.id, data.keys), data.keys.length, target.name)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex h-full min-h-0">
        {filtersOpen && <FilterSidebar index={index} result={result} />}
        <main className="flex min-w-0 flex-1 flex-col">
          <CatalogToolbar index={index} />
          <ResultsBar index={index} matchCount={result.matchCount} styleCount={styleCount} />
          <ProductGrid index={index} rows={rows} groups={groups} keys={keys} collectionCounts={collectionCounts} />
        </main>
        {dockOpen && <CollectionsDock index={index} />}
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <DragPreview data={dragging} />}</DragOverlay>
      <SelectionBar index={index} />
      <ProductDetailDialog index={index} />
    </DndContext>
  )
}

function DragPreview({ data }: { data: DragData }) {
  const many = data.keys.length > 1
  return (
    <div className="relative w-36 cursor-grabbing">
      {many && <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-3 rounded-xl border border-line bg-surface shadow-card" />}
      <div className="relative -rotate-2 overflow-hidden rounded-xl border border-ink bg-surface shadow-float">
        <ProductImage src={data.image} alt="" className="aspect-[4/5] w-full" />
        <div className="truncate px-2 py-1.5 text-xs font-medium">{data.title}</div>
      </div>
      {many && (
        <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white shadow-md tabular">
          {data.keys.length}
        </span>
      )}
    </div>
  )
}
