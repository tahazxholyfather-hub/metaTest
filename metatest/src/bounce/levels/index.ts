import type { LevelDef, ThemeId } from '../types'
import { createLevel01 } from './level01'
import { createLevel02 } from './level02'
import { createLevel03 } from './level03'
import { createLevel04 } from './level04'
import { createLevel05 } from './level05'

export const LEVELS: readonly LevelDef[] = [
  createLevel01(),
  createLevel02(),
  createLevel03(),
  createLevel04(),
  createLevel05(),
]

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((level) => level.id === id)
}

export function nextLevel(id: string): LevelDef | undefined {
  const index = LEVELS.findIndex((level) => level.id === id)
  if (index < 0) return undefined
  return LEVELS[index + 1]
}

export interface LevelSummary {
  id: string
  name: string
  number: number
  theme: ThemeId
  coins: number
}

export function levelSummaries(): LevelSummary[] {
  return LEVELS.map((level) => ({
    id: level.id,
    name: level.name,
    number: level.number,
    theme: level.theme,
    coins: level.objects.reduce((n, obj) => n + (obj.kind === 'coin' ? 1 : 0), 0),
  }))
}
