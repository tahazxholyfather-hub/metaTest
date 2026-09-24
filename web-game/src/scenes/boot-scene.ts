import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const bar = this.add.graphics();
    bar.fillStyle(0xf2cc8f, 1);
    bar.fillRect(0, 0, 32, 6);
    bar.generateTexture('loading-bar', 32, 6);
    bar.destroy();
    this.scene.start('PreloadScene');
  }
}
