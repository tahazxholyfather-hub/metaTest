import Phaser from 'phaser';
import { FONTS } from '@/src/config/asset-manifest';
import { TextButton } from '@/src/ui/button';

export interface MenuActions {
  onStart: () => void;
  onFullscreen: () => void;
  onToggleMute: () => boolean;
}

export class MenuView {
  constructor(scene: Phaser.Scene, actions: MenuActions, muted: boolean) {
    scene.add
      .text(scene.scale.width / 2, 70, 'WEBGAME', {
        fontFamily: FONTS.display,
        fontSize: '42px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5);
    scene.add
      .text(scene.scale.width / 2, 108, 'Reach the flag. Stomp the blobs.', {
        fontFamily: FONTS.display,
        fontSize: '12px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    new TextButton(scene, scene.scale.width / 2, 160, 'START', actions.onStart);
    new TextButton(scene, scene.scale.width / 2, 200, 'FULLSCREEN', actions.onFullscreen);
    const sound = new TextButton(scene, scene.scale.width / 2, 240, muted ? 'SOUND OFF' : 'SOUND ON', () => {
      const nextMuted = actions.onToggleMute();
      sound.setLabel(nextMuted ? 'SOUND OFF' : 'SOUND ON');
    });
  }
}
