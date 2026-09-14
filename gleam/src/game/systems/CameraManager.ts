import Phaser from 'phaser'
import type { SettingsData } from '../../core/types'

export class CameraManager {
  private shakeMag = 0
  private shakeTime = 0
  private lookX = 0
  private lookY = 0

  constructor(
    private cam: Phaser.Cameras.Scene2D.Camera,
    private settings: SettingsData,
  ) {
    cam.setRoundPixels(true)
  }

  bounds(w: number, h: number): void {
    this.cam.setBounds(0, 0, w, h)
  }

  follow(target: Phaser.GameObjects.GameObject): void {
    this.cam.startFollow(target, true, 0.12, 0.14)
    this.cam.setDeadzone(40, 28)
  }

  shake(mag: number, durMs: number): void {
    if (!this.settings.shake) return
    this.shakeMag = Math.max(this.shakeMag, mag)
    this.shakeTime = Math.max(this.shakeTime, durMs / 1000)
  }

  update(dt: number, vx: number, vy: number): void {
    this.lookX += (Phaser.Math.Clamp(vx / 80, -90, 90) - this.lookX) * Math.min(1, dt * 3)
    this.lookY += (Phaser.Math.Clamp(vy / 140, -40, 50) - this.lookY) * Math.min(1, dt * 2.5)
    this.cam.setFollowOffset(-this.lookX, -this.lookY + 12)

    if (this.shakeTime > 0) {
      this.shakeTime -= dt
      const n = this.shakeMag * (this.shakeTime > 0 ? 1 : 0)
      this.cam.shake(16, n / 400)
    }
  }

  introZoom(): void {
    this.cam.zoom = 1.18
    this.cam.pan
    this.cam.scene.tweens.add({
      targets: this.cam,
      zoom: 1,
      duration: 700,
      ease: 'Cubic.easeOut',
    })
  }
}
