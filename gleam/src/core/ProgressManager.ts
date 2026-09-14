import type { LevelDef, SeasonDef, UnlockRequirement } from './types'
import type { SaveManager } from './SaveManager'
import { SEASONS, getLevel, getSeason, nextLevel } from '../data/seasons'

export class ProgressManager {
  constructor(private save: SaveManager) {}

  isSeasonUnlocked(season: SeasonDef): boolean {
    if (this.save.isSeasonUnlocked(season.id)) return true
    return this.meets(season.unlock)
  }

  isLevelUnlocked(level: LevelDef): boolean {
    if (this.save.isLevelUnlocked(level.id)) return true
    const season = getSeason(level.seasonId)
    if (!season || !this.isSeasonUnlocked(season)) return false
    if (level.index === 1) return true
    if (level.isBoss) {
      return season.levels
        .filter((l) => !l.isBoss)
        .every((l) => this.save.getRecord(l.id)?.completed)
    }
    const prev = season.levels.find((l) => l.index === level.index - 1)
    return !!prev && !!this.save.getRecord(prev.id)?.completed
  }

  seasonProgress(season: SeasonDef): {
    completed: number
    total: number
    stars: number
    starMax: number
    secrets: number
    secretMax: number
    percent: number
    bossCleared: boolean
  } {
    const playable = season.levels
    let completed = 0
    let stars = 0
    let secrets = 0
    let secretMax = 0
    for (const l of playable) {
      const rec = this.save.getRecord(l.id)
      if (rec?.completed) completed += 1
      stars += rec?.stars ?? 0
      secrets += rec?.secrets ?? 0
      secretMax += l.collectibles.filter((c) => c.rarity === 'secret').length
    }
    const boss = playable.find((l) => l.isBoss)
    return {
      completed,
      total: playable.length,
      stars,
      starMax: playable.length * 3,
      secrets,
      secretMax,
      percent: playable.length ? Math.round((completed / playable.length) * 100) : 0,
      bossCleared: !!boss && !!this.save.getRecord(boss.id)?.completed,
    }
  }

  overallPercent(): number {
    const all = SEASONS.flatMap((s) => s.levels)
    const done = all.filter((l) => this.save.getRecord(l.id)?.completed).length
    return all.length ? Math.round((done / all.length) * 100) : 0
  }

  applyCompletion(level: LevelDef, stars: number): { unlockedNext: boolean; unlockedSeason?: string } {
    const nxt = nextLevel(level.id)
    let unlockedNext = false
    let unlockedSeason: string | undefined
    if (nxt) {
      this.save.unlockLevel(nxt.id)
      unlockedNext = true
      if (nxt.seasonId !== level.seasonId) {
        this.save.unlockSeason(nxt.seasonId)
        unlockedSeason = nxt.seasonId
      }
    }
    if (level.isBoss) {
      const season = getSeason(level.seasonId)
      if (season) {
        const following = SEASONS.find((s) => s.index === season.index + 1)
        if (following) {
          this.save.unlockSeason(following.id)
          const first = following.levels[0]
          if (first) this.save.unlockLevel(first.id)
          unlockedSeason = following.id
        }
      }
    }
    void stars
    this.syncUnlocks()
    return { unlockedNext, unlockedSeason }
  }

  syncUnlocks(): void {
    for (const season of SEASONS) {
      if (this.meets(season.unlock) || this.isSeasonUnlocked(season)) {
        this.save.unlockSeason(season.id)
      }
      for (const level of season.levels) {
        if (this.isLevelUnlocked(level)) this.save.unlockLevel(level.id)
      }
    }
  }

  starsFor(level: LevelDef): number {
    return this.save.getRecord(level.id)?.stars ?? 0
  }

  currentLevel(): LevelDef {
    const last = this.save.snapshot.lastPlayed
    if (last) {
      const l = getLevel(last.levelId)
      if (l) return l
    }
    for (const s of SEASONS) {
      for (const l of s.levels) {
        if (!this.save.getRecord(l.id)?.completed && this.isLevelUnlocked(l)) return l
      }
    }
    return SEASONS[0]!.levels[0]!
  }

  private meets(req: UnlockRequirement): boolean {
    switch (req.type) {
      case 'free':
        return true
      case 'season': {
        if (!req.seasonId) return false
        const s = getSeason(req.seasonId)
        if (!s) return false
        const boss = s.levels.find((l) => l.isBoss)
        const bossDown = boss ? !!this.save.getRecord(boss.id)?.completed : false
        if (bossDown) return true
        if (req.stars) {
          const stars = s.levels.reduce((n, l) => n + (this.save.getRecord(l.id)?.stars ?? 0), 0)
          return stars >= req.stars
        }
        return false
      }
      case 'stars':
        return this.save.snapshot.totals.stars >= (req.stars ?? 0)
      case 'level':
        return req.levelId ? !!this.save.getRecord(req.levelId)?.completed : false
      case 'boss': {
        if (!req.seasonId) return false
        const s = getSeason(req.seasonId)
        const boss = s?.levels.find((l) => l.isBoss)
        return !!boss && !!this.save.getRecord(boss.id)?.completed
      }
      case 'secrets': {
        let n = 0
        for (const rec of Object.values(this.save.snapshot.records)) n += rec.secrets
        return n >= (req.secrets ?? 0)
      }
      default:
        return false
    }
  }
}
