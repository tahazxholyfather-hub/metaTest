import type { SeasonDef, SeasonId, SeasonTheme } from './types'

const s = (
  id: SeasonId,
  theme: Omit<SeasonTheme, 'id' | 'cover' | 'background' | 'music' | 'bossMusic'>,
  extra: Partial<SeasonTheme> = {},
): SeasonTheme => ({
  id,
  cover: `assets/seasons/${id}-cover.png`,
  background: `assets/${id}/world-bg.png`,
  music: `music-${id}`,
  bossMusic: 'music-boss',
  ...theme,
  ...extra,
})

export const THEMES: Record<SeasonId, SeasonTheme> = {
  'season-1': s('season-1', {
    name: 'Verdant World',
    tagline: 'Learn to bounce',
    description: 'Sunlit groves, mossy stone and the first language of motion.',
    skyTop: 0x87c8d4,
    skyBot: 0x3d8b6e,
    solid: 0x2f6f4e,
    solidHi: 0x5dae74,
    accent: 0xd8f3dc,
    accent2: 0xffe08a,
    hazard: 0xc1121f,
    fog: 0x9ad1c0,
    parallax: [0x6db39a, 0x4e9a78, 0x2f6f4e],
  }),
  'season-2': s('season-2', {
    name: 'Industrial World',
    tagline: 'Machines never sleep',
    description: 'Conveyors, presses and a factory that wants you smaller.',
    skyTop: 0x3a3d45,
    skyBot: 0x1a1716,
    solid: 0x4a4643,
    solidHi: 0x7a736c,
    accent: 0xf4a261,
    accent2: 0xe76f51,
    hazard: 0xffd166,
    fog: 0x2b2d32,
    parallax: [0x5c5854, 0x3e3b39, 0x262422],
  }),
  'season-3': s('season-3', {
    name: 'Gravity World',
    tagline: 'Up is a suggestion',
    description: 'Weightless ruins, portals and a sky that folds in on itself.',
    skyTop: 0x14213d,
    skyBot: 0x070814,
    solid: 0x3a0ca3,
    solidHi: 0x4cc9f0,
    accent: 0x7209b7,
    accent2: 0x80ffdb,
    hazard: 0xf72585,
    fog: 0x1b1f3b,
    parallax: [0x3a0ca3, 0x4361ee, 0x4cc9f0],
  }),
  'season-4': s('season-4', {
    name: 'Bio World',
    tagline: 'You are very small',
    description: 'Membranes, toxins and a living maze that notices you.',
    skyTop: 0x3b0d21,
    skyBot: 0x14060d,
    solid: 0x9d4edd,
    solidHi: 0xff8fa3,
    accent: 0x80ffdb,
    accent2: 0xff4d6d,
    hazard: 0x7b2cbf,
    fog: 0x2a0f1c,
    parallax: [0x5a189a, 0x9d4edd, 0xff8fa3],
  }),
}

export const SEASONS: SeasonDef[] = [
  {
    id: 'season-1',
    index: 1,
    theme: THEMES['season-1'],
    unlock: { type: 'none' },
    levelCount: 11,
  },
  {
    id: 'season-2',
    index: 2,
    theme: THEMES['season-2'],
    unlock: { type: 'boss', seasonId: 'season-1' },
    levelCount: 11,
  },
  {
    id: 'season-3',
    index: 3,
    theme: THEMES['season-3'],
    unlock: { type: 'boss', seasonId: 'season-2' },
    levelCount: 11,
  },
  {
    id: 'season-4',
    index: 4,
    theme: THEMES['season-4'],
    unlock: { type: 'boss', seasonId: 'season-3' },
    levelCount: 11,
  },
]

export const seasonById = (id: SeasonId): SeasonDef => SEASONS.find((s) => s.id === id)!

export const levelId = (season: SeasonId, index: number): string => {
  const n = String(index).padStart(2, '0')
  return index === 11 ? `${season}-boss` : `${season}-${n}`
}
