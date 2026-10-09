import Phaser from 'phaser';
import { PhysicsBody } from '@/src/components/physics-body';
import { SpriteRenderer } from '@/src/components/sprite-renderer';
import { InputHandler } from '@/src/components/input-handler';
import type { InputSystem } from '@/src/systems/input-system';
import {
  COYOTE_MS,
  JUMP_BUFFER_MS,
  JUMP_VELOCITY,
  PLAYER_SPEED,
} from '@/src/config/constants';

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly body: PhysicsBody;
  private readonly input: InputHandler;
  private coyoteUntil = 0;
  private jumpBufferUntil = 0;
  invulnerableUntil = 0;
  godMode = false;

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputSystem) {
    this.sprite = SpriteRenderer.arcadeSprite(scene, x, y, 'player');
    this.sprite.setCollideWorldBounds(false);
    this.sprite.setDepth(5);
    this.sprite.body?.setSize(12, 14).setOffset(2, 2);
    this.body = new PhysicsBody(this.sprite);
    this.input = new InputHandler(input);
  }

  update(time: number): boolean {
    if (this.body.onFloor) this.coyoteUntil = time + COYOTE_MS;
    if (this.input.jumpPressed) this.jumpBufferUntil = time + JUMP_BUFFER_MS;
    const axis = this.input.axisX;
    this.body.setVelocityX(axis * PLAYER_SPEED);
    if (axis !== 0) this.sprite.setFlipX(axis < 0);
    const canJump = time <= this.coyoteUntil;
    const wantsJump = time <= this.jumpBufferUntil;
    if (canJump && wantsJump) {
      this.body.setVelocityY(JUMP_VELOCITY);
      this.coyoteUntil = 0;
      this.jumpBufferUntil = 0;
      return true;
    }
    return false;
  }

  bounce(velocityY: number): void {
    this.body.setVelocityY(velocityY);
  }

  get hurt(): boolean {
    return false;
  }

  get falling(): boolean {
    return this.body.velocityY > 40;
  }

  get feet(): number {
    return this.body.bottom;
  }
}
