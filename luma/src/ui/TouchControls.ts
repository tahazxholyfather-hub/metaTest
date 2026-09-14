import type { InputManager } from '../systems/InputManager'

/**
 * DOM overlay so multi-touch is reliable and independent of the Phaser camera.
 */
export class TouchControls {
  private root: HTMLDivElement
  private visible: boolean

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputManager,
  ) {
    this.visible = this.isTouch()
    this.root = document.createElement('div')
    this.root.id = 'luma-touch'
    this.root.innerHTML = `
      <button class="luma-pad" data-k="left" aria-label="Left">‹</button>
      <button class="luma-pad" data-k="right" aria-label="Right">›</button>
      <button class="luma-jump" data-k="jump" aria-label="Jump">Jump</button>
    `
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '30',
      display: this.visible ? 'block' : 'none',
    } as CSSStyleDeclaration)
    const style = document.createElement('style')
    style.textContent = `
      #luma-touch .luma-pad, #luma-touch .luma-jump {
        pointer-events: auto;
        position: absolute;
        bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        width: 78px; height: 78px;
        border-radius: 999px;
        border: 1px solid rgba(245,241,234,0.28);
        background: rgba(18,20,26,0.45);
        color: #F5F1EA;
        font: 600 22px Outfit, sans-serif;
        backdrop-filter: blur(8px);
        -webkit-user-select: none;
        user-select: none;
        touch-action: none;
      }
      #luma-touch .luma-pad:active, #luma-touch .luma-jump:active {
        background: rgba(245,241,234,0.22);
        transform: scale(0.96);
      }
      #luma-touch [data-k="left"] { left: calc(16px + env(safe-area-inset-left, 0px)); }
      #luma-touch [data-k="right"] { left: calc(102px + env(safe-area-inset-left, 0px)); }
      #luma-touch .luma-jump {
        right: calc(16px + env(safe-area-inset-right, 0px));
        width: 110px;
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(this.root)
    this.bind()
    this.layout()
  }

  layout(): void {
    const touch = this.isTouch() || this.scene.scale.width < 820
    this.root.style.display = touch ? 'block' : 'none'
  }

  destroy(): void {
    this.root.remove()
  }

  private isTouch(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  }

  private bind(): void {
    this.root.querySelectorAll('button').forEach((btn) => {
      const key = btn.getAttribute('data-k') as 'left' | 'right' | 'jump'
      const down = (e: Event) => {
        e.preventDefault()
        this.input.touch[key] = true
      }
      const up = (e: Event) => {
        e.preventDefault()
        this.input.touch[key] = false
      }
      btn.addEventListener('pointerdown', down)
      btn.addEventListener('pointerup', up)
      btn.addEventListener('pointerleave', up)
      btn.addEventListener('pointercancel', up)
    })
  }
}
