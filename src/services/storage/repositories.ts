/**
 * Storage ports. The app talks only to these interfaces; today they are backed
 * by IndexedDB on the buyer's device. A server-backed implementation (users,
 * shared collections, approvals) replaces them in app/services.ts without
 * touching features.
 */
import type { FilterPreset } from '@/domain/presets'
import type { AppSettings } from '@/domain/settings'
import type { Collection, LineList, LineListSummary } from '@/domain/types'

export interface LineListRepository {
  list(): Promise<LineListSummary[]>
  get(id: string): Promise<LineList | undefined>
  save(lineList: LineList): Promise<void>
  rename(id: string, name: string, brand: string | null): Promise<void>
  delete(id: string): Promise<void>
}

export interface CollectionRepository {
  listByLineList(lineListId: string): Promise<Collection[]>
  countByLineList(): Promise<Record<string, number>>
  save(collection: Collection): Promise<void>
  delete(id: string): Promise<void>
  deleteByLineList(lineListId: string): Promise<void>
}

export interface SelectionRepository {
  get(lineListId: string): Promise<string[]>
  save(lineListId: string, keys: string[]): Promise<void>
  delete(lineListId: string): Promise<void>
}

export interface PresetRepository {
  list(): Promise<FilterPreset[]>
  save(preset: FilterPreset): Promise<void>
  delete(id: string): Promise<void>
}

export interface SettingsRepository {
  get(): Promise<Partial<AppSettings> | undefined>
  save(settings: AppSettings): Promise<void>
}

export interface Repositories {
  lineLists: LineListRepository
  collections: CollectionRepository
  selections: SelectionRepository
  presets: PresetRepository
  settings: SettingsRepository
}
