import { useDraggable } from '@dnd-kit/core'
import { Check, FolderCheck, FolderPlus } from 'lucide-react'
import { memo } from 'react'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { AddToCollectionMenu } from '@/features/collections/AddToCollectionMenu'
import { ProductImage } from '@/features/product/ProductImage'
import { cn } from '@/lib/cn'
import type { CardSize } from '@/stores/preferences'
import { moneyFormatter, productTitle, roleNumber, roleText } from './useCatalogView'

export const CARD_INFO_HEIGHT: Record<CardSize, number> = { s: 96, m: 112, l: 120 }

export interface DragData {
  keys: string[]
  image: string | null
  title: string
}

interface ProductCardProps {
  index: CatalogIndex
  row: number
  size: CardSize
  selected: boolean
  /** Keys that move together when this card is dragged (the selection, if this card is in it). */
  getDragKeys: (key: string) => string[]
  collectionCount: number
  onToggle: (key: string) => void
  onOpen: (key: string) => void
}

export const ProductCard = memo(function ProductCard({ index, row, size, selected, getDragKeys, collectionCount, onToggle, onOpen }: ProductCardProps) {
  const key = index.keys[row]
  const image = roleText(index, 'image', row) || null
  const title = productTitle(index, row)
  // Only pointer listeners: cards are reached by Tab through their buttons, not as drag handles.
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `product:${key}`,
    data: { get keys() { return getDragKeys(key) }, image, title } satisfies DragData,
  })

  const style = roleText(index, 'style', row)
  const meta = [roleText(index, 'gender', row), roleText(index, 'category', row), roleText(index, 'line', row)].filter(Boolean)
  const uniqueMeta = [...new Set(meta)]
  const color = roleText(index, 'color', row)
  const fullPrice = roleNumber(index, 'fullPrice', row)
  const psf = roleNumber(index, 'price', row)
  const formatFull = moneyFormatter(index, 'fullPrice')
  const formatPsf = moneyFormatter(index, 'price')

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface transition-[box-shadow,border-color,opacity] duration-200 hover:shadow-card has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-brand',
        selected ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong',
        isDragging && 'opacity-40',
      )}
    >
      {/* The whole card opens the product; action buttons sit above this layer. */}
      <button
        type="button"
        onClick={() => onOpen(key)}
        aria-label={`Open ${title}, ${key}`}
        className="absolute inset-0 z-0 cursor-pointer outline-none"
      />
      <div className="pointer-events-none relative aspect-[4/5] w-full">
        <ProductImage src={image} alt={title} className="size-full" imgClassName="p-[6%] transition-transform duration-500 group-hover:scale-[1.03]" />

        <button
          type="button"
          aria-label={selected ? 'Deselect product' : 'Select product'}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(key)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'pointer-events-auto absolute top-2.5 left-2.5 z-10 grid size-6 place-items-center rounded-full border transition-all',
            selected
              ? 'border-ink bg-ink text-ink-fg opacity-100'
              : 'border-black/15 bg-white/90 text-transparent opacity-0 shadow-sm group-hover:opacity-100 hover:text-black/40 focus-visible:opacity-100',
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>

        <div className="pointer-events-auto absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          <AddToCollectionMenu
            keys={[key]}
            trigger={
              <button
                type="button"
                aria-label="Add to collection"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="grid size-7 place-items-center rounded-full bg-white/90 text-black/70 shadow-sm hover:text-black"
              >
                <FolderPlus className="size-3.5" />
              </button>
            }
          />
        </div>

        {collectionCount > 0 && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-black/70 shadow-sm">
            <FolderCheck className="size-3" /> {collectionCount}
          </span>
        )}
      </div>

      <div className={cn('pointer-events-none flex min-h-0 flex-1 flex-col px-3 pt-2.5 pb-3', size === 's' && 'px-2.5 pt-2 pb-2.5')}>
        <div className="flex items-center gap-1.5 text-[11px] text-subtle tabular">
          {style && <span className="font-medium text-muted">{style}</span>}
          {style && <span>·</span>}
          <span className="truncate">{key}</span>
        </div>
        <h3 className={cn('mt-0.5 truncate font-medium', size === 's' ? 'text-[13px]' : 'text-sm')} title={title}>
          {title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted" title={[...uniqueMeta, color].join(' · ')}>
          {uniqueMeta.join(' · ')}
          {color && (
            <>
              {uniqueMeta.length > 0 && ' · '}
              <span className="text-fg/80">{color}</span>
            </>
          )}
        </p>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1.5 tabular">
          <span className={cn('font-semibold', size === 's' ? 'text-[13px]' : 'text-sm')}>
            {fullPrice !== null ? formatFull(fullPrice) : psf !== null ? formatPsf(psf) : '—'}
          </span>
          {fullPrice !== null && psf !== null && size !== 's' && (
            <span className="truncate text-[11px] text-subtle" title="PSF">
              PSF {formatPsf(psf)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
