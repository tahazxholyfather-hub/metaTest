import { BALL_R, PHYS, TILE } from './config'
import {
  bodyInsideSolid,
  centerInWater,
  circleVsRect,
  depenetrateSlopes,
  overlapsSpike,
  probeFloor,
  resolveCeiling,
  resolveWalls,
  type DynRect,
} from './collision'
import { clamp, damp, moveToward } from './math'
import type { FloorHit, InputFrame, LevelDef, Rect, SimEvent } from './types'

interface Coin {
  id: string
  x: number
  y: number
  secret: boolean
  taken: boolean
}

interface Checkpoint {
  id: string
  x: number
  y: number
  w: number
  h: number
  used: boolean
}

interface SwitchEnt {
  id: string
  x: number
  y: number
  w: number
  h: number
  targets: string[]
  mode: 'once' | 'toggle' | 'hold'
  on: boolean
  was: boolean
  used: boolean
}

interface GateEnt {
  id: string
  x: number
  y: number
  w: number
  h: number
  open: boolean
  anim: number
}

interface Mover {
  x: number
  y: number
  w: number
  h: number
  axis: 'x' | 'y'
  distance: number
  period: number
  phase: number
  offset: number
  dx: number
  dy: number
}

interface Zone {
  id: string
  x: number
  y: number
  w: number
  h: number
  secret: boolean
  route: string
  seen: boolean
}

export interface PlayerBody {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  grounded: boolean
  gnx: number
  gny: number
  riding: number
  alive: boolean
  coyote: number
  jumpBuffer: number
  detach: number
  bounceLock: number
  airCap: number
  squash: number
  roll: number
  invuln: number
  drown: number
  inWater: boolean
  landed: number
  bounced: number
  checkpointFlash: number
  facing: number
  spawnX: number
  spawnY: number
  touchingBounce: boolean
}

function moverOffset(m: Mover, time: number): number {
  return Math.sin((time * Math.PI * 2) / m.period + m.phase) * m.distance
}

export class Simulation {
  readonly level: LevelDef
  readonly player: PlayerBody
  readonly coins: Coin[]
  readonly checkpoints: Checkpoint[]
  readonly switches: SwitchEnt[]
  readonly gates: GateEnt[]
  readonly platforms: Mover[]
  readonly hazards: Mover[]
  readonly zones: Zone[]
  readonly goal: Rect
  readonly coinTotal: number

  time = 0
  prevX = 0
  prevY = 0
  alpha = 1
  private acc = 0
  finished = false
  readonly collected = new Set<string>()
  readonly secrets = new Set<string>()
  readonly routes = new Set<string>()

  constructor(level: LevelDef) {
    this.level = level
    this.coins = []
    this.checkpoints = []
    this.switches = []
    this.gates = []
    this.platforms = []
    this.hazards = []
    this.zones = []
    let goal: Rect | null = null
    for (const obj of level.objects) {
      if (obj.kind === 'coin') {
        this.coins.push({ id: obj.id, x: obj.x, y: obj.y, secret: Boolean(obj.secret), taken: false })
      } else if (obj.kind === 'checkpoint') {
        this.checkpoints.push({ id: obj.id, x: obj.x, y: obj.y, w: TILE * 0.8, h: TILE * 1.4, used: false })
      } else if (obj.kind === 'goal') {
        goal = { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
      } else if (obj.kind === 'switch') {
        this.switches.push({
          id: obj.id,
          x: obj.x,
          y: obj.y,
          w: obj.w,
          h: obj.h,
          targets: obj.targets,
          mode: obj.mode,
          on: false,
          was: false,
          used: false,
        })
      } else if (obj.kind === 'gate') {
        const open = Boolean(obj.open)
        this.gates.push({ id: obj.id, x: obj.x, y: obj.y, w: obj.w, h: obj.h, open, anim: open ? 1 : 0 })
      } else if (obj.kind === 'platform' || obj.kind === 'hazard') {
        const list = obj.kind === 'platform' ? this.platforms : this.hazards
        list.push({
          x: obj.x,
          y: obj.y,
          w: obj.w,
          h: obj.h,
          axis: obj.axis,
          distance: obj.distance,
          period: Math.max(0.4, obj.period),
          phase: obj.phase ?? 0,
          offset: 0,
          dx: 0,
          dy: 0,
        })
      } else if (obj.kind === 'zone') {
        this.zones.push({
          id: obj.id,
          x: obj.x,
          y: obj.y,
          w: obj.w,
          h: obj.h,
          secret: Boolean(obj.secret),
          route: obj.route ?? '',
          seen: false,
        })
      }
    }
    this.goal = goal ?? { x: 0, y: 0, w: 0, h: 0 }
    this.coinTotal = this.coins.length
    this.player = this.makePlayer(level.spawn.x, level.spawn.y)
    this.prevX = this.player.x
    this.prevY = this.player.y
    for (const m of [...this.platforms, ...this.hazards]) m.offset = moverOffset(m, 0)
  }

  private makePlayer(x: number, y: number): PlayerBody {
    const player: PlayerBody = {
      x,
      y,
      vx: 0,
      vy: 0,
      r: BALL_R,
      grounded: false,
      gnx: 0,
      gny: -1,
      riding: -1,
      alive: true,
      coyote: 0,
      jumpBuffer: 0,
      detach: 0,
      bounceLock: 0,
      airCap: PHYS.maxRun,
      squash: 0,
      roll: 0,
      invuln: 0,
      drown: 0,
      inWater: false,
      landed: 0,
      bounced: 0,
      checkpointFlash: 0,
      facing: 1,
      spawnX: x,
      spawnY: y,
      touchingBounce: false,
    }
    const floor = probeFloor(this.level.grid, player, 24, [], 4)
    if (floor && Math.abs(floor.dy) < 20) {
      player.x = floor.x
      player.y = floor.y
      player.grounded = true
      player.gnx = floor.nx
      player.gny = floor.ny
      player.coyote = PHYS.coyote
      player.spawnX = player.x
      player.spawnY = player.y
    }
    return player
  }

  get renderX(): number {
    return this.prevX + (this.player.x - this.prevX) * this.alpha
  }

  get renderY(): number {
    return this.prevY + (this.player.y - this.prevY) * this.alpha
  }

  advance(frameDt: number, input: InputFrame): SimEvent[] {
    const dt = Math.min(0.05, Math.max(0, frameDt))
    this.acc += dt
    const events: SimEvent[] = []
    let steps = 0
    let first = true
    while (this.acc >= PHYS.step && steps < PHYS.maxSteps) {
      const frame: InputFrame = {
        x: input.x,
        jumpHeld: input.jumpHeld,
        jumpPressed: first && input.jumpPressed,
        jumpReleased: first && input.jumpReleased,
      }
      first = false
      events.push(...this.step(PHYS.step, frame))
      this.acc -= PHYS.step
      steps++
    }
    if (steps >= PHYS.maxSteps) this.acc = 0
    this.alpha = PHYS.step > 0 ? this.acc / PHYS.step : 1
    return events
  }

  respawn(): void {
    const p = this.player
    p.alive = true
    p.x = p.spawnX
    p.y = p.spawnY
    p.vx = 0
    p.vy = 0
    p.grounded = true
    p.gnx = 0
    p.gny = -1
    p.riding = -1
    p.invuln = PHYS.invuln
    p.drown = 0
    p.detach = 0
    p.jumpBuffer = 0
    p.squash = 0
    p.inWater = centerInWater(this.level.grid, p.x, p.y)
    this.prevX = p.x
    this.prevY = p.y
    this.acc = 0
    this.alpha = 1
  }

  floorBelow(x: number, y: number, maxDown: number) {
    return probeFloor(this.level.grid, { x, y, r: this.player.r }, maxDown, this.platformExtras(), 3)
  }

  platformRect(index: number): Rect {
    const m = this.platforms[index]
    return {
      x: m.x + (m.axis === 'x' ? m.offset : 0),
      y: m.y + (m.axis === 'y' ? m.offset : 0),
      w: m.w,
      h: m.h,
    }
  }

  hazardRect(index: number): Rect {
    const m = this.hazards[index]
    return {
      x: m.x + (m.axis === 'x' ? m.offset : 0),
      y: m.y + (m.axis === 'y' ? m.offset : 0),
      w: m.w,
      h: m.h,
    }
  }

  gateRect(gate: GateEnt): Rect {
    const lift = gate.anim * gate.h
    return { x: gate.x, y: gate.y - lift, w: gate.w, h: gate.h }
  }

  private step(dt: number, input: InputFrame): SimEvent[] {
    const events: SimEvent[] = []
    const p = this.player
    this.prevX = p.x
    this.prevY = p.y
    if (!p.alive) return events

    this.time += dt
    p.landed = Math.max(0, p.landed - dt)
    p.bounced = Math.max(0, p.bounced - dt)
    p.checkpointFlash = Math.max(0, p.checkpointFlash - dt)
    p.squash = damp(p.squash, 0, 14, dt)
    p.invuln = Math.max(0, p.invuln - dt)
    p.detach = Math.max(0, p.detach - dt)
    p.bounceLock = Math.max(0, p.bounceLock - dt)
    p.roll += (p.vx / p.r) * dt

    if (p.grounded) p.coyote = PHYS.coyote
    else p.coyote = Math.max(0, p.coyote - dt)

    if (input.jumpPressed) p.jumpBuffer = PHYS.jumpBuffer
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt)

    this.updateMovers()

    if (p.riding >= 0) {
      const plat = this.platforms[p.riding]
      p.x += plat.dx
      p.y += plat.dy
    }

    const wasWater = p.inWater
    p.inWater = centerInWater(this.level.grid, p.x, p.y)
    if (p.inWater && !wasWater) events.push({ type: 'splash' })

    let jumped = false
    const canJump = (p.grounded || p.coyote > 0) && p.detach <= 0
    if (p.jumpBuffer > 0 && p.inWater && !p.grounded) {
      p.vy = -PHYS.swim
      p.jumpBuffer = 0
      jumped = true
      events.push({ type: 'jump' })
    } else if (p.jumpBuffer > 0 && canJump) {
      const speed = p.vx
      const tangent = rightTangent(p.gnx, p.gny)
      p.vx = tangent.x * speed + p.gnx * PHYS.jumpSpeed * 0.05
      p.vy = tangent.y * speed + p.gny * PHYS.jumpSpeed
      p.grounded = false
      p.riding = -1
      p.coyote = 0
      p.jumpBuffer = 0
      p.detach = PHYS.detach
      p.airCap = Math.max(PHYS.maxRun * 0.55, Math.abs(tangent.x * speed))
      p.squash = 0.06
      jumped = true
      events.push({ type: 'jump' })
    }

    if (input.jumpReleased && p.vy < 0 && !p.inWater) p.vy *= PHYS.jumpCut

    if (p.grounded && !jumped) {
      // On the ground, vx is speed along the surface (positive runs to the right).
      const nx = p.gnx
      const onSlope = Math.abs(nx) > 0.18
      if (input.x !== 0) p.vx += input.x * PHYS.groundAccel * dt
      else p.vx = moveToward(p.vx, 0, PHYS.groundFriction * (onSlope ? 0.2 : 1) * dt)
      if (p.inWater) p.vx = moveToward(p.vx, 0, 460 * dt)
      p.vx += nx * PHYS.slopeAccel * dt
      const downhill = onSlope && p.vx * nx > 0
      const cap = downhill ? PHYS.maxSlope : PHYS.maxRun
      if (p.vx > cap) p.vx = cap
      if (p.vx < -cap) p.vx = -cap
      p.vy = 0
    } else {
      const grav = PHYS.gravity * (p.inWater ? PHYS.waterGravity : 1)
      p.vy += grav * dt
      if (p.inWater) {
        p.vx *= Math.exp(-PHYS.waterDrag * dt)
        p.vy *= Math.exp(-PHYS.waterDrag * 0.8 * dt)
      }
      const accel = p.inWater ? PHYS.waterAccel : PHYS.airAccel
      const cap = p.inWater ? PHYS.maxRun * 0.72 : p.airCap
      if (input.x !== 0) {
        const next = p.vx + input.x * accel * dt
        if (Math.abs(next) <= cap || Math.abs(next) < Math.abs(p.vx)) p.vx = next
      } else if (!p.inWater) {
        p.vx = moveToward(p.vx, 0, PHYS.airFriction * dt)
      }
      p.vy = Math.min(p.vy, p.inWater ? 240 : PHYS.maxFall)
    }

    if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1
    else if (Math.abs(p.vx) > 30) p.facing = p.vx > 0 ? 1 : -1

    const speed = Math.hypot(p.vx, p.vy)
    const slices = Math.max(1, Math.ceil((speed * dt) / (p.r * 0.45)))
    const h = dt / slices
    for (let i = 0; i < slices; i++) {
      if (p.grounded && !jumped && p.detach <= 0) this.integrateGround(h, events)
      else this.integrateAir(h, events)
    }

    if (p.inWater && !p.grounded) p.drown += dt
    else p.drown = Math.max(0, p.drown - dt * 1.8)

    this.touchSensors(events)

    if (p.alive && p.drown >= PHYS.drown) this.kill(p, 'drown', events)
    if (p.alive && p.y > this.level.grid.rows * TILE + TILE) this.kill(p, 'fall', events)
    if (p.alive && bodyInsideSolid(this.level.grid, p.x, p.y)) {
      let freed = false
      for (let i = 0; i < 18; i++) {
        p.y -= 3
        if (!bodyInsideSolid(this.level.grid, p.x, p.y)) {
          freed = true
          p.vy = Math.min(p.vy, 0)
          break
        }
      }
      if (!freed) this.kill(p, 'fall', events)
    }
    return events
  }

  private updateMovers(): void {
    for (const m of [...this.platforms, ...this.hazards]) {
      const next = moverOffset(m, this.time)
      const delta = next - m.offset
      m.offset = next
      m.dx = m.axis === 'x' ? delta : 0
      m.dy = m.axis === 'y' ? delta : 0
    }
    for (const gate of this.gates) {
      const target = gate.open ? 1 : 0
      gate.anim = damp(gate.anim, target, 12, PHYS.step)
      if (Math.abs(gate.anim - target) < 0.01) gate.anim = target
    }
  }

  private solidBlocks(): Rect[] {
    const rects: Rect[] = []
    for (const gate of this.gates) {
      if (gate.anim > 0.95) continue
      rects.push(this.gateRect(gate))
    }
    return rects
  }

  private platformExtras(): DynRect[] {
    return this.platforms.map((m, i) => ({
      x: m.x + (m.axis === 'x' ? m.offset : 0),
      y: m.y + (m.axis === 'y' ? m.offset : 0),
      w: m.w,
      h: m.h,
      oneWay: true,
      platform: i,
      bounce: false,
    }))
  }

  /** Grounded motion. `vx` is speed along the rightward tangent, not world X. */
  private integrateGround(dt: number, events: SimEvent[]): void {
    const p = this.player
    const tangent = rightTangent(p.gnx, p.gny)
    p.x += tangent.x * p.vx * dt
    p.y += tangent.y * p.vx * dt

    const wall = resolveWalls(this.level.grid, p.x, p.y, p.r, this.solidBlocks(), PHYS.wallInset)
    if (wall) {
      const hitSpeed = p.vx
      p.x = wall.x
      if (Math.sign(hitSpeed) === -wall.nx && Math.abs(hitSpeed) > PHYS.wallBounceMin) p.vx = -hitSpeed * PHYS.wallBounce
      else if (Math.sign(hitSpeed) === -wall.nx) p.vx = 0
    }

    const floor = probeFloor(this.level.grid, p, PHYS.snap + Math.abs(p.vx) * dt + 8, this.platformExtras(), 3)
    if (!floor || floor.dy > PHYS.snap + 8) {
      this.leaveGround()
      return
    }
    p.x = floor.x
    p.y = floor.y
    this.applyFloor(floor, 0, true, events)
  }

  private integrateAir(dt: number, events: SimEvent[]): void {
    const p = this.player
    const grid = this.level.grid
    const blocks = this.solidBlocks()
    const prevY = p.y

    p.x += p.vx * dt
    const wall = resolveWalls(grid, p.x, p.y, p.r, blocks, PHYS.wallInset)
    if (wall) {
      const hitSpeed = p.vx
      p.x = wall.x
      if (Math.sign(hitSpeed) === -wall.nx && Math.abs(hitSpeed) > PHYS.wallBounceMin) p.vx = -hitSpeed * PHYS.wallBounce
      else if (Math.sign(hitSpeed) === -wall.nx) p.vx = 0
    }

    p.y += p.vy * dt
    const slope = depenetrateSlopes(grid, p.x, p.y, p.r)
    if (slope.hit) {
      p.x = slope.x
      p.y = slope.y
      const vn = p.vx * slope.nx + p.vy * slope.ny
      if (vn < 0) {
        p.vx -= vn * slope.nx
        p.vy -= vn * slope.ny
      }
    }

    if (p.vy < 0) {
      const ceil = resolveCeiling(grid, p.x, p.y, prevY, p.r, blocks, PHYS.wallInset)
      if (ceil) {
        p.y = ceil.y
        if (p.vy < 0) p.vy = 0
      }
    }

    if (p.vy >= 0 && p.detach <= 0) {
      const probe = probeFloor(grid, p, Math.max(p.r, p.y - prevY + 10), this.platformExtras(), 3)
      const embedded = probe !== null && probe.dy < 0 && probe.dy >= -p.r
      const crossed = probe !== null && probe.y >= prevY - p.r && probe.y <= p.y + 6
      if (probe && (embedded || crossed)) {
        const impact = Math.max(0, p.vy)
        p.x = probe.x
        p.y = probe.y
        this.applyFloor(probe, impact, false, events)
      }
    }
  }

  private leaveGround(): void {
    const p = this.player
    if (!p.grounded) return
    const tangent = rightTangent(p.gnx, p.gny)
    const speed = p.vx
    p.vx = tangent.x * speed
    p.vy = tangent.y * speed
    p.grounded = false
    p.riding = -1
    p.touchingBounce = false
    p.airCap = Math.max(PHYS.maxRun * 0.55, Math.abs(p.vx))
  }

  private applyFloor(floor: FloorHit, impact: number, wasGrounded: boolean, events: SimEvent[]): void {
    const p = this.player
    const tangent = rightTangent(floor.nx, floor.ny)
    if (!wasGrounded) {
      p.vx = clamp(p.vx * tangent.x + p.vy * tangent.y, -PHYS.maxSlope, PHYS.maxSlope)
      p.vy = 0
    }
    p.grounded = true
    p.gnx = floor.nx
    p.gny = floor.ny
    p.riding = floor.platform
    p.coyote = PHYS.coyote

    if (floor.bounce && p.bounceLock <= 0 && (impact > 40 || wasGrounded)) {
      const speed = p.vx
      p.vx = tangent.x * speed + floor.nx * PHYS.bounceSpeed * 0.12
      p.vy = tangent.y * speed + floor.ny * PHYS.bounceSpeed
      p.grounded = false
      p.riding = -1
      p.detach = 0.07
      p.bounceLock = 0.18
      p.bounced = 0.18
      p.squash = PHYS.maxSquash
      p.airCap = Math.max(PHYS.maxRun * 0.55, Math.abs(tangent.x * speed))
      p.touchingBounce = true
      events.push({ type: 'bounce' })
      return
    }

    p.touchingBounce = floor.bounce
    p.vy = 0
    if (!wasGrounded && impact > 90) {
      p.landed = 0.14
      p.squash = clamp(impact / 6400, 0.035, PHYS.maxSquash)
      events.push({ type: 'land', speed: impact })
    }
  }

  private touchSensors(events: SimEvent[]): void {
    const p = this.player
    if (!p.alive) return
    const body: Rect = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }

    if (p.invuln <= 0 && overlapsSpike(this.level.grid, p.x, p.y, p.r)) {
      this.kill(p, 'spike', events)
      return
    }
    for (let i = 0; i < this.hazards.length; i++) {
      if (p.invuln <= 0 && circleVsRect(p.x, p.y, p.r - 1, this.hazardRect(i))) {
        this.kill(p, 'hazard', events)
        return
      }
    }

    for (const coin of this.coins) {
      if (coin.taken) continue
      const dx = coin.x - p.x
      const dy = coin.y - p.y
      if (dx * dx + dy * dy <= (p.r + 11) * (p.r + 11)) {
        coin.taken = true
        this.collected.add(coin.id)
        if (coin.secret) this.secrets.add(coin.id)
        events.push({ type: 'collect', id: coin.id, secret: coin.secret })
      }
    }

    for (const cp of this.checkpoints) {
      if (cp.used) continue
      const rect = { x: cp.x - cp.w / 2, y: cp.y - cp.h, w: cp.w, h: cp.h }
      if (!circleVsRect(p.x, p.y, p.r, rect)) continue
      cp.used = true
      p.spawnX = cp.x
      p.spawnY = cp.y - p.r
      const floor = probeFloor(this.level.grid, { x: p.spawnX, y: p.spawnY, r: p.r }, 30, [], 4)
      if (floor) {
        p.spawnX = floor.x
        p.spawnY = floor.y
      }
      p.checkpointFlash = 0.7
      events.push({ type: 'checkpoint', id: cp.id })
    }

    for (const sw of this.switches) {
      const down = circleVsRect(p.x, p.y, p.r * 0.7, sw)
      if (sw.mode === 'hold') {
        if (down !== sw.on) {
          sw.on = down
          this.applySwitch(sw, events)
        }
      } else if (down && !sw.was && !(sw.mode === 'once' && sw.used)) {
        sw.used = true
        sw.on = sw.mode === 'once' ? true : !sw.on
        this.applySwitch(sw, events)
      }
      sw.was = down
    }

    for (const zone of this.zones) {
      if (zone.seen || !circleVsRect(p.x, p.y, p.r * 0.5, zone)) continue
      zone.seen = true
      if (zone.secret) {
        this.secrets.add(zone.id)
        events.push({ type: 'secret', id: zone.id })
      }
      if (zone.route) {
        this.routes.add(zone.route)
        events.push({ type: 'route', id: zone.route })
      }
    }

    if (!this.finished && this.goal.w > 0 && overlapsRect(body, this.goal)) {
      this.finished = true
      events.push({ type: 'goal' })
    }
  }

  private applySwitch(sw: SwitchEnt, events: SimEvent[]): void {
    for (const id of sw.targets) {
      const gate = this.gates.find((g) => g.id === id)
      if (gate) gate.open = sw.on
    }
    events.push({ type: 'switch', id: sw.id, on: sw.on })
  }

  private kill(p: PlayerBody, reason: 'spike' | 'hazard' | 'drown' | 'fall', events: SimEvent[]): void {
    if (!p.alive) return
    p.alive = false
    p.vx = 0
    p.vy = 0
    p.grounded = false
    p.riding = -1
    events.push({ type: 'die', reason })
  }
}

function rightTangent(nx: number, ny: number): { x: number; y: number } {
  let x = -ny
  let y = nx
  if (x < 0 || (Math.abs(x) < 1e-8 && y < 0)) {
    x = -x
    y = -y
  }
  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len }
}

function overlapsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
