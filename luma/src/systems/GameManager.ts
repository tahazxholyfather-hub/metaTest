import type { SeasonId } from '../core/types'
import { AudioManager } from './AudioManager'
import { InputManager } from './InputManager'
import { ProgressManager } from './ProgressManager'
import { SaveManager } from './SaveManager'

export class GameManager {
  readonly save = new SaveManager()
  readonly progress = new ProgressManager(this.save)
  readonly audio = new AudioManager()
  readonly input = new InputManager()
  currentLevelId = 'season-1-01'
  currentSeasonId: SeasonId = 'season-1'
  pendingSkipIntro = false

  constructor() {
    this.progress.applyUnlocks()
  }

  applyAudioSettings(): void {
    const s = this.save.snapshot().settings
    this.audio.setVolumes(s.master, s.music, s.sfx, s.muted)
  }
}

let instance: GameManager | null = null

export const gameManager = (): GameManager => {
  if (!instance) instance = new GameManager()
  return instance
}
