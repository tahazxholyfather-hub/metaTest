import Phaser from 'phaser'
import { GAME_TITLE, STUDIO_NAME } from '../core/types'
import { allLevels } from '../data/levels'
import { gameManager } from '../systems/GameManager'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload(): void {
    this.load.image('studio-logo', 'assets/game/studio-logo-placeholder.png')
    this.load.image('cover', 'assets/game/cover-placeholder.png')
  }

  create(): void {
    const gm = gameManager()
    gm.input.attach()
    const skip = gm.save.snapshot().seenIntro && gm.save.snapshot().settings.skipIntro
    this.scene.start(skip ? 'load' : 'logo')
  }
}

export class LogoScene extends Phaser.Scene {
  constructor() {
    super('logo')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#07080c')
    const { width: w, height: h } = this.scale
    const logo = this.add.image(w / 2, h / 2 - 16, 'studio-logo').setAlpha(0)
    const max = Math.min(w * 0.38, h * 0.38, 280)
    logo.setDisplaySize(max, max)
    const caption = this.add
      .text(w / 2, h / 2 + max / 2 + 18, STUDIO_NAME, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#F5F1EA',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({ targets: [logo, caption], alpha: 1, duration: 700, ease: 'Sine.out' })
    this.tweens.add({
      targets: [logo, caption],
      alpha: 0,
      delay: 2200,
      duration: 500,
      ease: 'Sine.in',
      onComplete: () => this.scene.start('load'),
    })

    const skip = () => this.scene.start('load')
    this.input.once('pointerdown', skip)
    this.input.keyboard?.once('keydown', skip)
  }
}

export class LoadScene extends Phaser.Scene {
  constructor() {
    super('load')
  }

  preload(): void {
    const { width: w, height: h } = this.scale
    this.cameras.main.setBackgroundColor('#07080c')
    const cover = this.add.image(w / 2, h / 2, 'cover').setAlpha(0.92)
    cover.setDisplaySize(w, h)
    this.add.rectangle(w / 2, h / 2, w, h, 0x07080c, 0.35)
    this.add
      .text(w / 2, h * 0.18, GAME_TITLE, {
        fontFamily: 'Georgia, serif',
        fontSize: Math.min(86, w * 0.12) + 'px',
        color: '#F5F1EA',
      })
      .setOrigin(0.5)
    this.add
      .text(w / 2, h * 0.18 + 58, 'A bounce through four worlds', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '16px',
        color: '#F5F1EAaa',
      })
      .setOrigin(0.5)

    const barW = Math.min(360, w * 0.5)
    const track = this.add.rectangle(w / 2, h * 0.82, barW, 6, 0xf5f1ea, 0.15)
    const fill = this.add.rectangle(w / 2 - barW / 2, h * 0.82, 4, 6, 0xf5f1ea, 1).setOrigin(0, 0.5)
    const label = this.add
      .text(w / 2, h * 0.82 + 22, 'Loading', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px',
        color: '#F5F1EAaa',
      })
      .setOrigin(0.5)
    void track

    this.load.on('progress', (p: number) => {
      fill.width = Math.max(4, barW * p)
      label.setText(`Loading  ${Math.round(p * 100)}%`)
    })

    this.load.image('season-1-cover', 'assets/seasons/season-1-cover.png')
    this.load.image('season-2-cover', 'assets/seasons/season-2-cover.png')
    this.load.image('season-3-cover', 'assets/seasons/season-3-cover.png')
    this.load.image('season-4-cover', 'assets/seasons/season-4-cover.png')
    this.load.image('season-1-bg', 'assets/season-1/world-bg.png')
    this.load.image('season-2-bg', 'assets/season-2/world-bg.png')
    this.load.image('season-3-bg', 'assets/season-3/world-bg.png')
    this.load.image('season-4-bg', 'assets/season-4/world-bg.png')
  }

  async create(): Promise<void> {
    const gm = gameManager()
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      gm.audio.attach(ctx)
      await gm.audio.loadAll(async (url) => {
        const res = await fetch(url)
        return res.arrayBuffer()
      })
      gm.applyAudioSettings()
    } catch (err) {
      console.warn('audio init failed', err)
    }
    gm.save.markIntroSeen()
    const level = new URLSearchParams(location.search).get('level')
    if (new URLSearchParams(location.search).get('unlock') === '1') {
      gm.save.mutate((d) => {
        d.unlockedSeasons = ['season-1', 'season-2', 'season-3', 'season-4']
        d.unlockedLevels = allLevels().map((l) => l.id)
      })
    }
    this.cameras.main.fadeOut(400, 7, 8, 12)
    this.time.delayedCall(420, () => {
      if (level) this.scene.start('play', { levelId: level })
      else this.scene.start('menu')
    })
  }
}
