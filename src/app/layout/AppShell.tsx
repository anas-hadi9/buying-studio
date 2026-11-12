import { ChevronRight, Laptop, Moon, Settings2, Sun } from 'lucide-react'
import { Link, Outlet, useMatch } from 'react-router'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/overlays'
import { Tooltip } from '@/components/ui/primitives'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { usePreferences, type Theme } from '@/stores/preferences'
import { useWorkspace } from '@/stores/workspace'
import { useUi } from '@/stores/ui'

export const APP_NAME = 'Buying Studio'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md pr-1">
      <span className="grid size-8 place-items-center rounded-lg bg-ink text-ink-fg">
        <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 6.5a2.8 2.8 0 0 1 2.8 2.8c0 1.3-.9 2-1.7 2.6-.6.4-1.1.9-1.1 1.5v.7l9.6 6.6c1 .7.5 2.2-.7 2.2H7.1c-1.2 0-1.7-1.5-.7-2.2L15 14.8" />
        </svg>
      </span>
      <span className="font-display text-[22px] leading-none tracking-tight">{APP_NAME}</span>
    </Link>
  )
}

function Breadcrumbs() {
  const inLineList = useMatch('/l/:lineListId/*')
  const inCollection = useMatch('/l/:lineListId/c/:collectionId')
  const lineList = useWorkspace((s) => s.lineList)
  const collections = useWorkspace((s) => s.collections)
  if (!inLineList || !lineList) return null
  const collection = inCollection ? collections.find((c) => c.id === inCollection.params.collectionId) : undefined
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
      <ChevronRight className="size-4 shrink-0 text-subtle" />
      <Link to={`/l/${lineList.id}`} className="truncate rounded px-1 hover:text-fg">
        {lineList.brand && <span className="font-medium text-fg">{lineList.brand}</span>}
        {lineList.brand && <span className="px-1.5 text-subtle">·</span>}
        {lineList.name}
      </Link>
      {collection && (
        <>
          <ChevronRight className="size-4 shrink-0 text-subtle" />
          <span className="truncate font-medium text-fg">{collection.name}</span>
        </>
      )}
    </nav>
  )
}

const THEME_ICON = { light: Sun, dark: Moon, system: Laptop }

function ThemeMenu() {
  const theme = usePreferences((s) => s.theme)
  const setTheme = usePreferences((s) => s.setTheme)
  const Icon = THEME_ICON[theme]
  return (
    <Menu>
      <Tooltip content="Appearance">
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Appearance">
            <Icon />
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent className="min-w-36">
        {(['light', 'dark', 'system'] as Theme[]).map((t) => {
          const I = THEME_ICON[t]
          return (
            <MenuItem key={t} onSelect={() => setTheme(t)} className={theme === t ? 'font-medium' : ''}>
              <I /> {t[0].toUpperCase() + t.slice(1)}
            </MenuItem>
          )
        })}
      </MenuContent>
    </Menu>
  )
}

export function AppShell() {
  const settingsOpen = useUi((s) => s.settingsOpen)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const openSettings = useUi((s) => s.openSettings)
  return (
    <div className="flex h-full flex-col">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md">
        <Logo />
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content="Settings: pricing & material codes">
            <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => openSettings()}>
              <Settings2 />
            </Button>
          </Tooltip>
          <ThemeMenu />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
