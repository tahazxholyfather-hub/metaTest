import { createGrid } from '../tiles'
import { bouncePad, drop, feet, ground, pit, platform, rise, seal } from '../levelBuild'
import type { LevelDef } from '../types'
import { checkpoint, coin, gate, goal, sw, zone } from './helpers'

/** Meadow introduction. Movement, a slope, a hop, a spike, a bounce, a gate. */
export function createLevel01(): LevelDef {
  const cols = 86
  const rows = 18
  const g = createGrid(cols, rows)
  const s0 = 13

  ground(g, 0, s0, 18)
  const lowered = drop(g, 18, s0, 2, 'gentle')
  const low = lowered.surface
  ground(g, lowered.x, low, 10)
  pit(g, 32, low, 1, 3)
  ground(g, 33, low, 12)
  const climbed = rise(g, 45, low, 2, 'gentle')
  const high = climbed.surface
  ground(g, climbed.x, high, 28)
  bouncePad(g, 52, high, 1)
  pit(g, 60, high, 2, 3)
  seal(g)

  // A low hop the player can choose to take. Two tiles up from the sunken lane.
  platform(g, 24, low - 2, 4)

  const objects = [
    coin('l1-c1', 5, s0),
    coin('l1-c2', 8, s0),
    coin('l1-c3', 12, s0),
    coin('l1-c4', 20, low, 0.9),
    coin('l1-c5', 26, low - 2, 0.85),
    coin('l1-c6', 27, low - 2, 1.7, true),
    coin('l1-c7', 36, low),
    coin('l1-c8', 41, low),
    coin('l1-c9', 48, high),
    coin('l1-c10', 54, high, 4.35, true),
    coin('l1-c11', 57, high),
    coin('l1-c12', 66, high),
    checkpoint('l1-cp', 35, low),
    sw('l1-sw', 64, high, ['l1-gate']),
    gate('l1-gate', 68, high, 3),
    goal(74, high),
    zone('l1-secret', 24, low - 3, 4, 2, 'secret', true),
    zone('l1-bounce', 51, high - 5, 4, 4, 'bounce'),
  ]

  return {
    id: 'level-01',
    name: 'First Bounce',
    number: 1,
    theme: 'meadow',
    grid: g,
    spawn: feet(3, s0),
    objects,
  }
}
