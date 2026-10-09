import { TILE } from '../config'
import { getTile, isSpike, Tile } from '../tiles'
import { LEVELS } from '../levels'
import { Simulation } from '../Simulation'
import type { InputFrame, LevelDef } from '../types'

interface Memory {
  jump: boolean
  wasGrounded: boolean
  stuckFor: number
  lastX: number
  reverseFor: number
}

function hazardBlocks(sim: Simulation, dir: number): boolean {
  const p = sim.player
  const reach = 2.1 * TILE
  const box = {
    x: dir >= 0 ? p.x + p.r * 0.2 : p.x - reach,
    y: p.y - TILE * 0.2,
    w: reach,
    h: TILE * 0.9,
  }
  for (let i = 0; i < sim.hazards.length; i++) {
    const rect = sim.hazardRect(i)
    const overlap = box.x < rect.x + rect.w && box.x + box.w > rect.x && box.y < rect.y + rect.h && box.y + box.h > rect.y
    if (overlap) return true
  }
  return false
}

function shouldJump(sim: Simulation, dir: number, goalAbove: boolean): boolean {
  const p = sim.player
  if (!p.alive) return false
  if (p.inWater && !p.grounded) return p.vy > -40
  if (!p.grounded) return false
  if (goalAbove) return true

  const grid = sim.level.grid
  const sign = dir === 0 ? p.facing : dir
  const foot = Math.floor((p.y + p.r + 2) / TILE)
  let spikeAt: number | null = null
  for (let tiles = 1; tiles <= 5; tiles++) {
    const tx = Math.floor((p.x + sign * tiles * TILE) / TILE)
    if (isSpike(getTile(grid, tx, foot)) || isSpike(getTile(grid, tx, foot - 1))) {
      spikeAt = tiles
      break
    }
  }
  if (spikeAt !== null && (spikeAt <= 2 || (spikeAt <= 3 && Math.abs(p.vx) > 160))) return true

  for (const dist of [0.85, 1.45]) {
    const x = p.x + sign * dist * TILE
    const tx = Math.floor(x / TILE)
    const tile = getTile(grid, tx, foot)
    const above = getTile(grid, tx, foot - 1)
    if (tile === Tile.Empty && above !== Tile.OneWay && !isSpike(tile)) {
      const support = sim.floorBelow(x, p.y, TILE * 1.6)
      if (!support || support.dy > TILE * 1.15) return true
    }
    const chest = getTile(grid, tx, Math.floor(p.y / TILE))
    if ((chest === Tile.Solid || chest === Tile.Bounce) && dist < 1.2) return true
  }
  return false
}

function decide(sim: Simulation, memory: Memory): InputFrame {
  const p = sim.player
  const goal = sim.goal
  const gx = goal.x + goal.w * 0.5
  const gy = goal.y + goal.h * 0.55
  let dir: number = gx > p.x + 10 ? 1 : gx < p.x - 10 ? -1 : 0
  if (memory.reverseFor > 0) dir = -Math.sign(dir || p.facing) || -1

  const blocked = hazardBlocks(sim, dir || 1)
  if (blocked) dir = 0

  const goalAbove = gy < p.y - TILE * 1.2 && Math.abs(gx - p.x) < TILE * 8
  const wantJump = !blocked && shouldJump(sim, dir, goalAbove)
  // Hold through the arc, then press again on the next landing.
  const jump = wantJump || (!p.grounded && memory.jump)
  const landed = p.grounded && !memory.wasGrounded
  const frame: InputFrame = {
    x: dir,
    jumpHeld: jump,
    jumpPressed: (wantJump && !memory.jump) || (wantJump && landed),
    jumpReleased: memory.jump && !jump,
  }
  memory.jump = jump
  memory.wasGrounded = p.grounded
  return frame
}

export interface PilotReport {
  id: string
  finished: boolean
  deaths: number
  time: number
  x: number
  y: number
  coins: number
  coinsTotal: number
}

export function pilotLevel(level: LevelDef, seconds = 55): PilotReport {
  const sim = new Simulation(level)
  const memory: Memory = { jump: false, wasGrounded: true, stuckFor: 0, lastX: sim.player.x, reverseFor: 0 }
  let deaths = 0
  const dt = 1 / 60
  const frames = Math.round(seconds * 60)
  for (let i = 0; i < frames; i++) {
    if (!sim.player.alive) {
      deaths++
      if (deaths > 8) break
      sim.respawn()
      memory.stuckFor = 0
      memory.reverseFor = 0
    }
    const input = decide(sim, memory)
    sim.advance(dt, input)
    memory.reverseFor = Math.max(0, memory.reverseFor - dt)
    if (Math.abs(sim.player.x - memory.lastX) < 0.35 && sim.player.grounded) memory.stuckFor += dt
    else {
      memory.stuckFor = 0
      memory.lastX = sim.player.x
    }
    if (memory.stuckFor > 1.4 && memory.reverseFor <= 0) memory.reverseFor = 0.45
    if (sim.finished) break
  }
  return {
    id: level.id,
    finished: sim.finished,
    deaths,
    time: sim.time,
    x: sim.player.x,
    y: sim.player.y,
    coins: sim.collected.size,
    coinsTotal: sim.coinTotal,
  }
}

const proc = (globalThis as { process?: { argv: string[]; exit(code: number): void } }).process
const only = proc?.argv[2]
let failed = 0
for (const level of LEVELS) {
  if (only && level.id !== only && level.number !== Number(only)) continue
  const report = pilotLevel(level)
  const line = `${report.id} finished=${report.finished} deaths=${report.deaths} t=${report.time.toFixed(1)} x=${report.x.toFixed(0)} y=${report.y.toFixed(0)} coins=${report.coins}/${report.coinsTotal}`
  if (!report.finished || (level.number === 1 && report.deaths > 2)) {
    failed++
    console.error('FAIL', line)
  } else {
    console.log('ok  ', line)
  }
}

if (failed) proc?.exit(1)
console.log('pilot cleared the campaign')
