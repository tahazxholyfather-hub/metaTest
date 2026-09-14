/**
 * Persistence abstraction. Gameplay talks to SaveManager, never to localStorage.
 * Swap `LocalStorageAdapter` for a remote backend later without touching callers.
 */

import {
  DEFAULT_SETTINGS,
  type LevelId,
  type LevelRecord,
  type SaveData,
  type SettingsData,
} from './types'

export interface SaveStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export class LocalStorageAdapter implements SaveStorage {
  constructor(private readonly backend: Storage | null) {}

  get(key: string): string | null {
    try {
      return this.backend?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  set(key: string, value: string): void {
    try {
      this.backend?.setItem(key, value)
    } catch {
      /* quota / private mode */
    }
  }

  remove(key: string): void {
    try {
      this.backend?.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

export class MemoryStorageAdapter implements SaveStorage {
  private data = new Map<string, string>()
  get(key: string): string | null {
    return this.data.get(key) ?? null
  }
  set(key: string, value: string): void {
    this.data.set(key, value)
  }
  remove(key: string): void {
    this.data.delete(key)
  }
}

const SAVE_KEY = 'gleam.save.v1'
const SAVE_VERSION = 1

const emptySave = (): SaveData => ({
  version: SAVE_VERSION,
  firstLaunchDone: false,
  settings: { ...DEFAULT_SETTINGS },
  records: {},
  unlockedSeasons: ['season-1'],
  unlockedLevels: ['s1-l01'],
  totals: { score: 0, stars: 0, deaths: 0, playTime: 0 },
})

export class SaveManager {
  private data: SaveData

  constructor(private storage: SaveStorage) {
    this.data = this.read()
  }

  get snapshot(): SaveData {
    return this.data
  }

  get settings(): SettingsData {
    return this.data.settings
  }

  isFirstLaunch(): boolean {
    return !this.data.firstLaunchDone
  }

  markLaunchSeen(): void {
    this.data.firstLaunchDone = true
    this.flush()
  }

  patchSettings(partial: Partial<SettingsData>): void {
    this.data.settings = { ...this.data.settings, ...partial }
    this.flush()
  }

  getRecord(id: LevelId): LevelRecord | undefined {
    return this.data.records[id]
  }

  upsertRecord(id: LevelId, patch: Partial<LevelRecord>): LevelRecord {
    const prev = this.data.records[id] ?? {
      completed: false,
      bestScore: 0,
      bestTime: 0,
      deaths: 0,
      stars: 0,
      collectibles: 0,
      collectiblesMax: 0,
      secrets: 0,
      secretsMax: 0,
      played: true,
    }
    const next: LevelRecord = { ...prev, ...patch, played: true }
    if (patch.bestScore !== undefined) next.bestScore = Math.max(prev.bestScore, patch.bestScore)
    if (patch.bestTime !== undefined) {
      next.bestTime =
        prev.bestTime === 0 ? patch.bestTime : Math.min(prev.bestTime, patch.bestTime)
    }
    if (patch.stars !== undefined) next.stars = Math.max(prev.stars, patch.stars)
    if (patch.collectibles !== undefined) {
      next.collectibles = Math.max(prev.collectibles, patch.collectibles)
    }
    if (patch.secrets !== undefined) next.secrets = Math.max(prev.secrets, patch.secrets)
    this.data.records[id] = next
    this.recomputeTotals()
    this.flush()
    return next
  }

  unlockSeason(id: string): void {
    if (!this.data.unlockedSeasons.includes(id)) {
      this.data.unlockedSeasons.push(id)
      this.flush()
    }
  }

  unlockLevel(id: LevelId): void {
    if (!this.data.unlockedLevels.includes(id)) {
      this.data.unlockedLevels.push(id)
      this.flush()
    }
  }

  isSeasonUnlocked(id: string): boolean {
    return this.data.unlockedSeasons.includes(id)
  }

  isLevelUnlocked(id: LevelId): boolean {
    return this.data.unlockedLevels.includes(id)
  }

  setLastPlayed(seasonId: string, levelId: LevelId): void {
    this.data.lastPlayed = { seasonId, levelId }
    this.flush()
  }

  addPlayTime(seconds: number): void {
    this.data.totals.playTime += seconds
    this.flush()
  }

  addDeath(): void {
    this.data.totals.deaths += 1
    this.flush()
  }

  resetProgress(): void {
    const settings = this.data.settings
    this.data = emptySave()
    this.data.settings = settings
    this.data.firstLaunchDone = true
    this.flush()
  }

  private recomputeTotals(): void {
    let stars = 0
    let score = 0
    for (const rec of Object.values(this.data.records)) {
      stars += rec.stars
      score += rec.bestScore
    }
    this.data.totals.stars = stars
    this.data.totals.score = score
  }

  private read(): SaveData {
    const raw = this.storage.get(SAVE_KEY)
    if (!raw) return emptySave()
    try {
      const parsed = JSON.parse(raw) as SaveData
      if (!parsed || parsed.version !== SAVE_VERSION) return emptySave()
      return {
        ...emptySave(),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        records: parsed.records ?? {},
        unlockedSeasons: parsed.unlockedSeasons?.length ? parsed.unlockedSeasons : ['season-1'],
        unlockedLevels: parsed.unlockedLevels?.length ? parsed.unlockedLevels : ['s1-l01'],
        totals: { ...emptySave().totals, ...parsed.totals },
      }
    } catch {
      return emptySave()
    }
  }

  private flush(): void {
    this.storage.set(SAVE_KEY, JSON.stringify(this.data))
  }
}

export function createSaveManager(): SaveManager {
  const storage =
    typeof localStorage !== 'undefined'
      ? new LocalStorageAdapter(localStorage)
      : new MemoryStorageAdapter()
  return new SaveManager(storage)
}
