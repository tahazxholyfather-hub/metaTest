/** Tiny typed event bus used to keep Phaser, HUD, and app shell decoupled. */

export type Handler<T> = (payload: T) => void

export class Emitter<Events extends object> {
  private map = new Map<keyof Events, Set<Handler<Events[keyof Events]>>>()

  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(type)
    if (!set) {
      set = new Set()
      this.map.set(type, set)
    }
    set.add(fn as Handler<Events[keyof Events]>)
    return () => set!.delete(fn as Handler<Events[keyof Events]>)
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.map.get(type)
    if (!set) return
    for (const fn of set) fn(payload)
  }

  off<K extends keyof Events>(type: K, fn: Handler<Events[K]>): void {
    this.map.get(type)?.delete(fn as Handler<Events[keyof Events]>)
  }

  clear(): void {
    this.map.clear()
  }
}

export interface GameEvents {
  'hud': {
    score: number
    combo: number
    time: number
    collected: number
    collectMax: number
    secrets: number
    secretMax: number
    starsPreview: number
    paused: boolean
  }
  'player-hurt': { x: number; y: number; livesLeft: number }
  'player-die': { x: number; y: number }
  'player-respawn': { x: number; y: number }
  'collect': { rarity: string; x: number; y: number; score: number }
  'secret': { id: string }
  'checkpoint': { id: string }
  'boss-phase': { phase: number; name: string }
  'boss-hit': { hp: number; max: number }
  'complete': import('./types').LevelCompletePayload
  'pause': { paused: boolean }
  'exit-level': undefined
  'restart': undefined
  'next-level': undefined
  'shake': { mag: number; dur: number }
  'hitstop': { ms: number }
}

export const bus = new Emitter<GameEvents>()

export const gameplay = {
  paused: false,
}
