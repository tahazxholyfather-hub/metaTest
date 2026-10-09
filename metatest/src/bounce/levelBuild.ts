import { BALL_R, TILE } from './config'
import { setTile, Tile, type Grid, type TileId } from './tiles'

/** Fill a column range with solid ground from `surface` down to the bottom of the map. */
export function ground(g: Grid, x: number, surface: number, w: number): void {
  for (let i = 0; i < w; i++) {
    for (let r = surface; r < g.rows; r++) setTile(g, x + i, r, Tile.Solid)
  }
}

export function fill(g: Grid, x: number, y: number, w: number, h: number, tile: TileId): void {
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) setTile(g, x + ix, y + iy, tile)
  }
}

export function carve(g: Grid, x: number, y: number, w: number, h: number): void {
  fill(g, x, y, w, h, Tile.Empty)
}

/**
 * Open a pit in the ground. Spikes sit `depth` tiles below the old surface
 * so the fall is readable and the respawn is quick.
 */
export function pit(g: Grid, x: number, surface: number, w: number, depth = 4): void {
  const spikeRow = Math.min(g.rows - 2, surface + depth)
  for (let i = 0; i < w; i++) {
    for (let r = surface; r < g.rows; r++) setTile(g, x + i, r, Tile.Empty)
    setTile(g, x + i, spikeRow, Tile.SpikeU)
    for (let r = spikeRow + 1; r < g.rows; r++) setTile(g, x + i, r, Tile.Solid)
  }
}

export function platform(g: Grid, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i++) setTile(g, x + i, y, Tile.OneWay)
}

export function spikeUp(g: Grid, x: number, surface: number, w = 1): void {
  for (let i = 0; i < w; i++) setTile(g, x + i, surface - 1, Tile.SpikeU)
}

export function spikeDown(g: Grid, x: number, y: number, w = 1): void {
  for (let i = 0; i < w; i++) setTile(g, x + i, y, Tile.SpikeD)
}

export function bouncePad(g: Grid, x: number, surface: number, w = 1): void {
  for (let i = 0; i < w; i++) {
    setTile(g, x + i, surface, Tile.Bounce)
    for (let r = surface + 1; r < g.rows; r++) setTile(g, x + i, r, Tile.Solid)
  }
}

export function pool(g: Grid, x: number, surface: number, w: number, depth: number): void {
  for (let i = 0; i < w; i++) {
    for (let d = 0; d < depth; d++) setTile(g, x + i, surface - 1 - d, Tile.Water)
  }
}

export interface SurfaceCursor {
  x: number
  surface: number
}

/**
 * Ramp that climbs to the right.
 * `steps` is how many tiles of height are gained.
 * Gentle ramps travel two columns per step.
 */
export function rise(g: Grid, x: number, surface: number, steps: number, style: 'gentle' | 'steep'): SurfaceCursor {
  let cx = x
  let s = surface
  if (style === 'steep') {
    for (let i = 0; i < steps; i++) {
      setTile(g, cx, s - 1, Tile.SlopeR)
      for (let r = s; r < g.rows; r++) setTile(g, cx, r, Tile.Solid)
      cx += 1
      s -= 1
    }
  } else {
    for (let i = 0; i < steps; i++) {
      setTile(g, cx, s - 1, Tile.GentleRLow)
      setTile(g, cx + 1, s - 1, Tile.GentleRHigh)
      for (let r = s; r < g.rows; r++) {
        setTile(g, cx, r, Tile.Solid)
        setTile(g, cx + 1, r, Tile.Solid)
      }
      cx += 2
      s -= 1
    }
  }
  return { x: cx, surface: s }
}

/** Ramp that descends to the right. */
export function drop(g: Grid, x: number, surface: number, steps: number, style: 'gentle' | 'steep'): SurfaceCursor {
  let cx = x
  let s = surface
  if (style === 'steep') {
    for (let i = 0; i < steps; i++) {
      setTile(g, cx, s, Tile.SlopeL)
      for (let r = s + 1; r < g.rows; r++) setTile(g, cx, r, Tile.Solid)
      cx += 1
      s += 1
    }
  } else {
    for (let i = 0; i < steps; i++) {
      setTile(g, cx, s, Tile.GentleLHigh)
      setTile(g, cx + 1, s, Tile.GentleLLow)
      for (let r = s + 1; r < g.rows; r++) {
        setTile(g, cx, r, Tile.Solid)
        setTile(g, cx + 1, r, Tile.Solid)
      }
      cx += 2
      s += 1
    }
  }
  return { x: cx, surface: s }
}

export function seal(g: Grid): void {
  for (let y = 0; y < g.rows; y++) {
    setTile(g, 0, y, Tile.Solid)
    setTile(g, g.cols - 1, y, Tile.Solid)
  }
  for (let x = 0; x < g.cols; x++) {
    if (g.tiles[(g.rows - 1) * g.cols + x] === Tile.Empty) setTile(g, x, g.rows - 1, Tile.Solid)
  }
}

/** Ball center that rests on the top of a solid row. */
export function feet(col: number, surface: number): { x: number; y: number } {
  return { x: (col + 0.5) * TILE, y: surface * TILE - BALL_R - 0.25 }
}

export function px(tile: number): number {
  return tile * TILE
}
