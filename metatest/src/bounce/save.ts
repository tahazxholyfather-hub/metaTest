import { SAVE_KEY } from './config'
import { LEVELS, nextLevel } from './levels'

export interface Bindings {
  left: string[]
  right: string[]
  jump: string[]
}

export const DEFAULT_BINDINGS: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space'],
}

export interface Settings {
  master: number
  music: number
  sfx: number
  muted: boolean
  bindings: Bindings
}

export interface LevelRecord {
  completed: boolean
  bestMs: number | null
  coins: string[]
  secrets: string[]
  routes: string[]
}

interface SaveFile {
  v: 1
  unlocked: string[]
  levels: Record<string, LevelRecord>
  settings: Settings
}

const defaultSettings = (): Settings => ({
  master: 0.85,
  music: 0.45,
  sfx: 0.8,
  muted: false,
  bindings: {
    left: [...DEFAULT_BINDINGS.left],
    right: [...DEFAULT_BINDINGS.right],
    jump: [...DEFAULT_BINDINGS.jump],
  },
})

const emptyLevel = (): LevelRecord => ({
  completed: false,
  bestMs: null,
  coins: [],
  secrets: [],
  routes: [],
})

const fresh = (): SaveFile => ({
  v: 1,
  unlocked: ['level-01'],
  levels: {},
  settings: defaultSettings(),
})

const uniq = (list: Iterable<string>): string[] => [...new Set(list)]

export class SaveManager {
  private data: SaveFile

  constructor() {
    this.data = this.read()
  }

  get settings(): Settings {
    return this.data.settings
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch }
    this.write()
  }

  isUnlocked(id: string): boolean {
    return id === 'level-01' || this.data.unlocked.includes(id)
  }

  record(id: string): LevelRecord {
    return this.data.levels[id] ?? emptyLevel()
  }

  continueId(): string {
    for (const level of LEVELS) {
      if (this.isUnlocked(level.id) && !this.record(level.id).completed) return level.id
    }
    return LEVELS[0]?.id ?? 'level-01'
  }

  noteProgress(id: string, coins: Iterable<string>, secrets: Iterable<string>, routes: Iterable<string>): void {
    this.merge(id, coins, secrets, routes)
    this.write()
  }

  complete(
    id: string,
    timeSec: number,
    coins: Iterable<string>,
    secrets: Iterable<string>,
    routes: Iterable<string>,
  ): { bestMs: number; isBest: boolean; nextId: string | null } {
    const row = this.merge(id, coins, secrets, routes)
    const ms = Math.max(0, Math.round(timeSec * 1000))
    const isBest = row.bestMs === null || ms < row.bestMs
    if (isBest) row.bestMs = ms
    row.completed = true
    const next = nextLevel(id)
    if (next && !this.data.unlocked.includes(next.id)) this.data.unlocked.push(next.id)
    this.write()
    return { bestMs: row.bestMs ?? ms, isBest, nextId: next?.id ?? null }
  }

  private ensure(id: string): LevelRecord {
    const existing = this.data.levels[id]
    if (existing) return existing
    const created = emptyLevel()
    this.data.levels[id] = created
    return created
  }

  private merge(id: string, coins: Iterable<string>, secrets: Iterable<string>, routes: Iterable<string>): LevelRecord {
    const row = this.ensure(id)
    row.coins = uniq([...row.coins, ...coins])
    row.secrets = uniq([...row.secrets, ...secrets])
    row.routes = uniq([...row.routes, ...routes])
    return row
  }

  private read(): SaveFile {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return fresh()
      const parsed = JSON.parse(raw) as Partial<SaveFile>
      if (parsed.v !== 1 || !parsed.settings) return fresh()
      const settings = parsed.settings
      return {
        v: 1,
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked.filter((id) => typeof id === 'string') : ['level-01'],
        levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
        settings: {
          master: clamp01(settings.master, 0.85),
          music: clamp01(settings.music, 0.45),
          sfx: clamp01(settings.sfx, 0.8),
          muted: Boolean(settings.muted),
          bindings: {
            left: cleanKeys(settings.bindings?.left, DEFAULT_BINDINGS.left),
            right: cleanKeys(settings.bindings?.right, DEFAULT_BINDINGS.right),
            jump: cleanKeys(settings.bindings?.jump, DEFAULT_BINDINGS.jump),
          },
        },
      }
    } catch {
      return fresh()
    }
  }

  private write(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      // Private mode and full storage both leave the session running unsaved.
    }
  }
}

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

function cleanKeys(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  const keys = value.filter((key) => typeof key === 'string' && key.length > 0)
  return keys.length > 0 ? keys : [...fallback]
}
