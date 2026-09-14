import Phaser from 'phaser'
import { THEMES } from '../core/seasons'
import { PHYSICS, type CollectibleKind, type LevelDef, type RunStats } from '../core/types'
import { getLevel, nextLevelId } from '../data/levels'
import { BossManager } from '../entities/BossManager'
import { EnemyManager } from '../entities/EnemyManager'
import { ItemManager } from '../entities/ItemManager'
import { Player } from '../entities/Player'
import { WorldObjects } from '../entities/WorldObjects'
import { CameraManager } from '../systems/CameraManager'
import { gameManager } from '../systems/GameManager'
import { ParticleManager } from '../systems/ParticleManager'
import { Hud } from '../ui/Hud'
import { Overlay } from '../ui/Overlay'
import { TouchControls } from '../ui/TouchControls'

export class PlayScene extends Phaser.Scene {
  private def!: LevelDef
  private player!: Player
  private world!: WorldObjects
  private items!: ItemManager
  private enemies!: EnemyManager
  private boss: BossManager | null = null
  private particles!: ParticleManager
  private cameraFx!: CameraManager
  private hud!: Hud
  private overlay!: Overlay
  private touch!: TouchControls
  private paused = false
  private complete = false
  private stats!: RunStats
  private elapsed = 0
  private respawnTimer = 0
  private floaters: { t: Phaser.GameObjects.Text; life: number }[] = []

  constructor() {
    super('play')
  }

  init(data: { levelId?: string }): void {
    const gm = gameManager()
    const id = data.levelId ?? gm.currentLevelId
    try {
      this.def = getLevel(id)
    } catch {
      this.scene.start('menu')
      return
    }
    gm.currentLevelId = this.def.id
    gm.currentSeasonId = this.def.seasonId
  }

  create(): void {
    const gm = gameManager()
    gm.input.attach()
    this.paused = false
    this.complete = false
    this.elapsed = 0
    this.stats = {
      score: 0,
      time: 0,
      deaths: 0,
      collectibles: 0,
      collectiblesTotal: 0,
      secrets: 0,
      secretsTotal: 0,
      stars: 0,
      combo: 0,
    }

    const theme = THEMES[this.def.seasonId]
    this.cameras.main.setBackgroundColor(theme.skyBot)
    this.physics.world.gravity.y = 1750
    this.physics.world.setBounds(0, 0, this.def.world.width, this.def.world.height)

    this.drawParallax(theme.parallax, theme.skyTop, theme.skyBot)

    this.world = new WorldObjects(this, this.def, {
      solid: theme.solid,
      hi: theme.solidHi,
      accent: theme.accent,
      hazard: theme.hazard,
    })
    this.player = new Player(this, this.def.spawn.x, this.def.spawn.y)
    this.items = new ItemManager(this, this.def.collectibles)
    this.enemies = new EnemyManager(this, this.def.enemies, theme.hazard)
    this.boss = this.def.boss ? new BossManager(this, this.def.boss, theme.accent2) : null
    this.stats.collectiblesTotal = this.items.totals.all
    this.stats.secretsTotal = this.items.totals.secrets

    this.physics.add.collider(this.player.sprite, this.world.solids, (_p, s) => {
      if ((s as Phaser.Physics.Arcade.Sprite).getData('sticky')) this.player.sticky = 0.2
    })
    this.physics.add.collider(this.player.sprite, this.world.platforms, undefined, (_p, plat) => {
      const body = this.player.body
      const platBody = (plat as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.StaticBody
      return body.velocity.y >= 0 && body.bottom <= platBody.top + 12
    })
    this.physics.add.collider(this.player.sprite, this.world.hazards, () => {
      this.hurtPlayer(this.player.x)
    })

    this.particles = new ParticleManager(this)
    this.cameraFx = new CameraManager(this.cameras.main)
    this.cameraFx.follow(this.player.sprite, this.def.world.width, this.def.world.height)

    this.hud = new Hud(this, this.def)
    this.overlay = new Overlay(this)
    this.touch = new TouchControls(gm.input)

    this.scale.on('resize', this.layout, this)
    this.layout()

    const settings = gm.save.snapshot().settings
    gm.audio.playMusic(this.def.kind === 'boss' ? 'boss' : this.def.seasonId)
    void settings
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.033, delta / 1000)
    const gm = gameManager()
    const input = gm.input.sample()
    const settings = gm.save.snapshot().settings

    if (input.pausePressed && !this.complete) {
      this.togglePause()
    }
    if (this.paused || this.complete) {
      this.player.view.update(dt)
      return
    }
    if (this.cameraFx.consumingHitstop(dt)) return

    this.elapsed += dt
    this.stats.time = this.elapsed

    if (this.player.dead) {
      this.respawnTimer -= dt
      this.player.update(dt, input, gm.audio, this.particles, null, settings.particles)
      if (this.respawnTimer <= 0) this.respawn()
      this.particles.update(dt)
      return
    }

    const look = this.lookTarget()
    this.player.setWorldGravity(PHYSICS.gravity)
    this.player.update(dt, input, gm.audio, this.particles, look, settings.particles)

    const hurt = (x: number) => this.hurtPlayer(x)
    this.world.update(this.elapsed, dt, this.player, gm.audio, this.particles, hurt)

    for (const mv of this.world.colliderTargets()) {
      this.physics.world.collide(this.player.sprite, mv)
    }

    this.enemies.update(dt, this.player, gm.audio, this.particles, hurt)
    this.items.update(this.elapsed, this.player, gm.audio, this.particles, (n, kind) => this.addScore(n, kind))
    this.boss?.update(dt, this.player, gm.audio, this.particles, this.cameraFx, settings.shake, hurt)

    this.checkCheckpoints(gm)
    this.checkGoal(gm)
    this.checkFall()

    this.cameraFx.update(dt, this.player.body.velocity.x, this.player.body.velocity.y, settings)
    this.particles.update(dt)
    this.updateFloaters(dt)
    this.hud.refresh(this.stats, this.player.hp, this.player.maxHp, this.boss?.progress ?? null)
  }

  private lookTarget(): { x: number; y: number } | null {
    const orb = this.items.nearest(this.player.x, this.player.y, 140)
    const en = this.enemies.nearest(this.player.x, this.player.y, 160)
    const target = en
      ? { x: en.sprite.x, y: en.sprite.y }
      : orb
        ? { x: orb.x, y: orb.y }
        : this.boss && !this.boss.defeated
          ? { x: this.def.boss!.x, y: this.def.boss!.y }
          : null
    if (!target) return null
    return {
      x: Phaser.Math.Clamp((target.x - this.player.x) / 120, -1, 1),
      y: Phaser.Math.Clamp((target.y - this.player.y) / 120, -1, 1),
    }
  }

  private hurtPlayer(fromX: number): void {
    if (this.player.invuln > 0 || this.player.dead || this.complete) return
    const gm = gameManager()
    this.player.hit(fromX, gm.audio, this.particles, () =>
      this.cameraFx.addTrauma(0.5, gm.save.snapshot().settings.shake),
    )
    if (this.player.dead) {
      this.stats.deaths += 1
      this.respawnTimer = 0.85
    }
  }

  private respawn(): void {
    this.player.reset(this.player.spawn.x, this.player.spawn.y)
  }

  private checkFall(): void {
    if (this.player.y > this.def.world.height + 40 || this.player.y < -80) {
      this.hurtPlayer(this.player.x)
      if (this.player.dead) this.respawnTimer = 0.2
      else this.player.sprite.setPosition(this.player.spawn.x, this.player.spawn.y)
    }
  }

  private checkCheckpoints(gm: ReturnType<typeof gameManager>): void {
    for (const c of this.world.checkpoints) {
      if (c.getData('armed')) continue
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y) < 32) {
        c.setData('armed', true)
        c.setFillStyle(0xffffff, 1)
        this.player.checkpoint(c.x, c.y)
        gm.audio.playSfx('checkpoint')
      }
    }
  }

  private checkGoal(gm: ReturnType<typeof gameManager>): void {
    if (this.complete) return
    if (this.boss && !this.boss.defeated) return
    const g = this.world.goal
    if (Math.abs(this.player.x - g.x) < g.width / 2 + 10 && Math.abs(this.player.y - g.y) < g.height / 2 + 10) {
      this.finish(gm)
    }
  }

  private addScore(n: number, kind: CollectibleKind): void {
    this.stats.combo += 1
    const gain = n + Math.min(200, this.stats.combo * 10)
    this.stats.score += gain
    this.stats.collectibles = this.items.collected
    this.stats.secrets = this.items.secrets
    this.stats.stars = this.items.stars
    const t = this.add
      .text(this.player.x, this.player.y - 28, `+${gain}`, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '18px',
        color: kind === 'secret' ? '#c77dff' : '#ffe08a',
      })
      .setOrigin(0.5)
      .setDepth(50)
    this.floaters.push({ t, life: 0.7 })
    void kind
  }

  private updateFloaters(dt: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!
      f.life -= dt
      f.t.y -= 28 * dt
      f.t.alpha = Math.max(0, f.life / 0.7)
      if (f.life <= 0) {
        f.t.destroy()
        this.floaters.splice(i, 1)
      }
    }
  }

  private finish(gm: ReturnType<typeof gameManager>): void {
    this.complete = true
    this.player.win()
    gm.audio.playSfx('level-complete')
    this.stats.collectibles = this.items.collected
    this.stats.secrets = this.items.secrets
    this.stats.stars = Math.min(3, this.items.stars)
    if (this.stats.stars < 1) this.stats.stars = 1
    if (this.stats.time <= this.def.parTime && this.stats.stars < 2) this.stats.stars = 2
    if (this.items.stars >= 3 && this.stats.secrets >= this.stats.secretsTotal) this.stats.stars = 3
    const prev = gm.progress.record(this.def.id)
    gm.progress.commitLevel(this.def.id, {
      score: this.stats.score,
      time: this.stats.time,
      deaths: this.stats.deaths,
      stars: this.stats.stars,
      collectibles: this.stats.collectibles,
      secrets: this.stats.secrets,
      secretIds: this.items.secretIds,
    })
    this.overlay.showComplete(this.def, this.stats, prev, {
      onReplay: () => this.scene.restart({ levelId: this.def.id }),
      onNext: () => {
        const nid = nextLevelId(this.def.id)
        if (nid && gm.progress.isLevelUnlocked(nid)) this.scene.start('play', { levelId: nid })
        else this.scene.start('levels', { seasonId: this.def.seasonId })
      },
      onSelect: () => this.scene.start('levels', { seasonId: this.def.seasonId }),
    })
  }

  private togglePause(): void {
    if (this.complete) return
    this.paused = !this.paused
    this.physics.world.isPaused = this.paused
    if (this.paused) {
      this.overlay.showPause({
        onResume: () => this.togglePause(),
        onRestart: () => this.scene.restart({ levelId: this.def.id }),
        onSettings: () => this.overlay.showSettings(),
        onExit: () => this.scene.start('levels', { seasonId: this.def.seasonId }),
      })
    } else {
      this.overlay.hidePause()
    }
  }

  private drawParallax(layers: [number, number, number], top: number, bot: number): void {
    const g = this.add.graphics().setScrollFactor(0).setDepth(-20)
    g.fillGradientStyle(top, top, bot, bot, 1)
    g.fillRect(-20, -20, 1400, 800)
    layers.forEach((c, i) => {
      const r = this.add.rectangle(this.def.world.width / 2, this.def.world.height - 40 - i * 70, this.def.world.width * 1.4, 180, c, 0.35)
      r.setDepth(-10 + i)
      r.setScrollFactor(0.12 + i * 0.12, 0.04)
    })
  }

  private layout = (): void => {
    this.hud?.layout()
    this.touch?.layout()
    this.overlay?.layout()
  }

  shutdown(): void {
    this.touch?.destroy()
    this.enemies?.destroy()
    this.items?.destroy()
    this.boss?.destroy()
    this.particles?.destroy()
    this.scale.off('resize', this.layout, this)
  }
}

