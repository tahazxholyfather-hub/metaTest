import type { DeepPartial, GameConfig } from './types'

export const DEFAULT_GAME_CONFIG: GameConfig = {
  drops: {
    dropIntervalMin: 22_000,
    dropIntervalMax: 48_000,
    dropLifetime: 60_000,
    maxActiveDrops: 2,
    announceLead: 8_000,
  },
  animation: {
    stepMs: 280,
    landingMs: 160,
    captureMs: 420,
    returnHomeMs: 720,
    collectMs: 520,
    diceSpinMs: 720,
  },
  ai: {
    preRollMs: 420,
    thinkMinMs: 380,
    thinkMaxMs: 820,
  },
}

export const FINISH_STEPS = 56
export const LAST_MAIN_STEP = 50
export const HOME_STRETCH_LENGTH = 5
export const TOKENS_PER_PLAYER = 4
export const BOARD_SIZE = 15
export const MAIN_PATH_LENGTH = 52
export const ARM_SPACING = 13
export const MAX_CONSECUTIVE_SIXES = 3

export function mergeConfig(overrides?: DeepPartial<GameConfig>): GameConfig {
  if (!overrides) return { ...DEFAULT_GAME_CONFIG, drops: { ...DEFAULT_GAME_CONFIG.drops }, animation: { ...DEFAULT_GAME_CONFIG.animation }, ai: { ...DEFAULT_GAME_CONFIG.ai } }
  return {
    drops: { ...DEFAULT_GAME_CONFIG.drops, ...overrides.drops },
    animation: { ...DEFAULT_GAME_CONFIG.animation, ...overrides.animation },
    ai: { ...DEFAULT_GAME_CONFIG.ai, ...overrides.ai },
  }
}

export const REDUCED_MOTION_CONFIG: DeepPartial<GameConfig> = {
  animation: {
    stepMs: 90,
    landingMs: 40,
    captureMs: 140,
    returnHomeMs: 220,
    collectMs: 160,
    diceSpinMs: 180,
  },
  ai: {
    preRollMs: 180,
    thinkMinMs: 160,
    thinkMaxMs: 280,
  },
}
