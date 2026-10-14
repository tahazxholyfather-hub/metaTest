import { TILE } from './config'

export const Tile = {
  Empty: 0,
  Solid: 1,
  SlopeR: 2,
  SlopeL: 3,
  GentleRLow: 4,
  GentleRHigh: 5,
  GentleLHigh: 6,
  GentleLLow: 7,
  OneWay: 8,
  SpikeU: 9,
  SpikeD: 10,
  SpikeL: 11,
  SpikeR: 12,
  Water: 13,
  Bounce: 14,
} as const

export type TileId = (typeof Tile)[keyof typeof Tile]

export interface Grid {
  cols: number
  rows: number
  tiles: Uint8Array
}

export function createGrid(cols: number, rows: number): Grid {
  return { cols, rows, tiles: new Uint8Array(cols * rows) }
}

export function inGrid(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.cols && y < g.rows
}

export function setTile(g: Grid, x: number, y: number, tile: TileId): void {
  if (!inGrid(g, x, y)) return
  g.tiles[y * g.cols + x] = tile
}

/** Out of bounds left/right/below reads as solid so the ball cannot escape the map. */
export function getTile(g: Grid, x: number, y: number): TileId {
  if (y < 0) return Tile.Empty
  if (!inGrid(g, x, y)) return Tile.Solid
  return g.tiles[y * g.cols + x] as TileId
}

export function isFullSolid(id: TileId): boolean {
  return id === Tile.Solid || id === Tile.Bounce
}

export function isSlope(id: TileId): boolean {
  return (
    id === Tile.SlopeR ||
    id === Tile.SlopeL ||
    id === Tile.GentleRLow ||
    id === Tile.GentleRHigh ||
    id === Tile.GentleLHigh ||
    id === Tile.GentleLLow
  )
}

export function isSpike(id: TileId): boolean {
  return id === Tile.SpikeU || id === Tile.SpikeD || id === Tile.SpikeL || id === Tile.SpikeR
}

export interface Segment {
  x0: number
  y0: number
  x1: number
  y1: number
  nx: number
  ny: number
}

/** Walkable surface of a slope tile. Normal points toward the air (upward). */
export function slopeSegment(id: TileId, tx: number, ty: number): Segment | null {
  const x = tx * TILE
  const y = ty * TILE
  const s = TILE
  let x0 = 0
  let y0 = 0
  let x1 = 0
  let y1 = 0
  switch (id) {
    case Tile.SlopeR:
      x0 = x
      y0 = y + s
      x1 = x + s
      y1 = y
      break
    case Tile.SlopeL:
      x0 = x
      y0 = y
      x1 = x + s
      y1 = y + s
      break
    case Tile.GentleRLow:
      x0 = x
      y0 = y + s
      x1 = x + s
      y1 = y + s * 0.5
      break
    case Tile.GentleRHigh:
      x0 = x
      y0 = y + s * 0.5
      x1 = x + s
      y1 = y
      break
    case Tile.GentleLHigh:
      x0 = x
      y0 = y
      x1 = x + s
      y1 = y + s * 0.5
      break
    case Tile.GentleLLow:
      x0 = x
      y0 = y + s * 0.5
      x1 = x + s
      y1 = y + s
      break
    default:
      return null
  }
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  let nx = -dy / len
  let ny = dx / len
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }
  return { x0, y0, x1, y1, nx, ny }
}

const CHAR_TO_TILE: Record<string, TileId> = {
  '.': Tile.Empty,
  ' ': Tile.Empty,
  '#': Tile.Solid,
  '/': Tile.SlopeR,
  '\\': Tile.SlopeL,
  r: Tile.GentleRLow,
  R: Tile.GentleRHigh,
  L: Tile.GentleLHigh,
  l: Tile.GentleLLow,
  '=': Tile.OneWay,
  '^': Tile.SpikeU,
  v: Tile.SpikeD,
  '<': Tile.SpikeL,
  '>': Tile.SpikeR,
  '~': Tile.Water,
  B: Tile.Bounce,
}

export function parseMap(raw: string): Grid {
  let lines = raw.replace(/\r/g, '').split('\n')
  if (lines[0]?.trim() === '') lines = lines.slice(1)
  if (lines[lines.length - 1]?.trim() === '') lines = lines.slice(0, -1)
  if (lines.length === 0) throw new Error('Empty level map')
  const cols = lines[0].length
  const rows = lines.length
  const grid = createGrid(cols, rows)
  for (let y = 0; y < rows; y++) {
    const line = lines[y]
    if (line.length !== cols) {
      throw new Error(`Map row ${y} is ${line.length} chars, expected ${cols}`)
    }
    for (let x = 0; x < cols; x++) {
      const ch = line[x]
      const tile = CHAR_TO_TILE[ch]
      if (tile === undefined) throw new Error(`Unknown tile "${ch}" at ${x},${y}`)
      grid.tiles[y * cols + x] = tile
    }
  }
  return grid
}
