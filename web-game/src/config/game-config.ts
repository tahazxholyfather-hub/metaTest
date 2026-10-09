import Phaser from 'phaser';
import { BootScene } from '@/src/scenes/boot-scene';
import { PreloadScene } from '@/src/scenes/preload-scene';
import { MenuScene } from '@/src/scenes/menu-scene';
import { GameScene } from '@/src/scenes/game-scene';
import { GameOverScene } from '@/src/scenes/game-over-scene';
import { UIScene } from '@/src/scenes/ui-scene';
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY, TARGET_FPS } from '@/src/config/constants';

export const createGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#14182b',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  fps: { target: TARGET_FPS },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: { gamepad: true },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, GameOverScene, UIScene],
});
