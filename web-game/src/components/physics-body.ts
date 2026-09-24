import Phaser from 'phaser';

export class PhysicsBody {
  constructor(private readonly sprite: Phaser.Physics.Arcade.Sprite) {}

  private arcade(): Phaser.Physics.Arcade.Body {
    const body = this.sprite.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error('Sprite is missing an arcade body');
    }
    return body;
  }

  setVelocity(x: number, y: number): void {
    this.arcade().setVelocity(x, y);
  }

  setVelocityX(x: number): void {
    this.arcade().setVelocityX(x);
  }

  setVelocityY(y: number): void {
    this.arcade().setVelocityY(y);
  }

  get velocityY(): number {
    return this.arcade().velocity.y;
  }

  get onFloor(): boolean {
    return this.arcade().blocked.down || this.arcade().touching.down;
  }

  get bottom(): number {
    return this.arcade().bottom;
  }
}
