import { createGrid, setTile, Tile } from '../tiles'
import { bouncePad, drop, feet, ground, platform, pool, rise, seal } from '../levelBuild'
import type { LevelDef } from '../types'
import { checkpoint, coin, gate, goal, mover, sw, zone } from './helpers'

/** The last road: a fast drop, a tower, a wade, and the closing gate. */
export function createLevel05(): LevelDef {
  const cols = 116
  const rows = 30
  const g = createGrid(cols, rows)
  const crown = 8

  ground(g, 0, crown, 12)
  const rush = drop(g, 12, crown, 4, 'steep')
  const lane = rush.surface
  ground(g, rush.x, lane, 6)

  const gap = rush.x + 6
  const low = lane + 4
  for (let x = gap; x < gap + 2; x++) {
    for (let r = lane; r < low; r++) setTile(g, x, r, Tile.Empty)
  }
  ground(g, gap, low, 12)
  platform(g, gap + 2, lane, 8)
  const up = rise(g, gap + 10, low, 4, 'gentle')
  ground(g, up.x, up.surface, 28)

  const road = up.surface
  const pads = up.x + 4
  bouncePad(g, pads, road, 1)
  bouncePad(g, pads + 6, road, 1)
  pool(g, pads + 12, road, 8, 2)

  const tower = pads + 24
  ground(g, pads + 20, road, 8)
  platform(g, tower, road - 2, 8)
  platform(g, tower + 1, road - 4, 8)
  platform(g, tower, road - 6, 8)
  platform(g, tower + 1, road - 8, 8)
  platform(g, tower, road - 10, 8)
  const sky = road - 10
  ground(g, tower + 8, sky, 22)
  platform(g, tower + 10, sky - 3, 7)
  bouncePad(g, tower + 16, sky, 1)

  const last = tower + 20
  seal(g)

  return {
    id: 'level-05',
    name: 'Last Light',
    number: 5,
    theme: 'dusk',
    grid: g,
    spawn: feet(3, crown),
    objects: [
      coin('l5-c1', 4, crown),
      coin('l5-c2', 8, crown),
      coin('l5-c3', rush.x - 2, crown, 1),
      coin('l5-c4', rush.x + 2, lane),
      coin('l5-c5', gap + 1, low, 0.75),
      coin('l5-c6', gap + 6, low, 0.75),
      coin('l5-c7', up.x + 2, road),
      coin('l5-c8', pads + 1, road, 4.3, true),
      coin('l5-c9', pads + 7, road, 4.2, true),
      coin('l5-c10', pads + 14, road, 1.45),
      coin('l5-c11', pads + 18, road, 1.45),
      coin('l5-c12', tower + 2, road - 2, 0.75),
      coin('l5-c13', tower + 4, road - 4, 0.75),
      coin('l5-c14', tower + 2, road - 6, 0.75),
      coin('l5-c15', tower + 3, road - 8, 0.75),
      coin('l5-c16', tower + 2, sky, 0.8),
      coin('l5-c17', tower + 12, sky - 3, 0.8, true),
      coin('l5-c18', tower + 15, sky - 3, 0.8, true),
      coin('l5-c19', last + 2, sky),
      coin('l5-c20', last + 6, sky),
      checkpoint('l5-cp1', rush.x + 1, lane),
      checkpoint('l5-cp2', gap + 4, low),
      checkpoint('l5-cp3', pads + 10, road),
      checkpoint('l5-cp4', tower + 9, sky),
      mover('platform', tower + 2.4, road - 5.2, 2.2, 0.28, 'y', 1.4, 3.2, 0.4),
      mover('hazard', last + 1, sky - 2.3, 0.9, 0.58, 'x', 2, 1.75, 0.3),
      sw('l5-sw', last + 4, sky, ['l5-gate']),
      gate('l5-gate', last + 8, sky, 3),
      goal(last + 12, sky),
      zone('l5-speed', rush.x - 1, rush.surface - 1, 6, 2, 'speed'),
      zone('l5-secret', tower + 10, sky - 4, 7, 2, 'secret', true),
      zone('l5-tower', tower, sky, 8, 10, 'tower'),
    ],
  }
}
