import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type CardSize = 's' | 'm' | 'l'

interface PreferencesState {
  theme: Theme
  cardSize: CardSize
  filtersOpen: boolean
  dockOpen: boolean
  setTheme: (theme: Theme) => void
  setCardSize: (size: CardSize) => void
  setFiltersOpen: (open: boolean) => void
  setDockOpen: (open: boolean) => void
}

/** Per-device UI preferences. The storage key is also read by index.html to avoid a theme flash. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      cardSize: 'm',
      filtersOpen: true,
      dockOpen: true,
      setTheme: (theme) => set({ theme }),
      setCardSize: (cardSize) => set({ cardSize }),
      setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
      setDockOpen: (dockOpen) => set({ dockOpen }),
    }),
    { name: 'bs.preferences', version: 1 },
  ),
)

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
