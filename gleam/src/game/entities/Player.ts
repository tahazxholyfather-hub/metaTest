import Phaser from 'phaser'
import { CharacterEngine, drawCharacter, BODY_COLOR, EYE_COLOR, type AICharacterState } from '../../character'
import { PLAYER_RADIUS, type GravityMode, type LevelDef, type Vec2 } from '../../core/types'
import { bus } from '../../core/events'
import type { InputState } from '../../core/InputManager'
import type { AudioManager } from '../../core/AudioManager'
import type { SettingsData } from '../../core/types'

const VIEW = 200
const TEX = 128

const ACCEL = 2650
const AIR_ACCEL = 2100
const MAX_SPEED = 290
const FRICTION = 2100
const GRAVITY = 1950
const LOW_GRAVITY = 720
const UP_GRAVITY = -1950
const JUMP_V = 640
const JUMP_CUT = 0.48
const COYOTE = 0.1
const BUFFER = 0.14
const MAX_FALL = 980
const SPRING_V = 940

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  readonly engine = new CharacterEngine()
  private texture: Phaser.Textures.CanvasTexture
  private ctx: CanvasRenderingContext2D
  private squashX = 1
  private squashY = 1
  private tilt = 0
  private coyote = 0
  private buffer = 0
  private grounded = false
  private prevVy = 0
  private invuln = 0
  private blinkHurt = 0
  private stateTime = 0
  private currentState: AICharacterState = 'idle'
  private look: Vec2 = { x: 0, y: 0 }
  private trailCd = 0
  gravityMode: GravityMode = 'down'
  fluid = false
  sticky = 0
  dead = false
  spawn: Vec2
  checkpoint: Vec2
  facing = 1
  onMoving: { dx: number; dy: number } | null = null
  private jumpHeld = false
  private landLock = 0
  private noticeUntil = 0
  private dangerUntil = 0

  constructor(
    private scene: Phaser.Scene,
    spawn: Vec2,
    private audio: AudioManager,
    private settings: SettingsData,
  ) {
    this.spawn = { ...spawn }
    this.checkpoint = { ...spawn }
    const key = 'gleam-player'
    if (scene.textures.exists(key)) scene.textures.remove(key)
    this.texture = scene.textures.createCanvas(key, TEX, TEX)!
    this.ctx = this.texture.getContext()
    this.engine.settle(0.8)
    this.paint()

    this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, key)
    const scale = (PLAYER_RADIUS * 2) / TEX
    this.sprite.setScale(scale)
    this.sprite.setDepth(20)
    this.sprite.setBounce(0)
    this.sprite.setMaxVelocity(420, MAX_FALL)
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setCircle(TEX * 0.46)
    body.setOffset(TEX * 0.04, TEX * 0.04)
    body.setDrag(0, 0)
    body.setAllowGravity(true)
  }

  reset(pos: Vec2): void {
    this.dead = false
    this.sprite.setPosition(pos.x, pos.y)
    this.sprite.setVelocity(0, 0)
    this.sprite.setVisible(true)
    this.sprite.setAlpha(1)
    this.invuln = 0.6
    this.gravityMode = 'down'
    this.setState('surprised')
    this.engine.blink()
  }

  setCheckpoint(p: Vec2): void {
    this.checkpoint = { ...p }
  }

  applySpring(power = SPRING_V): void {
    const sign = this.gravityMode === 'up' ? 1 : -1
    this.sprite.setVelocityY(sign * power)
    this.coyote = 0
    this.squashX = 0.72
    this.squashY = 1.34
    this.audio.playSfx('spring', { detune: Phaser.Math.Between(-40, 80) })
    this.setState('excited')
    this.engine.play({
      duration: 0.35,
      keys: [
        { at: 0, pose: { height: 1.28, width: 0.88, shiftEl: 0.05 } },
        { at: 0.18, pose: {} },
      ],
    })
  }

  bounceEnemy(): void {
    const sign = this.gravityMode === 'up' ? 1 : -1
    this.sprite.setVelocityY(sign * 520)
    this.audio.playSfx('bounce')
    this.squashX = 1.2
    this.squashY = 0.78
    this.setState('happy')
  }

  hurt(from?: Vec2): boolean {
    if (this.dead || this.invuln > 0) return false
    this.invuln = 1.05
    this.blinkHurt = 0.8
    this.setState('shocked')
    this.engine.play({
      duration: 0.5,
      keys: [
        { at: 0, pose: { width: 1.5, height: 1.2, shiftEl: 0.04 } },
        { at: 0.2, pose: {} },
      ],
    })
    this.audio.playSfx('damage')
    bus.emit('shake', { mag: 8, dur: 160 })
    bus.emit('hitstop', { ms: 55 })
    if (from) {
      const dx = this.sprite.x - from.x
      this.sprite.setVelocityX(Math.sign(dx || 1) * 220)
      this.sprite.setVelocityY(this.gravityMode === 'up' ? 180 : -180)
    }
    bus.emit('player-hurt', { x: this.sprite.x, y: this.sprite.y, livesLeft: 1 })
    return true
  }

  kill(): void {
    if (this.dead) return
    this.dead = true
    this.audio.playSfx('death')
    this.setState('sad')
    bus.emit('shake', { mag: 12, dur: 220 })
    bus.emit('player-die', { x: this.sprite.x, y: this.sprite.y })
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 280,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.scene.time.delayedCall(420, () => {
          const s = (PLAYER_RADIUS * 2) / TEX
          this.sprite.setScale(s)
          this.reset(this.checkpoint)
          bus.emit('player-respawn', { x: this.checkpoint.x, y: this.checkpoint.y })
        })
      },
    })
  }

  celebrate(): void {
    this.setState('happy')
    this.engine.poke()
  }

  notice(kind: 'item' | 'danger' | 'enemy', worldX: number, worldY: number): void {
    const dx = worldX - this.sprite.x
    const dy = worldY - this.sprite.y
    const len = Math.hypot(dx, dy) || 1
    this.look = { x: dx / len, y: dy / len }
    if (kind === 'item') {
      this.setState('curious')
      this.noticeUntil = 0.45
    } else {
      this.setState(kind === 'danger' ? 'surprised' : 'annoyed')
      this.dangerUntil = 0.4
    }
  }

  update(dt: number, input: InputState): void {
    if (this.dead) {
      this.engine.update(dt)
      this.paint()
      return
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    const gSign = this.gravityMode === 'up' ? -1 : 1
    let grav = GRAVITY * gSign
    if (this.gravityMode === 'low') grav = LOW_GRAVITY
    if (this.gravityMode === 'zero') grav = 80 * gSign
    if (this.gravityMode === 'flip') grav = UP_GRAVITY
    if (this.gravityMode === 'up') grav = UP_GRAVITY
    body.setGravityY(grav - (this.scene.physics.world.gravity.y || 0))

    const onFloor = this.gravityMode === 'up' || this.gravityMode === 'flip' ? body.blocked.up || body.touching.up : body.blocked.down || body.touching.down
    this.grounded = onFloor
    if (onFloor) this.coyote = COYOTE
    else this.coyote = Math.max(0, this.coyote - dt)

    if (input.jumpPressed) this.buffer = BUFFER
    else this.buffer = Math.max(0, this.buffer - dt)

    const accel = onFloor ? ACCEL : AIR_ACCEL
    const ax = input.axis
    if (ax !== 0) {
      body.setVelocityX(Phaser.Math.Clamp(body.velocity.x + ax * accel * dt, -MAX_SPEED, MAX_SPEED))
      this.facing = ax
    } else if (onFloor) {
      const drag = this.sticky > 0 ? FRICTION * 2.4 : FRICTION
      const vx = body.velocity.x
      const nvx = vx > 0 ? Math.max(0, vx - drag * dt) : Math.min(0, vx + drag * dt)
      body.setVelocityX(nvx)
    }

    if (this.onMoving && onFloor) {
      this.sprite.x += this.onMoving.dx
      this.sprite.y += this.onMoving.dy
    }
    this.onMoving = null

    if (this.fluid) {
      body.setVelocity(body.velocity.x * 0.92, body.velocity.y * 0.9 - 40 * dt * 60)
    }

    if (this.sticky > 0) {
      this.sticky -= dt
      body.setVelocityX(body.velocity.x * 0.82)
    }

    const canJump = this.coyote > 0 && this.buffer > 0 && this.landLock <= 0
    if (canJump) {
      const j = this.sticky > 0 ? JUMP_V * 0.72 : JUMP_V
      body.setVelocityY(-gSign * j)
      this.coyote = 0
      this.buffer = 0
      this.jumpHeld = true
      this.squashX = 0.78
      this.squashY = 1.28
      this.audio.playSfx('jump', { detune: Phaser.Math.Between(-60, 90) })
      this.setState('curious')
      this.engine.play({
        duration: 0.28,
        keys: [
          { at: 0, pose: { height: 1.18, width: 0.9, shiftEl: 0.04 } },
          { at: 0.16, pose: {} },
        ],
      })
    }
    if (!input.jump) {
      if (this.jumpHeld && -gSign * body.velocity.y > 0) {
        body.setVelocityY(body.velocity.y * JUMP_CUT)
      }
      this.jumpHeld = false
    }

    if (Math.abs(body.velocity.y) > MAX_FALL) {
      body.setVelocityY(Math.sign(body.velocity.y) * MAX_FALL)
    }

    const landed = onFloor && this.prevVy * gSign > 220
    if (landed) {
      const impact = Math.min(1, Math.abs(this.prevVy) / 800)
      this.squashX = 1 + 0.38 * impact
      this.squashY = 1 - 0.32 * impact
      this.landLock = 0.05
      this.audio.playSfx('land', { gain: 0.4 + impact * 0.6 })
      if (impact > 0.45) bus.emit('shake', { mag: 3 + impact * 4, dur: 80 })
      this.engine.play({
        duration: 0.28,
        keys: [
          { at: 0, pose: { height: 0.78, width: 1.18, shiftEl: -0.02 } },
          { at: 0.12, pose: {} },
        ],
      })
    }
    this.landLock = Math.max(0, this.landLock - dt)
    this.prevVy = body.velocity.y

    this.invuln = Math.max(0, this.invuln - dt)
    this.blinkHurt = Math.max(0, this.blinkHurt - dt)
    this.noticeUntil = Math.max(0, this.noticeUntil - dt)
    this.dangerUntil = Math.max(0, this.dangerUntil - dt)
    this.sprite.setAlpha(this.blinkHurt > 0 ? (Math.sin(this.blinkHurt * 40) > 0 ? 0.45 : 1) : 1)

    this.squashX += (1 - this.squashX) * Math.min(1, dt * 12)
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 12)
    const base = (PLAYER_RADIUS * 2) / TEX
    this.sprite.setScale(base * this.squashX, base * this.squashY)

    const targetTilt = Phaser.Math.Clamp(body.velocity.x / MAX_SPEED, -1, 1) * 0.18
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 8)
    this.sprite.setRotation(this.tilt)

    if (this.noticeUntil <= 0 && this.dangerUntil <= 0) {
      const spd = Math.hypot(body.velocity.x, body.velocity.y)
      this.look.x += ((body.velocity.x / 280) - this.look.x) * Math.min(1, dt * 6)
      this.look.y += ((body.velocity.y / 400) - this.look.y) * Math.min(1, dt * 6)
      this.engine.setLookAt({ x: Phaser.Math.Clamp(this.look.x, -1, 1), y: Phaser.Math.Clamp(this.look.y, -1, 1) })
      this.pickState(onFloor, spd, body.velocity.y * gSign)
    } else {
      this.engine.setLookAt({ x: Phaser.Math.Clamp(this.look.x, -1, 1), y: Phaser.Math.Clamp(this.look.y, -1, 1) })
    }

    this.trailCd -= dt
    this.engine.update(dt)
    this.paint()
  }

  private pickState(onFloor: boolean, spd: number, vyAlongGravity: number): void {
    if (this.dangerUntil > 0) return
    if (this.noticeUntil > 0) return
    let next: AICharacterState = 'idle'
    if (!onFloor) {
      next = vyAlongGravity < -40 ? 'curious' : 'surprised'
      if (vyAlongGravity > 420) next = 'shocked'
    } else if (spd > 210) next = 'excited'
    else if (spd > 40) next = 'curious'
    else next = 'idle'
    this.setState(next)
  }

  private setState(s: AICharacterState): void {
    if (s === this.currentState) return
    this.currentState = s
    this.engine.setState(s)
    this.stateTime = 0
  }

  private paint(): void {
    drawCharacter(this.ctx, this.engine, { destSize: TEX, color: BODY_COLOR, eyeColor: EYE_COLOR })
    this.texture.refresh()
  }

  destroy(): void {
    this.sprite.destroy()
  }
}

export function attachPlayerCircle(player: Player, level: LevelDef): void {
  void player
  void level
}
