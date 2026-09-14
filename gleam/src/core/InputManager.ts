export interface InputState {
  left: boolean
  right: boolean
  jump: boolean
  jumpPressed: boolean
  pausePressed: boolean
  axis: number
}

/**
 * Keyboard + optional gamepad + virtual touch buttons.
 * Multi-touch is supported: left/right and jump can be held together.
 */
export class InputManager {
  left = false
  right = false
  jump = false
  private jumpWas = false
  private pauseWas = false
  pausePressed = false
  jumpPressed = false
  private keys = new Set<string>()
  private padJumpWas = false
  private padPauseWas = false
  private unbind: Array<() => void> = []

  attach(target: Window | HTMLElement = window): void {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code)
      if (['ArrowUp', 'Space', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => this.keys.delete(e.code)
    const blur = () => this.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    this.unbind.push(() => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    })
  }

  setTouch(action: 'left' | 'right' | 'jump', pressed: boolean): void {
    this[action] = pressed
  }

  update(): InputState {
    const kbLeft = this.keys.has('ArrowLeft') || this.keys.has('KeyA')
    const kbRight = this.keys.has('ArrowRight') || this.keys.has('KeyD')
    const kbJump =
      this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('KeyK')
    const kbPause = this.keys.has('Escape') || this.keys.has('KeyP')

    let padLeft = false
    let padRight = false
    let padJump = false
    let padPause = false
    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
      const ax = pad.axes[0] ?? 0
      if (ax < -0.35 || pad.buttons[14]?.pressed) padLeft = true
      if (ax > 0.35 || pad.buttons[15]?.pressed) padRight = true
      if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) padJump = true
      if (pad.buttons[9]?.pressed || pad.buttons[8]?.pressed) padPause = true
    }

    const left = this.left || kbLeft || padLeft
    const right = this.right || kbRight || padRight
    const jump = this.jump || kbJump || padJump
    this.jumpPressed = jump && !this.jumpWas
    this.jumpWas = jump
    const pauseHeld = kbPause || padPause
    this.pausePressed = pauseHeld && !this.pauseWas
    this.pauseWas = pauseHeld

    const axis = left && !right ? -1 : right && !left ? 1 : 0
    return { left, right, jump, jumpPressed: this.jumpPressed, pausePressed: this.pausePressed, axis }
  }

  dispose(): void {
    for (const fn of this.unbind) fn()
    this.unbind = []
  }
}
