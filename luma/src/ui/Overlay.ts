import Phaser from 'phaser'
import type { LevelDef, LevelRecord, RunStats } from '../core/types'
import { gameManager } from '../systems/GameManager'

interface PauseHandlers {
  onResume: () => void
  onRestart: () => void
  onSettings: () => void
  onExit: () => void
}

interface CompleteHandlers {
  onReplay: () => void
  onNext: () => void
  onSelect: () => void
}

export class Overlay {
  private scene: Phaser.Scene
  private layer: Phaser.GameObjects.Container
  private settingsOpen = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.layer = scene.add.container(0, 0).setScrollFactor(0).setDepth(120).setVisible(false)
  }

  layout(): void {
    /* rebuilt on show */
  }

  hidePause(): void {
    if (this.settingsOpen) return
    this.layer.removeAll(true)
    this.layer.setVisible(false)
  }

  showPause(h: PauseHandlers): void {
    this.paint('Paused', [
      this.btn('Resume', h.onResume),
      this.btn('Restart', h.onRestart),
      this.btn('Settings', h.onSettings),
      this.btn('Exit', h.onExit),
    ])
  }

  showComplete(def: LevelDef, stats: RunStats, prev: LevelRecord, h: CompleteHandlers): void {
    const stars = '★'.repeat(stats.stars) + '☆'.repeat(3 - stats.stars)
    this.paint(def.name, [
      this.label(stars),
      this.label(`Score  ${stats.score}    Best ${Math.max(prev.bestScore, stats.score)}`),
      this.label(`Time   ${fmt(stats.time)}    Best ${fmt(prev.bestTime === 0 ? stats.time : Math.min(prev.bestTime, stats.time))}`),
      this.label(`Deaths ${stats.deaths}`),
      this.label(`Collectibles ${stats.collectibles}/${stats.collectiblesTotal}    Secrets ${stats.secrets}/${stats.secretsTotal}`),
      this.btn('Replay', h.onReplay),
      this.btn('Next', h.onNext),
      this.btn('Level Select', h.onSelect),
    ])
  }

  showSettings(): void {
    this.settingsOpen = true
    const gm = gameManager()
    const s = gm.save.snapshot().settings
    const cycle = (key: 'master' | 'music' | 'sfx', value: number, name: string) =>
      this.btn(`${name}  ${Math.round(value * 100)}%`, () => {
        gm.save.updateSettings({ [key]: (value + 0.25) % 1.25 })
        gm.applyAudioSettings()
        this.showSettings()
      })
    this.paint('Settings', [
      cycle('master', s.master, 'Master'),
      cycle('music', s.music, 'Music'),
      cycle('sfx', s.sfx, 'SFX'),
      this.btn(`Mute: ${s.muted ? 'On' : 'Off'}`, () => {
        gm.save.updateSettings({ muted: !s.muted })
        gm.applyAudioSettings()
        this.showSettings()
      }),
      this.btn(`Screen shake: ${s.shake ? 'On' : 'Off'}`, () => {
        gm.save.updateSettings({ shake: !s.shake })
        this.showSettings()
      }),
      this.btn(`Particles: ${s.particles ? 'On' : 'Off'}`, () => {
        gm.save.updateSettings({ particles: !s.particles })
        this.showSettings()
      }),
      this.btn('Back', () => {
        this.settingsOpen = false
        this.layer.removeAll(true)
        this.layer.setVisible(false)
      }),
    ])
  }

  private paint(title: string, children: Phaser.GameObjects.GameObject[]): void {
    this.layer.removeAll(true)
    const w = this.scene.scale.width
    const h = this.scene.scale.height
    const dim = this.scene.add.rectangle(0, 0, w, h, 0x07080c, 0.62).setOrigin(0)
    const card = this.scene.add.rectangle(w / 2, h / 2, Math.min(520, w - 40), Math.min(560, h - 36), 0x12141a, 0.96)
    card.setStrokeStyle(1, 0xf5f1ea, 0.18)
    const head = this.scene.add
      .text(w / 2, h / 2 - Math.min(230, h * 0.32), title, {
        fontFamily: 'Georgia, serif',
        fontSize: '34px',
        color: '#F5F1EA',
      })
      .setOrigin(0.5)
    children.forEach((c, i) => {
      const t = c as Phaser.GameObjects.Text
      t.setPosition(w / 2, h / 2 - 140 + i * 40)
    })
    this.layer.add([dim, card, head, ...children])
    this.layer.setVisible(true)
  }

  private btn(labelText: string, onClick: () => void): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(0, 0, labelText, { fontFamily: 'Outfit, sans-serif', fontSize: '22px', color: '#F5F1EA' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    t.on('pointerover', () => t.setAlpha(0.65))
    t.on('pointerout', () => t.setAlpha(1))
    t.on('pointerup', () => {
      gameManager().audio.playSfx('ui-click')
      onClick()
    })
    return t
  }

  private label(text: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, text, { fontFamily: 'Outfit, sans-serif', fontSize: '16px', color: '#F5F1EAcc' })
      .setOrigin(0.5)
  }
}

function fmt(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
