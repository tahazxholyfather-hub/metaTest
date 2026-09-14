import Phaser from 'phaser'
import { SEASONS } from '../core/seasons'
import type { SeasonId } from '../core/types'
import { levelsForSeason } from '../data/levels'
import { gameManager } from '../systems/GameManager'

export class SeasonSelectScene extends Phaser.Scene {
  private index = 0
  private cards: Phaser.GameObjects.Container[] = []
  private dragging = false
  private dragX = 0

  constructor() {
    super('seasons')
  }

  create(): void {
    const gm = gameManager()
    const { width: w, height: h } = this.scale
    this.cameras.main.setBackgroundColor('#07080c')
    this.add
      .text(w / 2, 36, 'Worlds', { fontFamily: 'Georgia, serif', fontSize: '34px', color: '#F5F1EA' })
      .setOrigin(0.5, 0)
    const back = this.add
      .text(28, 36, '←', { fontFamily: 'Outfit, sans-serif', fontSize: '28px', color: '#F5F1EA' })
      .setInteractive({ useHandCursor: true })
    back.on('pointerup', () => this.scene.start('menu'))

    const cardW = Math.min(420, w * 0.72)
    const cardH = Math.min(520, h * 0.7)
    SEASONS.forEach((season, i) => {
      const unlocked = gm.progress.isSeasonUnlocked(season.id)
      const stars = gm.progress.seasonStars(season.id)
      const done = gm.progress.seasonCompleted(season.id)
      const total = levelsForSeason(season.id).length
      const c = this.add.container(w / 2, h / 2 + 10)
      const shadow = this.add.rectangle(6, 10, cardW, cardH, 0x000000, 0.35)
      const body = this.add.rectangle(0, 0, cardW, cardH, 0x12141a, 1).setStrokeStyle(1, 0xf5f1ea, 0.16)
      const cover = this.add.image(0, -cardH / 2 + cardH * 0.32, `${season.id}-cover`)
      cover.setDisplaySize(cardW - 8, cardH * 0.52)
      const name = this.add
        .text(0, cardH * 0.12, season.theme.name, {
          fontFamily: 'Georgia, serif',
          fontSize: '26px',
          color: '#F5F1EA',
        })
        .setOrigin(0.5)
      const desc = this.add
        .text(0, cardH * 0.2, season.theme.description, {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '14px',
          color: '#F5F1EA99',
          wordWrap: { width: cardW - 48 },
          align: 'center',
        })
        .setOrigin(0.5, 0)
      const prog = this.add
        .text(0, cardH * 0.34, unlocked ? `${done}/${total} stages    ${stars}★` : 'Locked', {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '15px',
          color: '#F5F1EAcc',
        })
        .setOrigin(0.5)
      c.add([shadow, body, cover, name, desc, prog])
      if (!unlocked) {
        const lock = this.add.rectangle(0, 0, cardW, cardH, 0x07080c, 0.55)
        const lt = this.add.text(0, 0, 'Locked', { fontFamily: 'Outfit, sans-serif', fontSize: '18px', color: '#F5F1EA' }).setOrigin(0.5)
        c.add([lock, lt])
      }
      c.setSize(cardW, cardH)
      c.setData('season', season.id)
      c.setData('unlocked', unlocked)
      c.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains)
      this.cards.push(c)
      void i
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true
      this.dragX = p.x
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return
      const dx = p.x - this.dragX
      this.dragging = false
      if (dx < -40) this.index = Math.min(this.cards.length - 1, this.index + 1)
      else if (dx > 40) this.index = Math.max(0, this.index - 1)
      else this.tryOpen()
      gm.audio.playSfx('ui-click')
    })
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.index = Math.max(0, this.index - 1)
    })
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.index = Math.min(this.cards.length - 1, this.index + 1)
    })
    this.input.keyboard?.on('keydown-ENTER', () => this.tryOpen())
    this.input.keyboard?.on('keydown-SPACE', () => this.tryOpen())

    const hint = this.add
      .text(w / 2, h - 28, 'Swipe or use arrows  ·  Enter to open', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px',
        color: '#F5F1EA66',
      })
      .setOrigin(0.5)
    void hint
    this.layoutCards(true)
  }

  update(): void {
    this.layoutCards(false)
  }

  private tryOpen(): void {
    const card = this.cards[this.index]
    if (!card) return
    if (!card.getData('unlocked')) {
      gameManager().audio.playSfx('hit', { volume: 0.3 })
      this.tweens.add({ targets: card, x: card.x + 8, yoyo: true, duration: 80, repeat: 2 })
      return
    }
    const id = card.getData('season') as SeasonId
    this.scene.start('levels', { seasonId: id })
  }

  private layoutCards(instant: boolean): void {
    const w = this.scale.width
    this.cards.forEach((c, i) => {
      const d = i - this.index
      const x = w / 2 + d * Math.min(280, w * 0.22)
      const s = i === this.index ? 1 : 0.86
      const a = i === this.index ? 1 : 0.55
      if (instant) {
        c.x = x
        c.setScale(s)
        c.setAlpha(a)
        c.setDepth(10 - Math.abs(d))
      } else {
        c.x += (x - c.x) * 0.16
        c.scale += (s - c.scale) * 0.16
        c.alpha += (a - c.alpha) * 0.16
        c.setDepth(10 - Math.abs(d))
      }
    })
  }
}
