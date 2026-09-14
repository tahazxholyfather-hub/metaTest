import Phaser from 'phaser'
import type { EnemyDef, EnemyKind, ThemePalette } from '../../core/types'
import { bus } from '../../core/events'
import type { Player } from '../entities/Player'
import type { ParticleManager } from './ParticleManager'
import type { AudioManager } from '../../core/AudioManager'

export interface EnemySprite extends Phaser.Physics.Arcade.Sprite {
  kind: EnemyKind
  hp: number
  maxHp: number
  dir: number
  homeX: number
  patrol: number
  state: 'idle' | 'patrol' | 'detect' | 'attack' | 'hit' | 'dead'
  stun: number
  timer: number
  shielded: boolean
}

const COLORS: Record<EnemyKind, number> = {
  patrol: 0x3d5a3a,
  walker: 0x5b4a32,
  jumper: 0x6b8f3a,
  flyer: 0x4a6d8c,
  shooter: 0x8c3a3a,
  chaser: 0x8c4a18,
  shielded: 0x6a6e78,
  environmental: 0x7a3a5a,
}

export class EnemyManager {
  group: Phaser.Physics.Arcade.Group
  private list: EnemySprite[] = []
  private projectiles: Phaser.Physics.Arcade.Group

  constructor(
    private scene: Phaser.Scene,
    private theme: ThemePalette,
    private particles: ParticleManager,
    private audio: AudioManager,
  ) {
    this.group = scene.physics.add.group({ allowGravity: true })
    this.projectiles = scene.physics.add.group({ allowGravity: false })
  }

  spawnAll(defs: EnemyDef[], variant: string): void {
    for (const d of defs) this.spawn(d, variant)
  }

  get projectilesGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles
  }

  private spawn(def: EnemyDef, variant: string): void {
    const key = this.ensureTexture(def.kind, variant)
    const s = this.scene.physics.add.sprite(def.x, def.y, key) as EnemySprite
    s.kind = def.kind
    s.hp = def.hp ?? (def.kind === 'shielded' ? 3 : 1)
    s.maxHp = s.hp
    s.dir = 1
    s.homeX = def.x
    s.patrol = def.patrol ?? 90
    s.state = 'patrol'
    s.stun = 0
    s.timer = Math.random() * 0.5
    s.shielded = def.kind === 'shielded'
    s.setDepth(12)
    s.setBounce(0)
    s.setCollideWorldBounds(false)
    const body = s.body as Phaser.Physics.Arcade.Body
    body.setSize(26, 26)
    if (def.kind === 'flyer') {
      body.setAllowGravity(false)
      s.setVelocityX(70)
    }
    this.group.add(s)
    this.list.push(s)
  }

  private ensureTexture(kind: EnemyKind, variant: string): string {
    const key = `en-${kind}-${variant}`
    if (this.scene.textures.exists(key)) return key
    const g = this.scene.make.graphics({ x: 0, y: 0 })
    const color = COLORS[kind]
    g.fillStyle(color, 1)
    if (kind === 'flyer') {
      g.fillEllipse(16, 16, 28, 18)
      g.fillStyle(0x111111, 1)
      g.fillCircle(10, 14, 3)
      g.fillCircle(22, 14, 3)
    } else if (kind === 'jumper') {
      g.fillRoundedRect(4, 8, 24, 20, 8)
      g.fillStyle(0x111111, 1)
      g.fillCircle(12, 16, 2.5)
      g.fillCircle(20, 16, 2.5)
    } else if (kind === 'shielded') {
      g.fillCircle(16, 16, 14)
      g.lineStyle(3, 0xcfd6de, 1)
      g.strokeCircle(16, 16, 14)
    } else if (kind === 'shooter') {
      g.fillTriangle(4, 28, 16, 4, 28, 28)
      g.fillStyle(0x111111, 1)
      g.fillCircle(16, 16, 3)
    } else if (kind === 'chaser') {
      g.fillCircle(16, 16, 13)
      g.fillStyle(0xffcc66, 1)
      g.fillCircle(11, 14, 3)
      g.fillCircle(21, 14, 3)
    } else if (kind === 'environmental') {
      g.fillStyle(0x7dff8a, 0.9)
      g.fillCircle(16, 16, 12)
      g.fillStyle(0x1a0c14, 1)
      g.fillCircle(16, 16, 4)
    } else {
      g.fillRoundedRect(3, 6, 26, 22, 7)
      g.fillStyle(0x111111, 1)
      g.fillCircle(11, 15, 2.4)
      g.fillCircle(21, 15, 2.4)
    }
    g.generateTexture(key, 32, 32)
    g.destroy()
    return key
  }

  update(dt: number, player: Player): void {
    const px = player.sprite.x
    const py = player.sprite.y
    for (const e of this.list) {
      if (e.state === 'dead' || !e.active) continue
      e.timer += dt
      e.stun = Math.max(0, e.stun - dt)
      if (e.stun > 0) continue
      const body = e.body as Phaser.Physics.Arcade.Body
      const dist = Phaser.Math.Distance.Between(e.x, e.y, px, py)

      if (dist < 220 && e.state === 'patrol') e.state = 'detect'
      if (dist > 280 && e.state === 'detect') e.state = 'patrol'

      switch (e.kind) {
        case 'flyer':
          e.y += Math.sin(e.timer * 3) * 18 * dt
          if (Math.abs(e.x - e.homeX) > e.patrol) e.dir *= -1
          e.setVelocityX(80 * e.dir)
          break
        case 'jumper':
          if (body.blocked.down && e.timer > 1.1) {
            e.setVelocityY(-420)
            e.timer = 0
            e.state = 'attack'
          }
          e.setVelocityX(40 * e.dir)
          if (body.blocked.left || body.blocked.right) e.dir *= -1
          break
        case 'chaser':
          if (dist < 260) {
            e.state = 'attack'
            e.setVelocityX(Math.sign(px - e.x) * 150)
          } else {
            e.setVelocityX(50 * e.dir)
            if (Math.abs(e.x - e.homeX) > e.patrol) e.dir *= -1
          }
          break
        case 'shooter':
          e.setVelocityX(0)
          if (e.timer > 1.6) {
            e.timer = 0
            e.state = 'attack'
            this.shoot(e, px, py)
          }
          break
        case 'shielded':
          e.setVelocityX(55 * e.dir)
          if (body.blocked.left || body.blocked.right) e.dir *= -1
          break
        case 'environmental':
          e.x = e.homeX + Math.sin(e.timer * 1.2) * e.patrol
          e.setVelocity(0, 0)
          body.setAllowGravity(false)
          break
        default:
          e.setVelocityX(70 * e.dir)
          if (body.blocked.left || body.blocked.right || Math.abs(e.x - e.homeX) > e.patrol) e.dir *= -1
      }
      e.setFlipX(e.dir < 0)
    }
  }

  private shoot(e: EnemySprite, px: number, py: number): void {
    const key = 'en-shot'
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xff6655, 1)
      g.fillCircle(6, 6, 6)
      g.generateTexture(key, 12, 12)
      g.destroy()
    }
    const b = this.projectiles.create(e.x, e.y, key) as Phaser.Physics.Arcade.Sprite
    const ang = Math.atan2(py - e.y, px - e.x)
    b.setVelocity(Math.cos(ang) * 220, Math.sin(ang) * 220)
    b.setDepth(14)
    this.scene.time.delayedCall(2400, () => b.destroy())
  }

  stomp(e: EnemySprite, player: Player): boolean {
    if (e.state === 'dead') return false
    if (e.shielded && e.hp > 1) {
      e.hp -= 1
      e.stun = 0.25
      e.state = 'hit'
      this.audio.playSfx('enemy-hit')
      this.particles.burst(e.x, e.y, 0xcfd6de, 6, 80)
      player.bounceEnemy()
      return true
    }
    this.kill(e)
    player.bounceEnemy()
    return true
  }

  hit(e: EnemySprite): void {
    if (e.state === 'dead') return
    e.hp -= 1
    e.state = 'hit'
    e.stun = 0.2
    this.audio.playSfx('enemy-hit')
    if (e.hp <= 0) this.kill(e)
  }

  private kill(e: EnemySprite): void {
    e.state = 'dead'
    this.audio.playSfx('enemy-death')
    this.particles.burst(e.x, e.y, COLORS[e.kind], 12, 160)
    bus.emit('shake', { mag: 4, dur: 80 })
    this.scene.tweens.add({
      targets: e,
      alpha: 0,
      scale: 0.2,
      duration: 180,
      onComplete: () => {
        e.disableBody(true, true)
        this.scene.time.delayedCall(2400, () => {
          e.enableBody(true, e.homeX, e.y, true, true)
          e.setAlpha(1).setScale(1)
          e.hp = e.maxHp
          e.state = 'patrol'
        })
      },
    })
  }
}
