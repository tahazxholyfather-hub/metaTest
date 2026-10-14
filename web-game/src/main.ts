import Phaser from 'phaser';
import { createGameConfig } from '@/src/config/game-config';

const game = new Phaser.Game(createGameConfig());

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    game.scale.refresh();
  }, 120);
});
