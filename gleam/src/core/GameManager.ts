import type { AudioManager } from './AudioManager'
import type { InputManager } from './InputManager'
import type { ProgressManager } from './ProgressManager'
import type { SaveManager } from './SaveManager'
import type { LevelDef, SeasonDef } from './types'
import { getSeason } from '../data/seasons'

export class GameManager {
  constructor(
    readonly save: SaveManager,
    readonly progress: ProgressManager,
    readonly audio: AudioManager,
    readonly input: InputManager,
  ) {}

  seasonOf(level: LevelDef): SeasonDef {
    return getSeason(level.seasonId)!
  }
}
