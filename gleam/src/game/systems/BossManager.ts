import Phaser from 'phaser'
import type { BossDef, ThemePalette } from '../../core/types'
import { bus } from '../../core/events'
import type { Player } from '../entities/Player'
import type { ParticleManager } from './ParticleManager'
import type { AudioManager } from '../../core/AudioManager'

export class BossManager {
  sprite: Phaser.Physics.Arcade.Sprite | null = null
  private def: BossDef | null = null
  phase = 0
  hp = 0
  maxHp = 0
  alive = false
  private timer = 0
  private telegraph = 0
  private attack = ''
  private weak = false
  private orbs: Phaser.Physics.Arcade.Group | null = null

  constructor(
    private scene: Phaser.Scene,
    private theme: ThemePalette,
    private particles: ParticleManager,
    private audio: AudioManager,
  ) {}

  spawn(def: BossDef): void {
    this.def = def
    this.phase = 0
    this.maxHp = def.phases.reduce((n, p) => n + p.hp, 0)
    this.hp = this.maxHp
    this.alive = true
    const key = this.tex(def.kind)
    this.sprite = this.scene.physics.add.sprite(def.x, def.y, key)
    this.sprite.setDepth(16)
    this.sprite.setBounce(0.1)
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setSize(72, 72)
    body.setImmovable(true)
    body.setAllowGravity(false)
    this.orbs = this.scene.physics.add.group({ allowGravity: false })
    this.enterPhase(0)
  }

  get projectiles(): Phaser.Physics.Arcade.Group | null {
    return this.orbs
  }

  private tex(kind: string): string {
    const key = `boss-${kind}`
    if (this.scene.textures.exists(key)) return key
    const g = this.scene.make.graphics({ x: 0, y: 0 })
    if (kind === 'grove-guardian') {
      g.fillStyle(0x3d7a3a, 1)
      g.fillCircle(48, 52, 40)
      g.fillStyle(0x6bbf4e, 1)
      g.fillCircle(48, 40, 28)
      g.fillStyle(0xf2c14e, 1)
      g.fillCircle(48, 44, 10)
      g.fillStyle(0x1a2410, 1)
      g.fillEllipse(38, 38, 6, 10)
      g.fillEllipse(58, 38, 6, 10)
    } else if (kind === 'gear-titan') {
      g.fillStyle(0x8a9099, 1)
      g.fillCircle(48, 48, 40)
      g.lineStyle(8, 0x23272d, 1)
      g.strokeCircle(48, 48, 32)
      g.fillStyle(0xe8a838, 1)
      g.fillCircle(48, 48, 12)
    } else if (kind === 'gravity-warden') {
      g.fillStyle(0x4b3c9c, 1)
      g.fillCircle(48, 48, 36)
      g.lineStyle(3, 0x6cf0ff, 1)
      g.strokeCircle(48, 48, 42)
      g.fillStyle(0xff72d2, 1)
      g.fillCircle(48, 48, 10)
    } else {
      g.fillStyle(0xc45c8a, 1)
      g.fillCircle(48, 48, 38)
      g.fillStyle(0x7dff8a, 0.8)
      g.fillCircle(32, 40, 10)
      g.fillCircle(64, 40, 10)
      g.fillCircle(48, 64, 12)
      g.fillStyle(0x1a0c14, 1)
      g.fillCircle(48, 48, 8)
    }
    g.generateTexture(key, 96, 96)
    g.destroy()
    return key
  }

  update(dt: number, player: Player): void {
    if (!this.alive || !this.sprite || !this.def) return
    this.timer += dt
    this.telegraph = Math.max(0, this.telegraph - dt)
    const kind = this.def.kind
    const s = this.sprite
    s.y += Math.sin(this.timer * 2) * 8 * dt * 60 * 0.02

    if (this.telegraph > 0) {
      s.setTint(0xffffff)
      return
    }
    s.clearTint()

    if (kind === 'grove-guardian') this.grove(dt, player)
    else if (kind === 'gear-titan') this.gear(dt, player)
    else if (kind === 'gravity-warden') this.warden(dt, player)
    else this.virus(dt, player)
  }

  tryHit(player: Player): boolean {
    if (!this.alive || !this.sprite) return false
    if (!this.weak && this.def?.kind !== 'grove-guardian') {
      if (this.telegraph > 0) return this.damage(player)
      return false
    }
    return this.damage(player)
  }

  private damage(player: Player): boolean {
    if (!this.sprite || !this.def) return false
    this.hp -= 1
    this.weak = false
    this.audio.playSfx('boss-hit')
    this.particles.burst(this.sprite.x, this.sprite.y, 0xffe27a, 16, 200)
    bus.emit('shake', { mag: 10, dur: 180 })
    bus.emit('hitstop', { ms: 70 })
    bus.emit('boss-hit', { hp: this.hp, max: this.maxHp })
    player.bounceEnemy()
    let acc = 0
    for (let i = 0; i < this.def.phases.length; i++) {
      acc += this.def.phases[i]!.hp
      if (this.hp === this.maxHp - acc) this.enterPhase(i + 1)
    }
    if (this.hp <= 0) this.die()
    return true
  }

  private enterPhase(i: number): void {
    if (!this.def) return
    this.phase = Math.min(i, this.def.phases.length - 1)
    const p = this.def.phases[this.phase]
    if (!p) return
    this.audio.playSfx('boss-phase')
    bus.emit('boss-phase', { phase: this.phase, name: p.name })
    bus.emit('shake', { mag: 14, dur: 280 })
    this.telegraph = 0.8
    this.timer = 0
  }

  private grove(dt: number, player: Player): void {
    void dt
    const s = this.sprite!
    if (this.timer > 1.8) {
      this.timer = 0
      this.attack = 'slam'
      this.telegraph = 0.45
      this.scene.time.delayedCall(450, () => {
        if (!this.alive) return
        this.weak = true
        bus.emit('shake', { mag: 16, dur: 200 })
        this.particles.burst(s.x, s.y + 40, 0x6bbf4e, 18, 220)
        this.fire(s.x, s.y + 20, 0, 0, 3)
        this.scene.time.delayedCall(700, () => (this.weak = false))
      })
    }
    s.x += Math.sign(player.sprite.x - s.x) * 40 * dt
  }

  private gear(dt: number, player: Player): void {
    const s = this.sprite!
    s.rotation += dt * (1.2 + this.phase)
    if (this.timer > 1.5) {
      this.timer = 0
      this.telegraph = 0.35
      this.weak = true
      this.scene.time.delayedCall(900, () => (this.weak = false))
      const dir = Math.sign(player.sprite.x - s.x) || 1
      this.fire(s.x, s.y, dir * 180, -40, 1)
    }
    if (this.phase >= 1 && Math.random() < dt * 0.6) {
      this.fire(s.x, s.y, Phaser.Math.Between(-160, 160), 180, 1)
    }
  }

  private warden(dt: number, player: Player): void {
    const s = this.sprite!
    s.x = this.def!.x + Math.sin(this.timer * 0.6) * 180
    if (this.timer > 2.2) {
      this.timer = 0
      this.telegraph = 0.5
      this.weak = true
      bus.emit('boss-phase', { phase: this.phase, name: 'Gravity pulse' })
      player.gravityMode = this.phase === 0 ? 'low' : this.phase === 1 ? 'up' : 'flip'
      this.scene.time.delayedCall(1400, () => {
        player.gravityMode = 'low'
        this.weak = false
      })
      this.ring(s.x, s.y)
    }
  }

  private virus(dt: number, player: Player): void {
    const s = this.sprite!
    const ang = Math.atan2(player.sprite.y - s.y, player.sprite.x - s.x)
    s.x += Math.cos(ang) * (50 + this.phase * 25) * dt
    s.y += Math.sin(ang) * (30 + this.phase * 10) * dt
    if (this.timer > 1.4) {
      this.timer = 0
      this.telegraph = 0.4
      this.weak = true
      this.scene.time.delayedCall(800, () => (this.weak = false))
      this.ring(s.x, s.y)
      if (this.phase >= 1) {
        this.fire(s.x, s.y, 140, 0, 1)
        this.fire(s.x, s.y, -140, 0, 1)
      }
    }
  }

  private fire(x: number, y: number, vx: number, vy: number, n: number): void {
    if (!this.orbs) return
    const key = 'boss-orb'
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffe27a, 1)
      g.fillCircle(8, 8, 8)
      g.generateTexture(key, 16, 16)
      g.destroy()
    }
    for (let i = 0; i < n; i++) {
      const o = this.orbs.create(x + (i - n / 2) * 18, y, key) as Phaser.Physics.Arcade.Sprite
      o.setVelocity(vx + (i - 1) * 40, vy)
      o.setDepth(15)
      this.scene.time.delayedCall(2600, () => o.destroy())
    }
  }

  private ring(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.fire(x, y, Math.cos(a) * 160, Math.sin(a) * 160, 1)
    }
  }

  private die(): void {
    this.alive = false
    this.audio.playSfx('complete')
    if (this.sprite) {
      this.particles.burst(this.sprite.x, this.sprite.y, 0xffffff, 28, 280)
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scale: 2.2,
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => this.sprite?.destroy(),
      })
    }
  }
}
