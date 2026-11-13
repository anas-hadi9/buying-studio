import { Check, ChevronLeft, ChevronRight, ExternalLink, FolderPlus, Globe, LayoutGrid, Sparkles, X } from 'lucide-react'
import { Dialog as RadixDialog } from 'radix-ui'
import { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, Kbd, Tooltip } from '@/components/ui/primitives'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { colourCode, colourwayRows, styleFilter } from '@/domain/catalog/colourways'
import { formatCell } from '@/domain/catalog/format'
import { linkHost, productLink } from '@/domain/productLink'
import { AddToCollectionMenu } from '@/features/collections/AddToCollectionMenu'
import { productTitle, roleText } from '@/features/catalog/useCatalogView'
import { cn } from '@/lib/cn'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'
import { ColourSwatch } from './ColourSwatch'
import { ProductImage, preloadImage } from './ProductImage'
import { ZoomableImage } from './ZoomableImage'

export function ProductDetailDialog({ index }: { index: CatalogIndex }) {
  const detail = useWorkspace((s) => s.detail)
  const stepDetail = useWorkspace((s) => s.stepDetail)
  const closeDetail = useWorkspace((s) => s.closeDetail)
  const open = !!detail && detail.keys.length > 0
  const key = detail ? detail.keys[detail.position] : undefined
  const row = key !== undefined ? index.keyToRow.get(key) : undefined

  // Warm the cache for neighbours so stepping feels instant.
  useEffect(() => {
    if (!detail) return
    for (const d of [-1, 1, 2]) {
      const k = detail.keys[(detail.position + d + detail.keys.length) % detail.keys.length]
      const r = index.keyToRow.get(k)
      if (r !== undefined) preloadImage(roleText(index, 'image', r))
    }
  }, [detail, index])

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && closeDetail()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/50 backdrop-blur-[2px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
          <RadixDialog.Content
            onKeyDown={(e) => {
              if ((e.target as HTMLElement).tagName === 'INPUT') return
              if (e.key === 'ArrowRight') stepDetail(1)
              if (e.key === 'ArrowLeft') stepDetail(-1)
            }}
            className="pointer-events-auto relative flex h-[min(880px,94dvh)] w-full max-w-[1240px] animate-dialog-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float outline-none md:flex-row"
          >
            {row !== undefined && detail && <DetailBody index={index} row={row} position={detail.position} total={detail.keys.length} onStep={stepDetail} />}
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function DetailBody({ index, row, position, total, onStep }: { index: CatalogIndex; row: number; position: number; total: number; onStep: (d: number) => void }) {
  const selection = useWorkspace((s) => s.selection)
  const toggleSelected = useWorkspace((s) => s.toggleSelected)
  const collections = useWorkspace((s) => s.collections)
  const openSettings = useUi((s) => s.openSettings)
  const linkTemplate = useSettings((s) => s.settings.productLink)
  const key = index.keys[row]
  const title = productTitle(index, row)
  const image = roleText(index, 'image', row) || null
  const selected = selection.has(key)
  const inCollections = collections.filter((c) => c.groups.some((g) => g.itemKeys.includes(key)))
  const style = roleText(index, 'style', row)
  const code = colourCode(index, row)
  const websiteLink = productLink(linkTemplate, { key, style, code })

  const chips = [roleText(index, 'gender', row), roleText(index, 'line', row), roleText(index, 'category', row), roleText(index, 'material', row)].filter(Boolean)
  // Headline price fields from the pricing file, then the PSF column.
  const priceTiles = [
    ...index.columns.filter((c) => c.def.id.startsWith('x-price-')),
    ...(index.roles.price ? [index.byId.get(index.roles.price)!] : []),
  ]

  const fields = useMemo(
    () =>
      index.columns.map((c) => ({
        id: c.def.id,
        header: c.def.header,
        derived: !!c.def.derived,
        kind: c.def.kind,
        raw: c.values[row],
        text: formatCell(c.def, c.values[row]),
      })),
    [index, row],
  )

  return (
    <>
      <div className="relative h-[46%] shrink-0 md:h-full md:w-[52%]">
        <ZoomableImage src={image} alt={title} />
        <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
          <NavButton label="Previous product" onClick={() => onStep(-1)}>
            <ChevronLeft />
          </NavButton>
          <NavButton label="Next product" onClick={() => onStep(1)}>
            <ChevronRight />
          </NavButton>
        </div>
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-black/70 shadow-sm tabular">
          {(position + 1).toLocaleString('en-GB')} / {total.toLocaleString('en-GB')}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start gap-3 border-b border-line px-6 pt-5 pb-4 md:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-subtle uppercase tabular">
              {roleText(index, 'style', row) && <>Style {roleText(index, 'style', row)} · </>}
              {key}
            </p>
            <RadixDialog.Title className="mt-1 font-display text-[32px] leading-[1.05] tracking-tight">{title}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Product details for {title}</RadixDialog.Description>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {roleText(index, 'color', row) && (
                <Badge tone="ink">
                  <ColourSwatch name={roleText(index, 'color', row)} className="mr-1.5 ring-white/40" />
                  {roleText(index, 'color', row)}
                  {code && <span className="ml-1 opacity-60 tabular">{code}</span>}
                </Badge>
              )}
              {[...new Set(chips)].map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>
          </div>
          <RadixDialog.Close className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </RadixDialog.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5 md:px-8">
          <Colourways index={index} row={row} />
          {priceTiles.length > 0 && (
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line" style={{ gridTemplateColumns: `repeat(${priceTiles.length}, minmax(0, 1fr))` }}>
              {priceTiles.map((c, i) => (
                <PriceTile
                  key={c.def.id}
                  label={c.def.id === index.roles.price ? 'PSF' : c.def.header.replace(/\s*\([^)]*\)$/, '')}
                  value={formatCell(c.def, c.values[row]) || '—'}
                  strong={i === 0 && c.def.id !== index.roles.price}
                />
              ))}
            </div>
          )}
          {!index.roles.fullPrice && index.roles.price && (
            <button type="button" onClick={() => openSettings('pricing')} className="mt-2 text-xs font-medium text-brand hover:underline">
              Load the pricing file to show full prices
            </button>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant={selected ? 'primary' : 'outline'} onClick={() => toggleSelected(key)}>
              <Check /> {selected ? 'Selected' : 'Select'}
            </Button>
            <AddToCollectionMenu
              keys={[key]}
              align="start"
              trigger={
                <Button variant="outline">
                  <FolderPlus /> Add to collection
                </Button>
              }
            />
            {websiteLink && linkTemplate && (
              <Button variant="outline" onClick={() => window.open(websiteLink, '_blank', 'noopener,noreferrer')}>
                <Globe /> View on {linkHost(linkTemplate)}
              </Button>
            )}
            {image && (
              <Button variant="ghost" onClick={() => window.open(image, '_blank', 'noopener,noreferrer')}>
                <ExternalLink /> Original image
              </Button>
            )}
            <span className="ml-auto hidden items-center gap-1 text-xs text-subtle lg:flex">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd> to browse
            </span>
          </div>
          {!linkTemplate && (
            <button type="button" onClick={() => openSettings('website')} className="mt-2 text-xs font-medium text-muted hover:text-fg hover:underline">
              Link products to the brand website…
            </button>
          )}
          {inCollections.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              In {inCollections.map((c) => `“${c.name}”`).join(', ')}
            </p>
          )}

          <h3 className="mt-7 mb-2 text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">All fields</h3>
          <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8">
            {fields.map((f) => (
              <div key={f.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm">
                <dt className="flex shrink-0 items-center gap-1 text-muted">
                  {f.header}
                  {f.derived && (
                    <Tooltip content="Calculated by the app">
                      <Sparkles className="size-3 text-brand" />
                    </Tooltip>
                  )}
                </dt>
                <dd className={cn('min-w-0 text-right break-words tabular', !f.text && 'text-subtle')}>
                  {f.kind === 'image' || f.kind === 'url' ? (
                    f.text ? (
                      <a href={f.text} target="_blank" rel="noopener noreferrer" className="text-brand underline-offset-2 hover:underline">
                        Open link
                      </a>
                    ) : (
                      '—'
                    )
                  ) : (
                    f.text || '—'
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  )
}

/** Every colour of this product's style; click one to view it, or show them all in the catalogue. */
function Colourways({ index, row }: { index: CatalogIndex; row: number }) {
  const showInDetail = useWorkspace((s) => s.showInDetail)
  const closeDetail = useWorkspace((s) => s.closeDetail)
  const focusOn = useWorkspace((s) => s.focusOn)
  const rows = colourwayRows(index, row)
  if (rows.length < 2) return null
  const target = styleFilter(index, row)

  return (
    <section className="mb-5" aria-label="Colours">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">Colours · {rows.length}</h3>
        {target && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              closeDetail()
              focusOn(target.columnId, target.filter)
            }}
          >
            <LayoutGrid /> Show all {rows.length} colours
          </Button>
        )}
      </div>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {rows.map((r) => {
          const current = r === row
          const colour = roleText(index, 'color', r)
          const c = colourCode(index, r)
          return (
            <li key={r} className="w-[84px] shrink-0">
              <button
                type="button"
                onClick={() => showInDetail(index.keys[r])}
                aria-current={current}
                aria-label={`${colour || index.keys[r]}${c ? ` ${c}` : ''}`}
                className={cn(
                  'block w-full overflow-hidden rounded-lg border text-left transition-colors',
                  current ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong',
                )}
              >
                <ProductImage src={roleText(index, 'image', r) || null} alt="" compact className="aspect-[4/5] w-full" imgClassName="p-[6%]" />
                <span className="flex items-center gap-1 px-1.5 pt-1 text-[11px] font-medium">
                  <ColourSwatch name={colour} />
                  <span className="truncate" title={colour}>
                    {colour || '—'}
                  </span>
                </span>
                <span className="block px-1.5 pb-1 text-[10px] text-subtle tabular">{c ?? index.keys[r]}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PriceTile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</div>
      <div className={cn('mt-0.5 tabular', strong ? 'text-xl font-semibold' : 'text-base font-medium')}>{value}</div>
    </div>
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/90 text-black/80 shadow-md transition hover:scale-105 hover:bg-white [&_svg]:size-5"
    >
      {children}
    </button>
  )
}
