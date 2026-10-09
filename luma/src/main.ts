import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_TITLE, GAME_WIDTH } from './core/types'
import { BootScene, LoadScene, LogoScene } from './scenes/BootScenes'
import { LevelSelectScene } from './scenes/LevelSelectScene'
import { MenuScene, SettingsScene } from './scenes/MenuScene'
import { PlayScene } from './scenes/PlayScene'
import { SeasonSelectScene } from './scenes/SeasonSelectScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  title: GAME_TITLE,
  backgroundColor: '#07080c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: { width: 320, height: 180 },
    max: { width: 2560, height: 1440 },
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1750 },
      debug: false,
    },
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, LogoScene, LoadScene, MenuScene, SettingsScene, SeasonSelectScene, LevelSelectScene, PlayScene],
  banner: false,
}

function boot(): void {
  const game = new Phaser.Game(config)
  const onVis = () => {
    if (document.hidden) game.sound.mute = true
  }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('orientationchange', () => game.scale.refresh())
}

boot()
