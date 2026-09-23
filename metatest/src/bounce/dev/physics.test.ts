import { BALL_R, PHYS, TILE } from '../config'
import { createGrid } from '../tiles'
import { bouncePad, drop, feet, ground, pit, platform, rise, spikeUp } from '../levelBuild'
import { Simulation } from '../Simulation'
import type { InputFrame, LevelDef } from '../types'

const hold = (x: number, jump = false): InputFrame => ({
  x,
  jumpHeld: jump,
  jumpPressed: jump,
  jumpReleased: false,
})

const none: InputFrame = { x: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false }

function level(grid: ReturnType<typeof createGrid>, spawn: { x: number; y: number }, objects: LevelDef['objects'] = []): LevelDef {
  return { id: 'test', name: 'test', number: 1, theme: 'meadow', grid, spawn, objects }
}

function simFor(grid: ReturnType<typeof createGrid>, spawn: { x: number; y: number }, objects: LevelDef['objects'] = []) {
  return new Simulation(level(grid, spawn, objects))
}

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  if (!cond) {
    failed++
    console.error(`FAIL ${name} ${detail}`)
  } else {
    console.log(`ok   ${name}`)
  }
}

function run(sim: Simulation, seconds: number, input: InputFrame, fps: number) {
  const dt = 1 / fps
  const steps = Math.round(seconds * fps)
  for (let i = 0; i < steps; i++) sim.advance(dt, input)
}

// Flat rest
{
  const g = createGrid(24, 12)
  ground(g, 0, 8, 24)
  const sim = simFor(g, feet(3, 8))
  run(sim, 1.5, none, 60)
  const rest = 8 * TILE - BALL_R
  check('rests on flat ground', sim.player.grounded && Math.abs(sim.player.y - rest) < 1.5, `y=${sim.player.y.toFixed(2)} grounded=${sim.player.grounded}`)
  check('no residual vertical speed', Math.abs(sim.player.vy) < 1, `vy=${sim.player.vy.toFixed(2)}`)
}

// Run
{
  const g = createGrid(40, 12)
  ground(g, 0, 8, 40)
  const sim = simFor(g, feet(2, 8))
  const x0 = sim.player.x
  run(sim, 1.2, hold(1), 60)
  check('accelerates to the right', sim.player.x > x0 + 120 && sim.player.grounded, `x=${sim.player.x.toFixed(1)} vx=${sim.player.vx.toFixed(1)}`)
  check('respects max run speed', Math.abs(sim.player.vx) <= PHYS.maxRun + 1, `vx=${sim.player.vx.toFixed(1)}`)
  run(sim, 0.8, none, 60)
  check('friction stops the roll', Math.abs(sim.player.vx) < 8, `vx=${sim.player.vx.toFixed(2)}`)
}

// Jump height
{
  const g = createGrid(30, 16)
  ground(g, 0, 12, 30)
  const sim = simFor(g, feet(4, 12))
  const y0 = sim.player.y
  let apex = y0
  const dt = 1 / 60
  sim.advance(dt, hold(0, true))
  for (let i = 0; i < 90; i++) {
    sim.advance(dt, none)
    apex = Math.min(apex, sim.player.y)
  }
  const height = y0 - apex
  const expected = (PHYS.jumpSpeed * PHYS.jumpSpeed) / (2 * PHYS.gravity)
  check('jump height matches the tuning', Math.abs(height - expected) < 14, `height=${height.toFixed(1)} expected≈${expected.toFixed(1)}`)
}

// High-speed landing does not tunnel
{
  const g = createGrid(16, 20)
  ground(g, 0, 16, 16)
  const sim = simFor(g, { x: 120, y: 40 })
  sim.player.vy = PHYS.maxFall
  sim.player.grounded = false
  run(sim, 2, none, 30)
  const rest = 16 * TILE - BALL_R
  check('does not fall through a floor', sim.player.alive && sim.player.grounded && Math.abs(sim.player.y - rest) < 2, `y=${sim.player.y.toFixed(2)} alive=${sim.player.alive}`)
}

// One-way platform
{
  const g = createGrid(20, 14)
  ground(g, 0, 10, 20)
  platform(g, 6, 8, 4)
  const sim = simFor(g, feet(7, 10))
  const dt = 1 / 120
  sim.advance(dt, hold(0, true))
  let passed = false
  let landed = false
  for (let i = 0; i < 360; i++) {
    sim.advance(dt, none)
    const top = 8 * TILE
    if (sim.player.vy < 0 && sim.player.y + sim.player.r < top - 4) passed = true
    if (passed && sim.player.grounded && Math.abs(sim.player.y + sim.player.r - top) < 3) landed = true
  }
  check('jumps through then lands on a one-way', passed && landed, `passed=${passed} landed=${landed} y=${sim.player.y.toFixed(1)}`)
}

// Steep slope continuity
{
  const g = createGrid(30, 18)
  ground(g, 0, 12, 6)
  const up = rise(g, 6, 12, 4, 'steep')
  ground(g, up.x, up.surface, 8)
  const sim = simFor(g, feet(2, 12))
  let groundedFrames = 0
  let frames = 0
  let minVx = 999
  const dt = 1 / 60
  for (let i = 0; i < 240; i++) {
    sim.advance(dt, hold(1))
    frames++
    if (sim.player.grounded) groundedFrames++
    minVx = Math.min(minVx, sim.player.vx)
  }
  const climbed = sim.player.y < 12 * TILE - BALL_R - TILE
  check('climbs a steep ramp without leaving the ground', groundedFrames / frames > 0.92 && climbed, `grounded=${(groundedFrames / frames).toFixed(2)} y=${sim.player.y.toFixed(1)} minVx=${minVx.toFixed(1)}`)
}

// Downhill builds speed past the flat cap
{
  const g = createGrid(40, 20)
  ground(g, 0, 6, 4)
  const down = drop(g, 4, 6, 6, 'steep')
  ground(g, down.x, down.surface, 10)
  const sim = simFor(g, feet(2, 6))
  let peak = 0
  const dt = 1 / 60
  for (let i = 0; i < 180; i++) {
    sim.advance(dt, hold(1))
    peak = Math.max(peak, sim.player.vx)
  }
  check('downhill exceeds flat top speed', peak > PHYS.maxRun + 30, `peak=${peak.toFixed(1)}`)
  check('downhill stays within the slope cap', peak <= PHYS.maxSlope + 2, `peak=${peak.toFixed(1)}`)
}

// Gentle ramp does not snag
{
  const g = createGrid(36, 16)
  ground(g, 0, 10, 4)
  const up = rise(g, 4, 10, 3, 'gentle')
  ground(g, up.x, up.surface, 6)
  const down = drop(g, up.x + 6, up.surface, 3, 'gentle')
  ground(g, down.x, down.surface, 6)
  const sim = simFor(g, feet(2, 10))
  let stuck = 0
  let prev = sim.player.x
  for (let i = 0; i < 300; i++) {
    sim.advance(1 / 60, hold(1))
    if (sim.player.x - prev < 0.2 && sim.player.grounded) stuck++
    prev = sim.player.x
  }
  check('gentle ramps do not snag the ball', stuck < 8 && sim.player.x > up.x * TILE, `stuck=${stuck} x=${sim.player.x.toFixed(1)}`)
}

// Spike kills, jump clears
{
  const g = createGrid(24, 12)
  ground(g, 0, 8, 24)
  spikeUp(g, 10, 8, 1)
  const sim = simFor(g, feet(4, 8))
  run(sim, 2.2, hold(1), 60)
  check('rolling into a spike is fatal', !sim.player.alive, `alive=${sim.player.alive} x=${sim.player.x.toFixed(1)}`)

  const sim2 = simFor(g, feet(6, 8))
  const dt = 1 / 60
  for (let i = 0; i < 40; i++) sim2.advance(dt, hold(1))
  sim2.advance(dt, hold(1, true))
  for (let i = 0; i < 80; i++) sim2.advance(dt, hold(1))
  check('a jump clears a single spike', sim2.player.alive && sim2.player.x > 12 * TILE, `alive=${sim2.player.alive} x=${sim2.player.x.toFixed(1)}`)
}

// Pit
{
  const g = createGrid(24, 14)
  ground(g, 0, 8, 24)
  pit(g, 10, 8, 2, 4)
  const sim = simFor(g, feet(6, 8))
  run(sim, 2.5, hold(1), 60)
  check('a pit kills', !sim.player.alive, `alive=${sim.player.alive} y=${sim.player.y.toFixed(1)}`)
}

// Bounce pad goes higher than a jump
{
  const g = createGrid(20, 18)
  ground(g, 0, 14, 20)
  bouncePad(g, 8, 14, 1)
  const sim = simFor(g, feet(5, 14))
  let apex = sim.player.y
  let bounced = false
  for (let i = 0; i < 200; i++) {
    const ev = sim.advance(1 / 60, hold(1))
    if (ev.some((e) => e.type === 'bounce')) bounced = true
    apex = Math.min(apex, sim.player.y)
  }
  const height = 14 * TILE - BALL_R - apex
  const jumpH = (PHYS.jumpSpeed * PHYS.jumpSpeed) / (2 * PHYS.gravity)
  check('bounce pad launches higher than a jump', bounced && height > jumpH + 30, `bounced=${bounced} height=${height.toFixed(1)} jump=${jumpH.toFixed(1)}`)
}

// Frame-rate independence
{
  const positions: number[] = []
  for (const fps of [30, 60, 120]) {
    const g = createGrid(50, 16)
    ground(g, 0, 10, 8)
    const up = rise(g, 8, 10, 2, 'gentle')
    ground(g, up.x, up.surface, 4)
    const down = drop(g, up.x + 4, up.surface, 3, 'steep')
    ground(g, down.x, down.surface, 8)
    const sim = simFor(g, feet(2, 10))
    const dt = 1 / fps
    const frames = Math.round(2 * fps)
    let jumped = false
    for (let i = 0; i < frames; i++) {
      const t = i / fps
      const jump = !jumped && t > 0.55
      if (jump) jumped = true
      sim.advance(dt, { x: 1, jumpHeld: jump, jumpPressed: jump, jumpReleased: false })
    }
    positions.push(sim.player.x, sim.player.y)
  }
  const dx = Math.max(positions[0], positions[2], positions[4]) - Math.min(positions[0], positions[2], positions[4])
  const dy = Math.max(positions[1], positions[3], positions[5]) - Math.min(positions[1], positions[3], positions[5])
  check('30/60/120 fps stay on the same path', dx < 2 && dy < 2, `dx=${dx.toFixed(3)} dy=${dy.toFixed(3)} pos=${positions.map((n) => n.toFixed(1)).join(',')}`)
}

// Coin + checkpoint + goal
{
  const g = createGrid(24, 12)
  ground(g, 0, 8, 24)
  const spawn = feet(2, 8)
  const sim = simFor(g, spawn, [
    { kind: 'coin', id: 'c', x: feet(5, 8).x, y: feet(5, 8).y },
    { kind: 'checkpoint', id: 'cp', x: feet(8, 8).x, y: 8 * TILE },
    { kind: 'goal', x: feet(14, 8).x, y: 8 * TILE - TILE * 2, w: TILE, h: TILE * 2 },
  ])
  const events = []
  for (let i = 0; i < 180; i++) events.push(...sim.advance(1 / 60, hold(1)))
  check('collects, checkpoints, and finishes', sim.collected.has('c') && sim.player.spawnX > spawn.x + TILE && sim.finished, `coins=${sim.collected.size} spawn=${sim.player.spawnX.toFixed(0)} finished=${sim.finished}`)
}

if (failed > 0) {
  console.error(`${failed} physics checks failed`)
  ;(globalThis as { process?: { exit(code: number): void } }).process?.exit(1)
}
console.log('all physics checks passed')
