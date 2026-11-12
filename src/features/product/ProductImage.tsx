import { ImageOff } from 'lucide-react'
import { memo, useState } from 'react'
import { cn } from '@/lib/cn'

// Remember outcomes across mounts: virtualised cards remount on scroll, and a
// URL that already loaded (browser-cached) shouldn't flash a skeleton again.
const loaded = new Set<string>()
const failed = new Set<string>()

/** Warms the browser cache, e.g. for the next/previous product in the detail view. */
export function preloadImage(src: string | null | undefined) {
  if (!src || loaded.has(src) || failed.has(src)) return
  const img = new Image()
  img.referrerPolicy = 'no-referrer'
  img.addEventListener('load', () => loaded.add(src), { once: true })
  img.addEventListener('error', () => failed.add(src), { once: true })
  img.src = src
}

export function ImageFallback({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex size-full flex-col items-center justify-center gap-2 bg-photo text-[#a39c90]', className)}>
      <ImageOff className={compact ? 'size-4' : 'size-6'} strokeWidth={1.5} />
      {!compact && <span className="text-[11px] font-medium tracking-wide uppercase">No image</span>}
    </div>
  )
}

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  imgClassName?: string
  compact?: boolean
  eager?: boolean
}

/**
 * Product photo on a neutral "studio" tile. `object-contain` never crops the
 * product; multiply blending melts white photo backgrounds into the tile.
 */
export const ProductImage = memo(function ProductImage({ src, alt, className, imgClassName, compact, eager }: ProductImageProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(() =>
    !src || failed.has(src) ? 'error' : loaded.has(src) ? 'loaded' : 'loading',
  )
  const [prevSrc, setPrevSrc] = useState(src)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setState(!src || failed.has(src) ? 'error' : loaded.has(src) ? 'loaded' : 'loading')
  }

  return (
    <div className={cn('relative overflow-hidden bg-photo', className)}>
      {state === 'loading' && <div className="skeleton absolute inset-0" aria-hidden />}
      {state === 'error' || !src ? (
        <ImageFallback compact={compact} />
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => {
            loaded.add(src)
            setState('loaded')
          }}
          onError={() => {
            failed.add(src)
            setState('error')
          }}
          className={cn(
            'size-full object-contain mix-blend-multiply transition-opacity duration-300',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
    </div>
  )
})
