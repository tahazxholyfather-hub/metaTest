import { lerp } from './math'

const hash = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** Smooth 1D value noise in [-1, 1]. Different seeds give uncorrelated streams. */
export function noise1(t: number, seed = 0): number {
  const offset = seed * 57.31
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i + offset), hash(i + 1 + offset), u) * 2 - 1
}

/** Two-octave fractal noise: a slow drift with a finer wobble layered on top. */
export function fbm(t: number, seed = 0): number {
  return noise1(t, seed) * 0.68 + noise1(t * 2.7 + 13.7, seed + 1) * 0.32
}
