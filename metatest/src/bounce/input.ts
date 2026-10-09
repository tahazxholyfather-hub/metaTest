import type { InputFrame } from './types'
import { DEFAULT_BINDINGS, type Bindings, type SaveManager } from './save'

export type Action = 'left' | 'right' | 'jump'

const GAME_KEYS = new Set<string>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyA',
  'KeyD',
])

function taken(bindings: Bindings, code: string): boolean {
  return bindings.left.includes(code) || bindings.right.includes(code) || bindings.jump.includes(code)
}

export function keyLabel(code: string): string {
  if (code === 'Space') return 'Space'
  if (code === 'ArrowLeft') return 'Left'
  if (code === 'ArrowRight') return 'Right'
  if (code === 'ArrowUp') return 'Up'
  if (code === 'ArrowDown') return 'Down'
  if (code.startsWith('Key')) return code.slice(3)
  return code
}

/**
 * One input path for keyboard and touch.
 * Edges are consumed by sample() or idle() so a press during a menu cannot leak into play.
 */
export class InputManager {
  private keys = new Set<string>()
  private pointers = new Map<number, Action>()
  private left = 0
  private right = 0
  private jump = 0
  private jumpWas = false
  private gameplay: () => boolean
  private onDebug: (() => void) | null = null
  private save: SaveManager
  bindings: Bindings

  constructor(save: SaveManager, gameplay: () => boolean) {
    this.save = save
    this.gameplay = gameplay
    this.bindings = {
      left: [...save.settings.bindings.left],
      right: [...save.settings.bindings.right],
      jump: [...save.settings.bindings.jump],
    }
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.keys.clear()
    this.pointers.clear()
    this.recount()
  }

  setDebugHandler(handler: () => void): void {
    this.onDebug = handler
  }

  setBinding(action: Action, code: string): void {
    if (!code || code === 'Escape' || code === 'F2' || code === 'Tab') return
    const next: Bindings = { left: [], right: [], jump: [] }
    for (const name of ['left', 'right', 'jump'] as const) {
      const kept = this.bindings[name].filter((key) => key !== code)
      next[name] = name === action ? [code, ...kept] : kept
    }
    for (const name of ['left', 'right', 'jump'] as const) {
      if (next[name].length > 0) continue
      const spare = DEFAULT_BINDINGS[name].find((key) => !taken(next, key))
      next[name] = [spare ?? (name === 'left' ? 'KeyA' : name === 'right' ? 'KeyD' : 'Space')]
    }
    this.bindings = next
    this.save.updateSettings({ bindings: next })
  }

  resetBindings(): void {
    this.bindings = {
      left: [...DEFAULT_BINDINGS.left],
      right: [...DEFAULT_BINDINGS.right],
      jump: [...DEFAULT_BINDINGS.jump],
    }
    this.save.updateSettings({ bindings: this.bindings })
  }

  pointerDown(action: Action, id: number): void {
    this.pointers.set(id, action)
    this.recount()
  }

  pointerUp(id: number): void {
    this.pointers.delete(id)
    this.recount()
  }

  held(action: Action): boolean {
    if (action === 'left') return this.left > 0 || this.match(this.bindings.left)
    if (action === 'right') return this.right > 0 || this.match(this.bindings.right)
    return this.jump > 0 || this.match(this.bindings.jump)
  }

  sample(): InputFrame {
    const left = this.held('left')
    const right = this.held('right')
    let x = 0
    if (left && !right) x = -1
    else if (right && !left) x = 1
    const jumpHeld = this.held('jump')
    const frame: InputFrame = {
      x,
      jumpHeld,
      jumpPressed: jumpHeld && !this.jumpWas,
      jumpReleased: !jumpHeld && this.jumpWas,
    }
    this.jumpWas = jumpHeld
    return frame
  }

  /** Drop edges while paused so holding jump across the pause screen does not bounce on resume. */
  idle(): void {
    this.jumpWas = this.held('jump')
  }

  private match(codes: string[]): boolean {
    for (const code of codes) if (this.keys.has(code)) return true
    return false
  }

  private recount(): void {
    this.left = 0
    this.right = 0
    this.jump = 0
    for (const action of this.pointers.values()) {
      if (action === 'left') this.left += 1
      else if (action === 'right') this.right += 1
      else this.jump += 1
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const tag = (event.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    this.keys.add(event.code)
    if (event.code === 'F2') {
      event.preventDefault()
      this.onDebug?.()
    }
    if (this.gameplay() && (GAME_KEYS.has(event.code) || this.isBound(event.code))) event.preventDefault()
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private onBlur = (): void => {
    this.keys.clear()
  }

  private isBound(code: string): boolean {
    return this.bindings.left.includes(code) || this.bindings.right.includes(code) || this.bindings.jump.includes(code)
  }
}
