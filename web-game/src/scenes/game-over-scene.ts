import Phaser from 'phaser';
import { FONTS } from '@/src/config/asset-manifest';
import { getSaveManager } from '@/src/systems/save-manager';
import { TextButton } from '@/src/ui/button';

interface OverData {
  score: number;
  coins: number;
  victory: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private score = 0;
  private victory = false;

  constructor() {
    super('GameOverScene');
  }

  init(data: OverData): void {
    this.score = data.score;
    this.victory = data.victory;
  }

  create(): void {
    const saves = getSaveManager();
    const stored = saves.load();
    const best = Math.max(stored.highScore, this.score);
    if (best !== stored.highScore) {
      const next = { ...stored, highScore: best };
      saves.save(next);
      void saves.syncCloud(next);
    }

    this.add
      .text(this.scale.width / 2, 70, this.victory ? 'YOU WIN' : 'GAME OVER', {
        fontFamily: FONTS.display,
        fontSize: '32px',
        color: this.victory ? '#81b29a' : '#e07a5f',
      })
      .setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, 120, `SCORE ${this.score}\nBEST ${best}`, {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: '#f4f1de',
        align: 'center',
      })
      .setOrigin(0.5);

    new TextButton(this, this.scale.width / 2, 180, 'AGAIN', () => this.scene.start('GameScene'));
    new TextButton(this, this.scale.width / 2, 220, 'MENU', () => this.scene.start('MenuScene'));
  }
}
