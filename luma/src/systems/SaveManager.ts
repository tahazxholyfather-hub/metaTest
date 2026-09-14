import type { SaveData, SettingsState } from '../core/types'
import { DEFAULT_SETTINGS } from '../core/types'

export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly store: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {}

  get(key: string): string | null {
    try {
      return this.store?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  set(key: string, value: string): void {
    try {
      this.store?.setItem(key, value)
    } catch {
      /* quota / private mode */
    }
  }

  remove(key: string): void {
    try {
      this.store?.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

const KEY = 'luma.save.v1'
const VERSION = 1

const fresh = (): SaveData => ({
  version: VERSION,
  seenIntro: false,
  settings: { ...DEFAULT_SETTINGS },
  levels: {},
  unlockedSeasons: ['season-1'],
  unlockedLevels: ['season-1-01'],
})

export class SaveManager {
  private data: SaveData
  constructor(private readonly storage: StorageAdapter = new LocalStorageAdapter()) {
    this.data = this.read()
  }

  private read(): SaveData {
    const raw = this.storage.get(KEY)
    if (!raw) return fresh()
    try {
      const parsed = JSON.parse(raw) as SaveData
      if (!parsed || parsed.version !== VERSION) return fresh()
      return {
        ...fresh(),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        levels: parsed.levels ?? {},
        unlockedSeasons: parsed.unlockedSeasons?.length ? parsed.unlockedSeasons : ['season-1'],
        unlockedLevels: parsed.unlockedLevels?.length ? parsed.unlockedLevels : ['season-1-01'],
      }
    } catch {
      return fresh()
    }
  }

  persist(): void {
    this.storage.set(KEY, JSON.stringify(this.data))
  }

  snapshot(): SaveData {
    return this.data
  }

  markIntroSeen(): void {
    this.data.seenIntro = true
    this.data.settings.skipIntro = true
    this.persist()
  }

  updateSettings(partial: Partial<SettingsState>): void {
    this.data.settings = { ...this.data.settings, ...partial }
    this.persist()
  }

  mutate(fn: (data: SaveData) => void): void {
    fn(this.data)
    this.persist()
  }

  resetProgress(): void {
    const settings = this.data.settings
    this.data = { ...fresh(), settings, seenIntro: true }
    this.persist()
  }
}
