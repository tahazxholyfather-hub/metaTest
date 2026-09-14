import Phaser from 'phaser'
import { LumaCanvas } from '../character'
import type { AICharacterState } from '../character'
import { PHYSICS, PLAYER_RADIUS } from '../core/types'
import type { InputState } from '../systems/InputManager'
import type { ParticleManager } from '../systems/ParticleManager'
import type { AudioManager } from '../systems/AudioManager'

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  readonly view: LumaCanvas
  hp = 3
  readonly maxHp = 3
  invuln = 0
  dead = false
  won = false
  facing = 1
  gravitySign = 1
  sticky = 0
  fluidDrag = 1
  toxicTimer = 0
  riding: Phaser.Physics.Arcade.Body | null = null
  private coyote = 0
  private jumpBuf = 0
  private wasGrounded = false
  private squashX = 1
  private squashY = 1
  private tex: Phaser.Textures.CanvasTexture
  private lookX = 0
  private lookY = 0
  private state: AICharacterState = 'idle'
  private speedTrail = 0
  spawn: { x: number; y: number }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.view = new LumaCanvas({ size: 160 })
    if (scene.textures.exists('luma-player')) scene.textures.remove('luma-player')
    this.tex = scene.textures.addCanvas('luma-player', this.view.canvas)!
    this.sprite = scene.physics.add.sprite(x, y, 'luma-player')
    this.sprite.setDepth(20)
    this.sprite.setCircle(this.view.canvas.width / 2)
    const body = this.body
    body.setMaxVelocity(420, PHYSICS.maxFall)
    body.setBounce(PHYSICS.bounce, PHYSICS.bounce * 0.6)
    body.setCollideWorldBounds(true)
    const scale = (PLAYER_RADIUS * 2) / this.view.canvas.width
    this.sprite.setScale(scale)
    this.spawn = { x, y }
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body
  }

  get x(): number {
    return this.sprite.x
  }
  get y(): number {
    return this.sprite.y
  }

  reset(x: number, y: number): void {
    this.sprite.setPosition(x, y)
    this.body.setVelocity(0, 0)
    this.hp = this.maxHp
    this.invuln = 0
    this.dead = false
    this.won = false
    this.gravitySign = 1
    this.sticky = 0
    this.fluidDrag = 1
    this.spawn = { x, y }
    this.setGravity(1)
    this.view.setState('idle')
  }

  setGravity(sign: number): void {
    this.gravitySign = sign < 0 ? -1 : 1
    this.body.setGravityY(PHYSICS.gravity * this.gravitySign - (this.sprite.scene.physics.world.gravity.y || PHYSICS.gravity))
  }

  setWorldGravity(value: number): void {
    this.body.setGravityY(value - this.sprite.scene.physics.world.gravity.y)
    this.gravitySign = value >= 0 ? 1 : -1
  }

  checkpoint(x: number, y: number): void {
    this.spawn = { x, y }
  }

  hit(fromX: number, audio: AudioManager, particles: ParticleManager, shake: () => void): void {
    if (this.invuln > 0 || this.dead || this.won) return
    this.hp -= 1
    this.invuln = PHYSICS.invuln
    const dir = this.x >= fromX ? 1 : -1
    this.body.setVelocity(dir * 260, -320 * this.gravitySign)
    this.view.setState('shocked')
    this.view.poke()
    audio.playSfx('damage')
    particles.burst(this.x, this.y, 0xf5f1ea, 14, 220, true)
    shake()
    if (this.hp <= 0) this.kill(audio)
  }

  kill(audio: AudioManager): void {
    if (this.dead) return
    this.dead = true
    this.hp = 0
    audio.playSfx('death')
    this.view.setState('sad')
  }

  win(): void {
    this.won = true
    this.view.setState('happy')
    this.body.setVelocity(this.body.velocity.x * 0.3, this.body.velocity.y * 0.3)
  }

  bounce(power: number, dir: 'up' | 'down' | 'left' | 'right'): void {
    if (dir === 'up') this.body.setVelocityY(-power)
    else if (dir === 'down') this.body.setVelocityY(power)
    else if (dir === 'left') this.body.setVelocityX(-power)
    else this.body.setVelocityX(power)
    this.coyote = 0
    this.view.poke()
  }

  update(
    dt: number,
    input: InputState,
    audio: AudioManager,
    particles: ParticleManager,
    look: { x: number; y: number } | null,
    settingsParticles: boolean,
  ): void {
    if (this.dead || this.won) {
      this.animate(dt, look)
      return
    }

    const body = this.body
    const grounded = this.gravitySign >= 0 ? body.blocked.down || body.touching.down : body.blocked.up || body.touching.up
    if (grounded) this.coyote = PHYSICS.coyote
    else this.coyote = Math.max(0, this.coyote - dt)
    if (input.jumpPressed) this.jumpBuf = PHYSICS.jumpBuffer
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt)

    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (move) this.facing = move

    const stickyMul = this.sticky > 0 ? 0.45 : 1
    const accel = (grounded ? PHYSICS.accel : PHYSICS.airAccel) * stickyMul * this.fluidDrag
    const target = move * PHYSICS.moveSpeed * stickyMul
    const maxStep = accel * dt
    if (Math.abs(target - body.velocity.x) <= maxStep) body.setVelocityX(target)
    else body.setVelocityX(body.velocity.x + Math.sign(target - body.velocity.x) * maxStep)

    if (!move && grounded && this.sticky <= 0) {
      const fr = PHYSICS.friction * dt
      if (Math.abs(body.velocity.x) <= fr) body.setVelocityX(0)
      else body.setVelocityX(body.velocity.x - Math.sign(body.velocity.x) * fr)
    }

    if (this.jumpBuf > 0 && this.coyote > 0) {
      const power = this.sticky > 0 ? PHYSICS.jump * 0.72 : PHYSICS.jump
      body.setVelocityY(-power * this.gravitySign)
      this.coyote = 0
      this.jumpBuf = 0
      this.squashX = 0.78
      this.squashY = 1.28
      audio.playSfx('jump', { detune: -40 + Math.random() * 80 })
      particles.dust(this.x, this.y + PLAYER_RADIUS * this.gravitySign, this.facing, settingsParticles)
    }

    // variable jump height
    if (!input.jump && this.gravitySign * body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * 0.88)
    }

    if (this.riding) {
      body.x += this.riding.deltaX()
      body.y += this.riding.deltaY()
    }

    if (grounded && !this.wasGrounded) {
      const impact = Math.abs(body.velocity.y)
      if (impact > 220) {
        this.squashX = 1.22
        this.squashY = 0.72
        audio.playSfx('land', { volume: Math.min(1, impact / 800) })
        particles.dust(this.x, this.y + PLAYER_RADIUS * this.gravitySign, this.facing, settingsParticles)
        this.view.poke()
      }
    }
    this.wasGrounded = grounded

    this.invuln = Math.max(0, this.invuln - dt)
    this.sticky = Math.max(0, this.sticky - dt)
    this.fluidDrag = 1
    this.sprite.setAlpha(this.invuln > 0 ? (Math.sin(this.invuln * 28) > 0 ? 0.45 : 1) : 1)

    if (Math.abs(body.velocity.x) > 240 && grounded) {
      this.speedTrail += dt
      if (this.speedTrail > 0.04) {
        this.speedTrail = 0
        particles.trail(this.x, this.y + PLAYER_RADIUS * 0.6 * this.gravitySign, 0xf5f1ea, settingsParticles)
      }
    }

    this.pickState(grounded, body, look)
    this.animate(dt, look)
    this.riding = null
  }

  private pickState(grounded: boolean, body: Phaser.Physics.Arcade.Body, look: { x: number; y: number } | null): void {
    if (this.invuln > 0.7) {
      this.setState('shocked')
      return
    }
    const vy = body.velocity.y * this.gravitySign
    if (!grounded && vy < -80) this.setState('excited')
    else if (!grounded && vy > 280) this.setState('surprised')
    else if (grounded && Math.abs(body.velocity.x) > 40) this.setState('curious')
    else if (look) this.setState('curious')
    else this.setState('idle')
  }

  private setState(s: AICharacterState): void {
    if (s !== this.state) {
      this.state = s
      this.view.setState(s)
    }
  }

  private animate(dt: number, look: { x: number; y: number } | null): void {
    this.squashX += (1 - this.squashX) * Math.min(1, dt * 10)
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 10)
    this.view.setSquash(this.squashX, this.squashY)

    const tx = look ? Phaser.Math.Clamp(look.x, -1, 1) : this.facing * 0.45
    const ty = look ? Phaser.Math.Clamp(look.y, -1, 1) : this.body.velocity.y * 0.0015 * this.gravitySign
    this.lookX += (tx - this.lookX) * Math.min(1, dt * 8)
    this.lookY += (ty - this.lookY) * Math.min(1, dt * 8)
    this.view.setLookAt({ x: this.lookX, y: this.lookY })

    this.view.update(dt)
    this.tex.refresh()
  }
}
