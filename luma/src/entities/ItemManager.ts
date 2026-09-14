import Phaser from 'phaser'
import type { CollectibleDef, CollectibleKind } from '../core/types'
import type { AudioManager } from '../systems/AudioManager'
import type { ParticleManager } from '../systems/ParticleManager'
import type { Player } from './Player'

const COLOR: Record<CollectibleKind, number> = {
  common: 0xffe08a,
  rare: 0x80ffdb,
  secret: 0xc77dff,
  star: 0xfff3b0,
}

export class ItemManager {
  items: { def: CollectibleDef; g: Phaser.GameObjects.Arc; taken: boolean }[] = []
  collected = 0
  stars = 0
  secrets = 0
  secretIds: string[] = []
  readonly totals: { all: number; stars: number; secrets: number }

  constructor(scene: Phaser.Scene, defs: CollectibleDef[]) {
    this.totals = {
      all: defs.length,
      stars: defs.filter((d) => d.kind === 'star').length,
      secrets: defs.filter((d) => d.kind === 'secret').length,
    }
    for (const def of defs) {
      const r = def.kind === 'star' ? 11 : def.kind === 'rare' ? 9 : 7
      const g = scene.add.circle(def.x, def.y, r, COLOR[def.kind], 1).setDepth(11)
      if (def.kind === 'star') g.setStrokeStyle(2, 0xffffff, 0.9)
      this.items.push({ def, g, taken: false })
    }
  }

  nearest(x: number, y: number, r: number): CollectibleDef | null {
    let best: CollectibleDef | null = null
    let bd = r
    for (const it of this.items) {
      if (it.taken) continue
      const d = Math.hypot(it.g.x - x, it.g.y - y)
      if (d < bd) {
        bd = d
        best = it.def
      }
    }
    return best
  }

  update(t: number, player: Player, audio: AudioManager, particles: ParticleManager, onScore: (n: number, kind: CollectibleKind) => void): void {
    for (const it of this.items) {
      if (it.taken) continue
      it.g.y = it.def.y + Math.sin(t * 3 + it.def.x * 0.01) * 4
      it.g.scale = 1 + Math.sin(t * 5 + it.def.y) * 0.06
      if (Phaser.Math.Distance.Between(player.x, player.y, it.g.x, it.g.y) < 26) {
        it.taken = true
        it.g.setVisible(false)
        this.collected += 1
        if (it.def.kind === 'star') this.stars += 1
        if (it.def.kind === 'secret') {
          this.secrets += 1
          this.secretIds.push(it.def.id)
        }
        const sfx = it.def.kind === 'secret' ? 'secret' : it.def.kind === 'rare' || it.def.kind === 'star' ? 'collect-rare' : 'collect'
        audio.playSfx(sfx)
        particles.burst(it.g.x, it.g.y, COLOR[it.def.kind], 12, 160, true)
        const pts = it.def.kind === 'star' ? 500 : it.def.kind === 'rare' ? 250 : it.def.kind === 'secret' ? 400 : 100
        onScore(pts, it.def.kind)
      }
    }
  }

  destroy(): void {
    this.items.forEach((i) => i.g.destroy())
  }
}
