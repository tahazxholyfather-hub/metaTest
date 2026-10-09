import Phaser from 'phaser';
import type { ImageKey } from '@/src/config/asset-manifest';

export class SpriteRenderer {
  static image(
    scene: Phaser.Scene,
    x: number,
    y: number,
    key: ImageKey,
  ): Phaser.GameObjects.Image {
    return scene.add.image(x, y, key);
  }

  static arcadeSprite(
    scene: Phaser.Scene,
    x: number,
    y: number,
    key: ImageKey,
  ): Phaser.Physics.Arcade.Sprite {
    return scene.physics.add.sprite(x, y, key);
  }
}
