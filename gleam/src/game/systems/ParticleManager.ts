import Phaser from 'phaser'
import type { SettingsData } from '../../core/types'

interface Puff {
  g: Phaser.GameObjects.Arc
  vx: number
  vy: number
  life: number
  max: number
}

export class ParticleManager {
  private pool: Puff[] = []
  private live: Puff[] = []

  constructor(
    private scene: Phaser.Scene,
    private settings: SettingsData,
    private max = 64,
  ) {
    for (let i = 0; i < max; i++) {
      const g = scene.add.circle(0, 0, 4, 0xffffff, 1).setVisible(false).setDepth(18)
      this.pool.push({ g, vx: 0, vy: 0, life: 0, max: 1 })
    }
  }

  burst(x: number, y: number, color: number, n = 8, speed = 140): void {
    if (!this.settings.particles) return
    for (let i = 0; i < n; i++) this.spawn(x, y, color, speed, 0.35 + Math.random() * 0.25)
  }

  dust(x: number, y: number, dir: number): void {
    if (!this.settings.particles) return
    this.spawn(x, y + 10, 0xd9cbb0, 40, 0.28, -dir * 60, -20)
  }

  sparkle(x: number, y: number, color: number): void {
    if (!this.settings.particles) return
    for (let i = 0; i < 6; i++) this.spawn(x, y, color, 90, 0.45)
  }

  trail(x: number, y: number, color: number): void {
    if (!this.settings.particles) return
    this.spawn(x, y, color, 20, 0.2, 0, 0)
  }

  private spawn(x: number, y: number, color: number, speed: number, life: number, ovx?: number, ovy?: number): void {
    const p = this.pool.pop() ?? this.live.shift()
    if (!p) return
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.4 + Math.random())
    p.vx = ovx ?? Math.cos(a) * s
    p.vy = ovy ?? Math.sin(a) * s
    p.life = life
    p.max = life
    p.g.setPosition(x, y).setFillStyle(color, 1).setVisible(true).setScale(0.6 + Math.random() * 0.8)
    this.live.push(p)
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]!
      p.life -= dt
      p.g.x += p.vx * dt
      p.g.y += p.vy * dt
      p.vy += 180 * dt
      p.g.setAlpha(Math.max(0, p.life / p.max))
      p.g.setScale(Math.max(0.1, p.g.scale * (1 - dt * 1.5)))
      if (p.life <= 0) {
        p.g.setVisible(false)
        this.live.splice(i, 1)
        this.pool.push(p)
      }
    }
  }

  destroy(): void {
    for (const p of [...this.pool, ...this.live]) p.g.destroy()
  }
}
