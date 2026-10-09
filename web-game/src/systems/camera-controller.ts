import Phaser from 'phaser';

export class CameraController {
  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {
    this.camera.roundPixels = true;
  }

  follow(target: Phaser.GameObjects.GameObject): void {
    this.camera.startFollow(target, true, 0.12, 0.12);
    this.camera.setDeadzone(48, 24);
  }

  setBounds(width: number, height: number): void {
    this.camera.setBounds(0, 0, width, height);
  }

  shake(duration = 120, intensity = 0.004): void {
    this.camera.shake(duration, intensity);
  }

  update(): void {
    this.camera.setScroll(
      Math.round(this.camera.scrollX),
      Math.round(this.camera.scrollY),
    );
  }
}
