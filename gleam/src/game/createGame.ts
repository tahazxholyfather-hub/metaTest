import Phaser from 'phaser'
import { PlayScene } from './scenes/PlayScene'
import type { PlayInit } from './scenes/PlayScene'

export function createPhaserGame(parent: HTMLElement, data: PlayInit): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: data.season.theme.skyTop,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    render: { antialias: true, roundPixels: true, pixelArt: false },
    audio: { noAudio: true },
    scene: [],
    fps: { target: 60, forceSetTimeOut: false },
    banner: false,
  })
  game.scene.add('play', PlayScene, true, data)
  return game
}
