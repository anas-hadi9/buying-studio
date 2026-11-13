import { ImageOff, RotateCw } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { LoadQueue } from '@/lib/loadQueue'

/*
 * Line-list photos are often full-size originals: typically around 0.4 MB,
 * some over 5 MB. This loader keeps that weight manageable:
 *  - only photos on screen (or half a screen ahead) download, at most
 *    DOWNLOAD_SLOTS at a time, in the order they came into view;
 *  - photos scrolled past quickly never start, and leaving cancels a download;
 *  - a failed download is retried after a short pause before giving up;
 *  - a photo that still fails shows "Retry". It is tried again automatically
 *    once the device reconnects, or when its card is shown again after a minute.
 */
const DOWNLOAD_SLOTS = 6
/** How long a photo must stay on screen before it joins the line (skips fast scrolls). */
const SETTLE_MS = 150
const ATTEMPTS = 3
const RETRY_DELAYS = [1_500, 5_000]
/** A slow download gives up its slot (it keeps loading) so others can start. */
const SLOW_AFTER = 12_000
const FAILURE_TTL = 60_000

const queue = new LoadQueue(DOWNLOAD_SLOTS)
// Remember outcomes across mounts: virtualised cards remount on scroll, and a
// photo that already loaded (browser-cached) shouldn't wait in line again.
const loaded = new Set<string>()
const failed = new Map<string, number>()
const preloading = new Set<string>()

if (typeof window !== 'undefined') window.addEventListener('online', () => failed.clear())

function failedRecently(src: string) {
  const at = failed.get(src)
  if (at === undefined) return false
  if (Date.now() - at < FAILURE_TTL) return true
  failed.delete(src)
  return false
}

// One IntersectionObserver per scroll container. Containers marked
// `data-image-root` get look-ahead; elsewhere the browser window is used.
const watchers = new WeakMap<Element, (visible: boolean) => void>()
const observers = new WeakMap<object, IntersectionObserver>()

function watchVisibility(el: Element, onChange: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true)
    return () => {}
  }
  const root = el.closest('[data-image-root]')
  let observer = observers.get(root ?? document)
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) watchers.get(e.target)?.(e.isIntersecting)
      },
      { root, rootMargin: '50% 0px' },
    )
    observers.set(root ?? document, observer)
  }
  const io = observer
  watchers.set(el, onChange)
  io.observe(el)
  return () => {
    io.unobserve(el)
    watchers.delete(el)
  }
}

/** Warms the browser cache, e.g. for the next/previous product in the detail view. */
export function preloadImage(src: string | null | undefined) {
  if (!src || loaded.has(src) || preloading.has(src) || failedRecently(src)) return
  preloading.add(src)
  // Load events are always async, so `release` is assigned before `done` runs.
  const release = queue.request(() => {
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    const done = () => {
      release()
      preloading.delete(src)
    }
    img.addEventListener('load', () => (loaded.add(src), done()), { once: true })
    img.addEventListener('error', done, { once: true })
    img.src = src
  })
}

/**
 * Shown when a product has no photo link, or (with `onRetry`) when its photo
 * couldn't be downloaded.
 */
export function ImageFallback({ compact, className, onRetry }: { compact?: boolean; className?: string; onRetry?: () => void }) {
  return (
    <div
      title={onRetry ? 'The photo couldn’t be downloaded from the image server.' : 'This product has no photo link in the line list.'}
      className={cn('flex size-full flex-col items-center justify-center gap-2 bg-photo text-[#a39c90]', className)}
    >
      <ImageOff className={compact ? 'size-4' : 'size-6'} strokeWidth={1.5} />
      {!compact && <span className="text-[11px] font-medium tracking-wide uppercase">{onRetry ? 'Photo didn’t load' : 'No photo'}</span>}
      {!compact && onRetry && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRetry()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto relative z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-black/70 shadow-sm hover:text-black"
        >
          <RotateCw className="size-3" /> Retry
        </button>
      )}
    </div>
  )
}

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  imgClassName?: string
  compact?: boolean
  /** Load now and ahead of other photos (e.g. the product being viewed). */
  eager?: boolean
}

/**
 * Product photo on a neutral "studio" tile. `object-contain` never crops the
 * product; multiply blending melts white photo backgrounds into the tile.
 */
export const ProductImage = memo(function ProductImage(props: ProductImageProps) {
  if (!props.src) {
    return (
      <div className={cn('relative overflow-hidden bg-photo', props.className)}>
        <ImageFallback compact={props.compact} />
      </div>
    )
  }
  // Keyed by src so a different photo always starts from a clean state.
  return <Photo key={props.src} {...props} src={props.src} />
})

/**
 * Removing an <img> doesn't stop its download, so a photo whose card goes away
 * mid-download would keep using bandwidth. Dropping `src` aborts it (and, unlike
 * `src = ''`, fires no error event). The check waits a microtask so it only acts
 * once the element has really left the page (React may detach and re-attach refs).
 */
const cancelUnfinished = (img: HTMLImageElement | null) => {
  if (!img) return
  return () =>
    queueMicrotask(() => {
      if (!img.isConnected && !img.complete) img.removeAttribute('src')
    })
}

type Phase = 'waiting' | 'loading' | 'retrying' | 'loaded' | 'failed'

function Photo({ src, alt, className, imgClassName, compact, eager }: ProductImageProps & { src: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useRef<(() => void) | null>(null)
  const [phase, setPhase] = useState<Phase>(() => (loaded.has(src) ? 'loaded' : failedRecently(src) ? 'failed' : 'waiting'))
  /** Failures in the current round of attempts. */
  const [failures, setFailures] = useState(0)
  /** Remounts the <img> so a retry is a fresh request. */
  const [attempt, setAttempt] = useState(0)

  const freeSlot = useCallback(() => {
    slot.current?.()
    slot.current = null
  }, [])
  useEffect(() => freeSlot, [freeSlot])

  const retry = useCallback(() => {
    failed.delete(src)
    setFailures(0)
    setAttempt((a) => a + 1)
    setPhase('waiting')
  }, [src])

  // Waiting: hold a place in the download line while the photo is near the screen.
  useEffect(() => {
    if (phase !== 'waiting') return
    let granted = false
    const ask = () => {
      slot.current ??= queue.request(
        () => {
          granted = true
          setPhase('loading')
        },
        { urgent: eager },
      )
    }
    const leave = () => {
      if (!granted) freeSlot()
    }
    if (eager || !ref.current) {
      ask()
      return leave
    }
    let settle: ReturnType<typeof setTimeout> | undefined
    const stop = watchVisibility(ref.current, (visible) => {
      clearTimeout(settle)
      if (visible) settle = setTimeout(ask, SETTLE_MS)
      else leave()
    })
    return () => {
      clearTimeout(settle)
      stop()
      leave()
    }
  }, [phase, eager, freeSlot])

  useEffect(() => {
    if (phase !== 'loading') return
    const t = setTimeout(freeSlot, SLOW_AFTER)
    return () => clearTimeout(t)
  }, [phase, freeSlot])

  useEffect(() => {
    if (phase !== 'retrying') return
    const t = setTimeout(
      () => {
        setAttempt((a) => a + 1)
        setPhase('waiting')
      },
      RETRY_DELAYS[failures - 1] ?? RETRY_DELAYS.at(-1),
    )
    return () => clearTimeout(t)
  }, [phase, failures])

  useEffect(() => {
    if (phase !== 'failed') return
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [phase, retry])

  return (
    <div ref={ref} className={cn('relative overflow-hidden bg-photo', className)}>
      {phase !== 'loaded' && phase !== 'failed' && <div className="skeleton absolute inset-0" aria-hidden />}
      {phase === 'failed' && <ImageFallback compact={compact} onRetry={retry} />}
      {(phase === 'loading' || phase === 'loaded') && (
        <img
          key={attempt}
          src={src}
          alt={alt}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          referrerPolicy="no-referrer"
          draggable={false}
          ref={cancelUnfinished}
          onLoad={() => {
            loaded.add(src)
            failed.delete(src)
            freeSlot()
            setPhase('loaded')
          }}
          onError={(e) => {
            if (!e.currentTarget.hasAttribute('src')) return
            freeSlot()
            if (failures + 1 < ATTEMPTS) {
              setFailures(failures + 1)
              setPhase('retrying')
            } else {
              failed.set(src, Date.now())
              setPhase('failed')
            }
          }}
          className={cn(
            'absolute inset-0 size-full object-contain mix-blend-multiply transition-opacity duration-300',
            phase === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
    </div>
  )
}
