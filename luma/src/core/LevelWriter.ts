import { TILE } from './types'
import type {
  Archetype,
  BossDef,
  CollectibleKind,
  Dir,
  EnemyKind,
  LevelDef,
  LevelKind,
  SeasonId,
} from './types'

const emptyLevel = (meta: Pick<LevelDef, 'id' | 'seasonId' | 'index' | 'kind' | 'name' | 'subtitle' | 'archetype' | 'parTime'>): LevelDef => ({
  ...meta,
  world: { width: TILE * 48, height: TILE * 18 },
  spawn: { x: TILE * 2, y: TILE * 14 },
  goal: { x: TILE * 45, y: TILE * 13, w: TILE, h: TILE * 2 },
  solids: [],
  platforms: [],
  movers: [],
  springs: [],
  conveyors: [],
  crushers: [],
  lasers: [],
  gears: [],
  portals: [],
  gravityZones: [],
  gravityPads: [],
  fluids: [],
  timed: [],
  collectibles: [],
  enemies: [],
  checkpoints: [],
  secrets: [],
  hazards: [],
  decorations: [],
})

const px = (n: number) => n * TILE

export class LevelWriter {
  readonly L: LevelDef
  private stars = 0
  private commons = 0
  private rares = 0
  private secretsN = 0
  private cps = 0

  constructor(
    seasonId: SeasonId,
    index: number,
    name: string,
    subtitle: string,
    archetype: Archetype,
    parTime: number,
    kind: LevelKind = 'normal',
  ) {
    const id = index === 11 ? `${seasonId}-boss` : `${seasonId}-${String(index).padStart(2, '0')}`
    this.L = emptyLevel({ id, seasonId, index, kind, name, subtitle, archetype, parTime })
  }

  size(w: number, h: number): this {
    this.L.world = { width: px(w), height: px(h) }
    return this
  }

  spawn(x: number, y: number): this {
    this.L.spawn = { x: px(x) + TILE / 2, y: px(y) + TILE / 2 }
    return this
  }

  goal(x: number, y: number, w = 1.4, h = 2.2): this {
    this.L.goal = { x: px(x), y: px(y), w: px(w), h: px(h) }
    return this
  }

  solid(x: number, y: number, w: number, h = 1): this {
    this.L.solids.push({ x: px(x), y: px(y), w: px(w), h: px(h) })
    return this
  }

  /** Ground strip from x to x+w at the bottom of the world, with optional thickness. */
  ground(x: number, w: number, thickness = 3): this {
    const tilesH = this.L.world.height / TILE
    return this.solid(x, tilesH - thickness, w, thickness)
  }

  platform(x: number, y: number, w: number): this {
    this.L.platforms.push({ x: px(x), y: px(y), w: px(w), h: 12, oneWay: true })
    return this
  }

  sticky(x: number, y: number, w: number, h = 1): this {
    this.L.solids.push({ x: px(x), y: px(y), w: px(w), h: px(h), sticky: true })
    return this
  }

  organic(x: number, y: number, w: number, h = 1): this {
    this.L.solids.push({ x: px(x), y: px(y), w: px(w), h: px(h), organic: true })
    return this
  }

  wall(x: number, y: number, h: number, w = 1): this {
    return this.solid(x, y, w, h)
  }

  pit(from: number, to: number, floor = 1): this {
    // visual only — caller omits ground in the gap
    const tilesH = this.L.world.height / TILE
    this.L.hazards.push({
      x: px(from),
      y: px(tilesH - floor),
      w: px(to - from),
      h: px(floor),
      kind: 'spike',
      dir: 'up',
    })
    return this
  }

  spikes(x: number, y: number, w = 1, dir: Dir = 'up'): this {
    this.L.hazards.push({ x: px(x), y: px(y), w: px(w), h: 16, kind: 'spike', dir })
    return this
  }

  thorns(x: number, y: number, w: number, h = 0.4): this {
    this.L.hazards.push({ x: px(x), y: px(y), w: px(w), h: px(h), kind: 'thorn' })
    return this
  }

  spring(x: number, y: number, power?: number, dir: Dir = 'up'): this {
    this.L.springs.push({ x: px(x) + TILE / 2, y: px(y) + TILE / 2, power, dir })
    return this
  }

  mover(x: number, y: number, w: number, ax: number, ay: number, period: number, phase = 0, oneWay = true): this {
    this.L.movers.push({
      x: px(x),
      y: px(y),
      w: px(w),
      h: 16,
      ax: px(ax),
      ay: px(ay),
      period,
      phase,
      oneWay,
    })
    return this
  }

  conveyor(x: number, y: number, w: number, speed: number): this {
    this.L.conveyors.push({ x: px(x), y: px(y), w: px(w), h: 18, speed })
    return this
  }

  crusher(x: number, y: number, w: number, h: number, ax: number, ay: number, period: number, delay = 0): this {
    this.L.crushers.push({
      x: px(x),
      y: px(y),
      w: px(w),
      h: px(h),
      ax: px(ax),
      ay: px(ay),
      period,
      delay,
    })
    return this
  }

  laser(x: number, y: number, length: number, axis: 'h' | 'v', on = 1.1, off = 1.1, phase = 0): this {
    this.L.lasers.push({
      x: px(x),
      y: px(y),
      w: axis === 'h' ? px(length) : 8,
      h: axis === 'v' ? px(length) : 8,
      on,
      off,
      phase,
      axis,
    })
    return this
  }

  gear(x: number, y: number, radius = 1.2, speed = 1.4): this {
    this.L.gears.push({ x: px(x), y: px(y), radius: px(radius), speed })
    return this
  }

  portal(ax: number, ay: number, bx: number, by: number): this {
    this.L.portals.push({
      a: { x: px(ax) + TILE / 2, y: px(ay) + TILE / 2 },
      b: { x: px(bx) + TILE / 2, y: px(by) + TILE / 2 },
    })
    return this
  }

  gravityZone(x: number, y: number, w: number, h: number, gravity: number, flip = false): this {
    this.L.gravityZones.push({ x: px(x), y: px(y), w: px(w), h: px(h), gravity, flip })
    return this
  }

  pad(x: number, y: number): this {
    this.L.gravityPads.push({ x: px(x) + TILE / 2, y: px(y) + TILE / 2 })
    return this
  }

  fluid(x: number, y: number, w: number, h: number, drag = 0.78, toxic = false): this {
    this.L.fluids.push({ x: px(x), y: px(y), w: px(w), h: px(h), drag, toxic })
    return this
  }

  timed(x: number, y: number, w: number, on = 1.4, off = 1.2, phase = 0): this {
    this.L.timed.push({ x: px(x), y: px(y), w: px(w), h: 16, on, off, phase })
    return this
  }

  orb(x: number, y: number, kind: CollectibleKind = 'common'): this {
    const id =
      kind === 'star'
        ? `star-${this.stars++}`
        : kind === 'rare'
          ? `rare-${this.rares++}`
          : kind === 'secret'
            ? `secret-${this.secretsN++}`
            : `orb-${this.commons++}`
    this.L.collectibles.push({ x: px(x) + TILE / 2, y: px(y) + TILE / 2, kind, id })
    return this
  }

  star(x: number, y: number): this {
    return this.orb(x, y, 'star')
  }

  rare(x: number, y: number): this {
    return this.orb(x, y, 'rare')
  }

  secretOrb(x: number, y: number): this {
    return this.orb(x, y, 'secret')
  }

  enemy(kind: EnemyKind, x: number, y: number, path = 3, dir = 1, hp?: number): this {
    this.L.enemies.push({ kind, x: px(x) + TILE / 2, y: px(y) + TILE / 2, path: px(path), dir, hp })
    return this
  }

  checkpoint(x: number, y: number): this {
    this.L.checkpoints.push({ x: px(x) + TILE / 2, y: px(y) + TILE / 2, id: `cp-${this.cps++}` })
    return this
  }

  secret(x: number, y: number, w: number, h: number, id?: string): this {
    this.L.secrets.push({ x: px(x), y: px(y), w: px(w), h: px(h), id: id ?? `room-${this.L.secrets.length}` })
    return this
  }

  deco(x: number, y: number, w: number, h: number): this {
    this.L.decorations.push({ x: px(x), y: px(y), w: px(w), h: px(h) })
    return this
  }

  boss(kind: NonNullable<BossDef['kind']>, x: number, y: number): this {
    this.L.boss = { kind, x: px(x), y: px(y) }
    return this
  }

  /** Outer bounds so the player cannot leave the stage. */
  bounds(thickness = 2): this {
    const w = this.L.world.width / TILE
    const h = this.L.world.height / TILE
    this.solid(-thickness, -thickness, w + thickness * 2, thickness)
    this.solid(-thickness, h, w + thickness * 2, thickness)
    this.wall(-thickness, 0, h, thickness)
    this.wall(w, 0, h, thickness)
    return this
  }

  done(): LevelDef {
    return this.L
  }
}
