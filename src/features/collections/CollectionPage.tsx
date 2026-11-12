import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowLeft, ArrowUp, FolderOpen, MoreHorizontal, Pencil, Plus, Rows3, Trash2, X } from 'lucide-react'
import { memo, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Popover } from '@/components/ui/overlays'
import { EmptyState, Select } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import * as ops from '@/domain/collections'
import { rowsForKeys, summarize, type Summary } from '@/domain/selection/summary'
import type { Collection, CollectionGroup } from '@/domain/types'
import { useOpenLineList, WorkspaceFallback } from '@/features/catalog/CatalogPage'
import { moneyFormatter, productTitle, roleNumber, roleText } from '@/features/catalog/useCatalogView'
import { ProductDetailDialog } from '@/features/product/ProductDetailDialog'
import { ProductImage } from '@/features/product/ProductImage'
import { cn } from '@/lib/cn'
import { useWorkspace } from '@/stores/workspace'
import { noun, plural } from '@/lib/plural'

const GROUP_PREFIX = 'group:'

/**
 * Pointer-first collision: whatever is under the pointer wins (a card before
 * its group), so empty groups are easy to drop into. Falls back to corner
 * distance for keyboard dragging and gaps between cards.
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 0) {
    const card = hits.find((h) => !String(h.id).startsWith(GROUP_PREFIX))
    return card ? [card] : hits
  }
  return closestCorners(args)
}

export function CollectionPage() {
  const { status, index } = useOpenLineList()
  const { collectionId } = useParams()
  const collection = useWorkspace((s) => s.collections.find((c) => c.id === collectionId))
  if (!index) return <WorkspaceFallback status={status === 'missing' ? 'missing' : 'loading'} />
  if (!collection) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="Collection not found"
        action={
          <Link to={`/l/${index.lineList.id}`} className="text-sm font-medium underline underline-offset-4">
            Back to catalogue
          </Link>
        }
      />
    )
  }
  return <Board index={index} collection={collection} />
}

function useSummary(index: CatalogIndex, keys: string[]): Summary {
  return useMemo(() => summarize(index, rowsForKeys(index, keys)), [index, keys])
}

function Board({ index, collection }: { index: CatalogIndex; collection: Collection }) {
  const saveCollection = useWorkspace((s) => s.saveCollection)
  const openDetail = useWorkspace((s) => s.openDetail)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  // A drop can be followed by a click on the card underneath; ignore it.
  const lastDragEnd = useRef(0)
  const allKeys = useMemo(() => collection.groups.flatMap((g) => g.itemKeys), [collection])
  const summary = useSummary(index, allKeys)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const groupOf = (id: string): CollectionGroup | undefined =>
    id.startsWith(GROUP_PREFIX)
      ? collection.groups.find((g) => g.id === id.slice(GROUP_PREFIX.length))
      : collection.groups.find((g) => g.itemKeys.includes(id))

  const onDragStart = (e: DragStartEvent) => setActiveKey(String(e.active.id))

  // Live move across groups while hovering, so the card visibly changes group.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = groupOf(String(active.id))
    const to = groupOf(String(over.id))
    if (!from || !to || from.id === to.id) return
    const overIndex = String(over.id).startsWith(GROUP_PREFIX) ? to.itemKeys.length : to.itemKeys.indexOf(String(over.id))
    saveCollection(ops.moveItem(collection, String(active.id), to.id, overIndex < 0 ? to.itemKeys.length : overIndex))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveKey(null)
    lastDragEnd.current = performance.now()
    if (!over) return
    const group = groupOf(String(active.id))
    const target = groupOf(String(over.id))
    if (!group || !target || group.id !== target.id || active.id === over.id) return
    const newIndex = String(over.id).startsWith(GROUP_PREFIX) ? group.itemKeys.length - 1 : group.itemKeys.indexOf(String(over.id))
    saveCollection(ops.moveItem(collection, String(active.id), group.id, newIndex))
  }

  const open = (key: string) => {
    if (performance.now() - lastDragEnd.current < 300) return
    openDetail(allKeys.filter((k) => index.keyToRow.has(k)), key)
  }

  return (
    <div className="flex h-full flex-col">
      <BoardHeader index={index} collection={collection} summary={summary} />
      <div className="min-h-0 flex-1 overflow-auto">
        {allKeys.length === 0 && (
          <EmptyState
            icon={<Rows3 />}
            title="This collection is empty"
            action={
              <Link to={`/l/${collection.lineListId}`} className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-sm font-medium text-ink-fg">
                Go to catalogue
              </Link>
            }
          >
            Drag products from the catalogue onto “{collection.name}” in the Collections panel.
          </EmptyState>
        )}
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveKey(null)}>
          <div className="space-y-10 px-6 py-6 lg:px-10">
            {collection.groups.map((g, i) => (
              <GroupSection key={g.id} index={index} collection={collection} group={g} position={i} onOpen={open} />
            ))}
          </div>
          <DragOverlay>
            {activeKey && (
              <div className="w-40 rotate-2 cursor-grabbing">
                <BoardCard index={index} itemKey={activeKey} overlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
        {summary.products > 0 && <p className="px-10 pb-10 text-xs text-subtle">Totals use one unit per product.</p>}
      </div>
      <ProductDetailDialog index={index} />
    </div>
  )
}

function BoardHeader({ index, collection, summary }: { index: CatalogIndex; collection: Collection; summary: Summary }) {
  const saveCollection = useWorkspace((s) => s.saveCollection)
  const deleteCollection = useWorkspace((s) => s.deleteCollection)
  const formatFull = moneyFormatter(index, 'fullPrice')
  const navigate = useNavigate()
  const [name, setName] = useState(collection.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [arrangeBy, setArrangeBy] = useState(index.roles.material ?? '')
  const [arrangeOpen, setArrangeOpen] = useState(false)
  const groupable = index.columns.filter((c) => c.groupable)

  return (
    <header className="border-b border-line bg-surface px-6 pt-5 pb-4 lg:px-10">
      <Link to={`/l/${collection.lineListId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Catalogue
      </Link>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== collection.name && saveCollection({ ...collection, name: name.trim(), updatedAt: new Date().toISOString() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Collection name"
            className="w-full rounded-md bg-transparent font-display text-4xl leading-tight tracking-tight outline-none hover:bg-surface-2/60 focus:bg-surface-2/60"
          />
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted tabular">
            <span>
              <b className="font-semibold text-fg">{summary.products}</b> {noun(summary.products, 'product')}
            </span>
            <span>
              <b className="font-semibold text-fg">{summary.styles}</b> {noun(summary.styles, 'style')}
            </span>
            {summary.fullPrice && (
              <span>
                Retail value <b className="font-semibold text-fg">{formatFull(summary.fullPrice.total)}</b>
              </span>
            )}
            {summary.fullPrice?.average != null && (
              <span>
                Avg <b className="font-semibold text-fg">{formatFull(summary.fullPrice.average)}</b>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover
            align="end"
            open={arrangeOpen}
            onOpenChange={setArrangeOpen}
            trigger={
              <Button>
                <Rows3 /> Arrange by…
              </Button>
            }
          >
            <h3 className="text-sm font-semibold">Arrange into groups</h3>
            <p className="mt-0.5 mb-3 text-xs text-muted">One group per value — e.g. by material, story or delivery month. Replaces the current groups; order inside each group is kept.</p>
            <Select value={arrangeBy} onChange={(e) => setArrangeBy(e.target.value)} aria-label="Arrange by column">
              <option value="">Choose a column…</option>
              {groupable.map((c) => (
                <option key={c.def.id} value={c.def.id}>
                  {c.def.header}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={!arrangeBy}
              onClick={() => {
                const next = ops.regroupBy(collection, index, arrangeBy)
                saveCollection(next)
                setArrangeOpen(false)
                toast.success(`Arranged into ${plural(next.groups.length, 'group')} by ${index.byId.get(arrangeBy)?.def.header}`)
              }}
            >
              Arrange
            </Button>
          </Popover>
          <Button onClick={() => saveCollection(ops.addGroup(collection, `Group ${collection.groups.length + 1}`))}>
            <Plus /> Add group
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" aria-label="Collection actions">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete collection
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${collection.name}”?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteCollection(collection.id)
                navigate(`/l/${collection.lineListId}`)
                toast(`Deleted “${collection.name}”`)
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="p-6 text-sm text-muted">The products stay in the line list; only this collection and its groups are removed.</p>
      </Dialog>
    </header>
  )
}

function GroupSection({
  index,
  collection,
  group,
  position,
  onOpen,
}: {
  index: CatalogIndex
  collection: Collection
  group: CollectionGroup
  position: number
  onOpen: (key: string) => void
}) {
  const saveCollection = useWorkspace((s) => s.saveCollection)
  const formatFull = moneyFormatter(index, 'fullPrice')
  const { setNodeRef, isOver } = useDroppable({ id: GROUP_PREFIX + group.id })
  const summary = useSummary(index, group.itemKeys)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const last = collection.groups.length - 1

  const commitName = () => {
    setEditing(false)
    if (name.trim() && name !== group.name) saveCollection(ops.renameGroup(collection, group.id, name))
    else setName(group.name)
  }

  return (
    <section aria-label={group.name}>
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-2">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
            className="rounded-md bg-surface-2 px-1 text-lg font-semibold outline-none"
            aria-label="Group name"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="group flex items-center gap-1.5 text-lg font-semibold" title="Rename group">
            {group.name}
            <Pencil className="size-3.5 text-subtle opacity-0 group-hover:opacity-100" />
          </button>
        )}
        <span className="text-xs text-muted tabular">
          {plural(summary.products, 'product')} · {plural(summary.styles, 'style')}
          {summary.fullPrice && summary.fullPrice.total > 0 && <> · {formatFull(summary.fullPrice.total)}</>}
        </span>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Actions for ${group.name}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Rename
            </MenuItem>
            <MenuItem disabled={position === 0} onSelect={() => saveCollection(ops.moveGroup(collection, group.id, position - 1))}>
              <ArrowUp /> Move up
            </MenuItem>
            <MenuItem disabled={position === last} onSelect={() => saveCollection(ops.moveGroup(collection, group.id, position + 1))}>
              <ArrowDown /> Move down
            </MenuItem>
            <MenuSeparator />
            <MenuItem destructive disabled={collection.groups.length <= 1} onSelect={() => saveCollection(ops.deleteGroup(collection, group.id))}>
              <Trash2 /> Delete group (keep products)
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <SortableContext items={group.itemKeys} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'grid min-h-32 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 rounded-xl p-1 transition-colors',
            isOver && 'bg-brand-soft/40',
            group.itemKeys.length === 0 && 'border border-dashed border-line-strong',
          )}
        >
          {group.itemKeys.map((key) => (
            <SortableCard key={key} index={index} itemKey={key} onOpen={onOpen} onRemove={() => saveCollection(ops.removeItems(collection, [key]))} />
          ))}
          {group.itemKeys.length === 0 && <p className="col-span-full self-center text-center text-sm text-subtle">Drag products here</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({ index, itemKey, onOpen, onRemove }: { index: CatalogIndex; itemKey: string; onOpen: (k: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemKey })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'opacity-30')}
      {...attributes}
      {...listeners}
    >
      <BoardCard index={index} itemKey={itemKey} onOpen={() => index.keyToRow.has(itemKey) && onOpen(itemKey)} />
      <button
        type="button"
        aria-label="Remove from collection"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 z-10 grid size-6 place-items-center rounded-full bg-white/90 text-black/60 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-black focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

const BoardCard = memo(function BoardCard({ index, itemKey, onOpen, overlay }: { index: CatalogIndex; itemKey: string; onOpen?: () => void; overlay?: boolean }) {
  const row = index.keyToRow.get(itemKey)
  if (row === undefined) {
    return (
      <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong p-3 text-center text-xs text-muted">
        <span className="font-medium">{itemKey}</span>
        <span className="mt-1 text-subtle">Not in this line list</span>
      </div>
    )
  }
  const title = productTitle(index, row)
  const price = roleNumber(index, 'fullPrice', row)
  return (
    <div
      className={cn(
        'relative cursor-grab overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-card active:cursor-grabbing has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-brand',
        overlay && 'shadow-float',
      )}
    >
      {onOpen && <button type="button" onClick={onOpen} aria-label={`Open ${title}`} className="absolute inset-0 z-0 cursor-[inherit] outline-none" />}
      <ProductImage src={roleText(index, 'image', row) || null} alt={title} className="pointer-events-none aspect-[4/5] w-full" imgClassName="p-[6%]" />
      <div className="pointer-events-none px-2.5 pt-2 pb-2.5">
        <div className="truncate text-[11px] text-subtle tabular">{itemKey}</div>
        <div className="truncate text-[13px] font-medium" title={title}>
          {title}
        </div>
        <div className="mt-0.5 flex justify-between gap-2 text-xs tabular">
          <span className="min-w-0 truncate text-muted">{roleText(index, 'color', row)}</span>
          <span className="shrink-0 font-semibold whitespace-nowrap">{price !== null ? moneyFormatter(index, 'fullPrice')(price) : ''}</span>
        </div>
      </div>
    </div>
  )
})
