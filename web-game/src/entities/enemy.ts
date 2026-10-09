import Phaser from 'phaser';
import { SpriteRenderer } from '@/src/components/sprite-renderer';

export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private direction = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly left: number,
    private readonly right: number,
    x: number,
    y: number,
  ) {
    this.sprite = SpriteRenderer.arcadeSprite(scene, x, y, 'enemy');
    this.sprite.setDepth(4);
    this.sprite.body?.setSize(14, 14);
  }

  update(): void {
    const body = this.sprite.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return;
    if (this.sprite.x < this.left) this.direction = 1;
    if (this.sprite.x > this.right) this.direction = -1;
    body.setVelocityX(this.direction * 50);
    this.sprite.setFlipX(this.direction < 0);
  }

  defeat(): void {
    this.sprite.disableBody(true, true);
  }
}
