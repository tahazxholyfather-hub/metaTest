import type { LevelDef, SeasonId } from '../../core/types'
import { season1Levels } from './season1'
import { season2Levels } from './season2'
import { season3Levels } from './season3'
import { season4Levels } from './season4'

const ALL: LevelDef[] = [
  ...season1Levels(),
  ...season2Levels(),
  ...season3Levels(),
  ...season4Levels(),
]

if (ALL.length !== 44) {
  throw new Error(`Expected 44 stages, found ${ALL.length}`)
}

const BY_ID = new Map(ALL.map((l) => [l.id, l]))

export function allLevels(): LevelDef[] {
  return ALL
}

export function getLevel(id: string): LevelDef {
  const aliased = id.replace(/-11$/, '-boss')
  const l = BY_ID.get(id) ?? BY_ID.get(aliased)
  if (!l) throw new Error(`Unknown level ${id}`)
  return l
}

export function levelsForSeason(seasonId: SeasonId): LevelDef[] {
  return ALL.filter((l) => l.seasonId === seasonId).sort((a, b) => a.index - b.index)
}

export function nextLevelId(id: string): string | null {
  const cur = getLevel(id)
  const list = levelsForSeason(cur.seasonId)
  const i = list.findIndex((l) => l.id === id)
  if (i >= 0 && i < list.length - 1) return list[i + 1]!.id
  const seasons: SeasonId[] = ['season-1', 'season-2', 'season-3', 'season-4']
  const si = seasons.indexOf(cur.seasonId)
  if (si >= 0 && si < seasons.length - 1) {
    const next = levelsForSeason(seasons[si + 1]!)
    return next[0]?.id ?? null
  }
  return null
}

export function firstLevelId(): string {
  return 'season-1-01'
}
