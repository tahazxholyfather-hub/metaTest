import type { AICharacterState } from '../components/met/character'
import { PHYS } from './config'
import { clamp } from './math'
import type { PlayerBody } from './Simulation'

/** Map ball motion onto Met's existing eye states. The face never spins. */
export function metExpression(player: PlayerBody, finished: boolean): AICharacterState {
  if (!player.alive) return 'sad'
  if (finished) return 'excited'
  if (player.checkpointFlash > 0.05) return 'happy'
  if (player.bounced > 0.02) return 'excited'
  if (player.landed > 0.02) return 'happy'
  if (!player.grounded) {
    if (player.inWater) return 'curious'
    if (player.vy < -120) return 'surprised'
    if (player.vy > 180) return 'shocked'
    return 'curious'
  }
  if (Math.abs(player.vx) > PHYS.maxRun * 0.82) return 'excited'
  if (Math.abs(player.vx) > 36) return 'curious'
  return 'idle'
}

export function metGaze(player: PlayerBody): { x: number; y: number } {
  return {
    x: clamp(player.facing * 0.22 + player.vx / 900, -0.75, 0.75),
    y: clamp(player.grounded ? 0.08 : player.vy / 1600, -0.45, 0.65),
  }
}
