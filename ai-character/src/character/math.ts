export const TAU = Math.PI * 2

export interface Vec2 {
  x: number
  y: number
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y })

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export const rand = (min: number, max: number): number => min + Math.random() * (max - min)

export const randSign = (): number => (Math.random() < 0.5 ? -1 : 1)

export const chance = (p: number): boolean => Math.random() < p

export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const easeInCubic = (t: number): number => t * t * t

export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t)
