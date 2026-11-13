import { ImageOff, RotateCw } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { photoWidth, resizedPhotoUrl } from '@/domain/photoResizer'
import { cn } from '@/lib/cn'
import { LoadQueue } from '@/lib/loadQueue'
import { useSettings } from '@/stores/settings'

/*
 * Line-list photos are often full-size originals: typically around 0.4 MB,
 * some over 5 MB. This loader keeps that weight manageable:
 *  - cards show a small copy from the photo resizer (Settings → Photos),
 *    ~50× lighter; the original is used if the copy fails, and the product
 *    view always shows the original (with the small copy as an instant preview);
 *  - only photos on screen (or half a screen ahead) download, at most
 *    DOWNLOAD_SLOTS at a time, in the order they came into view;
 *  - photos scrolled past quickly never start, and leaving cancels a download;
 *  - a failed download is retried after a short pause before giving up;
 *  - a photo that still fails shows "Retry". It is tried again automatically
 *    once the device reconnects, or when its card is shown again after a minute.
 */
const DOWNLOAD_SLOTS = 10
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
/** Every address (small copy or original) that loaded. */
const loaded = new Set<string>()
/** Original address → the small copy that loaded for it. */
const smallCopy = new Map<string, string>()
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
  /** Show the original photo, not a small copy (e.g. the zoomable product view). */
  full?: boolean
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
  return <ResizedPhoto {...props} src={props.src} />
})

function ResizedPhoto(props: ProductImageProps & { src: string }) {
  const resizer = useSettings((s) => s.settings.photoResizer)
  // The product view shows the original, with a small copy as an instant preview.
  const preview = props.full ? (smallCopy.get(props.src) ?? (resizer ? resizedPhotoUrl(resizer, props.src, 640) : null)) : null
  // Keyed so a different photo (or resizer) always starts from a clean state.
  return <Photo key={`${props.src}|${resizer ?? ''}`} {...props} resizer={props.full ? null : resizer} previewUrl={preview} />
}

/** Addresses to try, best first: a small copy sized for the element, then the original. */
function candidates(src: string, el: HTMLElement | null, resizer: string | null, compact: boolean): string[] {
  if (!resizer) return [src]
  const width = photoWidth(el?.clientWidth || 300, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, compact)
  return [resizedPhotoUrl(resizer, src, width), src]
}

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

/** What a remounted card can show straight away. */
function alreadyLoaded(src: string, full: boolean): string | null {
  if (full) return loaded.has(src) ? src : null
  return smallCopy.get(src) ?? (loaded.has(src) ? src : null)
}

function Photo({
  src,
  alt,
  className,
  imgClassName,
  compact,
  eager,
  full,
  resizer,
  previewUrl,
}: ProductImageProps & { src: string; resizer: string | null; previewUrl: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useRef<(() => void) | null>(null)
  const tries = useRef<string[] | null>(null)
  const tryIndex = useRef(0)
  const [url, setUrl] = useState<string | null>(() => alreadyLoaded(src, !!full))
  const [phase, setPhase] = useState<Phase>(() => (url ? 'loaded' : failedRecently(src) ? 'failed' : 'waiting'))
  /** Failures in the current round of attempts. */
  const [failures, setFailures] = useState(0)
  /** Remounts the <img> so a retry is a fresh request. */
  const [attempt, setAttempt] = useState(0)
  // The product view shows the small copy while the original arrives (or if it can't).
  const [previewFailed, setPreviewFailed] = useState(false)
  const preview = phase !== 'loaded' && !previewFailed ? previewUrl : null

  const freeSlot = useCallback(() => {
    slot.current?.()
    slot.current = null
  }, [])
  useEffect(() => freeSlot, [freeSlot])

  const retry = useCallback(() => {
    failed.delete(src)
    tryIndex.current = 0
    setFailures(0)
    setAttempt((a) => a + 1)
    setPhase('waiting')
  }, [src])

  // Addresses to try, worked out once the element is on the page (its width picks the size).
  useLayoutEffect(() => {
    tries.current = candidates(src, ref.current, resizer, !!compact)
  }, [src, resizer, compact])

  // Waiting: hold a place in the download line while the photo is near the screen.
  useEffect(() => {
    if (phase !== 'waiting') return
    const urls = tries.current ?? [src]
    let granted = false
    const ask = () => {
      slot.current ??= queue.request(
        () => {
          granted = true
          setUrl(urls[tryIndex.current])
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
  }, [phase, eager, freeSlot, src])

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

  // With a preview on screen, the original replaces it directly (no fade, no gap).
  const fadeIn = !previewUrl || previewFailed
  return (
    <div ref={ref} className={cn('relative overflow-hidden bg-photo', className)}>
      {phase !== 'loaded' && phase !== 'failed' && !preview && <div className="skeleton absolute inset-0" aria-hidden />}
      {preview && (
        <img
          src={preview}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setPreviewFailed(true)}
          className={cn('absolute inset-0 size-full object-contain mix-blend-multiply', imgClassName)}
        />
      )}
      {phase === 'failed' && !preview && <ImageFallback compact={compact} onRetry={retry} />}
      {(phase === 'loading' || phase === 'loaded') && url && (
        <img
          key={`${url}#${attempt}`}
          src={url}
          alt={alt}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          referrerPolicy="no-referrer"
          draggable={false}
          ref={cancelUnfinished}
          onLoad={(e) => {
            loaded.add(url)
            if (url !== src) smallCopy.set(src, url)
            failed.delete(src)
            freeSlot()
            // Show it once decoded, so swapping out the preview never flashes.
            void e.currentTarget
              .decode()
              .catch(() => {})
              .finally(() => setPhase('loaded'))
          }}
          onError={(e) => {
            if (!e.currentTarget.hasAttribute('src')) return
            freeSlot()
            // The small copy failed (e.g. the resizer is unreachable): use the original.
            if (tries.current && tryIndex.current < tries.current.length - 1) {
              tryIndex.current++
              setPhase('waiting')
              return
            }
            if (failures + 1 < ATTEMPTS) {
              setFailures(failures + 1)
              setPhase('retrying')
            } else {
              failed.set(src, Date.now())
              setPhase('failed')
            }
          }}
          className={cn(
            'absolute inset-0 size-full object-contain mix-blend-multiply',
            fadeIn && 'transition-opacity duration-300',
            phase === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
    </div>
  )
}
