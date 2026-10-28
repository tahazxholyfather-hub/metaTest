import Phaser from 'phaser'
import { TILE, VIEW_H, VIEW_W } from '../config'
import { getLevel } from '../levels'
import { metExpression, metGaze } from '../metPose'
import type { AudioManager } from '../audio'
import type { InputManager } from '../input'
import type { SaveManager } from '../save'
import type { Session } from '../session'
import { Simulation } from '../Simulation'
import type { Rect, SimEvent } from '../types'
import { MET_PX, MetPainter } from '../render/metPainter'
import { themeOf } from '../render/themes'
import { burst, drawWorld, stepSpecks, type Speck } from '../render/worldDraw'
import { CameraController } from '../camera'

export interface GameDeps {
  session: Session
  audio: AudioManager
  input: InputManager
  save: SaveManager
}

export class PlayScene extends Phaser.Scene {
  private session!: Session
  private audio!: AudioManager
  private controls!: InputManager
  private save!: SaveManager
  private gfx!: Phaser.GameObjects.Graphics
  private painter!: MetPainter
  private sprite!: Phaser.GameObjects.Image
  private texture!: Phaser.Textures.CanvasTexture
  private sim: Simulation | null = null
  private cam = new CameraController()
  private bounds: Rect = { x: 0, y: 0, w: 1, h: 1 }
  private specks: Speck[] = []
  private levelSerial = 0
  private restartSerial = 0
  private loadLeft = 0
  private deathLeft = 0
  private debug = false
  private hudClock = 0

  constructor() {
    super('play')
  }

  create(): void {
    const deps = this.game.registry.get('deps') as GameDeps
    this.session = deps.session
    this.audio = deps.audio
    this.controls = deps.input
    this.save = deps.save
    this.gfx = this.add.graphics()
    this.painter = new MetPainter()
    const texture = this.textures.addCanvas('met-ball', this.painter.canvas)
    if (!texture) throw new Error('Could not create Met texture')
    this.texture = texture
    this.sprite = this.add.image(0, 0, 'met-ball')
    this.sprite.setOrigin(0.5, 0.5)
    this.sprite.setDisplaySize(MET_PX, MET_PX)
    this.sprite.setVisible(false)
    this.cameras.main.setRoundPixels(false)
    this.controls.setDebugHandler(() => {
      this.debug = !this.debug
    })
    this.debug = new URLSearchParams(window.location.search).get('debug') === '1'
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, Math.max(0, delta / 1000))
    this.syncLevel()
    const phase = this.session.phase
    if (phase === 'ROTATE_DEVICE') {
      this.controls.idle()
      return
    }
    if (!this.sim || phase === 'BOOT' || phase === 'MENU' || phase === 'LEVEL_SELECT') {
      this.controls.idle()
      this.sprite.setVisible(false)
      return
    }

    if (phase === 'LOADING') {
      this.loadLeft -= dt
      this.paint(dt)
      this.renderWorld()
      if (this.loadLeft <= 0) this.session.markReady()
      return
    }

    if (phase === 'PLAYING') {
      const events = this.sim.advance(dt, this.controls.sample())
      this.onEvents(events)
      const player = this.sim.player
      this.cam.update(dt, player.x, player.y, player.vx, player.vy, this.bounds)
      stepSpecks(this.specks, dt)
      this.hudClock += dt
      if (this.hudClock >= 0.1) {
        this.hudClock = 0
        this.pushHud()
      }
      this.paint(dt)
      this.renderWorld()
      return
    }

    this.controls.idle()
    if (phase === 'GAME_OVER') {
      this.deathLeft -= dt
      if (this.deathLeft <= 0 && this.sim && !this.sim.player.alive) {
        this.sim.respawn()
        this.cam.snap(this.sim.player.x, this.sim.player.y, this.bounds)
        this.session.revive()
        this.renderWorld()
      }
    }
    this.paint(dt)
  }

  private syncLevel(): void {
    if (this.session.levelSerial === this.levelSerial && this.session.restartSerial === this.restartSerial) return
    const levelChanged = this.session.levelSerial !== this.levelSerial
    this.levelSerial = this.session.levelSerial
    this.restartSerial = this.session.restartSerial
    const id = this.session.levelId
    const level = id ? getLevel(id) : undefined
    if (!level) {
      this.sim = null
      this.sprite.setVisible(false)
      return
    }
    this.sim = new Simulation(level)
    this.bounds = level.camera ?? { x: 0, y: 0, w: level.grid.cols * TILE, h: level.grid.rows * TILE }
    this.cam.snap(this.sim.player.x, this.sim.player.y, this.bounds)
    this.specks = []
    this.deathLeft = 0
    this.hudClock = 0
    this.cameras.main.setBackgroundColor(themeOf(level.theme).skyTop)
    if (levelChanged) this.loadLeft = 0.22
    this.pushHud()
  }

  private onEvents(events: SimEvent[]): void {
    const sim = this.sim
    if (!sim) return
    for (const event of events) {
      if (event.type === 'jump') this.audio.jump()
      else if (event.type === 'land') {
        this.audio.land()
        burst(this.specks, sim.player.x, sim.player.y + sim.player.r, 0xffffff, 4, 40)
      } else if (event.type === 'bounce') {
        this.audio.bounce()
        burst(this.specks, sim.player.x, sim.player.y + sim.player.r, 0xf2c14e, 6, 70)
      } else if (event.type === 'collect') {
        this.audio.collect()
        this.save.noteProgress(sim.level.id, sim.collected, sim.secrets, sim.routes)
      } else if (event.type === 'checkpoint') {
        this.audio.checkpoint()
        this.save.noteProgress(sim.level.id, sim.collected, sim.secrets, sim.routes)
      } else if (event.type === 'secret' || event.type === 'route') {
        this.save.noteProgress(sim.level.id, sim.collected, sim.secrets, sim.routes)
      } else if (event.type === 'splash') this.audio.splash()
      else if (event.type === 'die') {
        this.audio.die()
        this.deathLeft = 0.55
        this.session.fail()
      } else if (event.type === 'goal') {
        const rec = this.save.complete(sim.level.id, sim.time, sim.collected, sim.secrets, sim.routes)
        this.audio.complete()
        this.session.finish({
          levelId: sim.level.id,
          name: sim.level.name,
          number: sim.level.number,
          time: sim.time,
          bestMs: rec.bestMs,
          isBest: rec.isBest,
          coins: sim.collected.size,
          total: sim.coinTotal,
          secrets: sim.secrets.size,
          routes: [...sim.routes],
          nextId: rec.nextId,
        })
      }
    }
  }

  private paint(dt: number): void {
    const sim = this.sim
    if (!sim) return
    const player = sim.player
    this.painter.setExpression(metExpression(player, sim.finished))
    const gaze = metGaze(player)
    this.painter.setGaze(gaze.x, gaze.y)
    this.painter.paint(dt, player)
    this.texture.source[0]?.update()
    const ox = VIEW_W / 2 - this.cam.x
    const oy = VIEW_H / 2 - this.cam.y
    this.sprite.setPosition(sim.renderX + ox, sim.renderY + oy)
    this.sprite.setVisible(true)
    const blink = player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0
    this.sprite.setAlpha(!player.alive ? 0.45 : blink ? 0.4 : 1)
  }

  private renderWorld(): void {
    const sim = this.sim
    if (!sim) return
    drawWorld(this.gfx, sim, this.cam.x, this.cam.y, themeOf(sim.level.theme), this.specks, this.debug || this.session.debug)
  }

  private pushHud(): void {
    const sim = this.sim
    if (!sim) return
    this.session.setHud({
      name: sim.level.name,
      number: sim.level.number,
      time: sim.time,
      coins: sim.collected.size,
      total: sim.coinTotal,
    })
  }
}
