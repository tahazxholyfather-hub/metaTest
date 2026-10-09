import type { InputSystem } from '@/src/systems/input-system';

export class InputHandler {
  constructor(private readonly input: InputSystem) {}

  get axisX(): number {
    const left = this.input.isDown('left') ? 1 : 0;
    const right = this.input.isDown('right') ? 1 : 0;
    return right - left;
  }

  get jumpPressed(): boolean {
    return this.input.justPressed('jump');
  }

  get pausePressed(): boolean {
    return this.input.justPressed('pause');
  }
}
