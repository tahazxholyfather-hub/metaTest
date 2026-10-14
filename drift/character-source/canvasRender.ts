/**
 * Canvas adapter for the existing eyes-only character engine.
 * Preserves the original geometry: a flat filled circle with two
 * sphere-projected eyes. No extra facial features are added.
 */
import { DEFAULT_ENGINE_CONFIG, type CharacterEngine } from './engine'
import type { EyeRender } from './types'
import type { Mat2d } from './geometry'

/** Default body colour from the original AICharacter. */
export const BODY_COLOR = '#F5F1EA'
/** Default eye colour from the original AICharacter. */
export const EYE_COLOR = '#0E0E10'

export interface CharacterDrawOptions {
  color?: string
  eyeColor?: string
  /** Destination size in pixels. The engine viewBox is 200×200. */
  destSize?: number
}

const MATRIX_RE = /matrix\(([^)]+)\)/

export function parseMatrix(transform: string): Mat2d {
  const m = transform.match(MATRIX_RE)
  if (!m) return [1, 0, 0, 1, 0, 0]
  const p = m[1].trim().split(/[\s,]+/).map(Number)
  if (p.length < 6 || p.some((n) => Number.isNaN(n))) return [1, 0, 0, 1, 0, 0]
  return [p[0], p[1], p[2], p[3], p[4], p[5]]
}

function drawEye(ctx: CanvasRenderingContext2D, eye: EyeRender, eyeColor: string): void {
  if (!eye.pill || !eye.transform) return
  const [a, b, c, d, e, f] = parseMatrix(eye.transform)
  ctx.save()
  ctx.transform(a, b, c, d, e, f)
  try {
    const lid = new Path2D(eye.lid)
    ctx.clip(lid)
    const pill = new Path2D(eye.pill)
    ctx.fillStyle = eyeColor
    ctx.fill(pill)
  } catch {
    /* malformed path — skip the eye this frame */
  }
  ctx.restore()
}

/**
 * Draw the current engine frame into a 2D context.
 * Call `engine.update(dt)` first. The engine viewBox is 200×200.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  engine: CharacterEngine,
  opts: CharacterDrawOptions = {},
): void {
  const view = DEFAULT_ENGINE_CONFIG.center * 2
  const dest = opts.destSize ?? view
  const color = opts.color ?? BODY_COLOR
  const eyeColor = opts.eyeColor ?? EYE_COLOR
  const { radius, center } = engine.config
  const frame = engine.frame

  ctx.save()
  ctx.clearRect(0, 0, dest, dest)
  if (dest !== view) ctx.scale(dest / view, dest / view)

  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.clip()
  drawEye(ctx, frame.left, eyeColor)
  drawEye(ctx, frame.right, eyeColor)
  ctx.restore()

  ctx.restore()
}
