import type { GameAction, KeyState, PointerState } from '@/src/types/game-types';

const ACTIONS: Record<GameAction, readonly string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  pause: ['Escape', 'KeyP'],
};

const emptyKey = (): KeyState => ({ down: false, justPressed: false, justReleased: false });

export class InputSystem {
  private readonly keys = new Map<string, KeyState>();
  private readonly actions = new Map<GameAction, KeyState>();
  readonly pointer: PointerState = {
    x: 0,
    y: 0,
    down: false,
    justPressed: false,
    justReleased: false,
  };
  gamepadIndex = -1;
  private attached = false;
  private keyDown = (event: KeyboardEvent): void => {
    this.setKey(event.code, true);
  };
  private keyUp = (event: KeyboardEvent): void => {
    this.setKey(event.code, false);
  };

  constructor() {
    (Object.keys(ACTIONS) as GameAction[]).forEach((action) => {
      this.actions.set(action, emptyKey());
    });
  }

  attach(target: Window): void {
    if (this.attached) return;
    target.addEventListener('keydown', this.keyDown);
    target.addEventListener('keyup', this.keyUp);
    this.attached = true;
  }

  detach(target: Window): void {
    if (!this.attached) return;
    target.removeEventListener('keydown', this.keyDown);
    target.removeEventListener('keyup', this.keyUp);
    this.attached = false;
  }

  isDown(action: GameAction): boolean {
    return this.actions.get(action)?.down ?? false;
  }

  justPressed(action: GameAction): boolean {
    return this.actions.get(action)?.justPressed ?? false;
  }

  justReleased(action: GameAction): boolean {
    return this.actions.get(action)?.justReleased ?? false;
  }

  endFrame(): void {
    for (const state of this.actions.values()) {
      state.justPressed = false;
      state.justReleased = false;
    }
    for (const state of this.keys.values()) {
      state.justPressed = false;
      state.justReleased = false;
    }
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
  }

  readPointer(pointer: Phaser.Input.Pointer): void {
    const wasDown = this.pointer.down;
    this.pointer.x = pointer.worldX;
    this.pointer.y = pointer.worldY;
    this.pointer.down = pointer.isDown;
    this.pointer.justPressed = pointer.isDown && !wasDown;
    this.pointer.justReleased = !pointer.isDown && wasDown;
  }

  readGamepad(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((entry) => entry !== null) ?? null;
    if (!pad) {
      this.gamepadIndex = -1;
      return;
    }
    this.gamepadIndex = pad.index;
    const axis = pad.axes[0] ?? 0;
    this.setAction('left', axis < -0.4 || Boolean(pad.buttons[14]?.pressed));
    this.setAction('right', axis > 0.4 || Boolean(pad.buttons[15]?.pressed));
    const jump = Boolean(pad.buttons[0]?.pressed);
    if (jump) this.setAction('jump', true);
    if (pad.buttons[9]?.pressed) this.setAction('pause', true);
  }

  private setKey(code: string, down: boolean): void {
    const state = this.keys.get(code) ?? emptyKey();
    if (state.down === down) {
      this.keys.set(code, state);
      return;
    }
    state.justPressed = down;
    state.justReleased = !down;
    state.down = down;
    this.keys.set(code, state);
    (Object.keys(ACTIONS) as GameAction[]).forEach((action) => {
      if (ACTIONS[action].includes(code)) this.setAction(action, down);
    });
  }

  private setAction(action: GameAction, down: boolean): void {
    const state = this.actions.get(action) ?? emptyKey();
    if (state.down === down) return;
    state.justPressed = down && !state.down;
    state.justReleased = !down && state.down;
    state.down = down;
    this.actions.set(action, state);
  }
}
