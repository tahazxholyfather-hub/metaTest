import Phaser from 'phaser'
import { THEMES } from '../core/seasons'
import type { SeasonId } from '../core/types'
import { levelsForSeason } from '../data/levels'
import { gameManager } from '../systems/GameManager'

export class LevelSelectScene extends Phaser.Scene {
  private seasonId: SeasonId = 'season-1'

  constructor() {
    super('levels')
  }

  init(data: { seasonId?: SeasonId }): void {
    this.seasonId = data.seasonId ?? gameManager().currentSeasonId
  }

  create(): void {
    const gm = gameManager()
    const theme = THEMES[this.seasonId]
    const { width: w, height: h } = this.scale
    this.cameras.main.setBackgroundColor(theme.skyBot)
    if (this.textures.exists(`${this.seasonId}-bg`)) {
      this.add.image(w / 2, h / 2, `${this.seasonId}-bg`).setDisplaySize(w, h).setAlpha(0.55)
    }
    this.add.rectangle(w / 2, h / 2, w, h, theme.skyBot, 0.35)
    this.add
      .text(w / 2, 28, theme.name, { fontFamily: 'Georgia, serif', fontSize: '30px', color: '#F5F1EA' })
      .setOrigin(0.5, 0)
    this.add
      .text(w / 2, 62, theme.tagline, { fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#F5F1EA99' })
      .setOrigin(0.5, 0)

    const back = this.add
      .text(24, 30, '← Worlds', { fontFamily: 'Outfit, sans-serif', fontSize: '16px', color: '#F5F1EA' })
      .setInteractive({ useHandCursor: true })
    back.on('pointerup', () => this.scene.start('seasons'))

    const levels = levelsForSeason(this.seasonId)
    const gfx = this.add.graphics()
    gfx.lineStyle(3, 0xf5f1ea, 0.22)
    const nodes: { x: number; y: number }[] = []
    for (let i = 0; i < levels.length; i++) {
      const col = i % 6
      const row = Math.floor(i / 6)
      const x = w * 0.14 + col * ((w * 0.72) / 5)
      const y = 130 + row * 150 + (col % 2 === 0 ? 0 : 24)
      nodes.push({ x, y })
    }
    gfx.beginPath()
    nodes.forEach((n, i) => (i === 0 ? gfx.moveTo(n.x, n.y) : gfx.lineTo(n.x, n.y)))
    gfx.strokePath()

    levels.forEach((lv, i) => {
      const n = nodes[i]!
      const unlocked = gm.progress.isLevelUnlocked(lv.id)
      const rec = gm.progress.record(lv.id)
      const isBoss = lv.kind === 'boss'
      const r = isBoss ? 28 : 22
      const fill = !unlocked ? 0x2a2d34 : rec.completed ? theme.accent : 0xf5f1ea
      const node = this.add.circle(n.x, n.y, r, fill, unlocked ? 1 : 0.28).setStrokeStyle(isBoss ? 3 : 1, 0xffffff, isBoss ? 0.8 : 0.3)
      const label = this.add
        .text(n.x, n.y, isBoss ? 'B' : String(lv.index), {
          fontFamily: 'Outfit, sans-serif',
          fontSize: isBoss ? '16px' : '14px',
          color: rec.completed ? '#12141a' : '#12141a',
        })
        .setOrigin(0.5)
      const stars = this.add
        .text(n.x, n.y + r + 12, unlocked ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '', {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '12px',
          color: '#F5F1EA',
        })
        .setOrigin(0.5, 0)
      const name = this.add
        .text(n.x, n.y + r + 26, lv.name, {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '11px',
          color: '#F5F1EA88',
        })
        .setOrigin(0.5, 0)
      if (unlocked) {
        node.setInteractive({ useHandCursor: true })
        node.on('pointerover', () => node.setScale(1.08))
        node.on('pointerout', () => node.setScale(1))
        node.on('pointerup', () => {
          gm.audio.playSfx('ui-click')
          this.cameras.main.fadeOut(250, 7, 8, 12)
          this.time.delayedCall(260, () => this.scene.start('play', { levelId: lv.id }))
        })
      }
      void label
      void stars
      void name
    })
  }
}
