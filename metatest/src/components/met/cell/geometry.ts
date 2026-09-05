import { clamp01, fnoise, hash1 } from './math';

export interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic bezier smooth closed path. */
export function smoothClosedPath(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d + ' Z';
}

export const MEMBRANE_POINTS = 14;
export const CELL_CX = 200;
export const CELL_CY = 196;
export const CELL_R = 148;

/**
 * Fixed per-vertex irregularity so the silhouette matches the reference:
 * organic and lumpy but still roughly round. Seeded, stable across frames.
 */
const STATIC_OFFSETS: number[] = Array.from({ length: MEMBRANE_POINTS }, (_, i) => {
  return (hash1(i * 17 + 3, 1289) - 0.5) * 0.09 + (hash1(i * 5 + 11, 771) - 0.5) * 0.045;
});

const scratch: Pt[] = Array.from({ length: MEMBRANE_POINTS }, () => ({ x: 0, y: 0 }));

export interface MembraneDent {
  /** Angle from the cell center, radians. */
  angle: number;
  /** Radius delta in px (negative = poke inward). */
  amount: number;
  /** Angular gaussian width, radians. */
  width: number;
}

const noDents: MembraneDent[] = [];

/**
 * Build the living membrane outline. `wobbleAmp` is in px, `time` in seconds,
 * `squashX/squashY` allow directional breathing. `dents` are local touch
 * deformations (e.g. where the user pokes Met).
 */
export function membranePath(
  time: number,
  wobbleAmp: number,
  wobbleSpeed: number,
  squashX: number,
  squashY: number,
  scale = 1,
  dents: MembraneDent[] = noDents,
): string {
  const n = MEMBRANE_POINTS;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const wob = fnoise(time * wobbleSpeed * 0.42 + i * 7.31, 37) * wobbleAmp;
    const slow = fnoise(time * 0.11 + i * 3.77, 91) * wobbleAmp * 0.55;
    let r = CELL_R * (1 + STATIC_OFFSETS[i]) * scale + wob + slow;
    for (let d = 0; d < dents.length; d++) {
      const dent = dents[d];
      let da = a - dent.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      r += dent.amount * Math.exp(-(da * da) / (2 * dent.width * dent.width));
    }
    scratch[i].x = CELL_CX + Math.cos(a) * r * squashX;
    scratch[i].y = CELL_CY + Math.sin(a) * r * squashY;
  }
  return smoothClosedPath(scratch);
}

export interface MouthShape {
  cx: number;
  cy: number;
  w: number;
  open: number; // 0..~1.15
  curve: number; // -1..1
  round: number; // 0..1
}

export interface MouthGeom {
  d: string;
  cx: number;
  /** Vertical mouth center after jaw drop. */
  cy: number;
  w: number;
  openH: number;
  open: number;
  round: number;
}

/**
 * One morphable mouth covering smile, frown, open talk shapes and the
 * surprised "o". The whole mouth drops slightly with openness (jaw), which
 * makes speech read as articulation instead of a scaling hole.
 */
export function mouthGeom(m: MouthShape): MouthGeom {
  const round = clamp01(m.round);
  const open = Math.max(0, m.open);
  const curve = m.curve * (1 - 0.7 * round);
  const w = Math.max(6, m.w * (1 - 0.3 * round));
  const hw = w / 2;
  const cy = m.cy + open * 4.5; // jaw drop
  const cornerY = cy - curve * 5.5 * (1 - 0.5 * round) - open * 1.5;
  const topCtrlY = cy + curve * 7.5 - open * 3.5 - round * open * 5;
  const openH = open * (15 + 6 * round) + round * (3 + open * 4);
  const botCtrlY = topCtrlY + openH * 2; // quadratic ctrl overshoots to reach depth
  const lx = m.cx - hw;
  const rx = m.cx + hw;
  const d =
    `M ${lx.toFixed(2)} ${cornerY.toFixed(2)}` +
    ` Q ${m.cx.toFixed(2)} ${topCtrlY.toFixed(2)} ${rx.toFixed(2)} ${cornerY.toFixed(2)}` +
    ` Q ${m.cx.toFixed(2)} ${botCtrlY.toFixed(2)} ${lx.toFixed(2)} ${cornerY.toFixed(2)} Z`;
  return { d, cx: m.cx, cy, w, openH, open, round };
}

export function mouthPath(m: MouthShape): string {
  return mouthGeom(m).d;
}

// Face layout (matched to the reference proportions on a 400×400 viewBox).
export const EYE_L = { x: 167, y: 149 };
export const EYE_R = { x: 233, y: 149 };
export const EYE_RX = 21.5;
export const EYE_RY = 27;
export const PUPIL_R = 12;
export const PUPIL_TRAVEL_X = 6.5;
export const PUPIL_TRAVEL_Y = 6;
export const BROW_L = { x: 165, y: 113 };
export const BROW_R = { x: 235, y: 113 };
export const MOUTH = { x: 200, y: 205 };
export const NUCLEUS = { x: 217, y: 259, r: 38 };
export const MITO = { x: 118, y: 262 };
export const VESICLE = { x: 289, y: 238 };
export const BLUSH_L = { x: 148, y: 187 };
export const BLUSH_R = { x: 252, y: 187 };
