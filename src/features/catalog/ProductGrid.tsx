import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, SearchX } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox, EmptyState } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import type { GroupNode } from '@/domain/catalog/sortGroup'
import { summarize } from '@/domain/selection/summary'
import { cn } from '@/lib/cn'
import { usePreferences, type CardSize } from '@/stores/preferences'
import { useWorkspace } from '@/stores/workspace'
import { CARD_INFO_HEIGHT, ProductCard } from './ProductCard'
import { noun } from '@/lib/plural'
import { moneyFormatter } from './useCatalogView'

const MIN_CARD_WIDTH: Record<CardSize, number> = { s: 168, m: 220, l: 300 }
const GAP: Record<CardSize, number> = { s: 12, m: 16, l: 20 }
const PADDING_X = 24
const HEADER_HEIGHT = [64, 48]

type Item =
  | { type: 'header'; node: GroupNode; height: number }
  | { type: 'cards'; rows: number[]; height: number; groupId: string | null }

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function chunk(rows: number[], size: number) {
  const out: number[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

interface ProductGridProps {
  index: CatalogIndex
  rows: number[]
  groups: GroupNode[] | null
  keys: string[]
  collectionCounts: Map<string, number>
}

export function ProductGrid({ index, rows, groups, keys, collectionCounts }: ProductGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const width = useWidth(scrollRef)
  const size = usePreferences((s) => s.cardSize)
  const selection = useWorkspace((s) => s.selection)
  const collapsed = useWorkspace((s) => s.collapsedGroups)
  const toggleSelected = useWorkspace((s) => s.toggleSelected)
  const openDetail = useWorkspace((s) => s.openDetail)
  const clearFilters = useWorkspace((s) => s.clearFilters)

  const gap = GAP[size]
  const inner = Math.max(0, width - PADDING_X * 2)
  const columns = Math.max(1, Math.floor((inner + gap) / (MIN_CARD_WIDTH[size] + gap)))
  const cardWidth = (inner - gap * (columns - 1)) / columns
  const cardHeight = Math.round(cardWidth * 1.25 + CARD_INFO_HEIGHT[size])
  const rowHeight = cardHeight + gap

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    const pushRows = (r: number[], groupId: string | null) => {
      for (const c of chunk(r, columns)) out.push({ type: 'cards', rows: c, height: rowHeight, groupId })
    }
    if (!groups) {
      pushRows(rows, null)
      return out
    }
    const walk = (nodes: GroupNode[]) => {
      for (const node of nodes) {
        out.push({ type: 'header', node, height: HEADER_HEIGHT[Math.min(node.depth, 1)] })
        if (collapsed.has(node.id)) continue
        if (node.children) walk(node.children)
        else pushRows(node.rows, node.id)
      }
    }
    walk(groups)
    return out
  }, [rows, groups, columns, rowHeight, collapsed])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => items[i].height,
    overscan: 3,
    paddingStart: 8,
    paddingEnd: 120,
  })

  useEffect(() => {
    virtualizer.measure()
  }, [items, virtualizer])

  // Back to top when the result set changes shape (new filter/sort/group).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [groups, rows.length])

  // Dragging moves the whole selection if the dragged card is part of it.
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const getDragKeys = useCallback((key: string) => (selectionRef.current.has(key) ? [...selectionRef.current] : [key]), [])
  const onOpen = useCallback((key: string) => openDetail(keys, key), [openDetail, keys])

  if (rows.length === 0) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <EmptyState
          icon={<SearchX />}
          title="No products match"
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters and search
            </Button>
          }
        >
          Try removing a filter or searching for something broader.
        </EmptyState>
      </div>
    )
  }

  return (
    <div ref={scrollRef} data-image-root className="min-h-0 flex-1 overflow-auto [overflow-anchor:none]">
      <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
        {virtualizer.getVirtualItems().map((v) => {
          const item = items[v.index]
          return (
            <div
              key={v.key}
              className="absolute left-0 w-full"
              style={{ transform: `translateY(${v.start}px)`, height: item.height, paddingLeft: PADDING_X, paddingRight: PADDING_X }}
            >
              {item.type === 'header' ? (
                <GroupHeader index={index} node={item.node} collapsed={collapsed.has(item.node.id)} />
              ) : (
                <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, height: cardHeight }}>
                  {item.rows.map((r) => {
                    const key = index.keys[r]
                    return (
                      <ProductCard
                        key={key}
                        index={index}
                        row={r}
                        size={size}
                        selected={selection.has(key)}
                        getDragKeys={getDragKeys}
                        collectionCount={collectionCounts.get(key) ?? 0}
                        onToggle={toggleSelected}
                        onOpen={onOpen}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GroupHeader({ index, node, collapsed }: { index: CatalogIndex; node: GroupNode; collapsed: boolean }) {
  const toggleGroup = useWorkspace((s) => s.toggleGroup)
  const selection = useWorkspace((s) => s.selection)
  const select = useWorkspace((s) => s.select)
  const deselect = useWorkspace((s) => s.deselect)
  const formatFull = useMemo(() => moneyFormatter(index, 'fullPrice'), [index])
  const rows = node.rows
  const summary = useMemo(() => summarize(index, rows), [index, rows])
  const keys = useMemo(() => rows.map((r) => index.keys[r]), [index, rows])
  const selectedCount = keys.filter((k) => selection.has(k)).length
  const column = index.byId.get(node.columnId)
  const top = node.depth === 0

  return (
    <div className={cn('flex h-full items-end gap-3 pb-3', top ? 'border-b border-line' : 'pl-1')}>
      <Checkbox
        label={`Select all in ${node.label}`}
        checked={selectedCount === 0 ? false : selectedCount === keys.length ? true : 'indeterminate'}
        onCheckedChange={(c) => (c ? select(keys) : deselect(keys))}
        className="mb-1"
      />
      <button type="button" onClick={() => toggleGroup(node.id)} className="group flex min-w-0 items-baseline gap-2 text-left" aria-expanded={!collapsed}>
        <ChevronDown className={cn('size-4 shrink-0 self-center text-subtle transition-transform', collapsed && '-rotate-90')} />
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-subtle uppercase">{column?.def.header}</span>
        <span className={cn('truncate', top ? 'font-display text-2xl leading-none' : 'text-[15px] font-semibold')}>{node.label}</span>
      </button>
      <div className="ml-auto flex shrink-0 items-baseline gap-4 text-xs text-muted tabular">
        <span>
          <b className="font-semibold text-fg">{summary.products.toLocaleString('en-GB')}</b> {noun(summary.products, 'product')}
        </span>
        <span className="hidden sm:inline">
          <b className="font-semibold text-fg">{summary.styles.toLocaleString('en-GB')}</b> {noun(summary.styles, 'style')}
        </span>
        {summary.fullPrice && summary.fullPrice.average !== null && (
          <span className="hidden md:inline">
            avg <b className="font-semibold text-fg">{formatFull(summary.fullPrice.average)}</b>
          </span>
        )}
        {selectedCount > 0 && <span className="font-medium text-fg">{selectedCount} selected</span>}
      </div>
    </div>
  )
}
