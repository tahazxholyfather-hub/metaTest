/**
 * Geometry for the "flat circle that reads as a sphere" trick.
 *
 * Eyes are treated as small decals glued to a unit sphere. We project them
 * orthographically onto the flat circle: their position follows the great
 * circle, they get foreshortened radially as they approach the rim, and their
 * vertical axis follows the local meridian. The body itself never moves.
 */

export interface SphereSample {
  /** Projected position relative to the circle centre (screen units, y down). */
  x: number
  y: number
  /** Depth toward the viewer, 1 at the centre, 0 at the rim. */
  z: number
  /** Rotation (radians, clockwise) of the local "up" direction on the surface. */
  meridianAngle: number
  /** Direction from the centre to the projected point (radians). */
  radialAngle: number
}

export function projectOnSphere(azimuth: number, elevation: number, radius: number): SphereSample {
  const cosEl = Math.cos(elevation)
  const sinEl = Math.sin(elevation)
  const sinAz = Math.sin(azimuth)
  const cosAz = Math.cos(azimuth)
  const x = radius * cosEl * sinAz
  const y = -radius * sinEl
  const z = Math.max(0, cosEl * cosAz)
  // Tangent of increasing elevation projected to screen: (-sinEl*sinAz, -cosEl).
  const meridianAngle = Math.atan2(-sinEl * sinAz, cosEl)
  const radialAngle = Math.atan2(y, x)
  return { x, y, z, meridianAngle, radialAngle }
}

/** Row-major 2D affine matrix [a b c d e f] as used by SVG `matrix(...)`. */
export type Mat2d = [number, number, number, number, number, number]

export const mIdentity = (): Mat2d => [1, 0, 0, 1, 0, 0]

export function mMultiply(m: Mat2d, n: Mat2d): Mat2d {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

export const mTranslate = (x: number, y: number): Mat2d => [1, 0, 0, 1, x, y]

export function mRotate(angle: number): Mat2d {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, s, -s, c, 0, 0]
}

export const mScale = (sx: number, sy: number): Mat2d => [sx, 0, 0, sy, 0, 0]

export function mCompose(...ms: Mat2d[]): Mat2d {
  let out = mIdentity()
  for (const m of ms) out = mMultiply(out, m)
  return out
}

const f = (n: number): string => (Math.abs(n) < 1e-6 ? '0' : n.toFixed(4))

export const mToString = (m: Mat2d): string =>
  `matrix(${f(m[0])} ${f(m[1])} ${f(m[2])} ${f(m[3])} ${f(m[4])} ${f(m[5])})`

/** A vertical pill (stadium) centred on the origin. Degrades to a circle or a horizontal pill. */
export function pillPath(width: number, height: number): string {
  const w = Math.max(0.01, width)
  const h = Math.max(0.01, height)
  const r = Math.min(w, h) / 2
  const x0 = -w / 2
  const x1 = w / 2
  const y0 = -h / 2
  const y1 = h / 2
  return (
    `M${f(x0 + r)} ${f(y0)}` +
    `H${f(x1 - r)}` +
    `A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}` +
    `V${f(y1 - r)}` +
    `A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}` +
    `H${f(x0 + r)}` +
    `A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}` +
    `V${f(y0 + r)}` +
    `A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}Z`
  )
}

export interface LidShape {
  topLid: number
  bottomLid: number
  topCurve: number
  bottomCurve: number
  topSlant: number
  bottomSlant: number
}

/**
 * The visible region of an eye between two lids, in the eye's local frame.
 * `side` is -1 for the left eye and +1 for the right eye so that "outer" and
 * "inner" mean the same thing on both sides.
 */
export function lidClipPath(width: number, height: number, side: number, lid: LidShape): string {
  const w = Math.max(0.01, width)
  const h = Math.max(0.01, height)
  const halfSpan = w * 0.8
  const xInner = -side * halfSpan
  const xOuter = side * halfSpan

  const slantAmp = h * 0.22
  const curveAmp = h * 0.9

  // Fully open lids sit slightly outside the eye so anti-aliased caps are never nicked.
  const margin = h * 0.08

  // Top edge (y grows downward).
  const yTop = -h / 2 - margin + lid.topLid * (h + margin)
  const yTopOuter = yTop + lid.topSlant * slantAmp
  const yTopInner = yTop - lid.topSlant * slantAmp
  const yTopCtrl = yTop + lid.topCurve * curveAmp

  // Bottom edge.
  const yBot = h / 2 + margin - lid.bottomLid * (h + margin)
  const yBotOuter = yBot + lid.bottomSlant * slantAmp
  const yBotInner = yBot - lid.bottomSlant * slantAmp
  const yBotCtrl = yBot - lid.bottomCurve * curveAmp

  const bo = Math.max(yBotOuter, yTopOuter)
  const bi = Math.max(yBotInner, yTopInner)

  return (
    `M${f(xInner)} ${f(yTopInner)}` +
    `Q0 ${f(yTopCtrl)} ${f(xOuter)} ${f(yTopOuter)}` +
    `V${f(bo)}` +
    `Q0 ${f(yBotCtrl)} ${f(xInner)} ${f(bi)}` +
    `Z`
  )
}
