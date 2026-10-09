import { TILE } from './config'
import { clamp } from './math'
import { getTile, isFullSolid, isSpike, slopeSegment, Tile, type Grid, type TileId } from './tiles'
import type { FloorHit, Rect } from './types'

export interface DynRect extends Rect {
  bounce?: boolean
  platform: number
  oneWay: boolean
}

export function circleVsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const px = clamp(cx, rect.x, rect.x + rect.w)
  const py = clamp(cy, rect.y, rect.y + rect.h)
  const dx = cx - px
  const dy = cy - py
  return dx * dx + dy * dy <= r * r
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h
}

function signedSegment(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number, nx: number, ny: number): number | null {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  if (len2 < 1) return null
  const t = ((cx - x0) * dx + (cy - y0) * dy) / len2
  if (t < -0.04 || t > 1.04) return null
  return (cx - x0) * nx + (cy - y0) * ny
}

export interface ProbeBody {
  x: number
  y: number
  r: number
}

/**
 * Highest walkable surface under the ball, within `maxDown` pixels below the
 * current center. Used to stick to slopes and floors.
 */
export function probeFloor(
  grid: Grid,
  body: ProbeBody,
  maxDown: number,
  extras: DynRect[] = [],
  inset = 6,
): FloorHit | null {
  const { x, y, r } = body
  const minTx = Math.floor((x - r - 2) / TILE) - 1
  const maxTx = Math.floor((x + r + 2) / TILE) + 1
  const minTy = Math.floor((y - r) / TILE) - 1
  const maxTy = Math.floor((y + r + maxDown) / TILE) + 1
  let best: FloorHit | null = null

  const consider = (hit: FloorHit | null) => {
    if (!hit) return
    if (hit.dy < -body.r || hit.dy > maxDown) return
    if (!best || hit.dy < best.dy) best = hit
  }

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const id = getTile(grid, tx, ty)
      consider(floorFromTile(id, tx, ty, x, y, r, inset))
    }
  }

  for (let i = 0; i < extras.length; i++) {
    const rect = extras[i]
    if (!rect.oneWay && !rect.bounce) continue
    if (x <= rect.x + inset || x >= rect.x + rect.w - inset) continue
    const restY = rect.y - r
    consider({
      x,
      y: restY,
      nx: 0,
      ny: -1,
      dy: restY - y,
      bounce: Boolean(rect.bounce),
      platform: rect.platform,
    })
  }

  return best
}

function floorFromTile(id: TileId, tx: number, ty: number, x: number, y: number, r: number, inset: number): FloorHit | null {
  const left = tx * TILE
  const top = ty * TILE
  if (isFullSolid(id) || id === Tile.OneWay) {
    if (x <= left + inset || x >= left + TILE - inset) return null
    const restY = top - r
    return {
      x,
      y: restY,
      nx: 0,
      ny: -1,
      dy: restY - y,
      bounce: id === Tile.Bounce,
      platform: -1,
    }
  }
  const seg = slopeSegment(id, tx, ty)
  if (!seg) return null
  const dx = seg.x1 - seg.x0
  if (Math.abs(dx) < 1) return null
  const t = (x - seg.x0 - seg.nx * r) / dx
  if (t < -0.02 || t > 1.02) return null
  const tc = clamp(t, 0, 1)
  const px = seg.x0 + (seg.x1 - seg.x0) * tc
  const py = seg.y0 + (seg.y1 - seg.y0) * tc
  const restX = px + seg.nx * r
  const restY = py + seg.ny * r
  return {
    x: restX,
    y: restY,
    nx: seg.nx,
    ny: seg.ny,
    dy: restY - y,
    bounce: false,
    platform: -1,
  }
}

/** Push the ball out of slope volumes it is overlapping. */
export function depenetrateSlopes(grid: Grid, x: number, y: number, r: number): { x: number; y: number; nx: number; ny: number; hit: boolean } {
  let cx = x
  let cy = y
  let nx = 0
  let ny = -1
  let hit = false
  const minTx = Math.floor((cx - r) / TILE) - 1
  const maxTx = Math.floor((cx + r) / TILE) + 1
  const minTy = Math.floor((cy - r) / TILE) - 1
  const maxTy = Math.floor((cy + r) / TILE) + 1
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const seg = slopeSegment(getTile(grid, tx, ty), tx, ty)
        if (!seg) continue
        const signed = signedSegment(cx, cy, seg.x0, seg.y0, seg.x1, seg.y1, seg.nx, seg.ny)
        if (signed === null) continue
        if (signed < r && signed > -r * 0.9) {
          const push = r - signed
          cx += seg.nx * push
          cy += seg.ny * push
          nx = seg.nx
          ny = seg.ny
          hit = true
          pushed = true
        }
      }
    }
    if (!pushed) break
  }
  return { x: cx, y: cy, nx, ny, hit }
}

export interface WallHit {
  x: number
  nx: number
}

export function resolveWalls(grid: Grid, x: number, y: number, r: number, blocks: Rect[], inset: number): WallHit | null {
  let cx = x
  let hit: WallHit | null = null
  const minTx = Math.floor((cx - r) / TILE) - 1
  const maxTx = Math.floor((cx + r) / TILE) + 1
  const minTy = Math.floor((y - r + inset) / TILE)
  const maxTy = Math.floor((y + r - inset) / TILE)

  const rects: Rect[] = []
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const id = getTile(grid, tx, ty)
      if (!isFullSolid(id)) continue
      rects.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })
    }
  }
  for (const block of blocks) rects.push(block)

  for (let pass = 0; pass < 2; pass++) {
    for (const rect of rects) {
      if (y + r - inset <= rect.y || y - r + inset >= rect.y + rect.h) continue
      if (cx + r <= rect.x || cx - r >= rect.x + rect.w) continue
      const penL = cx + r - rect.x
      const penR = rect.x + rect.w - (cx - r)
      if (penL < penR) {
        cx = rect.x - r
        hit = { x: cx, nx: -1 }
      } else {
        cx = rect.x + rect.w + r
        hit = { x: cx, nx: 1 }
      }
    }
  }
  return hit ? { x: cx, nx: hit.nx } : null
}

export interface CeilingHit {
  y: number
}

export function resolveCeiling(grid: Grid, x: number, y: number, prevY: number, r: number, blocks: Rect[], inset: number): CeilingHit | null {
  let cy = y
  let hit = false
  const minTx = Math.floor((x - r) / TILE)
  const maxTx = Math.floor((x + r) / TILE)
  const minTy = Math.floor((cy - r) / TILE) - 1
  const maxTy = Math.floor((prevY - r) / TILE) + 1
  const rects: Rect[] = []
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isFullSolid(getTile(grid, tx, ty))) continue
      rects.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })
    }
  }
  for (const block of blocks) rects.push(block)

  for (const rect of rects) {
    if (x <= rect.x + inset || x >= rect.x + rect.w - inset) continue
    const bottom = rect.y + rect.h
    if (prevY - r >= bottom - 0.5 && cy - r < bottom) {
      cy = bottom + r
      hit = true
    }
  }
  return hit ? { y: cy } : null
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = clamp(t, 0, 1)
  const qx = ax + dx * t
  const qy = ay + dy * t
  return Math.hypot(px - qx, py - qy)
}

function pointInTri(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  const s1 = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
  const s2 = (px - bx) * (cy - by) - (py - by) * (cx - bx)
  const s3 = (px - cx) * (ay - cy) - (py - cy) * (ax - cx)
  const neg = s1 < 0 || s2 < 0 || s3 < 0
  const pos = s1 > 0 || s2 > 0 || s3 > 0
  return !(neg && pos)
}

export function circleHitsTriangle(
  px: number,
  py: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean {
  if (pointInTri(px, py, ax, ay, bx, by, cx, cy)) return true
  if (distToSegment(px, py, ax, ay, bx, by) <= r) return true
  if (distToSegment(px, py, bx, by, cx, cy) <= r) return true
  if (distToSegment(px, py, cx, cy, ax, ay) <= r) return true
  return false
}

/** Hurt triangle for a spike tile. Inset so brushing the tile edge is not fatal. */
export function spikeTriangle(id: TileId, tx: number, ty: number): [number, number, number, number, number, number] | null {
  if (!isSpike(id)) return null
  const x = tx * TILE
  const y = ty * TILE
  const s = TILE
  const m = 15
  if (id === Tile.SpikeU) return [x + s / 2, y + 6, x + m, y + s - 4, x + s - m, y + s - 4]
  if (id === Tile.SpikeD) return [x + s / 2, y + s - 6, x + m, y + 4, x + s - m, y + 4]
  if (id === Tile.SpikeL) return [x + 6, y + s / 2, x + s - 4, y + m, x + s - 4, y + s - m]
  return [x + s - 6, y + s / 2, x + 4, y + m, x + 4, y + s - m]
}

export function overlapsSpike(grid: Grid, x: number, y: number, r: number): boolean {
  const minTx = Math.floor((x - r) / TILE)
  const maxTx = Math.floor((x + r) / TILE)
  const minTy = Math.floor((y - r) / TILE)
  const maxTy = Math.floor((y + r) / TILE)
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const tri = spikeTriangle(getTile(grid, tx, ty), tx, ty)
      if (!tri) continue
      if (circleHitsTriangle(x, y, r - 1, tri[0], tri[1], tri[2], tri[3], tri[4], tri[5])) return true
    }
  }
  return false
}

export function centerInWater(grid: Grid, x: number, y: number): boolean {
  return getTile(grid, Math.floor(x / TILE), Math.floor(y / TILE)) === Tile.Water
}

export function bodyInsideSolid(grid: Grid, x: number, y: number): boolean {
  const id = getTile(grid, Math.floor(x / TILE), Math.floor(y / TILE))
  if (isFullSolid(id)) return true
  const seg = slopeSegment(id, Math.floor(x / TILE), Math.floor(y / TILE))
  if (!seg) return false
  const signed = (x - seg.x0) * seg.nx + (y - seg.y0) * seg.ny
  return signed < 0
}
