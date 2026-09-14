import Phaser from 'phaser'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: number
  gravity: number
  drag: number
}

/**
 * Tiny pooled particle renderer. Caps live particles for mobile.
 */
export class ParticleManager {
  private pool: Particle[] = []
  private live: Particle[] = []
  private gfx: Phaser.GameObjects.Graphics
  private maxLive: number

  constructor(scene: Phaser.Scene, maxLive = 180) {
    this.gfx = scene.add.graphics().setDepth(40)
    this.maxLive = maxLive
    for (let i = 0; i < maxLive; i++) {
      this.pool.push(this.make())
    }
  }

  burst(
    x: number,
    y: number,
    color: number,
    n: number,
    speed = 180,
    enabled = true,
  ): void {
    if (!enabled) return
    const count = Math.min(n, this.maxLive - this.live.length)
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop() ?? this.make()
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.35 + Math.random() * 0.75)
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * s
      p.vy = Math.sin(a) * s
      p.life = 0.25 + Math.random() * 0.45
      p.max = p.life
      p.size = 2 + Math.random() * 3.5
      p.color = color
      p.gravity = 420
      p.drag = 2.8
      this.live.push(p)
    }
  }

  dust(x: number, y: number, dir: number, enabled: boolean): void {
    if (!enabled) return
    for (let i = 0; i < 6; i++) {
      const p = this.pool.pop() ?? this.make()
      p.x = x
      p.y = y
      p.vx = -dir * (40 + Math.random() * 70) + (Math.random() - 0.5) * 30
      p.vy = -20 - Math.random() * 50
      p.life = 0.28
      p.max = 0.28
      p.size = 2 + Math.random() * 2
      p.color = 0xf5f1ea
      p.gravity = 200
      p.drag = 4
      this.live.push(p)
    }
  }

  trail(x: number, y: number, color: number, enabled: boolean): void {
    if (!enabled) return
    if (this.live.length > this.maxLive - 4) return
    const p = this.pool.pop() ?? this.make()
    p.x = x
    p.y = y
    p.vx = 0
    p.vy = 0
    p.life = 0.18
    p.max = 0.18
    p.size = 10
    p.color = color
    p.gravity = 0
    p.drag = 0
    this.live.push(p)
  }

  floatText?: never

  update(dt: number): void {
    this.gfx.clear()
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]!
      p.life -= dt
      if (p.life <= 0) {
        this.live.splice(i, 1)
        this.pool.push(p)
        continue
      }
      p.vy += p.gravity * dt
      p.vx *= Math.max(0, 1 - p.drag * dt)
      p.vy *= Math.max(0, 1 - p.drag * dt)
      p.x += p.vx * dt
      p.y += p.vy * dt
      const a = Math.max(0, p.life / p.max)
      this.gfx.fillStyle(p.color, a)
      this.gfx.fillCircle(p.x, p.y, p.size * a)
    }
  }

  destroy(): void {
    this.gfx.destroy()
  }

  private make(): Particle {
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: 0xffffff, gravity: 0, drag: 0 }
  }
}
