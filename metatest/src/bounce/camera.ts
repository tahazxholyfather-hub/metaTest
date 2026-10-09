import { CAM, VIEW_H, VIEW_W } from './config'
import { clamp, damp, smoothDamp } from './math'
import type { Rect } from './types'

/** Smooth follow with a dead zone, velocity look-ahead, and hard level limits. */
export class CameraController {
  x = 0
  y = 0
  private lookX = 0
  private lookY = 0
  private readonly vx = { v: 0 }
  private readonly vy = { v: 0 }

  snap(px: number, py: number, bounds: Rect): void {
    this.lookX = 0
    this.lookY = 0
    this.vx.v = 0
    this.vy.v = 0
    this.x = px
    this.y = py
    this.clampTo(bounds)
  }

  update(dt: number, px: number, py: number, pvx: number, pvy: number, bounds: Rect): void {
    const aimX = clamp(pvx / 236, -1, 1) * CAM.lookX
    let aimY = 0
    if (pvy < -40) aimY = clamp(-pvy / 630, 0, 1) * -CAM.lookYUp
    else if (pvy > 80) aimY = clamp(pvy / 920, 0, 1) * CAM.lookYDown
    this.lookX = damp(this.lookX, aimX, CAM.lookLambda, dt)
    this.lookY = damp(this.lookY, aimY, CAM.lookLambda, dt)

    const focusX = px + this.lookX
    const focusY = py + this.lookY + CAM.biasY
    let desiredX = this.x
    let desiredY = this.y
    if (focusX < this.x - CAM.deadX) desiredX = focusX + CAM.deadX
    else if (focusX > this.x + CAM.deadX) desiredX = focusX - CAM.deadX
    if (focusY < this.y - CAM.deadY) desiredY = focusY + CAM.deadY
    else if (focusY > this.y + CAM.deadY) desiredY = focusY - CAM.deadY

    this.x = smoothDamp(this.x, desiredX, this.vx, CAM.smoothTimeX, dt, 1400)
    this.y = smoothDamp(this.y, desiredY, this.vy, CAM.smoothTimeY, dt, 1400)
    this.clampTo(bounds)
  }

  private clampTo(bounds: Rect): void {
    this.x = contain(this.x, VIEW_W, bounds.x, bounds.w)
    this.y = contain(this.y, VIEW_H, bounds.y, bounds.h)
  }
}

function contain(center: number, view: number, min: number, size: number): number {
  if (size <= view) return min + size / 2
  return clamp(center, min + view / 2, min + size - view / 2)
}
