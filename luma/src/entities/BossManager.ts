import Phaser from 'phaser'
import type { BossDef } from '../core/types'
import type { AudioManager } from '../systems/AudioManager'
import type { CameraManager } from '../systems/CameraManager'
import type { ParticleManager } from '../systems/ParticleManager'
import type { Player } from './Player'

export class BossManager {
  kind: BossDef['kind']
  x: number
  y: number
  phase = 1
  hp = 6
  maxHp = 6
  defeated = false
  private body: Phaser.GameObjects.Container
  private core: Phaser.GameObjects.Arc
  private timer = 1.2
  private state: 'idle' | 'telegraph' | 'attack' | 'vulnerable' | 'stunned' = 'idle'
  private telegraph: Phaser.GameObjects.Rectangle
  private waves: Phaser.GameObjects.Rectangle[] = []
  private scene: Phaser.Scene
  private color: number
  private vulnerable = 0
  private gravFlipCool = 0

  constructor(scene: Phaser.Scene, def: BossDef, color: number) {
    this.scene = scene
    this.kind = def.kind
    this.x = def.x
    this.y = def.y
    this.color = color
    if (def.kind === 'prime-pathogen') {
      this.hp = this.maxHp = 9
    }
    this.core = scene.add.circle(0, 0, 38, color, 1)
    const eyeL = scene.add.ellipse(-12, -8, 8, 16, 0x0e0e10)
    const eyeR = scene.add.ellipse(12, -8, 8, 16, 0x0e0e10)
    this.body = scene.add.container(def.x, def.y, [this.core, eyeL, eyeR]).setDepth(15)
    this.telegraph = scene.add.rectangle(def.x, def.y + 80, 220, 18, 0xffffff, 0).setDepth(9)
  }

  get progress(): number {
    return 1 - this.hp / this.maxHp
  }

  update(
    dt: number,
    player: Player,
    audio: AudioManager,
    particles: ParticleManager,
    camera: CameraManager,
    shakeOn: boolean,
    onHurt: (x: number) => void,
  ): void {
    if (this.defeated) {
      this.body.y += dt * 40
      this.body.alpha = Math.max(0, this.body.alpha - dt * 0.4)
      this.body.rotation += dt
      return
    }

    this.timer -= dt
    this.gravFlipCool = Math.max(0, this.gravFlipCool - dt)
    this.body.y = this.y + Math.sin(this.scene.time.now / 280) * 6
    this.core.setScale(1 + Math.sin(this.scene.time.now / 180) * 0.04)

    if (this.state === 'idle' && this.timer <= 0) {
      this.state = 'telegraph'
      this.timer = this.kind === 'grav-nexus' ? 0.7 : 0.55
      this.telegraph.setAlpha(0.45)
      this.placeTelegraph(player)
    } else if (this.state === 'telegraph' && this.timer <= 0) {
      this.state = 'attack'
      this.timer = 0.45
      this.telegraph.setAlpha(0)
      this.doAttack(player, audio, particles, camera, shakeOn, onHurt)
    } else if (this.state === 'attack' && this.timer <= 0) {
      this.state = 'vulnerable'
      this.vulnerable = 1.35 - this.phase * 0.12
      this.timer = this.vulnerable
      this.core.setFillStyle(0xf5f1ea, 1)
    } else if (this.state === 'vulnerable') {
      if (Phaser.Math.Distance.Between(player.x, player.y, this.body.x, this.body.y) < 56 && player.body.velocity.y > 60) {
        this.hurt(audio, particles, camera, shakeOn)
        player.body.setVelocityY(-480)
      }
      if (this.timer <= 0) {
        this.state = 'idle'
        this.timer = Math.max(0.55, 1.3 - this.phase * 0.2)
        this.core.setFillStyle(this.color, 1)
      }
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!
      w.x += (w.getData('vx') as number) * dt
      w.alpha -= dt * 0.6
      if (overlap(player, w)) onHurt(w.x)
      if (w.alpha <= 0) {
        w.destroy()
        this.waves.splice(i, 1)
      }
    }

    if (this.state !== 'vulnerable' && Phaser.Math.Distance.Between(player.x, player.y, this.body.x, this.body.y) < 48) {
      onHurt(this.body.x)
    }
  }

  private placeTelegraph(player: Player): void {
    if (this.kind === 'thorn-titan') {
      this.telegraph.setPosition(player.x, this.y + 90)
      this.telegraph.setSize(160, 16)
    } else if (this.kind === 'prime-mover') {
      this.telegraph.setPosition(this.body.x, this.y + 70)
      this.telegraph.setSize(280, 14)
    } else if (this.kind === 'grav-nexus') {
      this.telegraph.setPosition(this.body.x, this.body.y)
      this.telegraph.setSize(40, 200)
    } else {
      this.telegraph.setPosition(player.x, this.y + 80)
      this.telegraph.setSize(120 + this.phase * 20, 18)
    }
  }

  private doAttack(
    player: Player,
    audio: AudioManager,
    particles: ParticleManager,
    camera: CameraManager,
    shakeOn: boolean,
    onHurt: (x: number) => void,
  ): void {
    audio.playSfx('boss-hit', { volume: 0.5 })
    camera.addTrauma(0.45, shakeOn)
    particles.burst(this.body.x, this.body.y + 40, this.color, 18, 240, true)
    if (this.kind === 'thorn-titan') {
      this.slam(player, onHurt)
    } else if (this.kind === 'prime-mover') {
      this.laserSweep(player, onHurt)
    } else if (this.kind === 'grav-nexus') {
      if (this.gravFlipCool <= 0) {
        player.setGravity(-player.gravitySign)
        this.gravFlipCool = 2.2
      }
      this.slam(player, onHurt)
    } else {
      this.slam(player, onHurt)
      if (this.phase >= 2) this.laserSweep(player, onHurt)
    }
  }

  private slam(player: Player, onHurt: (x: number) => void): void {
    const w = this.scene.add.rectangle(this.body.x, this.body.y + 70, 40, 18, 0xf5f1ea, 0.9).setDepth(10)
    w.setData('vx', player.x > this.body.x ? 220 : -220)
    this.waves.push(w)
    const w2 = this.scene.add.rectangle(this.body.x, this.body.y + 70, 40, 18, 0xf5f1ea, 0.9).setDepth(10)
    w2.setData('vx', player.x > this.body.x ? -180 : 180)
    this.waves.push(w2)
    if (Math.abs(player.x - this.body.x) < 80 && Math.abs(player.y - (this.body.y + 70)) < 40) onHurt(this.body.x)
  }

  private laserSweep(player: Player, onHurt: (x: number) => void): void {
    const beam = this.scene.add.rectangle(this.body.x, player.y, 420, 8, 0xffd166, 0.8).setDepth(10)
    this.scene.time.delayedCall(180, () => {
      if (Math.abs(player.y - beam.y) < 20) onHurt(beam.x)
      beam.destroy()
    })
  }

  private hurt(audio: AudioManager, particles: ParticleManager, camera: CameraManager, shakeOn: boolean): void {
    this.hp -= 1
    audio.playSfx('boss-hit')
    particles.burst(this.body.x, this.body.y, 0xf5f1ea, 22, 260, true)
    camera.addTrauma(0.55, shakeOn)
    camera.setHitstop(0.06)
    this.state = 'idle'
    this.timer = 0.9
    this.core.setFillStyle(this.color, 1)
    const nextPhase = this.hp <= this.maxHp * 0.33 ? 3 : this.hp <= this.maxHp * 0.66 ? 2 : 1
    if (nextPhase !== this.phase) {
      this.phase = nextPhase
      audio.playSfx('boss-phase')
    }
    if (this.hp <= 0) {
      this.defeated = true
      audio.playSfx('level-complete')
    }
  }

  destroy(): void {
    this.body.destroy()
    this.telegraph.destroy()
    this.waves.forEach((w) => w.destroy())
  }
}

function overlap(player: Player, r: Phaser.GameObjects.Rectangle): boolean {
  return Math.abs(player.x - r.x) < r.width / 2 + 16 && Math.abs(player.y - r.y) < r.height / 2 + 16
}
