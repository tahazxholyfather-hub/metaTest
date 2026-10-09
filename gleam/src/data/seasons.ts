import type { SeasonDef } from '../core/types'
import { THEMES } from './themes'
import { ASSETS } from '../core/AssetManifest'
import { SEASON_1_LEVELS } from './levels/season1'
import { SEASON_2_LEVELS } from './levels/season2'
import { SEASON_3_LEVELS } from './levels/season3'
import { SEASON_4_LEVELS } from './levels/season4'

export const SEASONS: SeasonDef[] = [
  {
    id: 'season-1',
    index: 1,
    name: 'Verdant World',
    shortName: 'Verdant',
    description: 'Soft hills, loud insects, and the first honest bounce. Learn to move without being taught.',
    cover: ASSETS.seasons['season-1']!,
    background: ASSETS.backgrounds['season-1'],
    theme: THEMES.verdant,
    music: { world: 's1', boss: 'boss1' },
    unlock: { type: 'free' },
    levels: SEASON_1_LEVELS,
  },
  {
    id: 'season-2',
    index: 2,
    name: 'Industrial World',
    shortName: 'Industrial',
    description: 'Belts, presses, and light that cuts. The factory is still running. You are not on the roster.',
    cover: ASSETS.seasons['season-2']!,
    background: ASSETS.backgrounds['season-2'],
    theme: THEMES.industrial,
    music: { world: 's2', boss: 'boss2' },
    unlock: { type: 'season', seasonId: 'season-1', stars: 18 },
    levels: SEASON_2_LEVELS,
  },
  {
    id: 'season-3',
    index: 3,
    name: 'Gravity World',
    shortName: 'Gravity',
    description: 'A quiet cosmos that changes the rules mid-jump. Portals remember. Floors forget.',
    cover: ASSETS.seasons['season-3']!,
    background: ASSETS.backgrounds['season-3'],
    theme: THEMES.gravity,
    music: { world: 's3', boss: 'boss3' },
    unlock: { type: 'season', seasonId: 'season-2', stars: 18 },
    levels: SEASON_3_LEVELS,
  },
  {
    id: 'season-4',
    index: 4,
    name: 'Bio World',
    shortName: 'Bio',
    description: 'Inside something alive. Membranes cling. Toxins bloom. The finale has a pulse.',
    cover: ASSETS.seasons['season-4']!,
    background: ASSETS.backgrounds['season-4'],
    theme: THEMES.bio,
    music: { world: 's4', boss: 'boss4' },
    unlock: { type: 'season', seasonId: 'season-3', stars: 18 },
    levels: SEASON_4_LEVELS,
  },
]

export function getSeason(id: string): SeasonDef | undefined {
  return SEASONS.find((s) => s.id === id)
}

export function getLevel(id: string) {
  for (const s of SEASONS) {
    const l = s.levels.find((x) => x.id === id)
    if (l) return l
  }
  return undefined
}

export function nextLevel(id: string) {
  const all = SEASONS.flatMap((s) => s.levels)
  const i = all.findIndex((l) => l.id === id)
  if (i < 0) return undefined
  return all[i + 1]
}

export function prevLevel(id: string) {
  const all = SEASONS.flatMap((s) => s.levels)
  const i = all.findIndex((l) => l.id === id)
  if (i <= 0) return undefined
  return all[i - 1]
}

export const LEVEL_COUNT = SEASONS.reduce((n, s) => n + s.levels.length, 0)

if (SEASONS.some((s) => s.levels.length !== 11)) {
  throw new Error('Each season must contain 10 stages plus a boss.')
}
