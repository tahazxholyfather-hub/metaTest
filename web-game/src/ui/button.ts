import Phaser from 'phaser';
import { FONTS } from '@/src/config/asset-manifest';

export class TextButton extends Phaser.GameObjects.Container {
  private readonly labelText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ) {
    super(scene, x, y);
    const text = scene.add
      .text(0, 0, label, {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: '#f4f1de',
        backgroundColor: '#3d405b',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);
    text.setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setBackgroundColor('#e07a5f'));
    text.on('pointerout', () => text.setBackgroundColor('#3d405b'));
    text.on('pointerdown', () => onClick());
    this.labelText = text;
    this.add(text);
    scene.add.existing(this);
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
  }
}
