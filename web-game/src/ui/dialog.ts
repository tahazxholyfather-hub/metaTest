import Phaser from 'phaser';
import { FONTS } from '@/src/config/asset-manifest';
import { TextButton } from '@/src/ui/button';

export class Dialog {
  private readonly root: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    title: string,
    onResume: () => void,
    onQuit: () => void,
  ) {
    const dim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.55);
    const label = scene.add
      .text(0, -40, title, { fontFamily: FONTS.display, fontSize: '20px', color: '#f4f1de' })
      .setOrigin(0.5);
    const resume = new TextButton(scene, 0, 0, 'RESUME', onResume);
    const quit = new TextButton(scene, 0, 36, 'QUIT', onQuit);
    this.root = scene.add.container(scene.scale.width / 2, scene.scale.height / 2, [
      dim,
      label,
      resume,
      quit,
    ]);
    this.root.setScrollFactor(0);
    this.root.setDepth(40);
    this.root.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }
}
