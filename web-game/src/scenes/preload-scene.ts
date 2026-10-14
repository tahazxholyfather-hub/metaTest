import Phaser from 'phaser';
import { DATA, IMAGES } from '@/src/config/asset-manifest';
import { getAudio } from '@/src/systems/audio-manager';

export class PreloadScene extends Phaser.Scene {
  private retries = 0;
  private failed = false;
  private startedAt = 0;
  private status?: Phaser.GameObjects.Text;

  constructor() {
    super('PreloadScene');
  }

  init(data: { retries?: number }): void {
    this.retries = data.retries ?? 0;
    this.failed = false;
  }

  preload(): void {
    this.startedAt = this.time.now;
    const width = this.scale.width;
    const bar = this.add.image(width / 2, this.scale.height / 2, 'loading-bar').setOrigin(0, 0.5);
    bar.setX(width / 2 - 80);
    this.status = this.add
      .text(width / 2, this.scale.height / 2 + 24, 'Loading', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f4f1de',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.setScale(Math.max(0.05, value) * 8, 2);
      this.status?.setText(`Loading ${Math.round(value * 100)}%`);
    });
    this.load.on('loaderror', () => {
      this.failed = true;
    });

    Object.entries(IMAGES).forEach(([key, url]) => {
      this.load.image(key, url);
    });
    this.load.json('level', DATA.level);
  }

  create(): void {
    const wait = Math.max(0, 400 - (this.time.now - this.startedAt));
    this.time.delayedCall(wait, () => {
      void this.finish();
    });
  }

  private async finish(): Promise<void> {
    if (this.failed && this.retries < 3) {
      this.scene.restart({ retries: this.retries + 1 });
      return;
    }
    if (this.failed) {
      this.status?.setText('Some files failed to load. Refresh to retry.');
      return;
    }
    try {
      this.status?.setText('Loading audio');
      await getAudio().loadAll();
    } catch {
      this.status?.setText('Audio failed. Refresh to retry.');
      return;
    }
    this.scene.start('MenuScene');
  }
}
