import Phaser from 'phaser'
import type { LevelDef, RunStats } from '../core/types'
import { gameManager } from '../systems/GameManager'

export class Hud {
  private score: Phaser.GameObjects.Text
  private bits: Phaser.GameObjects.Text
  private time: Phaser.GameObjects.Text
  private hearts: Phaser.GameObjects.Arc[] = []
  private pause: Phaser.GameObjects.Text
  private bossBar?: Phaser.GameObjects.Rectangle
  private bossFill?: Phaser.GameObjects.Rectangle
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, def: LevelDef) {
    this.scene = scene
    const cam = scene.cameras.main
    this.score = scene.add.text(24, 18, '0', { fontFamily: 'Outfit, sans-serif', fontSize: '22px', color: '#F5F1EA' })
    this.bits = scene.add.text(24, 44, '', { fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#F5F1EAaa' })
    this.time = scene.add.text(cam.width / 2, 20, '0:00', {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '18px',
      color: '#F5F1EA',
    }).setOrigin(0.5, 0)
    this.pause = scene.add
      .text(cam.width - 28, 22, 'II', { fontFamily: 'Outfit, sans-serif', fontSize: '18px', color: '#F5F1EA' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    this.pause.on('pointerup', () => {
      gameManager().input.requestPause()
      gameManager().audio.playSfx('ui-click')
    })
    for (let i = 0; i < 3; i++) {
      this.hearts.push(scene.add.circle(0, 0, 7, 0xf5f1ea, 1))
    }
    const kids: Phaser.GameObjects.GameObject[] = [this.score, this.bits, this.time, this.pause, ...this.hearts]
    if (def.kind === 'boss') {
      this.bossBar = scene.add.rectangle(cam.width / 2, 56, 280, 10, 0x000000, 0.35).setOrigin(0.5)
      this.bossFill = scene.add.rectangle(cam.width / 2 - 140, 56, 280, 10, 0xff6b6b, 0.9).setOrigin(0, 0.5)
      kids.push(this.bossBar, this.bossFill)
    }
    scene.add.container(0, 0, kids).setScrollFactor(0).setDepth(80)
    this.layout()
  }

  refresh(stats: RunStats, hp: number, maxHp: number, boss: number | null): void {
    this.score.setText(String(stats.score).padStart(6, '0'))
    this.bits.setText(`★ ${stats.stars}/3   ◉ ${stats.collectibles}/${stats.collectiblesTotal}   ? ${stats.secrets}/${stats.secretsTotal}`)
    const m = Math.floor(stats.time / 60)
    const s = Math.floor(stats.time % 60)
    this.time.setText(`${m}:${String(s).padStart(2, '0')}`)
    this.hearts.forEach((h, i) => h.setFillStyle(i < hp ? 0xf5f1ea : 0xf5f1ea, i < hp ? 1 : 0.2))
    if (this.bossFill && boss !== null) this.bossFill.width = 280 * Math.max(0, 1 - boss)
    void maxHp
  }

  layout(): void {
    const w = this.scene.scale.width
    const pad = 18 + (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0)
    this.score.setPosition(24, pad)
    this.bits.setPosition(24, pad + 26)
    this.time.setPosition(w / 2, pad + 2)
    this.pause.setPosition(w - 24, pad + 2)
    this.hearts.forEach((h, i) => h.setPosition(w - 90 + i * 20, pad + 44))
    this.bossBar?.setPosition(w / 2, pad + 58)
    this.bossFill?.setPosition(w / 2 - 140, pad + 58)
  }
}
