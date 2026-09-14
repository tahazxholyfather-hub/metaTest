import Phaser from 'phaser'
import type { SettingsState } from '../core/types'

export class CameraManager {
  private trauma = 0
  private lookX = 0
  private lookY = 0
  private hitstop = 0

  constructor(private readonly cam: Phaser.Cameras.Scene2D.Camera) {}

  follow(target: Phaser.GameObjects.GameObject, worldW: number, worldH: number): void {
    this.cam.startFollow(target, true, 0.12, 0.16)
    this.cam.setDeadzone(80, 50)
    this.cam.setBounds(0, 0, worldW, worldH)
    this.cam.setRoundPixels(true)
  }

  addTrauma(amount: number, enabled: boolean): void {
    if (!enabled) return
    this.trauma = Math.min(1, this.trauma + amount)
  }

  pulse(enabled: boolean): void {
    this.addTrauma(0.35, enabled)
  }

  setHitstop(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds)
  }

  consumingHitstop(dt: number): boolean {
    if (this.hitstop <= 0) return false
    this.hitstop -= dt
    return true
  }

  update(
    dt: number,
    vx: number,
    vy: number,
    settings: SettingsState,
  ): void {
    this.lookX = Phaser.Math.Linear(this.lookX, Phaser.Math.Clamp(vx * 0.18, -90, 90), 1 - Math.pow(0.001, dt))
    this.lookY = Phaser.Math.Linear(this.lookY, Phaser.Math.Clamp(vy * 0.08, -40, 60), 1 - Math.pow(0.001, dt))
    this.cam.setFollowOffset(-this.lookX, -this.lookY + 20)

    if (!settings.shake) {
      this.trauma = 0
      this.cam.setAngle(0)
      return
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.8)
    const t = this.trauma * this.trauma
    if (t > 0.002) {
      this.cam.setAngle((Math.random() - 0.5) * 2.2 * t)
      this.cam.scrollX += (Math.random() - 0.5) * 18 * t
      this.cam.scrollY += (Math.random() - 0.5) * 18 * t
    } else {
      this.cam.setAngle(0)
    }
  }
}
