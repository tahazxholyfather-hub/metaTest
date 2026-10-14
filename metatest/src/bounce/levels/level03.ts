import { createGrid, setTile, Tile } from '../tiles'
import { bouncePad, carve, feet, ground, platform, pool, rise, seal } from '../levelBuild'
import type { LevelDef } from '../types'
import { checkpoint, coin, gate, goal, sw, zone } from './helpers'

/** Exploration. The road is obvious; water, a loft, and a switch hide the rest. */
export function createLevel03(): LevelDef {
  const cols = 96
  const rows = 24
  const g = createGrid(cols, rows)
  const road = 16

  ground(g, 0, road, cols)

  // Left secret loft, above the spawn, reached by a bounce pad set off the road.
  platform(g, 3, road - 5, 5)
  platform(g, 4, road - 7, 3)
  bouncePad(g, 2, road, 1)

  // Sunken pool on the main road. The floor stays, so it is a wade, not a trap.
  for (let x = 18; x < 28; x++) {
    for (let r = road - 2; r < road; r++) setTile(g, x, r, Tile.Empty)
  }
  pool(g, 18, road, 10, 2)

  // Side channel under the road, entered from the pool and exited by a slope.
  carve(g, 20, road + 1, 14, 3)
  for (let x = 20; x < 34; x++) pool(g, x, road + 4, 1, 3)
  const exit = rise(g, 34, road + 4, 4, 'gentle')
  // Rejoin the road surface if the rise lands on it.
  if (exit.surface < road) ground(g, exit.x, exit.surface, road - exit.surface)

  // Upper galleries.
  platform(g, 40, road - 3, 7)
  platform(g, 48, road - 5, 6)
  platform(g, 56, road - 3, 5)
  platform(g, 62, road - 6, 4)

  // A gate on the road, switch living up on the gallery.
  seal(g)

  const objects = [
    coin('l3-c1', 6, road),
    coin('l3-c2', 10, road),
    coin('l3-c3', 4, road - 5, 0.8, true),
    coin('l3-c4', 5, road - 7, 0.85, true),
    coin('l3-c5', 20, road, 1.3),
    coin('l3-c6', 24, road, 1.5),
    coin('l3-c7', 23, road + 3, 0.7, true),
    coin('l3-c8', 28, road + 3, 0.7, true),
    coin('l3-c9', 32, road + 3, 0.7, true),
    coin('l3-c10', 42, road - 3, 0.75),
    coin('l3-c11', 50, road - 5, 0.8, true),
    coin('l3-c12', 58, road - 3, 0.75),
    coin('l3-c13', 64, road - 6, 0.8, true),
    coin('l3-c14', 70, road),
    coin('l3-c15', 76, road),
    coin('l3-c16', 82, road),
    checkpoint('l3-cp1', 16, road),
    checkpoint('l3-cp2', 46, road),
    sw('l3-loft', 63, road - 6, ['l3-gate']),
    sw('l3-road', 72, road, ['l3-gate']),
    gate('l3-gate', 78, road, 3),
    goal(86, road),
    zone('l3-loft', 3, road - 8, 6, 4, 'secret', true),
    zone('l3-channel', 20, road + 1, 12, 3, 'secret', true),
    zone('l3-gallery', 48, road - 6, 8, 2, 'upper'),
  ]

  return {
    id: 'level-03',
    name: 'Hidden Cove',
    number: 3,
    theme: 'cove',
    grid: g,
    spawn: feet(8, road),
    objects,
  }
}
