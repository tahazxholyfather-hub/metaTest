import Phaser from 'phaser';
import { MenuView } from '@/src/ui/menu';
import { getAudio } from '@/src/systems/audio-manager';
import { getSaveManager } from '@/src/systems/save-manager';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    const save = getSaveManager();
    const data = save.load();
    const audio = getAudio();
    audio.setMuted(data.muted);
    audio.setMusicVolume(data.musicVolume);
    audio.setSfxVolume(data.sfxVolume);

    const unlock = (): void => {
      audio.unlock();
      audio.playMusic('theme');
    };
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);

    new MenuView(
      this,
      {
        onStart: () => {
          unlock();
          this.scene.start('GameScene');
        },
        onFullscreen: () => {
          const canvas = this.game.canvas;
          if (document.fullscreenElement) void document.exitFullscreen();
          else void canvas.requestFullscreen();
        },
        onToggleMute: () => {
          const next = !audio.isMuted;
          audio.setMuted(next);
          const current = save.load();
          save.save({ ...current, muted: next });
          return next;
        },
      },
      data.muted,
    );

    this.add
      .text(this.scale.width / 2, this.scale.height - 16, 'Arrows / WASD, Space jump, Esc pause', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#81b29a',
      })
      .setOrigin(0.5);
  }
}
