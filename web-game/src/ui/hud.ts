import Phaser from 'phaser';
import { FONTS } from '@/src/config/asset-manifest';
import { MAX_LIVES } from '@/src/config/constants';

export class Hud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly fpsText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scoreText = scene.add
      .text(8, 6, 'SCORE 0', { fontFamily: FONTS.display, fontSize: '12px', color: '#f4f1de' })
      .setScrollFactor(0)
      .setDepth(30);
    this.coinText = scene.add
      .text(8, 22, 'COINS 0', { fontFamily: FONTS.display, fontSize: '12px', color: '#f2cc8f' })
      .setScrollFactor(0)
      .setDepth(30);
    for (let i = 0; i < MAX_LIVES; i += 1) {
      this.hearts.push(
        scene.add.image(scene.scale.width - 16 - i * 16, 14, 'heart').setScrollFactor(0).setDepth(30),
      );
    }
    this.fpsText = scene.add
      .text(scene.scale.width - 8, scene.scale.height - 8, '', {
        fontFamily: FONTS.display,
        fontSize: '10px',
        color: '#81b29a',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(30)
      .setVisible(import.meta.env.DEV);
  }

  setScore(score: number): void {
    this.scoreText.setText(`SCORE ${score}`);
  }

  setCoins(coins: number): void {
    this.coinText.setText(`COINS ${coins}`);
  }

  setLives(lives: number): void {
    this.hearts.forEach((heart, index) => {
      heart.setAlpha(index < lives ? 1 : 0.25);
    });
  }

  setFps(fps: number): void {
    if (import.meta.env.DEV) this.fpsText.setText(`${Math.round(fps)} FPS`);
  }
}
