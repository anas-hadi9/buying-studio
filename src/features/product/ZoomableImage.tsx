import { ZoomIn, ZoomOut } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { ProductImage } from './ProductImage'

const ZOOM = 2.5

/**
 * Click to zoom, move the pointer to pan. Uses a CSS transform only, so it
 * works with any image host (no CORS or canvas needed).
 */
export function ZoomableImage({ src, alt }: { src: string | null; alt: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const [prevSrc, setPrevSrc] = useState(src)
  const ref = useRef<HTMLDivElement>(null)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setZoomed(false)
  }

  const track = (e: { clientX: number; clientY: number }) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`)
  }

  return (
    <div ref={ref} className="group relative size-full overflow-hidden bg-photo">
      <div className="size-full transition-transform duration-300 ease-out" style={{ transform: zoomed ? `scale(${ZOOM})` : undefined, transformOrigin: origin }}>
        <ProductImage src={src} alt={alt} eager className="size-full" imgClassName="p-[5%]" />
      </div>
      {src && (
        <>
          <button
            type="button"
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            aria-pressed={zoomed}
            onClick={(e) => {
              if (e.detail > 0) track(e)
              setZoomed(!zoomed)
            }}
            onPointerMove={zoomed ? track : undefined}
            className={cn('absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset', zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in')}
          />
          <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-black/70 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            {zoomed ? <ZoomOut className="size-3.5" /> : <ZoomIn className="size-3.5" />}
            {zoomed ? 'Click to zoom out' : 'Click to zoom'}
          </span>
        </>
      )}
    </div>
  )
}
