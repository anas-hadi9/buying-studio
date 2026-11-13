/**
 * Small copies of product photos. Line-list photos are usually full-size
 * originals (0.4 MB+, 1500×2000 px); a card needs a ~50× smaller copy. A
 * resizing service turns an original's address into a small copy's address:
 * {url} is the original (URL-encoded), {width} the width in pixels.
 */

/** wsrv.nl: free, open-source image resizing, cached on Cloudflare. */
export const DEFAULT_PHOTO_RESIZER = 'https://wsrv.nl/?url={url}&w={width}&we&output=webp&q=75'

/**
 * Few sizes on purpose: everyone asking for the same size shares the
 * service's cache, so a photo one buyer has seen loads instantly for the next.
 */
export const PHOTO_WIDTHS = [320, 640, 960] as const

export function photoWidth(cssWidth: number, pixelRatio: number, compact: boolean): number {
  if (compact) return PHOTO_WIDTHS[0]
  const px = cssWidth * Math.min(Math.max(pixelRatio, 1), 2)
  return PHOTO_WIDTHS.find((w) => w >= px) ?? PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1]
}

export function resizedPhotoUrl(template: string, src: string, width: number): string {
  return template.replace(/\{url\}/g, encodeURIComponent(src)).replace(/\{width\}/g, String(width))
}

/** A usable resizer address: http(s) with an {url} placeholder. */
export function isPhotoResizer(template: string): boolean {
  return /^https?:\/\/\S+$/i.test(template.trim()) && template.includes('{url}')
}
