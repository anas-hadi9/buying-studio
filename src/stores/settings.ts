import { create } from 'zustand'
import { DEFAULT_SETTINGS, withDefaults, type AppSettings } from '@/domain/settings'
import { getRepositories } from '@/services/registry'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettings = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    if (get().loaded) return
    const saved = await getRepositories().settings.get()
    set({ settings: withDefaults(saved), loaded: true })
  },
  async update(patch) {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    await getRepositories().settings.save(settings)
  },
}))
