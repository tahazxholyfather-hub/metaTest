/** Small math toolkit: springs, deterministic noise, easing, colors. */

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Deterministic integer hash → [0, 1). */
export function hash1(i: number, seed = 0): number {
  let h = (i | 0) * 374761393 + (seed | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. Cheap, continuous, non-repeating feel. */
export function vnoise(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u) * 2 - 1;
}

/** Two-octave fractal version for organic drift. [-1, 1] approx. */
export function fnoise(x: number, seed = 0): number {
  return vnoise(x, seed) * 0.68 + vnoise(x * 2.7 + 13.7, seed + 91) * 0.32;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Critically-tunable damped spring. Semi-implicit Euler with a clamped dt keeps
 * it stable even after tab-switch time jumps.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  stiffness: number;
  damping: number;

  constructor(value: number, stiffness = 110, damping = 17) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  update(dt: number): number {
    const step = Math.min(dt, 1 / 30);
    const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += a * step;
    this.value += this.velocity * step;
    return this.value;
  }

  snap(v: number): void {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }
}

// ---------------------------------------------------------------------------
// Colors

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function rgbCss(c: RGB, alpha?: number): string {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}
