import Phaser from 'phaser'
import type { EnemyDef, EnemyKind } from '../core/types'
import type { AudioManager } from '../systems/AudioManager'
import type { ParticleManager } from '../systems/ParticleManager'
import type { Player } from './Player'

type Phase = 'idle' | 'patrol' | 'detect' | 'attack' | 'hit' | 'death' | 'respawn'

export class EnemyActor {
  sprite: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Arc
  kind: EnemyKind
  hp: number
  maxHp: number
  phase: Phase = 'patrol'
  dead = false
  ox: number
  oy: number
  path: number
  dir: number
  timer = 0
  hitTimer = 0
  respawnAt = 0
  detectR = 160
  private eyeL: Phaser.GameObjects.Ellipse
  private eyeR: Phaser.GameObjects.Ellipse
  private vx = 0
  private shootCool = 0
  private bullets: { g: Phaser.GameObjects.Arc; vx: number; vy: number }[] = []
  private scene: Phaser.Scene
  private color: number

  constructor(scene: Phaser.Scene, def: EnemyDef, color: number) {
    this.scene = scene
    this.kind = def.kind
    this.color = color
    this.maxHp = def.hp ?? (def.kind === 'shielded' ? 3 : def.kind === 'chaser' ? 2 : 1)
    this.hp = this.maxHp
    this.ox = def.x
    this.oy = def.y
    this.path = def.path ?? 80
    this.dir = def.dir ?? 1
    this.body = scene.add.circle(0, 0, this.radius(), color, 1)
    this.eyeL = scene.add.ellipse(-5, -3, 5, 8, 0x0e0e10)
    this.eyeR = scene.add.ellipse(5, -3, 5, 8, 0x0e0e10)
    this.sprite = scene.add.container(def.x, def.y, [this.body, this.eyeL, this.eyeR]).setDepth(12)
  }

  radius(): number {
    if (this.kind === 'flyer' || this.kind === 'virus') return 12
    if (this.kind === 'shielded') return 16
    return 14
  }

  update(dt: number, player: Player, audio: AudioManager, particles: ParticleManager, onPlayerHit: (x: number) => void): void {
    if (this.phase === 'death') {
      this.timer -= dt
      this.sprite.alpha = Math.max(0, this.timer)
      this.sprite.scale = 1 + (1 - this.timer) * 0.4
      if (this.timer <= 0) {
        this.phase = 'respawn'
        this.respawnAt = 2.8
        this.sprite.setVisible(false)
      }
      this.updateBullets(dt, player, onPlayerHit)
      return
    }
    if (this.phase === 'respawn') {
      this.respawnAt -= dt
      if (this.respawnAt <= 0) {
        this.hp = this.maxHp
        this.dead = false
        this.phase = 'patrol'
        this.sprite.setPosition(this.ox, this.oy)
        this.sprite.setVisible(true)
        this.sprite.setAlpha(1)
        this.sprite.setScale(1)
      }
      return
    }
    if (this.phase === 'hit') {
      this.hitTimer -= dt
      this.sprite.x += Math.sin(this.hitTimer * 80) * 2
      if (this.hitTimer <= 0) this.phase = 'patrol'
    }

    const dx = player.x - this.sprite.x
    const dy = player.y - this.sprite.y
    const dist = Math.hypot(dx, dy)
    const spotted = dist < this.detectR && this.kind !== 'environmental'

    if (this.phase === 'idle') this.phase = 'patrol'
    if (spotted && this.phase === 'patrol') {
      this.phase = 'detect'
      this.timer = 0.22
    }
    if (this.phase === 'detect') {
      this.timer -= dt
      this.eyeL.scaleY = 1.3
      if (this.timer <= 0) this.phase = 'attack'
    } else {
      this.eyeL.scaleY += (1 - this.eyeL.scaleY) * 0.2
    }

    this.act(dt, player, spotted, dx, dy, dist)
    this.updateBullets(dt, player, onPlayerHit)

    if (!this.dead && dist < this.radius() + 18) {
      if (player.body.velocity.y > 80 && player.y < this.sprite.y) {
        this.hurt(1, audio, particles)
        player.body.setVelocityY(-420)
      } else if (this.kind !== 'environmental') {
        onPlayerHit(this.sprite.x)
      }
    }
  }

  hurt(amount: number, audio: AudioManager, particles: ParticleManager): void {
    if (this.dead) return
    if (this.kind === 'shielded' && this.hp === this.maxHp) {
      this.hp -= 1
      this.phase = 'hit'
      this.hitTimer = 0.25
      audio.playSfx('enemy-hit')
      return
    }
    this.hp -= amount
    this.phase = 'hit'
    this.hitTimer = 0.18
    audio.playSfx('enemy-hit')
    particles.burst(this.sprite.x, this.sprite.y, this.color, 8, 140, true)
    if (this.hp <= 0) {
      this.dead = true
      this.phase = 'death'
      this.timer = 0.35
      audio.playSfx('enemy-death')
      particles.burst(this.sprite.x, this.sprite.y, 0xf5f1ea, 16, 200, true)
    }
  }

  private act(dt: number, player: Player, spotted: boolean, dx: number, dy: number, dist: number): void {
    switch (this.kind) {
      case 'patrol':
      case 'walker':
      case 'virus': {
        const speed = this.kind === 'virus' ? 90 : this.kind === 'walker' ? 55 : 70
        this.sprite.x += this.dir * speed * dt
        if (Math.abs(this.sprite.x - this.ox) > this.path) this.dir *= -1
        this.sprite.y = this.oy + (this.kind === 'virus' ? Math.sin(this.scene.time.now / 180) * 8 : 0)
        break
      }
      case 'jumper': {
        this.timer -= dt
        if (this.timer <= 0) {
          this.vx = this.dir * 120
          this.sprite.y -= 4
          this.timer = 1.2
          this.dir *= -1
        }
        this.sprite.x += this.vx * dt
        this.sprite.y += (this.oy - this.sprite.y) * Math.min(1, dt * 6)
        this.vx *= 0.96
        break
      }
      case 'flyer': {
        this.sprite.x += this.dir * 80 * dt
        this.sprite.y = this.oy + Math.sin(this.scene.time.now / 280) * 28
        if (Math.abs(this.sprite.x - this.ox) > this.path) this.dir *= -1
        break
      }
      case 'chaser': {
        if (spotted && dist < 280) {
          this.sprite.x += Math.sign(dx) * 95 * dt
          this.sprite.y += Math.sign(dy) * 40 * dt
        } else {
          this.sprite.x += this.dir * 50 * dt
          if (Math.abs(this.sprite.x - this.ox) > this.path) this.dir *= -1
        }
        break
      }
      case 'shooter': {
        this.shootCool -= dt
        this.eyeL.x = dx > 0 ? -3 : -7
        if (spotted && this.shootCool <= 0) {
          this.fire(dx, dy, dist)
          this.shootCool = 1.4
        }
        break
      }
      case 'shielded': {
        this.sprite.x += this.dir * 40 * dt
        if (Math.abs(this.sprite.x - this.ox) > this.path) this.dir *= -1
        this.body.setStrokeStyle(3, 0xffffff, this.hp === this.maxHp ? 0.9 : 0.2)
        break
      }
      default:
        break
    }
    const look = Math.sign(player.x - this.sprite.x) || 1
    this.eyeL.x = -5 + look * 1.5
    this.eyeR.x = 5 + look * 1.5
  }

  private fire(dx: number, dy: number, dist: number): void {
    const g = this.scene.add.circle(this.sprite.x, this.sprite.y, 5, 0xffd166, 1).setDepth(13)
    const s = 180
    this.bullets.push({ g, vx: (dx / dist) * s, vy: (dy / dist) * s })
  }

  private updateBullets(dt: number, player: Player, onPlayerHit: (x: number) => void): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!
      b.g.x += b.vx * dt
      b.g.y += b.vy * dt
      if (Phaser.Math.Distance.Between(b.g.x, b.g.y, player.x, player.y) < 20) {
        onPlayerHit(b.g.x)
        b.g.destroy()
        this.bullets.splice(i, 1)
      } else if (b.g.x < -40 || b.g.y < -40 || b.g.x > 8000 || b.g.y > 8000) {
        b.g.destroy()
        this.bullets.splice(i, 1)
      }
    }
  }

  destroy(): void {
    this.bullets.forEach((b) => b.g.destroy())
    this.sprite.destroy()
  }
}

export class EnemyManager {
  enemies: EnemyActor[] = []
  constructor(scene: Phaser.Scene, defs: EnemyDef[], color: number) {
    this.enemies = defs.map((d) => new EnemyActor(scene, d, color))
  }
  update(dt: number, player: Player, audio: AudioManager, particles: ParticleManager, onPlayerHit: (x: number) => void): void {
    for (const e of this.enemies) e.update(dt, player, audio, particles, onPlayerHit)
  }
  nearest(x: number, y: number, r: number): EnemyActor | null {
    let best: EnemyActor | null = null
    let bd = r
    for (const e of this.enemies) {
      if (e.dead) continue
      const d = Math.hypot(e.sprite.x - x, e.sprite.y - y)
      if (d < bd) {
        bd = d
        best = e
      }
    }
    return best
  }
  destroy(): void {
    this.enemies.forEach((e) => e.destroy())
  }
}
