import Phaser from 'phaser'
import type { AudioManager } from '../../core/AudioManager'
import { bus } from '../../core/events'
import type { InputManager } from '../../core/InputManager'
import type { ProgressManager } from '../../core/ProgressManager'
import type { SaveManager } from '../../core/SaveManager'
import type {
  CollectibleDef,
  GravityMode,
  HazardDef,
  LevelCompletePayload,
  LevelDef,
  PlatformDef,
  RunStats,
  SeasonDef,
  SettingsData,
  ThemePalette,
} from '../../core/types'
import { Player } from '../entities/Player'
import { BossManager } from '../systems/BossManager'
import { CameraManager } from '../systems/CameraManager'
import { EnemyManager } from '../systems/EnemyManager'
import { ParticleManager } from '../systems/ParticleManager'

export interface PlayInit {
  level: LevelDef
  season: SeasonDef
  audio: AudioManager
  input: InputManager
  save: SaveManager
  progress: ProgressManager
  settings: SettingsData
}

interface Plat extends Phaser.Physics.Arcade.Image {
  spec: PlatformDef
  homeX: number
  homeY: number
  lastX: number
  lastY: number
  crumble?: number
}

interface Haz extends Phaser.Physics.Arcade.Image {
  spec: HazardDef
  homeX: number
  homeY: number
  laserOn?: boolean
}

interface Item extends Phaser.Physics.Arcade.Image {
  spec: CollectibleDef
  taken: boolean
  bob: number
}

export class PlayScene extends Phaser.Scene {
  private initData!: PlayInit
  private player!: Player
  private cam!: CameraManager
  private particles!: ParticleManager
  private enemies!: EnemyManager
  private boss!: BossManager
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private movers!: Phaser.Physics.Arcade.Group
  private hazards!: Phaser.Physics.Arcade.Group
  private items!: Phaser.Physics.Arcade.Group
  private platList: Plat[] = []
  private hazList: Haz[] = []
  private itemList: Item[] = []
  private stats!: RunStats
  private elapsed = 0
  private paused = false
  private finished = false
  private hitstop = 0
  private unsubs: Array<() => void> = []
  private goal?: Phaser.Physics.Arcade.Image
  private theme!: ThemePalette
  private bgLayers: Phaser.GameObjects.TileSprite[] = []
  private portalPairs: { a: Phaser.GameObjects.Zone; b: Phaser.GameObjects.Zone; cool: number }[] = []
  private portalCool = 0

  constructor() {
    super('play')
  }

  init(data: PlayInit): void {
    this.initData = data
    this.theme = data.season.theme
  }

  create(): void {
    const { level, season, audio, settings } = this.initData
    this.stats = {
      score: 0,
      time: 0,
      deaths: 0,
      collectibles: 0,
      collectiblesMax: level.collectibles.filter((c) => c.rarity !== 'secret').length,
      rares: 0,
      secrets: 0,
      secretsMax: level.collectibles.filter((c) => c.rarity === 'secret').length,
      combo: 0,
      maxCombo: 0,
    }
    this.elapsed = 0
    this.finished = false
    this.paused = false
    this.cameras.main.setBackgroundColor(season.theme.skyTop)
    this.physics.world.setBounds(0, 0, level.width, level.height)
    this.physics.world.gravity.y = 0

    this.drawBackdrop(level, season)
    this.particles = new ParticleManager(this, settings)
    this.platforms = this.physics.add.staticGroup()
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true })
    this.hazards = this.physics.add.group({ allowGravity: false })
    this.items = this.physics.add.group({ allowGravity: false })

    this.buildPlatforms(level)
    this.buildHazards(level)
    this.buildItems(level)
    this.buildGoal(level)

    this.player = new Player(this, level.spawn, audio, settings)
    this.buildCheckpoints(level)
    this.buildPortals(level)
    this.enemies = new EnemyManager(this, this.theme, this.particles, audio)
    this.enemies.spawnAll(level.enemies, season.id)
    this.boss = new BossManager(this, this.theme, this.particles, audio)
    if (level.boss) this.boss.spawn(level.boss)

    this.physics.add.collider(this.player.sprite, this.platforms, (_p, plat) => this.onLand(plat as unknown as Plat))
    this.physics.add.collider(this.player.sprite, this.movers, (_p, plat) => this.onLand(plat as unknown as Plat))
    this.physics.add.collider(this.enemies.group, this.platforms)
    this.physics.add.collider(this.enemies.group, this.movers)
    this.physics.add.overlap(this.player.sprite, this.items, (_p, it) => this.takeItem(it as unknown as Item))
    this.physics.add.overlap(this.player.sprite, this.hazards, (_p, h) => this.touchHazard(h as unknown as Haz))
    this.physics.add.overlap(this.player.sprite, this.enemies.group, (_p, e) => this.touchEnemy(e as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.player.sprite, this.enemies.projectilesGroup, () => {
      if (this.player.hurt()) this.fail()
    })
    if (this.boss.sprite) {
      this.physics.add.overlap(this.player.sprite, this.boss.sprite, () => this.touchBoss())
    }
    if (this.boss.projectiles) {
      this.physics.add.overlap(this.player.sprite, this.boss.projectiles, () => {
        if (this.player.hurt()) this.fail()
      })
    }
    if (this.goal) {
      this.physics.add.overlap(this.player.sprite, this.goal, () => this.tryComplete())
    }

    this.cam = new CameraManager(this.cameras.main, settings)
    this.cam.bounds(level.width, level.height)
    this.cam.follow(this.player.sprite)
    this.cam.introZoom()

    this.unsubs.push(
      bus.on('shake', (p) => this.cam.shake(p.mag, p.dur)),
      bus.on('hitstop', (p) => (this.hitstop = p.ms / 1000)),
      bus.on('pause', (p) => this.setPaused(p.paused)),
      bus.on('restart', () => this.scene.restart(this.initData)),
    )

    audio.playMusic(level.isBoss ? (season.music.boss as 'boss1') : (season.music.world as 's1'))
    this.hud()
  }

  private drawBackdrop(level: LevelDef, season: SeasonDef): void {
    const t = season.theme
    const g = this.add.graphics().setScrollFactor(0).setDepth(-20)
    g.fillGradientStyle(
      Phaser.Display.Color.HexStringToColor(t.skyTop).color,
      Phaser.Display.Color.HexStringToColor(t.skyTop).color,
      Phaser.Display.Color.HexStringToColor(t.skyBottom).color,
      Phaser.Display.Color.HexStringToColor(t.skyBottom).color,
      1,
    )
    g.fillRect(0, 0, this.scale.width, this.scale.height)

    const makeLayer = (tint: number, alpha: number, factor: number, h: number, y: number) => {
      const key = `par-${season.id}-${factor}`
      if (!this.textures.exists(key)) {
        const gg = this.make.graphics({ x: 0, y: 0 })
        gg.fillStyle(tint, alpha)
        for (let i = 0; i < 8; i++) {
          const bx = i * 90 + 20
          gg.fillEllipse(bx, 40, 80 + (i % 3) * 20, 50)
        }
        gg.generateTexture(key, 720, 80)
        gg.destroy()
      }
      const spr = this.add.tileSprite(0, y, level.width, h, key).setOrigin(0, 1).setScrollFactor(factor, 1).setDepth(-10)
      this.bgLayers.push(spr)
    }
    const mid = Phaser.Display.Color.HexStringToColor(t.mid).color
    const ground = Phaser.Display.Color.HexStringToColor(t.ground).color
    makeLayer(mid, 0.55, 0.15, 90, level.height - 40)
    makeLayer(ground, 0.7, 0.35, 70, level.height - 10)

    if (season.id === 'season-3') {
      for (let i = 0; i < 40; i++) {
        this.add
          .circle(Math.random() * level.width, Math.random() * level.height * 0.7, Math.random() * 1.6 + 0.4, 0xffffff, 0.7)
          .setScrollFactor(0.25)
          .setDepth(-12)
      }
    }
  }

  private platTex(spec: PlatformDef, w: number, h: number): string {
    const key = `plat-${spec.type}-${Math.round(w)}x${Math.round(h)}-${this.theme.id}`
    if (this.textures.exists(key)) return key
    const g = this.make.graphics({ x: 0, y: 0 })
    const fill = Phaser.Display.Color.HexStringToColor(this.theme.platform).color
    const edge = Phaser.Display.Color.HexStringToColor(this.theme.platformEdge).color
    const accent = Phaser.Display.Color.HexStringToColor(this.theme.accent).color
    if (spec.type === 'spring') {
      g.fillStyle(accent, 1)
      g.fillRoundedRect(0, 0, w, h, 6)
      g.fillStyle(edge, 1)
      g.fillRect(w * 0.2, 4, w * 0.6, 4)
    } else if (spec.type === 'conveyor') {
      g.fillStyle(0x5a616a, 1)
      g.fillRoundedRect(0, 0, w, h, 4)
      g.fillStyle(accent, 1)
      for (let x = 6; x < w; x += 14) g.fillTriangle(x, 6, x + 8, h / 2, x, h - 6)
    } else if (spec.type === 'sticky' || spec.type === 'membrane') {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.theme.accent2).color, 0.95)
      g.fillRoundedRect(0, 0, w, h, 10)
    } else if (spec.type === 'timed') {
      g.fillStyle(fill, 0.85)
      g.fillRoundedRect(0, 0, w, h, 4)
      g.lineStyle(2, accent, 1)
      g.strokeRoundedRect(1, 1, w - 2, h - 2, 4)
    } else if (spec.type === 'hidden') {
      g.fillStyle(fill, 0.18)
      g.fillRect(0, 0, w, h)
    } else if (spec.type === 'ice') {
      g.fillStyle(0xb9e8f2, 0.95)
      g.fillRoundedRect(0, 0, w, h, 3)
    } else {
      g.fillStyle(fill, spec.type === 'oneway' ? 0.92 : 1)
      g.fillRoundedRect(0, 0, w, h, spec.type === 'oneway' ? 3 : 6)
      g.fillStyle(edge, 1)
      g.fillRect(0, 0, w, 5)
    }
    g.generateTexture(key, Math.max(2, Math.round(w)), Math.max(2, Math.round(h)))
    g.destroy()
    return key
  }

  private buildPlatforms(level: LevelDef): void {
    for (const spec of level.platforms) {
      const tex = this.platTex(spec, spec.w, spec.h)
      if (spec.type === 'hidden') {
        const ghost = this.add.image(spec.x + spec.w / 2, spec.y + spec.h / 2, tex).setDisplaySize(spec.w, spec.h).setAlpha(0.2).setDepth(2)
        this.tweens.add({ targets: ghost, alpha: 0.08, duration: 1600, yoyo: true, repeat: -1 })
        continue
      }
      const moving = !!spec.move || spec.type === 'moving' || spec.type === 'crumble' || spec.type === 'timed'
      const img = (moving ? this.movers.create(spec.x + spec.w / 2, spec.y + spec.h / 2, tex) : this.platforms.create(spec.x + spec.w / 2, spec.y + spec.h / 2, tex)) as Plat
      img.spec = spec
      img.homeX = img.x
      img.homeY = img.y
      img.lastX = img.x
      img.lastY = img.y
      img.setDisplaySize(spec.w, spec.h)
      const body = img.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
      body.setSize(spec.w, spec.h)
      if ('setImmovable' in img) img.setImmovable(true)
      if (spec.type === 'oneway' && 'checkCollision' in body) {
        ;(body as Phaser.Physics.Arcade.Body).checkCollision.down = false
        ;(body as Phaser.Physics.Arcade.Body).checkCollision.left = false
        ;(body as Phaser.Physics.Arcade.Body).checkCollision.right = false
      }
      this.platList.push(img)
    }
    this.platforms.refresh()
  }

  private buildHazards(level: LevelDef): void {
    for (const spec of level.hazards) {
      const key = this.hazTex(spec)
      const img = this.hazards.create(spec.x + spec.w / 2, spec.y + spec.h / 2, key) as Haz
      img.spec = spec
      img.homeX = img.x
      img.homeY = img.y
      img.laserOn = true
      img.setDisplaySize(spec.w, spec.h)
      img.setDepth(11)
      this.hazList.push(img)
    }
  }

  private hazTex(spec: HazardDef): string {
    const key = `haz-${spec.type}-${Math.round(spec.w)}x${Math.round(spec.h)}`
    if (this.textures.exists(key)) return key
    const g = this.make.graphics({ x: 0, y: 0 })
    const hz = Phaser.Display.Color.HexStringToColor(this.theme.hazard).color
    if (spec.type === 'spike') {
      g.fillStyle(hz, 1)
      const n = Math.max(1, Math.round(spec.w / 12))
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (spec.w / n)
        g.fillTriangle(x - 6, spec.h, x, 0, x + 6, spec.h)
      }
    } else if (spec.type === 'laser') {
      g.fillStyle(0xff3355, 1)
      g.fillRect(0, 0, spec.w, spec.h)
    } else if (spec.type === 'toxic') {
      g.fillStyle(0xb8ff3d, 0.55)
      g.fillRoundedRect(0, 0, spec.w, spec.h, 6)
    } else if (spec.type === 'gear') {
      g.fillStyle(0x8a9099, 1)
      g.fillCircle(spec.w / 2, spec.h / 2, spec.w / 2)
      g.fillStyle(0x23272d, 1)
      g.fillCircle(spec.w / 2, spec.h / 2, spec.w / 6)
    } else {
      g.fillStyle(hz, 1)
      g.fillRoundedRect(0, 0, spec.w, spec.h, 4)
    }
    g.generateTexture(key, Math.max(2, Math.round(spec.w)), Math.max(2, Math.round(spec.h)))
    g.destroy()
    return key
  }

  private buildItems(level: LevelDef): void {
    for (const spec of level.collectibles) {
      const key = `orb-${spec.rarity}`
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 })
        const col = spec.rarity === 'secret' ? 0xb388ff : spec.rarity === 'rare' ? 0x7ae7c7 : 0xffe27a
        g.fillStyle(col, 1)
        g.fillCircle(10, 10, 8)
        g.fillStyle(0xffffff, 0.5)
        g.fillCircle(8, 7, 3)
        g.generateTexture(key, 20, 20)
        g.destroy()
      }
      const img = this.items.create(spec.x, spec.y, key) as Item
      img.spec = spec
      img.taken = false
      img.bob = Math.random() * Math.PI * 2
      img.setDepth(13)
      this.itemList.push(img)
    }
  }

  private buildCheckpoints(level: LevelDef): void {
    for (const c of level.checkpoints) {
      const z = this.add.zone(c.x, c.y, 28, 48)
      this.physics.add.existing(z, true)
      this.physics.add.overlap(this.player.sprite, z, () => {
        this.player.setCheckpoint({ x: c.x, y: c.y })
        this.initData.audio.playSfx('checkpoint')
        bus.emit('checkpoint', { id: c.id })
      })
    }
  }

  private buildPortals(level: LevelDef): void {
    const zones: Phaser.GameObjects.Zone[] = []
    for (const p of level.portals) {
      const color = 0x6cf0ff
      this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, color, 0.35).setDepth(9)
      const z = this.add.zone(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h)
      this.physics.world.enable(z, Phaser.Physics.Arcade.STATIC_BODY)
      ;(z as unknown as { pid: string; target: string }).pid = p.id
      ;(z as unknown as { pid: string; target: string }).target = p.targetId
      zones.push(z)
    }
    this.physics.add.overlap(this.player.sprite, zones as unknown as Phaser.GameObjects.GameObject[], (_pl, z) => {
      if (this.portalCool > 0) return
      const t = (z as unknown as { target: string }).target
      const dest = level.portals.find((p) => p.id === t)
      if (!dest) return
      this.portalCool = 0.45
      this.player.sprite.setPosition(dest.x + dest.w / 2, dest.y + dest.h / 2)
      this.initData.audio.playSfx('portal')
      this.particles.sparkle(dest.x, dest.y, 0x6cf0ff)
      this.cam.shake(5, 80)
    })
  }

  private buildGoal(level: LevelDef): void {
    const g = level.goal
    const key = 'goal-flag'
    if (!this.textures.exists(key)) {
      const gg = this.make.graphics({ x: 0, y: 0 })
      gg.fillStyle(0xf5f1ea, 1)
      gg.fillRect(8, 0, 4, 48)
      gg.fillStyle(0xffe27a, 1)
      gg.fillTriangle(12, 2, 36, 14, 12, 26)
      gg.generateTexture(key, 40, 48)
      gg.destroy()
    }
    this.goal = this.physics.add.staticImage(g.x + g.w / 2, g.y + g.h / 2, key)
    this.goal.setDepth(10)
    if (level.isBoss) this.goal.setVisible(false).disableBody(true, true)
  }

  private onLand(plat: Plat): void {
    if (!plat.spec) return
    const spec = plat.spec
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    const fromAbove = body.velocity.y >= 0 && this.player.sprite.y < plat.y
    if (spec.type === 'spring' && fromAbove) {
      this.player.applySpring(spec.spring ?? 920)
    }
    if (spec.type === 'conveyor') {
      body.setVelocityX(body.velocity.x + (spec.dir ?? 1) * (spec.speed ?? 140) * 0.04)
    }
    if (spec.type === 'sticky' || spec.type === 'membrane') {
      this.player.sticky = 0.2
    }
    if (spec.type === 'crumble' && fromAbove) {
      plat.crumble = plat.crumble ?? 0.45
    }
    if (spec.move || spec.type === 'moving') {
      this.player.onMoving = { dx: plat.x - plat.lastX, dy: plat.y - plat.lastY }
    }
  }

  private takeItem(it: Item): void {
    if (it.taken) return
    it.taken = true
    const rarity = it.spec.rarity
    const pts = rarity === 'secret' ? 500 : rarity === 'rare' ? 250 : 100
    this.stats.score += pts + this.stats.combo * 10
    this.stats.combo += 1
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo)
    if (rarity === 'secret') {
      this.stats.secrets += 1
      this.initData.audio.playSfx('collect-secret')
      bus.emit('secret', { id: it.spec.id ?? 'secret' })
    } else {
      this.stats.collectibles += 1
      if (rarity === 'rare') this.stats.rares += 1
      this.initData.audio.playSfx(rarity === 'rare' ? 'collect-rare' : 'collect')
    }
    this.particles.sparkle(it.x, it.y, rarity === 'secret' ? 0xb388ff : 0xffe27a)
    this.player.notice('item', it.x, it.y)
    this.tweens.add({
      targets: it,
      y: it.y - 28,
      alpha: 0,
      scale: 1.6,
      duration: 240,
      onComplete: () => it.destroy(),
    })
    this.hud()
  }

  private touchHazard(h: Haz): void {
    if (h.spec.type === 'laser' && h.laserOn === false) return
    if (h.spec.type === 'toxic') {
      this.player.notice('danger', h.x, h.y)
      if (this.player.hurt({ x: h.x, y: h.y })) this.fail()
      return
    }
    this.player.notice('danger', h.x, h.y)
    this.fail()
  }

  private touchEnemy(e: Phaser.Physics.Arcade.Sprite): void {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    const stomp = body.velocity.y > 80 && this.player.sprite.y < e.y - 4
    if (stomp) {
      this.enemies.stomp(e as never, this.player)
      this.stats.score += 150
      this.stats.combo += 1
      this.hud()
      return
    }
    this.player.notice('enemy', e.x, e.y)
    if (this.player.hurt({ x: e.x, y: e.y })) this.fail()
  }

  private touchBoss(): void {
    if (!this.boss.alive) return
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    const stomp = body.velocity.y > 40 && this.player.sprite.y < (this.boss.sprite?.y ?? 0)
    if (stomp) {
      this.boss.tryHit(this.player)
      this.stats.score += 200
      if (!this.boss.alive) {
        this.goal?.enableBody(true, this.goal.x, this.goal.y, true, true)
        this.goal?.setVisible(true)
      }
      this.hud()
      return
    }
    if (this.player.hurt({ x: this.boss.sprite?.x ?? 0, y: this.boss.sprite?.y ?? 0 })) this.fail()
  }

  private fail(): void {
    if (this.player.dead) return
    this.stats.deaths += 1
    this.stats.combo = 0
    this.initData.save.addDeath()
    this.particles.burst(this.player.sprite.x, this.player.sprite.y, 0xf5f1ea, 16, 180)
    this.player.kill()
    this.hud()
  }

  private tryComplete(): void {
    if (this.finished) return
    if (this.initData.level.isBoss && this.boss.alive) return
    this.finished = true
    this.player.celebrate()
    this.initData.audio.playSfx('complete')
    const stars = this.computeStars()
    const prev = this.initData.save.getRecord(this.initData.level.id)
    const rec = this.initData.save.upsertRecord(this.initData.level.id, {
      completed: true,
      bestScore: this.stats.score,
      bestTime: this.stats.time,
      deaths: this.stats.deaths,
      stars,
      collectibles: this.stats.collectibles,
      collectiblesMax: this.stats.collectiblesMax,
      secrets: this.stats.secrets,
      secretsMax: this.stats.secretsMax,
    })
    const unlock = this.initData.progress.applyCompletion(this.initData.level, stars)
    const payload: LevelCompletePayload = {
      level: this.initData.level,
      stats: this.stats,
      stars,
      prevStars: prev?.stars ?? 0,
      bestScore: rec.bestScore,
      bestTime: rec.bestTime,
      newBestScore: !prev || this.stats.score >= rec.bestScore,
      newBestTime: !prev || prev.bestTime === 0 || this.stats.time <= rec.bestTime,
      unlockedNext: unlock.unlockedNext,
      unlockedSeason: unlock.unlockedSeason,
    }
    this.time.delayedCall(400, () => bus.emit('complete', payload))
  }

  private computeStars(): number {
    let s = 1
    const allCommon = this.stats.collectiblesMax === 0 || this.stats.collectibles >= this.stats.collectiblesMax
    if (allCommon) s = 2
    const secretOk = this.stats.secretsMax === 0 || this.stats.secrets >= this.stats.secretsMax
    const clean = this.stats.deaths === 0
    const fast = this.stats.time <= this.initData.level.parTime
    if (allCommon && secretOk && (clean || fast)) s = 3
    return s
  }

  private setPaused(paused: boolean): void {
    this.paused = paused
    this.physics.world.isPaused = paused
    this.hud()
  }

  update(_t: number, delta: number): void {
    if (this.paused || this.finished) return
    let dt = Math.min(delta / 1000, 1 / 20)
    if (this.hitstop > 0) {
      this.hitstop -= dt
      dt *= 0.12
    }
    const input = this.initData.input.update()
    if (input.pausePressed) {
      bus.emit('pause', { paused: !this.paused })
      return
    }
    this.elapsed += dt
    this.stats.time = this.elapsed
    this.portalCool = Math.max(0, this.portalCool - dt)

    this.updatePlatforms(dt)
    this.updateHazards(dt)
    this.updateItems(dt)
    this.updateZones()
    this.enemies.update(dt, this.player)
    this.boss.update(dt, this.player)
    this.player.update(dt, input)
    this.particles.update(dt)
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    this.cam.update(dt, body.velocity.x, body.velocity.y)

    const nearest = this.itemList.find((i) => !i.taken && Phaser.Math.Distance.Between(i.x, i.y, this.player.sprite.x, this.player.sprite.y) < 90)
    if (nearest) this.player.notice('item', nearest.x, nearest.y)
    const nearHaz = this.hazList.find((h) => Phaser.Math.Distance.Between(h.x, h.y, this.player.sprite.x, this.player.sprite.y) < 70)
    if (nearHaz) this.player.notice('danger', nearHaz.x, nearHaz.y)

    if (this.player.sprite.y > this.initData.level.height + 80 || this.player.sprite.y < -120) this.fail()
    if (Math.floor(this.elapsed * 4) !== Math.floor((this.elapsed - dt) * 4)) this.hud()
  }

  private updatePlatforms(dt: number): void {
    const t = this.elapsed
    for (const p of this.platList) {
      p.lastX = p.x
      p.lastY = p.y
      const m = p.spec.move
      if (m) {
        const u = ((t + (m.phase ?? 0)) / m.period) * Math.PI * 2
        const k = m.ease === 'linear' ? ((t / m.period) % 1) * 2 : Math.sin(u)
        const a = m.ease === 'linear' ? (k > 1 ? 2 - k : k) * 2 - 1 : k
        p.x = p.homeX + m.dx * a
        p.y = p.homeY + m.dy * a
        p.body?.updateFromGameObject?.()
      }
      if (p.spec.type === 'timed') {
        const per = p.spec.period ?? 2.2
        const on = (t + (p.spec.delay ?? 0)) % per < per * 0.55
        p.setAlpha(on ? 1 : 0.15)
        if (on) p.enableBody?.(true, p.x, p.y, true, true)
        else p.disableBody?.(true, false)
      }
      if (p.crumble !== undefined) {
        p.crumble -= dt
        p.x += Math.sin(t * 40) * 1.2
        if (p.crumble <= 0) {
          p.disableBody(true, true)
          this.time.delayedCall(2000, () => {
            p.enableBody(true, p.homeX, p.homeY, true, true)
            p.crumble = undefined
          })
        }
      }
      if (p.spec.type === 'membrane') p.rotation += dt * 0.6
    }
  }

  private updateHazards(dt: number): void {
    void dt
    const t = this.elapsed
    for (const h of this.hazList) {
      const m = h.spec.move
      if (m) {
        const u = Math.sin(((t + (m.phase ?? 0)) / m.period) * Math.PI * 2)
        h.x = h.homeX + m.dx * u
        h.y = h.homeY + m.dy * u
      }
      if (h.spec.type === 'laser') {
        const on = h.spec.onMs ?? 900
        const off = h.spec.offMs ?? 900
        const cyc = (on + off) / 1000
        const local = (t + (h.spec.delay ?? 0) / 1000) % cyc
        h.laserOn = local < on / 1000
        h.setAlpha(h.laserOn ? 1 : 0.12)
        h.setActive(!!h.laserOn)
      }
      if (h.spec.type === 'gear') h.rotation += dt * 2
    }
  }

  private updateItems(dt: number): void {
    for (const it of this.itemList) {
      if (it.taken || !it.active) continue
      it.bob += dt * 3
      it.y += Math.sin(it.bob) * 8 * dt
      it.rotation = Math.sin(it.bob) * 0.15
    }
  }

  private updateZones(): void {
    const z = this.initData.level.zones
    const p = this.player
    p.fluid = false
    let g: GravityMode | null = null
    for (const zone of z) {
      if (p.sprite.x > zone.x && p.sprite.x < zone.x + zone.w && p.sprite.y > zone.y && p.sprite.y < zone.y + zone.h) {
        if (zone.gravity) g = zone.gravity
        if (zone.fluid) p.fluid = true
        if (zone.sticky) p.sticky = 0.1
        if (zone.toxic && p.hurt()) this.fail()
      }
    }
    if (g) p.gravityMode = g
    else if (!this.initData.level.boss) p.gravityMode = 'down'
  }

  private hud(): void {
    bus.emit('hud', {
      score: this.stats.score,
      combo: this.stats.combo,
      time: this.stats.time,
      collected: this.stats.collectibles,
      collectMax: this.stats.collectiblesMax,
      secrets: this.stats.secrets,
      secretMax: this.stats.secretsMax,
      starsPreview: this.computeStars(),
      paused: this.paused,
    })
  }

  shutdown(): void {
    for (const u of this.unsubs) u()
    this.unsubs = []
    this.particles?.destroy()
  }
}
