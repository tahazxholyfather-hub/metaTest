import Phaser from 'phaser'
import { BALL_R, TILE, VIEW_H, VIEW_W } from '../config'
import type { Simulation } from '../Simulation'
import { getTile, slopeSegment, Tile, type TileId } from '../tiles'
import { mix, type Theme } from './themes'

export interface Speck {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: number
  r: number
}

export function burst(specks: Speck[], x: number, y: number, color: number, count: number, speed: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const mag = speed * (0.35 + Math.random() * 0.7)
    let speck = specks.find((item) => item.life <= 0)
    if (!speck) {
      if (specks.length >= 36) return
      speck = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color, r: 2 }
      specks.push(speck)
    }
    speck.x = x
    speck.y = y
    speck.vx = Math.cos(angle) * mag
    speck.vy = Math.sin(angle) * mag - 30
    speck.life = 0.28 + Math.random() * 0.22
    speck.max = speck.life
    speck.color = color
    speck.r = 1.4 + Math.random() * 1.4
  }
}

export function stepSpecks(specks: Speck[], dt: number): void {
  for (const speck of specks) {
    if (speck.life <= 0) continue
    speck.life -= dt
    speck.x += speck.vx * dt
    speck.y += speck.vy * dt
    speck.vy += 520 * dt
  }
}

export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  sim: Simulation,
  camX: number,
  camY: number,
  theme: Theme,
  specks: Speck[],
  debug: boolean,
): void {
  const ox = VIEW_W / 2 - camX
  const oy = VIEW_H / 2 - camY
  g.clear()
  drawSky(g, theme, camX)
  drawTerrain(g, sim, ox, oy, camX, camY, theme)
  drawWater(g, sim, ox, oy, camX, camY, theme)
  drawEntities(g, sim, ox, oy, theme)
  drawSpecks(g, specks, ox, oy)
  const px = sim.renderX + ox
  const py = sim.renderY + oy
  g.fillStyle(theme.shadow, 0.25)
  g.fillEllipse(px, py + BALL_R * 0.78, BALL_R * 1.65, BALL_R * 0.48)
  if (debug) {
    g.lineStyle(1, 0xff4466, 1)
    g.strokeCircle(px, py, BALL_R)
    g.lineStyle(1, 0x44ff88, 0.8)
    g.strokeRect(sim.goal.x + ox, sim.goal.y + oy, sim.goal.w, sim.goal.h)
  }
}

function drawSky(g: Phaser.GameObjects.Graphics, theme: Theme, camX: number): void {
  const bands = 10
  for (let i = 0; i < bands; i++) {
    g.fillStyle(mix(theme.skyTop, theme.skyBottom, i / (bands - 1)), 1)
    g.fillRect(0, (VIEW_H / bands) * i, VIEW_W, VIEW_H / bands + 1)
  }
  g.fillStyle(theme.cloud, theme.id === 'dusk' ? 0.22 : 0.7)
  g.fillCircle(VIEW_W * 0.78, theme.id === 'dusk' ? 48 : 56, theme.id === 'dusk' ? 14 : 18)
  hill(g, camX, 0.1, VIEW_H * 0.42, theme.hillFar, 16, 0.004)
  hill(g, camX, 0.22, VIEW_H * 0.52, theme.hillMid, 20, 0.006)
  g.fillStyle(theme.cloud, 0.45)
  const drift = -camX * 0.08
  g.fillEllipse((80 + drift) % (VIEW_W + 80), 48, 54, 16)
  g.fillEllipse((210 + drift * 1.2) % (VIEW_W + 80), 70, 36, 12)
}

function hill(
  g: Phaser.GameObjects.Graphics,
  camX: number,
  factor: number,
  base: number,
  color: number,
  amp: number,
  freq: number,
): void {
  g.fillStyle(color, 1)
  g.beginPath()
  g.moveTo(-8, VIEW_H + 4)
  for (let x = -8; x <= VIEW_W + 8; x += 18) {
    const world = x - VIEW_W / 2 + camX * factor
    const y = base + Math.sin(world * freq) * amp + Math.sin(world * freq * 2.3) * amp * 0.28
    g.lineTo(x, y)
  }
  g.lineTo(VIEW_W + 8, VIEW_H + 4)
  g.closePath()
  g.fillPath()
}

function drawTerrain(
  g: Phaser.GameObjects.Graphics,
  sim: Simulation,
  ox: number,
  oy: number,
  camX: number,
  camY: number,
  theme: Theme,
): void {
  const grid = sim.level.grid
  const c0 = Math.max(0, Math.floor((camX - VIEW_W / 2) / TILE) - 1)
  const c1 = Math.min(grid.cols - 1, Math.ceil((camX + VIEW_W / 2) / TILE) + 1)
  const r0 = Math.max(0, Math.floor((camY - VIEW_H / 2) / TILE) - 1)
  const r1 = Math.min(grid.rows - 1, Math.ceil((camY + VIEW_H / 2) / TILE) + 1)

  for (let row = r0; row <= r1; row++) {
    let col = c0
    while (col <= c1) {
      const id = getTile(grid, col, row)
      if (id !== Tile.Solid && id !== Tile.Bounce) {
        col += 1
        continue
      }
      const start = col
      const bounce = id === Tile.Bounce
      const surface = !bounce && getTile(grid, col, row - 1) === Tile.Empty
      while (col <= c1 && getTile(grid, col, row) === id) {
        const aboveOpen = getTile(grid, col, row - 1) === Tile.Empty
        if (!bounce && aboveOpen !== surface) break
        col += 1
      }
      const x = start * TILE + ox
      const y = row * TILE + oy
      const w = (col - start) * TILE
      const deep = !surface && (getTile(grid, start, row - 2) === Tile.Solid || getTile(grid, start, row - 2) === Tile.Bounce)
      g.fillStyle(bounce ? theme.earth : deep ? theme.earthDeep : theme.earth, 1)
      g.fillRect(x, y, w, TILE)
      if (!surface) {
        g.fillStyle(theme.earthDeep, 0.35)
        g.fillRect(x, y, 4, TILE)
      }
      if (bounce) {
        g.fillStyle(theme.bounce, 1)
        g.fillRect(x + 3, y, Math.max(4, w - 6), 8)
        g.fillStyle(0xffffff, 0.35)
        g.fillRect(x + 6, y + 2, Math.max(2, w - 12), 2)
      } else if (surface) {
        g.fillStyle(theme.grass, 1)
        g.fillRect(x, y, w, 8)
        g.fillStyle(theme.earthDeep, 0.35)
        g.fillRect(x, y + 8, w, 3)
        if ((start * 3) % 5 === 0) {
          g.fillTriangle(x + 14, y, x + 18, y - 9, x + 22, y)
        }
      }
    }
  }

  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const id = getTile(grid, col, row)
      if (id === Tile.OneWay) drawPlank(g, col, row, ox, oy, theme)
      else if (isSlopeTile(id)) drawSlope(g, id, col, row, ox, oy, theme)
      else if (id === Tile.SpikeU || id === Tile.SpikeD || id === Tile.SpikeL || id === Tile.SpikeR) {
        drawSpike(g, id, col, row, ox, oy, theme)
      }
    }
  }
}

function drawPlank(g: Phaser.GameObjects.Graphics, col: number, row: number, ox: number, oy: number, theme: Theme): void {
  const x = col * TILE + ox
  const y = row * TILE + oy
  g.fillStyle(theme.plankEdge, 1)
  g.fillRect(x + 2, y, TILE - 4, 11)
  g.fillStyle(theme.plank, 1)
  g.fillRect(x + 2, y, TILE - 4, 7)
}

function drawSlope(g: Phaser.GameObjects.Graphics, id: TileId, col: number, row: number, ox: number, oy: number, theme: Theme): void {
  const x = col * TILE + ox
  const y = row * TILE + oy
  const s = TILE
  g.fillStyle(theme.earth, 1)
  if (id === Tile.SlopeR) g.fillTriangle(x, y + s, x + s, y, x + s, y + s)
  else if (id === Tile.SlopeL) g.fillTriangle(x, y, x + s, y + s, x, y + s)
  else if (id === Tile.GentleRLow) g.fillTriangle(x, y + s, x + s, y + s * 0.5, x + s, y + s)
  else if (id === Tile.GentleRHigh) {
    g.fillTriangle(x, y + s * 0.5, x + s, y, x + s, y + s)
    g.fillTriangle(x, y + s * 0.5, x + s, y + s, x, y + s)
  } else if (id === Tile.GentleLHigh) {
    g.fillTriangle(x, y, x + s, y + s * 0.5, x + s, y + s)
    g.fillTriangle(x, y, x + s, y + s, x, y + s)
  } else if (id === Tile.GentleLLow) g.fillTriangle(x, y + s * 0.5, x + s, y + s, x, y + s)
  const seg = slopeSegment(id, col, row)
  if (!seg) return
  g.lineStyle(4, theme.grass, 1)
  g.beginPath()
  g.moveTo(seg.x0 + ox, seg.y0 + oy)
  g.lineTo(seg.x1 + ox, seg.y1 + oy)
  g.strokePath()
}

function drawSpike(g: Phaser.GameObjects.Graphics, id: TileId, col: number, row: number, ox: number, oy: number, theme: Theme): void {
  const x = col * TILE + ox
  const y = row * TILE + oy
  const s = TILE
  g.fillStyle(theme.spike, 1)
  if (id === Tile.SpikeU) g.fillTriangle(x + 8, y + s - 2, x + s / 2, y + 8, x + s - 8, y + s - 2)
  else if (id === Tile.SpikeD) g.fillTriangle(x + 8, y + 2, x + s / 2, y + s - 8, x + s - 8, y + 2)
  else if (id === Tile.SpikeL) g.fillTriangle(x + s - 2, y + 8, x + 8, y + s / 2, x + s - 2, y + s - 8)
  else g.fillTriangle(x + 2, y + 8, x + s - 8, y + s / 2, x + 2, y + s - 8)
}

function drawWater(
  g: Phaser.GameObjects.Graphics,
  sim: Simulation,
  ox: number,
  oy: number,
  camX: number,
  camY: number,
  theme: Theme,
): void {
  const grid = sim.level.grid
  const c0 = Math.max(0, Math.floor((camX - VIEW_W / 2) / TILE) - 1)
  const c1 = Math.min(grid.cols - 1, Math.ceil((camX + VIEW_W / 2) / TILE) + 1)
  const r0 = Math.max(0, Math.floor((camY - VIEW_H / 2) / TILE) - 1)
  const r1 = Math.min(grid.rows - 1, Math.ceil((camY + VIEW_H / 2) / TILE) + 1)
  g.fillStyle(theme.water, 0.55)
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (getTile(grid, col, row) !== Tile.Water) continue
      g.fillRect(col * TILE + ox, row * TILE + oy, TILE, TILE)
    }
  }
  g.lineStyle(2, 0xffffff, 0.35)
  g.beginPath()
  let moved = false
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (getTile(grid, col, row) !== Tile.Water) continue
      if (getTile(grid, col, row - 1) === Tile.Water) continue
      const x = col * TILE + ox
      const y = row * TILE + oy + 4 + Math.sin(sim.time * 3 + col * 0.7) * 2
      if (!moved) {
        g.moveTo(x, y)
        moved = true
      }
      g.lineTo(x + TILE, y)
    }
  }
  if (moved) g.strokePath()
}

function drawEntities(g: Phaser.GameObjects.Graphics, sim: Simulation, ox: number, oy: number, theme: Theme): void {
  for (const coin of sim.coins) {
    if (coin.taken) continue
    const bob = Math.sin(sim.time * 3 + coin.x * 0.01) * 3
    g.fillStyle(coin.secret ? theme.coinSecret : theme.coin, 1)
    g.fillCircle(coin.x + ox, coin.y + oy + bob, coin.secret ? 6 : 7)
    g.fillStyle(0xffffff, 0.55)
    g.fillCircle(coin.x + ox - 2, coin.y + oy + bob - 2, 2)
  }

  for (const cp of sim.checkpoints) {
    const x = cp.x + ox
    const y = cp.y + oy
    g.fillStyle(cp.used ? theme.checkpoint : theme.switchOff, 1)
    g.fillRect(x - 2, y - 36, 4, 36)
    g.fillCircle(x, y - 40, 7)
    if (cp.used) {
      g.fillStyle(0xffffff, 0.7)
      g.fillCircle(x - 2, y - 42, 2)
    }
  }

  for (const sw of sim.switches) {
    g.fillStyle(sw.on ? theme.switchOn : theme.switchOff, 1)
    g.fillRoundedRect(sw.x + ox, sw.y + oy, sw.w, sw.h, 4)
  }

  for (const gate of sim.gates) {
    const rect = sim.gateRect(gate)
    g.fillStyle(theme.gate, 0.95)
    g.fillRect(rect.x + ox, rect.y + oy, rect.w, rect.h)
    g.fillStyle(theme.bounce, 0.8)
    g.fillRect(rect.x + ox, rect.y + oy, rect.w, 4)
  }

  for (let i = 0; i < sim.platforms.length; i++) {
    const rect = sim.platformRect(i)
    g.fillStyle(theme.plankEdge, 1)
    g.fillRoundedRect(rect.x + ox, rect.y + oy, rect.w, rect.h, 4)
    g.fillStyle(theme.plank, 1)
    g.fillRoundedRect(rect.x + ox, rect.y + oy, rect.w, Math.max(4, rect.h - 3), 4)
  }

  for (let i = 0; i < sim.hazards.length; i++) {
    const rect = sim.hazardRect(i)
    g.fillStyle(theme.hazard, 1)
    g.fillRoundedRect(rect.x + ox, rect.y + oy, rect.w, rect.h, 3)
    g.fillStyle(0xffffff, 0.35)
    const teeth = Math.max(1, Math.floor(rect.w / 10))
    for (let t = 0; t < teeth; t++) {
      const tx = rect.x + ox + 4 + t * 10
      g.fillTriangle(tx, rect.y + oy + rect.h, tx + 4, rect.y + oy + rect.h + 6, tx + 8, rect.y + oy + rect.h)
    }
  }

  const goal = sim.goal
  const cx = goal.x + goal.w / 2 + ox
  const cy = goal.y + goal.h * 0.45 + oy
  const pulse = 0.5 + 0.5 * Math.sin(sim.time * 3)
  g.fillStyle(theme.goal, 0.18 + pulse * 0.12)
  g.fillCircle(cx, cy, 26 + pulse * 4)
  g.lineStyle(3, theme.goal, 0.9)
  g.strokeCircle(cx, cy, 16)
  g.lineStyle(2, 0xffffff, 0.45)
  g.strokeCircle(cx, cy, 8)
}

function drawSpecks(g: Phaser.GameObjects.Graphics, specks: Speck[], ox: number, oy: number): void {
  for (const speck of specks) {
    if (speck.life <= 0) continue
    g.fillStyle(speck.color, Math.max(0, speck.life / speck.max))
    g.fillCircle(speck.x + ox, speck.y + oy, speck.r)
  }
}

function isSlopeTile(id: TileId): boolean {
  return (
    id === Tile.SlopeR ||
    id === Tile.SlopeL ||
    id === Tile.GentleRLow ||
    id === Tile.GentleRHigh ||
    id === Tile.GentleLHigh ||
    id === Tile.GentleLLow
  )
}
