import { getLevel } from './levels'
import type { SaveManager } from './save'
import { useEffect, useState } from 'react'

export type Phase =
  | 'BOOT'
  | 'MENU'
  | 'LEVEL_SELECT'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER'
  | 'ROTATE_DEVICE'

export interface Hud {
  name: string
  number: number
  time: number
  coins: number
  total: number
}

export interface RunResult {
  levelId: string
  name: string
  number: number
  time: number
  bestMs: number
  isBest: boolean
  coins: number
  total: number
  secrets: number
  routes: string[]
  nextId: string | null
}

export interface Snapshot {
  phase: Phase
  levelId: string | null
  panel: 'none' | 'settings'
  hud: Hud
  result: RunResult | null
  debug: boolean
}

const EMPTY_HUD: Hud = { name: '', number: 0, time: 0, coins: 0, total: 0 }

export class Session {
  phase: Phase = 'BOOT'
  levelId: string | null = null
  panel: 'none' | 'settings' = 'none'
  hud: Hud = EMPTY_HUD
  result: RunResult | null = null
  debug = false
  levelSerial = 0
  restartSerial = 0
  private held: Phase | null = null
  private listeners = new Set<() => void>()
  private save: SaveManager

  constructor(save: SaveManager) {
    this.save = save
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  snapshot(): Snapshot {
    return {
      phase: this.phase,
      levelId: this.levelId,
      panel: this.panel,
      hud: this.hud,
      result: this.result,
      debug: this.debug,
    }
  }

  boot(): void {
    window.setTimeout(() => this.go('MENU'), 360)
  }

  setRotate(on: boolean): void {
    if (on) {
      if (this.phase === 'ROTATE_DEVICE') return
      this.held = this.phase
      this.phase = 'ROTATE_DEVICE'
      this.emit()
      return
    }
    if (this.phase !== 'ROTATE_DEVICE') return
    this.phase = this.held ?? 'MENU'
    this.held = null
    this.emit()
  }

  startLevel(id: string): void {
    const level = getLevel(id)
    if (!level || !this.save.isUnlocked(id)) return
    this.levelId = id
    this.result = null
    this.panel = 'none'
    this.levelSerial += 1
    const coins = level.objects.reduce((n, obj) => n + (obj.kind === 'coin' ? 1 : 0), 0)
    this.hud = { name: level.name, number: level.number, time: 0, coins: 0, total: coins }
    this.go('LOADING')
  }

  markReady(): void {
    if (this.phase === 'LOADING') this.go('PLAYING')
    else if (this.phase === 'ROTATE_DEVICE' && this.held === 'LOADING') this.held = 'PLAYING'
  }

  pause(): void {
    if (this.phase === 'PLAYING') this.go('PAUSED')
  }

  resume(): void {
    if (this.phase !== 'PAUSED') return
    this.panel = 'none'
    this.go('PLAYING')
  }

  restart(): void {
    if (!this.levelId) return
    this.result = null
    this.panel = 'none'
    this.restartSerial += 1
    this.hud = { ...this.hud, time: 0, coins: 0 }
    if (this.phase === 'ROTATE_DEVICE') {
      this.held = 'PLAYING'
      this.emit()
      return
    }
    this.phase = 'PLAYING'
    this.emit()
  }

  exit(): void {
    this.levelId = null
    this.result = null
    this.panel = 'none'
    this.go('MENU')
  }

  fail(): void {
    if (this.phase === 'PLAYING') this.go('GAME_OVER')
  }

  revive(): void {
    if (this.phase === 'GAME_OVER') this.go('PLAYING')
    else if (this.phase === 'ROTATE_DEVICE' && this.held === 'GAME_OVER') this.held = 'PLAYING'
  }

  finish(result: RunResult): void {
    if (this.phase !== 'PLAYING') return
    this.result = result
    this.go('LEVEL_COMPLETE')
  }

  showLevels(): void {
    this.panel = 'none'
    this.go('LEVEL_SELECT')
  }

  showMenu(): void {
    this.panel = 'none'
    this.go('MENU')
  }

  openSettings(): void {
    this.panel = 'settings'
    this.emit()
  }

  closeSettings(): void {
    if (this.panel === 'none') return
    this.panel = 'none'
    this.emit()
  }

  onEscape(): void {
    if (this.panel === 'settings') {
      this.closeSettings()
      return
    }
    if (this.phase === 'PAUSED') this.resume()
    else if (this.phase === 'PLAYING') this.pause()
    else if (this.phase === 'LEVEL_SELECT') this.showMenu()
    else if (this.phase === 'LEVEL_COMPLETE') this.exit()
  }

  setHud(hud: Hud): void {
    const prev = this.hud
    const time = Math.round(hud.time * 100) / 100
    const prevTime = Math.round(prev.time * 100) / 100
    if (prevTime === time && prev.coins === hud.coins && prev.total === hud.total && prev.name === hud.name && prev.number === hud.number) {
      return
    }
    this.hud = { ...hud, time }
    this.emit()
  }

  toggleDebug(): void {
    this.debug = !this.debug
    this.emit()
  }

  private go(phase: Phase): void {
    if (this.phase === 'ROTATE_DEVICE') {
      this.held = phase
      this.emit()
      return
    }
    if (this.phase === phase) return
    this.phase = phase
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}

export function useSession(session: Session): Snapshot {
  const [snap, setSnap] = useState(() => session.snapshot())
  useEffect(() => session.subscribe(() => setSnap(session.snapshot())), [session])
  return snap
}
