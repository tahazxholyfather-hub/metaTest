import Phaser from 'phaser';
import { Hud } from '@/src/ui/hud';
import { MAX_LIVES } from '@/src/config/constants';

export class UIScene extends Phaser.Scene {
  private hud?: Hud;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.hud = new Hud(this);
    this.hud.setLives(MAX_LIVES);
    const game = this.scene.get('GameScene');
    game.events.on('score-changed', (score: number) => this.hud?.setScore(score));
    game.events.on('coins-changed', (coins: number) => this.hud?.setCoins(coins));
    game.events.on('lives-changed', (lives: number) => this.hud?.setLives(lives));
  }

  update(): void {
    this.hud?.setFps(this.game.loop.actualFps);
  }
}
