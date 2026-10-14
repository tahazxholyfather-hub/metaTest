import { TAU } from './math'

/**
 * Springs are tuned in perceptual terms rather than raw stiffness:
 * `frequency` (Hz) controls how quickly the value settles, `damping` is the
 * damping ratio (1 = critically damped, < 1 overshoots, > 1 sluggish).
 */
export interface SpringConfig {
  frequency: number
  damping: number
}

export const spring = (frequency: number, damping: number): SpringConfig => ({ frequency, damping })

const MAX_STEP = 1 / 120

export class Spring {
  value: number
  velocity = 0
  target: number
  private k: number
  private c: number

  constructor(value: number, config: SpringConfig) {
    this.value = value
    this.target = value
    this.k = 0
    this.c = 0
    this.configure(config)
  }

  configure(config: SpringConfig): void {
    const omega = TAU * Math.max(0.01, config.frequency)
    this.k = omega * omega
    this.c = 2 * config.damping * omega
  }

  /** Jump straight to a value with no motion. */
  snap(value: number): void {
    this.value = value
    this.target = value
    this.velocity = 0
  }

  /** Add an instantaneous velocity kick (used for bounces and pops). */
  impulse(velocity: number): void {
    this.velocity += velocity
  }

  update(dt: number): number {
    let remaining = dt
    while (remaining > 0) {
      const h = remaining > MAX_STEP ? MAX_STEP : remaining
      remaining -= h
      const accel = -this.k * (this.value - this.target) - this.c * this.velocity
      this.velocity += accel * h
      this.value += this.velocity * h
    }
    return this.value
  }
}

export class SpringVec2 {
  readonly x: Spring
  readonly y: Spring

  constructor(x: number, y: number, config: SpringConfig) {
    this.x = new Spring(x, config)
    this.y = new Spring(y, config)
  }

  configure(config: SpringConfig): void {
    this.x.configure(config)
    this.y.configure(config)
  }

  setTarget(x: number, y: number): void {
    this.x.target = x
    this.y.target = y
  }

  snap(x: number, y: number): void {
    this.x.snap(x)
    this.y.snap(y)
  }

  update(dt: number): void {
    this.x.update(dt)
    this.y.update(dt)
  }

  get speed(): number {
    return Math.hypot(this.x.velocity, this.y.velocity)
  }
}
