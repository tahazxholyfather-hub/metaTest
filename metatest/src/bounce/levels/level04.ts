import { createGrid, setTile, Tile } from '../tiles'
import { drop, feet, ground, platform, rise, seal } from '../levelBuild'
import type { LevelDef } from '../types'
import { checkpoint, coin, goal, mover, zone } from './helpers'

/** Tighter gaps and moving decks. Missing a hop drops you onto a road that climbs back. */
export function createLevel04(): LevelDef {
  const cols = 108
  const rows = 24
  const g = createGrid(cols, rows)
  const ridge = 9

  ground(g, 0, ridge, 18)
  const dive = drop(g, 18, ridge, 4, 'steep')
  const lane = dive.surface
  ground(g, dive.x, lane, 7)

  const gap = dive.x + 7
  const low = lane + 4
  for (let x = gap; x < gap + 2; x++) {
    for (let r = lane; r < low; r++) setTile(g, x, r, Tile.Empty)
  }
  ground(g, gap, low, 14)
  platform(g, gap + 2, lane, 10)
  const rejoin = rise(g, gap + 12, low, 4, 'gentle')
  ground(g, rejoin.x, rejoin.surface, 8)

  const road = rejoin.surface
  const second = rejoin.x + 8
  ground(g, second, road, 5)
  for (let x = second + 5; x < second + 8; x++) {
    for (let r = road; r < road + 3; r++) setTile(g, x, r, Tile.Empty)
  }
  ground(g, second + 5, road + 3, 3)
  ground(g, second + 8, road, 18)

  platform(g, second + 12, road - 3, 6)
  platform(g, second + 16, road - 5, 5)
  bouncePadLike(g, second + 20, road)

  seal(g)

  return {
    id: 'level-04',
    name: 'High Ridge',
    number: 4,
    theme: 'ridge',
    grid: g,
    spawn: feet(4, ridge),
    objects: [
      coin('l4-c1', 5, ridge),
      coin('l4-c2', 10, ridge),
      coin('l4-c3', 15, ridge),
      coin('l4-c4', dive.x + 1, lane, 0.9),
      coin('l4-c5', dive.x + 5, lane),
      coin('l4-c6', gap + 3, low, 0.75),
      coin('l4-c7', gap + 8, low, 0.75),
      coin('l4-c8', second + 2, road),
      coin('l4-c9', second + 13, road - 3, 0.8, true),
      coin('l4-c10', second + 17, road - 5, 0.85, true),
      coin('l4-c11', second + 21, road, 4.1, true),
      coin('l4-c12', second + 24, road),
      checkpoint('l4-cp1', dive.x + 2, lane),
      checkpoint('l4-cp2', gap + 4, low),
      checkpoint('l4-cp3', second + 10, road),
      mover('hazard', second + 1.2, road - 2.5, 0.8, 0.62, 'x', 2.4, 1.65, 0.5),
      mover('platform', second + 4.7, road, 2.5, 0.28, 'x', 1.15, 2.6, -Math.PI / 2),
      mover('hazard', second + 14, road - 4.4, 0.7, 0.55, 'y', 1.3, 1.9, 0.8),
      goal(second + 26, road),
      zone('l4-safe', gap + 1, low - 1, 8, 2, 'safe'),
      zone('l4-advanced', second + 12, road - 6, 8, 3, 'advanced'),
    ],
  }
}

function bouncePadLike(g: ReturnType<typeof createGrid>, x: number, surface: number): void {
  // Local import avoided; pad is placed by overwriting the surface tile.
  g.tiles[surface * g.cols + x] = Tile.Bounce
}
