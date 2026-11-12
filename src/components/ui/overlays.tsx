import { X } from 'lucide-react'
import { Dialog as RadixDialog, DropdownMenu, Popover as RadixPopover } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideHeader,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  hideHeader?: boolean
  footer?: ReactNode
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/40 backdrop-blur-[2px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <RadixDialog.Content
            className={cn(
              'pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg animate-dialog-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float outline-none',
              className,
            )}
          >
            {hideHeader ? (
              <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
            ) : (
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                <div className="min-w-0">
                  <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
                  {description && <RadixDialog.Description className="mt-0.5 text-sm text-muted">{description}</RadixDialog.Description>}
                </div>
                <RadixDialog.Close className="-mr-2 grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                  <X className="size-4" />
                </RadixDialog.Close>
              </div>
            )}
            {!description && <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>}
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface px-6 py-3">{footer}</div>}
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  open,
  onOpenChange,
}: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn('z-50 w-72 animate-pop-in rounded-xl border border-line bg-surface p-3 shadow-float outline-none', className)}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({ className, children, align = 'end', ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn('z-50 max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] min-w-48 animate-pop-in overflow-auto rounded-xl border border-line bg-surface p-1 shadow-float', className)}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function MenuItem({ className, destructive, ...props }: ComponentProps<typeof DropdownMenu.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted',
        destructive && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{children}</DropdownMenu.Label>
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />
}
