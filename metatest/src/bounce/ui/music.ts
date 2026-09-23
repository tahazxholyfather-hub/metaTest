import type { MusicId } from '../audio'
import { getLevel } from '../levels'
import type { Phase } from '../session'

export function musicFor(phase: Phase, levelId: string | null): MusicId | null {
  if (phase === 'ROTATE_DEVICE') return null
  if (phase === 'LOADING' || phase === 'PLAYING' || phase === 'PAUSED' || phase === 'GAME_OVER' || phase === 'LEVEL_COMPLETE') {
    return getLevel(levelId ?? '')?.theme ?? 'menu'
  }
  return 'menu'
}
