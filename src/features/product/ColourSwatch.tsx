import { swatchBackground, swatchFor } from '@/domain/colours'
import { cn } from '@/lib/cn'

/** A small dot showing roughly what a colour name looks like; nothing for unknown names. */
export function ColourSwatch({ name, className }: { name: string | null | undefined; className?: string }) {
  const swatch = swatchFor(name)
  if (!swatch) return null
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25', className)}
      style={{ background: swatchBackground(swatch) }}
    />
  )
}
