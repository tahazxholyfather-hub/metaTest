export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export const moveToward = (current: number, target: number, maxDelta: number): number => {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

/** Critically damped spring, the same shape Unity uses for cameras. */
export function smoothDamp(
  current: number,
  target: number,
  vel: { v: number },
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
): number {
  const st = Math.max(0.0001, smoothTime)
  const omega = 2 / st
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  let change = current - target
  const maxChange = maxSpeed * st
  change = clamp(change, -maxChange, maxChange)
  const temp = (vel.v + omega * change) * dt
  vel.v = (vel.v - omega * temp) * exp
  let output = target + (change + temp) * exp
  if (target - current > 0 === output > target) {
    output = target
    vel.v = 0
  }
  return output
}

export function formatTime(ms: number): string {
  const s = Math.max(0, ms) / 1000
  if (s < 60) return `${s.toFixed(2)}s`
  const m = Math.floor(s / 60)
  const rem = s - m * 60
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`
}
