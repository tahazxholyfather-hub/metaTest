import { SEASONS } from '../core/seasons'
import type { LevelRecord, SaveData, SeasonId } from '../core/types'
import { EMPTY_RECORD } from '../core/types'
import { allLevels, getLevel, levelsForSeason, nextLevelId } from '../data/levels'
import type { SaveManager } from './SaveManager'

export class ProgressManager {
  constructor(private readonly save: SaveManager) {}

  record(id: string): LevelRecord {
    return this.save.snapshot().levels[id] ?? { ...EMPTY_RECORD }
  }

  isSeasonUnlocked(id: SeasonId): boolean {
    return this.save.snapshot().unlockedSeasons.includes(id)
  }

  isLevelUnlocked(id: string): boolean {
    return this.save.snapshot().unlockedLevels.includes(id)
  }

  seasonStars(id: SeasonId): number {
    return levelsForSeason(id).reduce((n, l) => n + this.record(l.id).stars, 0)
  }

  seasonCompleted(id: SeasonId): number {
    return levelsForSeason(id).filter((l) => this.record(l.id).completed).length
  }

  seasonBossBeaten(id: SeasonId): boolean {
    const boss = levelsForSeason(id).find((l) => l.kind === 'boss')
    return boss ? this.record(boss.id).completed : false
  }

  completionPercent(): number {
    const all = allLevels()
    const done = all.filter((l) => this.record(l.id).completed).length
    return Math.round((done / all.length) * 100)
  }

  totalStars(): number {
    return allLevels().reduce((n, l) => n + this.record(l.id).stars, 0)
  }

  applyUnlocks(): void {
    this.save.mutate((data) => {
      for (const season of SEASONS) {
        if (data.unlockedSeasons.includes(season.id)) continue
        const req = season.unlock
        if (req.type === 'none') data.unlockedSeasons.push(season.id)
        else if (req.type === 'boss' && req.seasonId && this.seasonBossBeaten(req.seasonId)) {
          data.unlockedSeasons.push(season.id)
        } else if (req.type === 'stars' && req.stars && this.totalStars() >= req.stars) {
          data.unlockedSeasons.push(season.id)
        }
      }
      for (const season of SEASONS) {
        if (!data.unlockedSeasons.includes(season.id)) continue
        const list = levelsForSeason(season.id)
        const first = list[0]
        if (first && !data.unlockedLevels.includes(first.id)) data.unlockedLevels.push(first.id)
        for (let i = 0; i < list.length - 1; i++) {
          const cur = list[i]!
          const nxt = list[i + 1]!
          if (this.record(cur.id).completed && !data.unlockedLevels.includes(nxt.id)) {
            data.unlockedLevels.push(nxt.id)
          }
        }
      }
    })
  }

  commitLevel(
    id: string,
    result: { score: number; time: number; deaths: number; stars: number; collectibles: number; secrets: number; secretIds: string[] },
  ): LevelRecord {
    let next: LevelRecord = { ...EMPTY_RECORD }
    this.save.mutate((data) => {
      const prev = data.levels[id] ?? { ...EMPTY_RECORD }
      next = {
        completed: true,
        stars: Math.max(prev.stars, result.stars),
        bestScore: Math.max(prev.bestScore, result.score),
        bestTime: prev.bestTime === 0 ? result.time : Math.min(prev.bestTime, result.time),
        deaths: prev.deaths + result.deaths,
        collectibles: Math.max(prev.collectibles, result.collectibles),
        secrets: Math.max(prev.secrets, result.secrets),
        secretIds: [...new Set([...prev.secretIds, ...result.secretIds])],
      }
      data.levels[id] = next
      const follow = nextLevelId(id)
      if (follow && !data.unlockedLevels.includes(follow)) data.unlockedLevels.push(follow)
      const season = getLevel(id).seasonId
      if (!data.unlockedSeasons.includes(season)) data.unlockedSeasons.push(season)
    })
    this.applyUnlocks()
    return next
  }

  dump(): SaveData {
    return this.save.snapshot()
  }
}
