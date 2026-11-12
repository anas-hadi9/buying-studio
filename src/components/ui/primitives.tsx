import { Check, Minus } from 'lucide-react'
import { Checkbox as RadixCheckbox, ToggleGroup, Tooltip as RadixTooltip } from 'radix-ui'
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle transition-colors outline-none hover:border-line-strong focus:border-fg/40 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
})

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full appearance-none rounded-lg border border-line bg-surface bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8 pl-3 text-sm text-fg outline-none hover:border-line-strong focus:border-fg/40',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  label,
}: {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  className?: string
  label?: string
}) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c === true)}
      aria-label={label}
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-[5px] border border-line-strong bg-surface transition-colors data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink',
        className,
      )}
    >
      <RadixCheckbox.Indicator className="text-ink-fg">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warn' | 'ink'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    brand: 'bg-brand-soft text-brand',
    warn: 'bg-warn-soft text-warn',
    ink: 'bg-ink text-ink-fg',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1 font-sans text-[11px] text-muted">
      {children}
    </kbd>
  )
}

export function Tooltip({ content, children, side = 'bottom' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RadixTooltip.Root delayDuration={350}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 animate-fade-in rounded-md bg-ink px-2 py-1 text-xs text-ink-fg shadow-float"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="inline-flex h-9 items-center rounded-lg border border-line bg-surface p-0.5"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          aria-label={o.title}
          className="inline-flex h-full min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium text-muted transition-colors hover:text-fg data-[state=on]:bg-surface-2 data-[state=on]:text-fg data-[state=on]:shadow-sm [&_svg]:size-4"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-muted [&_svg]:size-5">{icon}</div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
