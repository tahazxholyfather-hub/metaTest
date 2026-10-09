import Phaser from 'phaser'
import type { LevelDef } from '../core/types'
import type { AudioManager } from '../systems/AudioManager'
import type { ParticleManager } from '../systems/ParticleManager'
import type { Player } from './Player'

export class WorldObjects {
  solids!: Phaser.Physics.Arcade.StaticGroup
  platforms!: Phaser.Physics.Arcade.StaticGroup
  oneWay: Phaser.Physics.Arcade.Sprite[] = []
  movers: Mover[] = []
  springs: SpringPad[] = []
  conveyors: Conveyor[] = []
  crushers: Crusher[] = []
  lasers: Laser[] = []
  gears: Gear[] = []
  portals: PortalPair[] = []
  pads: GravPad[] = []
  zones: Zone[] = []
  fluids: Fluid[] = []
  timed: TimedPlat[] = []
  hazards: Phaser.Physics.Arcade.StaticGroup
  checkpoints: Phaser.GameObjects.Arc[] = []
  goal!: Phaser.GameObjects.Rectangle
  private scene: Phaser.Scene
  private themeSolid: number
  private themeHi: number
  private themeAccent: number
  private themeHazard: number

  constructor(scene: Phaser.Scene, def: LevelDef, colors: { solid: number; hi: number; accent: number; hazard: number }) {
    this.scene = scene
    this.themeSolid = colors.solid
    this.themeHi = colors.hi
    this.themeAccent = colors.accent
    this.themeHazard = colors.hazard
    this.solids = scene.physics.add.staticGroup()
    this.platforms = scene.physics.add.staticGroup()
    this.hazards = scene.physics.add.staticGroup()

    for (const s of def.solids) {
      const r = this.block(s.x, s.y, s.w, s.h, s.sticky ? 0x6a4c93 : s.organic ? 0xff8fa3 : this.themeSolid, this.themeHi)
      this.solids.add(r)
      if (s.sticky) r.setData('sticky', true)
    }
    for (const p of def.platforms) {
      const r = this.block(p.x, p.y, p.w, p.h, this.themeHi, this.themeAccent)
      r.setData('oneWay', true)
      this.platforms.add(r)
      this.oneWay.push(r)
    }
    for (const m of def.movers) this.movers.push(new Mover(scene, m, this.themeHi))
    for (const s of def.springs) this.springs.push(new SpringPad(scene, s.x, s.y, s.power ?? 1080, s.dir ?? 'up', this.themeAccent))
    for (const c of def.conveyors) this.conveyors.push(new Conveyor(scene, c, this.themeAccent))
    for (const c of def.crushers) this.crushers.push(new Crusher(scene, c, this.themeHazard))
    for (const l of def.lasers) this.lasers.push(new Laser(scene, l, this.themeHazard))
    for (const g of def.gears) this.gears.push(new Gear(scene, g.x, g.y, g.radius, g.speed, this.themeHi))
    for (const p of def.portals) this.portals.push(new PortalPair(scene, p.a.x, p.a.y, p.b.x, p.b.y, this.themeAccent))
    for (const p of def.gravityPads) this.pads.push(new GravPad(scene, p.x, p.y, this.themeAccent))
    for (const z of def.gravityZones) this.zones.push(new Zone(z.x, z.y, z.w, z.h, z.gravity, z.flip ?? false))
    for (const f of def.fluids) this.fluids.push(new Fluid(scene, f, f.toxic ? 0x80ffdb : 0x4cc9f0))
    for (const t of def.timed) this.timed.push(new TimedPlat(scene, t, this.themeHi))
    for (const h of def.hazards) {
      const hz = this.block(h.x, h.y, h.w, h.h, this.themeHazard, 0xff6b6b)
      hz.setData('hazard', true)
      this.hazards.add(hz)
    }
    for (const c of def.checkpoints) {
      const a = scene.add.circle(c.x, c.y, 10, this.themeAccent, 0.7).setDepth(8)
      a.setData('id', c.id)
      a.setData('x', c.x)
      a.setData('y', c.y)
      a.setData('armed', false)
      this.checkpoints.push(a)
    }
    this.goal = scene.add.rectangle(def.goal.x + def.goal.w / 2, def.goal.y + def.goal.h / 2, def.goal.w, def.goal.h, this.themeAccent, 0.35)
    this.goal.setStrokeStyle(3, 0xffffff, 0.8)
    this.goal.setDepth(6)
    scene.add.circle(this.goal.x, this.goal.y - def.goal.h / 2 + 8, 6, 0xffffff, 0.9).setDepth(7)
  }

  colliderTargets(): Phaser.Physics.Arcade.Sprite[] {
    const list: Phaser.Physics.Arcade.Sprite[] = []
    this.movers.forEach((m) => list.push(m.sprite))
    this.conveyors.forEach((c) => list.push(c.sprite))
    this.timed.forEach((t) => {
      if (t.active) list.push(t.sprite)
    })
    return list
  }

  update(t: number, dt: number, player: Player, audio: AudioManager, particles: ParticleManager, onHurt: (x: number) => void): void {
    for (const m of this.movers) m.update(t, player)
    for (const s of this.springs) s.update(player, audio, particles)
    for (const c of this.conveyors) c.update(player)
    for (const c of this.crushers) c.update(t, player, onHurt)
    for (const l of this.lasers) l.update(t, player, audio, onHurt)
    for (const g of this.gears) g.update(dt, player, onHurt)
    for (const p of this.portals) p.update(player, audio, particles)
    for (const p of this.pads) p.update(player, audio)
    for (const z of this.zones) z.apply(player)
    for (const f of this.fluids) f.update(player, onHurt, dt)
    for (const tm of this.timed) tm.update(t)
    this.goal.alpha = 0.28 + Math.sin(t * 3) * 0.12
  }

  private block(x: number, y: number, w: number, h: number, fill: number, hi: number): Phaser.Physics.Arcade.Sprite {
    const key = `blk-${Math.round(w)}x${Math.round(h)}-${fill}`
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 })
      g.fillStyle(fill, 1)
      g.fillRoundedRect(0, 0, w, h, Math.min(8, h / 3, w / 6))
      g.fillStyle(hi, 0.35)
      g.fillRect(0, 0, w, Math.max(3, h * 0.18))
      g.generateTexture(key, w, h)
      g.destroy()
    }
    const s = this.scene.physics.add.staticSprite(x + w / 2, y + h / 2, key)
    s.setDepth(5)
    return s
  }
}

class Mover {
  sprite: Phaser.Physics.Arcade.Sprite
  ox: number
  oy: number
  ax: number
  ay: number
  period: number
  phase: number
  constructor(scene: Phaser.Scene, m: { x: number; y: number; w: number; h: number; ax: number; ay: number; period: number; phase?: number }, color: number) {
    const g = scene.add.rectangle(0, 0, m.w, m.h, color, 1)
    const rt = scene.add.renderTexture(0, 0, m.w, m.h)
    rt.draw(g, m.w / 2, m.h / 2)
    g.destroy()
    const key = `mover-${Math.random().toString(36).slice(2, 7)}`
    rt.saveTexture(key)
    rt.destroy()
    this.sprite = scene.physics.add.sprite(m.x + m.w / 2, m.y + m.h / 2, key)
    this.sprite.setImmovable(true)
    ;(this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.sprite.setDepth(6)
    this.ox = this.sprite.x
    this.oy = this.sprite.y
    this.ax = m.ax
    this.ay = m.ay
    this.period = m.period
    this.phase = m.phase ?? 0
  }
  update(t: number, player: Player): void {
    const prevX = this.sprite.x
    const prevY = this.sprite.y
    const u = Math.sin(((t + this.phase) / this.period) * Math.PI * 2)
    const nx = this.ox + this.ax * u
    const ny = this.oy + this.ay * u
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.reset(nx, ny)
    const onTop =
      player.body.touching.down &&
      Math.abs(player.x - nx) < this.sprite.displayWidth / 2 + 10 &&
      player.y < ny
    if (onTop) {
      player.sprite.x += nx - prevX
      player.sprite.y += ny - prevY
    }
  }
}

class SpringPad {
  sprite: Phaser.GameObjects.Rectangle
  power: number
  dir: 'up' | 'down' | 'left' | 'right'
  cool = 0
  constructor(scene: Phaser.Scene, x: number, y: number, power: number, dir: 'up' | 'down' | 'left' | 'right', color: number) {
    this.sprite = scene.add.rectangle(x, y, 28, 14, color, 1).setDepth(7)
    this.power = power
    this.dir = dir
  }
  update(player: Player, audio: AudioManager, particles: ParticleManager): void {
    this.cool = Math.max(0, this.cool - 0.016)
    if (this.cool > 0) return
    if (Phaser.Math.Distance.Between(player.x, player.y, this.sprite.x, this.sprite.y) < 28) {
      player.bounce(this.power, this.dir)
      audio.playSfx('spring')
      particles.burst(this.sprite.x, this.sprite.y, 0xffe08a, 8, 160, true)
      this.cool = 0.25
      this.sprite.scaleY = 0.5
    }
    this.sprite.scaleY += (1 - this.sprite.scaleY) * 0.2
  }
}

class Conveyor {
  sprite: Phaser.Physics.Arcade.Sprite
  speed: number
  constructor(scene: Phaser.Scene, c: { x: number; y: number; w: number; h: number; speed: number }, color: number) {
    const g = scene.add.rectangle(0, 0, c.w, c.h, color, 0.95)
    const key = `conv-${Math.round(c.w)}-${c.speed}`
    if (!scene.textures.exists(key)) {
      const rt = scene.add.renderTexture(0, 0, c.w, c.h)
      rt.draw(g, c.w / 2, c.h / 2)
      rt.saveTexture(key)
      rt.destroy()
    }
    g.destroy()
    this.sprite = scene.physics.add.sprite(c.x + c.w / 2, c.y + c.h / 2, key)
    this.sprite.setImmovable(true)
    ;(this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.speed = c.speed
    this.sprite.setDepth(6)
  }
  update(player: Player): void {
    if (player.body.touching.down && Math.abs(player.y - this.sprite.y) < 28 && Math.abs(player.x - this.sprite.x) < this.sprite.displayWidth / 2) {
      player.body.setVelocityX(player.body.velocity.x + this.speed * 0.05)
      player.sprite.x += this.speed * (1 / 60)
    }
  }
}

class Crusher {
  sprite: Phaser.GameObjects.Rectangle
  ox: number
  oy: number
  ax: number
  ay: number
  period: number
  delay: number
  constructor(scene: Phaser.Scene, c: { x: number; y: number; w: number; h: number; ax: number; ay: number; period: number; delay?: number }, color: number) {
    this.sprite = scene.add.rectangle(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, color, 1).setDepth(9)
    this.ox = this.sprite.x
    this.oy = this.sprite.y
    this.ax = c.ax
    this.ay = c.ay
    this.period = c.period
    this.delay = c.delay ?? 0
  }
  update(t: number, player: Player, onHurt: (x: number) => void): void {
    const u = (Math.sin(((t + this.delay) / this.period) * Math.PI * 2) + 1) / 2
    this.sprite.x = this.ox + this.ax * u
    this.sprite.y = this.oy + this.ay * u
    if (overlapRect(player, this.sprite)) onHurt(this.sprite.x)
  }
}

class Laser {
  gfx: Phaser.GameObjects.Rectangle
  on: number
  off: number
  phase: number
  live = false
  constructor(scene: Phaser.Scene, l: { x: number; y: number; w: number; h: number; on: number; off: number; phase?: number }, color: number) {
    this.gfx = scene.add.rectangle(l.x + l.w / 2, l.y + l.h / 2, l.w, l.h, color, 0.85).setDepth(8)
    this.on = l.on
    this.off = l.off
    this.phase = l.phase ?? 0
  }
  update(t: number, player: Player, audio: AudioManager, onHurt: (x: number) => void): void {
    const cycle = this.on + this.off
    const u = (t + this.phase) % cycle
    this.live = u < this.on
    this.gfx.setAlpha(this.live ? 0.85 : 0.08)
    if (this.live && overlapRect(player, this.gfx)) {
      audio.playSfx('laser', { volume: 0.3 })
      onHurt(this.gfx.x)
    }
  }
}

class Gear {
  sprite: Phaser.GameObjects.Arc
  teeth: Phaser.GameObjects.Arc[]
  speed: number
  radius: number
  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, speed: number, color: number) {
    this.radius = radius
    this.speed = speed
    this.sprite = scene.add.circle(x, y, radius, color, 1).setDepth(8)
    this.teeth = []
    for (let i = 0; i < 8; i++) {
      this.teeth.push(scene.add.circle(x, y, radius * 0.22, color, 1).setDepth(8))
    }
  }
  update(dt: number, player: Player, onHurt: (x: number) => void): void {
    this.sprite.rotation += this.speed * dt
    this.teeth.forEach((t, i) => {
      const a = this.sprite.rotation + (i / 8) * Math.PI * 2
      t.x = this.sprite.x + Math.cos(a) * this.radius
      t.y = this.sprite.y + Math.sin(a) * this.radius
    })
    if (Phaser.Math.Distance.Between(player.x, player.y, this.sprite.x, this.sprite.y) < this.radius + 16) {
      onHurt(this.sprite.x)
    }
  }
}

class PortalPair {
  a: Phaser.GameObjects.Arc
  b: Phaser.GameObjects.Arc
  cool = 0
  constructor(scene: Phaser.Scene, ax: number, ay: number, bx: number, by: number, color: number) {
    this.a = scene.add.circle(ax, ay, 16, color, 0.7).setStrokeStyle(3, 0xffffff, 0.8).setDepth(8)
    this.b = scene.add.circle(bx, by, 16, color, 0.7).setStrokeStyle(3, 0xffffff, 0.8).setDepth(8)
  }
  update(player: Player, audio: AudioManager, particles: ParticleManager): void {
    this.cool = Math.max(0, this.cool - 0.016)
    this.a.scale = 1 + Math.sin(player.sprite.scene.time.now / 200) * 0.08
    this.b.scale = 1 + Math.sin(player.sprite.scene.time.now / 200 + 1) * 0.08
    if (this.cool > 0) return
    if (Phaser.Math.Distance.Between(player.x, player.y, this.a.x, this.a.y) < 22) {
      player.sprite.setPosition(this.b.x, this.b.y)
      this.cool = 0.6
      audio.playSfx('portal')
      particles.burst(this.b.x, this.b.y, 0x4cc9f0, 12, 140, true)
    } else if (Phaser.Math.Distance.Between(player.x, player.y, this.b.x, this.b.y) < 22) {
      player.sprite.setPosition(this.a.x, this.a.y)
      this.cool = 0.6
      audio.playSfx('portal')
      particles.burst(this.a.x, this.a.y, 0x4cc9f0, 12, 140, true)
    }
  }
}

class GravPad {
  sprite: Phaser.GameObjects.Ellipse
  cool = 0
  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    this.sprite = scene.add.ellipse(x, y, 36, 14, color, 0.8).setDepth(7)
  }
  update(player: Player, audio: AudioManager): void {
    this.cool = Math.max(0, this.cool - 0.016)
    if (this.cool > 0) return
    if (Phaser.Math.Distance.Between(player.x, player.y, this.sprite.x, this.sprite.y) < 26) {
      player.setGravity(-player.gravitySign)
      audio.playSfx('portal', { detune: -200 })
      this.cool = 0.8
    }
  }
}

class Zone {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public gravity: number,
    public flip: boolean,
  ) {}
  apply(player: Player): void {
    if (player.x > this.x && player.x < this.x + this.w && player.y > this.y && player.y < this.y + this.h) {
      player.setWorldGravity(this.gravity)
    }
  }
}

class Fluid {
  rect: Phaser.GameObjects.Rectangle
  drag: number
  toxic: boolean
  constructor(scene: Phaser.Scene, f: { x: number; y: number; w: number; h: number; drag: number; toxic?: boolean }, color: number) {
    this.rect = scene.add.rectangle(f.x + f.w / 2, f.y + f.h / 2, f.w, f.h, color, f.toxic ? 0.35 : 0.22).setDepth(4)
    this.drag = f.drag
    this.toxic = !!f.toxic
  }
  update(player: Player, onHurt: (x: number) => void, dt: number): void {
    if (overlapRect(player, this.rect)) {
      player.fluidDrag = this.drag
      player.body.setVelocity(player.body.velocity.x * (1 - 1.8 * dt), player.body.velocity.y * (1 - 1.2 * dt))
      if (this.toxic) {
        player.toxicTimer += dt
        if (player.toxicTimer > 0.45) {
          player.toxicTimer = 0
          onHurt(this.rect.x)
        }
      }
    }
  }
}

class TimedPlat {
  sprite: Phaser.Physics.Arcade.Sprite
  on: number
  off: number
  phase: number
  active = true
  constructor(scene: Phaser.Scene, t: { x: number; y: number; w: number; h: number; on: number; off: number; phase?: number }, color: number) {
    const g = scene.add.rectangle(0, 0, t.w, t.h, color, 1)
    const key = `timed-${Math.round(t.w)}-${t.on}`
    if (!scene.textures.exists(key)) {
      const rt = scene.add.renderTexture(0, 0, t.w, t.h)
      rt.draw(g, t.w / 2, t.h / 2)
      rt.saveTexture(key)
      rt.destroy()
    }
    g.destroy()
    this.sprite = scene.physics.add.sprite(t.x + t.w / 2, t.y + t.h / 2, key)
    this.sprite.setImmovable(true)
    ;(this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.on = t.on
    this.off = t.off
    this.phase = t.phase ?? 0
  }
  update(t: number): void {
    const cycle = this.on + this.off
    const u = (t + this.phase) % cycle
    this.active = u < this.on
    this.sprite.setAlpha(this.active ? 1 : 0.15)
    this.sprite.body!.enable = this.active
  }
}

function overlapRect(player: Player, r: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse): boolean {
  const w = 'width' in r ? (r as Phaser.GameObjects.Rectangle).width : 20
  const h = 'height' in r ? (r as Phaser.GameObjects.Rectangle).height : 20
  return Math.abs(player.x - r.x) < w / 2 + 16 && Math.abs(player.y - r.y) < h / 2 + 16
}
