import Phaser from 'phaser'
import { LumaCanvas } from '../character'
import { GAME_TITLE } from '../core/types'
import { gameManager } from '../systems/GameManager'

export class MenuScene extends Phaser.Scene {
  private luma!: LumaCanvas
  private tex!: Phaser.Textures.CanvasTexture
  private sprite!: Phaser.GameObjects.Image

  constructor() {
    super('menu')
  }

  create(): void {
    const gm = gameManager()
    const { width: w, height: h } = this.scale
    this.cameras.main.setBackgroundColor('#0b0d12')
    this.add.image(w / 2, h / 2, 'cover').setDisplaySize(w, h).setAlpha(0.22)
    this.add.circle(w / 2, h * 0.38, 130, 0x07080c, 0.55)
    this.add.rectangle(w / 2, h / 2, w, h, 0x07080c, 0.45)

    this.luma = new LumaCanvas({ size: 220 })
    if (this.textures.exists('luma-menu')) this.textures.remove('luma-menu')
    this.tex = this.textures.addCanvas('luma-menu', this.luma.canvas)!
    this.sprite = this.add.image(w / 2, h * 0.38, 'luma-menu').setDisplaySize(Math.min(180, w * 0.28), Math.min(180, w * 0.28))
    this.luma.setState('idle')

    this.add
      .text(w / 2, h * 0.58, GAME_TITLE, {
        fontFamily: 'Georgia, serif',
        fontSize: Math.min(72, w * 0.11) + 'px',
        color: '#F5F1EA',
      })
      .setOrigin(0.5)
    this.add
      .text(w / 2, h * 0.58 + 48, 'Four seasons. Forty-four stages. One pair of eyes.', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '15px',
        color: '#F5F1EA99',
      })
      .setOrigin(0.5)

    const play = this.makeBtn(w / 2, h * 0.74, 'Play', () => this.scene.start('seasons'))
    const settings = this.makeBtn(w / 2, h * 0.74 + 48, 'Settings', () => this.scene.start('settings'))
    void play
    void settings

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const dx = (p.x - this.sprite.x) / 120
      const dy = (p.y - this.sprite.y) / 120
      this.luma.setLookAt({ x: Phaser.Math.Clamp(dx, -1, 1), y: Phaser.Math.Clamp(dy, -1, 1) })
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.x, p.y, this.sprite.x, this.sprite.y) < 90) this.luma.poke()
    })

    gm.audio.playMusic('menu')
    gm.audio.resume()
  }

  update(_t: number, d: number): void {
    this.luma.update(Math.min(0.033, d / 1000))
    this.tex.refresh()
  }

  private makeBtn(x: number, y: number, label: string, fn: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, { fontFamily: 'Outfit, sans-serif', fontSize: '22px', color: '#F5F1EA' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    t.on('pointerover', () => {
      t.setAlpha(0.7)
      gameManager().audio.playSfx('ui-hover')
    })
    t.on('pointerout', () => t.setAlpha(1))
    t.on('pointerup', () => {
      gameManager().audio.playSfx('ui-click')
      fn()
    })
    return t
  }
}

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('settings')
  }

  create(): void {
    const gm = gameManager()
    const { width: w, height: h } = this.scale
    this.cameras.main.setBackgroundColor('#07080c')
    this.add
      .text(w / 2, 70, 'Settings', { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#F5F1EA' })
      .setOrigin(0.5)
    const paint = (): void => {
      this.children.getAll().forEach((c) => {
        if (c.getData('row')) c.destroy()
      })
      const s = gm.save.snapshot().settings
      const items: [string, () => void][] = [
        [`Master  ${Math.round(s.master * 100)}%`, () => gm.save.updateSettings({ master: (s.master + 0.25) % 1.25 })],
        [`Music  ${Math.round(s.music * 100)}%`, () => gm.save.updateSettings({ music: (s.music + 0.25) % 1.25 })],
        [`SFX  ${Math.round(s.sfx * 100)}%`, () => gm.save.updateSettings({ sfx: (s.sfx + 0.25) % 1.25 })],
        [`Mute  ${s.muted ? 'On' : 'Off'}`, () => gm.save.updateSettings({ muted: !s.muted })],
        [`Screen shake  ${s.shake ? 'On' : 'Off'}`, () => gm.save.updateSettings({ shake: !s.shake })],
        [`Particles  ${s.particles ? 'On' : 'Off'}`, () => gm.save.updateSettings({ particles: !s.particles })],
        [
          `Skip intro  ${s.skipIntro ? 'On' : 'Off'}`,
          () => gm.save.updateSettings({ skipIntro: !s.skipIntro }),
        ],
      ]
      items.forEach(([label, fn], i) => {
        const t = this.add
          .text(w / 2, 140 + i * 44, label, { fontFamily: 'Outfit, sans-serif', fontSize: '22px', color: '#F5F1EA' })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .setData('row', true)
        t.on('pointerup', () => {
          fn()
          gm.applyAudioSettings()
          gm.audio.playSfx('ui-click')
          paint()
        })
      })
    }
    paint()
    const back = this.add
      .text(w / 2, h - 70, 'Back', { fontFamily: 'Outfit, sans-serif', fontSize: '20px', color: '#F5F1EA99' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    back.on('pointerup', () => this.scene.start('menu'))
  }
}
