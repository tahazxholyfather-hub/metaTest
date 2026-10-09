import Phaser from 'phaser'
import { VIEW_H, VIEW_W } from '../config'
import { PlayScene, type GameDeps } from './PlayScene'

export function createGame(parent: HTMLElement, deps: GameDeps): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#8ecae6',
    banner: false,
    disableContextMenu: true,
    fps: { target: 60 },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: false,
    },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scene: PlayScene,
    callbacks: {
      preBoot: (game) => {
        game.registry.set('deps', deps)
      },
    },
  })
}
