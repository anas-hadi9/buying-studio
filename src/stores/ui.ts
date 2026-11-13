import { create } from 'zustand'

export type SettingsTab = 'pricing' | 'materials' | 'website'

/** Transient UI state shared across features (not persisted). */
interface UiState {
  settingsOpen: boolean
  settingsTab: SettingsTab
  openSettings: (tab?: SettingsTab) => void
  setSettingsOpen: (open: boolean) => void
  setSettingsTab: (tab: SettingsTab) => void
}

export const useUi = create<UiState>()((set) => ({
  settingsOpen: false,
  settingsTab: 'pricing',
  openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
}))
