export interface InputState {
  left: boolean
  right: boolean
  jump: boolean
  jumpPressed: boolean
  pausePressed: boolean
}

/**
 * Aggregates keyboard, optional gamepad, and on-screen touch buttons.
 * Touch buttons write into `touch` from the HUD overlay (multi-touch).
 */
export class InputManager {
  readonly touch = { left: false, right: false, jump: false }
  private keys = new Set<string>()
  private prevJump = false
  private prevPause = false
  private jumpPressed = false
  private pausePressed = false
  private pauseQueued = false
  private attached = false

  attach(): void {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', this.onDown)
    window.addEventListener('keyup', this.onUp)
    window.addEventListener('blur', this.clear)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onDown)
    window.removeEventListener('keyup', this.onUp)
    window.removeEventListener('blur', this.clear)
    this.attached = false
  }

  sample(): InputState {
    const pad = this.readPad()
    const left =
      this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left || pad.left
    const right =
      this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right || pad.right
    const jumpHeld =
      this.keys.has('Space') ||
      this.keys.has('ArrowUp') ||
      this.keys.has('KeyW') ||
      this.keys.has('KeyZ') ||
      this.touch.jump ||
      pad.jump
    const pauseHeld = this.keys.has('Escape') || this.keys.has('KeyP') || pad.pause

    this.jumpPressed = jumpHeld && !this.prevJump
    this.pausePressed = (pauseHeld && !this.prevPause) || this.pauseQueued
    this.pauseQueued = false
    this.prevJump = jumpHeld
    this.prevPause = pauseHeld

    return {
      left,
      right,
      jump: jumpHeld,
      jumpPressed: this.jumpPressed,
      pausePressed: this.pausePressed,
    }
  }

  consumeJump(): boolean {
    const v = this.jumpPressed
    this.jumpPressed = false
    return v
  }

  requestPause(): void {
    this.pauseQueued = true
  }

  private readPad(): { left: boolean; right: boolean; jump: boolean; pause: boolean } {
    const pads = navigator.getGamepads?.() ?? []
    for (const p of pads) {
      if (!p) continue
      const ax = p.axes[0] ?? 0
      return {
        left: ax < -0.4 || !!p.buttons[14]?.pressed,
        right: ax > 0.4 || !!p.buttons[15]?.pressed,
        jump: !!(p.buttons[0]?.pressed || p.buttons[1]?.pressed),
        pause: !!(p.buttons[9]?.pressed),
      }
    }
    return { left: false, right: false, jump: false, pause: false }
  }

  private onDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }
  }

  private onUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  private clear = (): void => {
    this.keys.clear()
    this.touch.left = false
    this.touch.right = false
    this.touch.jump = false
  }
}
