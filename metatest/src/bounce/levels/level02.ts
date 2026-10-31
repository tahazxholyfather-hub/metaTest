import { createGrid, setTile, Tile } from '../tiles'
import { bouncePad, drop, feet, ground, platform, rise, seal } from '../levelBuild'
import type { LevelDef } from '../types'
import { checkpoint, coin, goal, mover, zone } from './helpers'

/** Momentum. Keep the downhill speed, or take the lower road and climb back. */
export function createLevel02(): LevelDef {
  const cols = 104
  const rows = 28
  const g = createGrid(cols, rows)
  const top = 8

  ground(g, 0, top, 14)
  const glide = drop(g, 14, top, 3, 'gentle')
  const dive = drop(g, glide.x, glide.surface, 3, 'steep')
  const lane = dive.surface
  ground(g, dive.x, lane, 8)

  const gap = dive.x + 8
  const low = lane + 5
  for (let x = gap; x < gap + 2; x++) {
    for (let r = lane; r < low; r++) setTile(g, x, r, Tile.Empty)
  }
  ground(g, gap, low, 2)

  // Upper landing is a bridge. The lower road stays open underneath and rejoins.
  platform(g, gap + 2, lane, 12)
  ground(g, gap, low, 20)
  const back = rise(g, gap + 16, low, 5, 'gentle')
  ground(g, back.x, back.surface, 10)

  const road = back.surface
  const hop = back.x + 10
  ground(g, hop, road, 6)
  for (let x = hop + 6; x < hop + 10; x++) {
    for (let r = road; r < rows - 1; r++) setTile(g, x, r, Tile.Empty)
  }
  ground(g, hop + 10, road, 16)
  platform(g, hop + 6, road, 4)
  bouncePad(g, hop + 14, road, 1)

  const shaft = hop + 18
  platform(g, shaft, road - 2, 8)
  platform(g, shaft + 1, road - 4, 8)
  platform(g, shaft, road - 6, 8)
  platform(g, shaft + 1, road - 8, 8)

  seal(g)

  return {
    id: 'level-02',
    name: 'Long Way Down',
    number: 2,
    theme: 'canyon',
    grid: g,
    spawn: feet(3, top),
    objects: [
      coin('l2-c1', 4, top),
      coin('l2-c2', 9, top),
      coin('l2-c3', 16, top, 1.1),
      coin('l2-c4', glide.x + 1, glide.surface, 0.9),
      coin('l2-c5', dive.x + 2, lane),
      coin('l2-c6', dive.x + 6, lane),
      coin('l2-c7', gap, lane, 1.8, true),
      coin('l2-c8', gap + 4, low, 0.75),
      coin('l2-c9', gap + 9, low, 0.75),
      coin('l2-c10', gap + 14, low, 0.8),
      coin('l2-c11', hop + 2, road),
      coin('l2-c12', hop + 7, road, 2.2, true),
      coin('l2-c13', hop + 15, road, 4.2, true),
      coin('l2-c14', shaft + 2, road - 2, 0.75),
      coin('l2-c15', shaft + 4, road - 5, 0.75),
      coin('l2-c16', shaft + 3, road - 8, 0.8),
      checkpoint('l2-cp1', dive.x + 2, lane),
      checkpoint('l2-cp2', gap + 6, low),
      checkpoint('l2-cp3', hop + 12, road),
      mover('platform', hop + 5.6, road - 3.1, 2.4, 0.28, 'x', 1.6, 3.3, 0.2),
      goal(shaft + 3, road - 8),
      zone('l2-advanced', gap - 1, lane - 2, 4, 2, 'advanced'),
      zone('l2-safe', gap + 2, low - 1, 8, 2, 'safe'),
    ],
  }
}
