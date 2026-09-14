/**
 * Canvas renderer for the existing eyes-only CharacterEngine.
 *
 * The engine, poses, blinks, and sphere-projected eyes are unchanged.
 * This adapter draws the same cream sphere + lid-clipped pills onto an
 * offscreen canvas so Phaser (or any other host) can blit the result.
 */
import { CharacterEngine, DEFAULT_ENGINE_CONFIG } from './engine'
import type { AICharacterState } from './types'
import type { Vec2 } from './math'

export const BODY_COLOR = '#F5F1EA'
export const EYE_COLOR = '#0E0E10'
export const VIEW_SIZE = DEFAULT_ENGINE_CONFIG.center * 2

export interface LumaCanvasOptions {
  size?: number
  bodyColor?: string
  eyeColor?: string
}

export class LumaCanvas {
  readonly canvas: HTMLCanvasElement
  readonly engine: CharacterEngine
  readonly view: number
  private readonly ctx: CanvasRenderingContext2D
  private readonly pixelSize: number
  private bodyColor: string
  private eyeColor: string
  private squashX = 1
  private squashY = 1

  constructor(options: LumaCanvasOptions = {}) {
    this.engine = new CharacterEngine()
    this.view = VIEW_SIZE
    this.pixelSize = options.size ?? 192
    this.bodyColor = options.bodyColor ?? BODY_COLOR
    this.eyeColor = options.eyeColor ?? EYE_COLOR
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.pixelSize
    this.canvas.height = this.pixelSize
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    this.ctx = ctx
    this.engine.settle(1.2)
    this.paint()
  }

  setState(state: AICharacterState): void {
    this.engine.setState(state)
  }

  setLookAt(p: Vec2 | null): void {
    this.engine.setLookAt(p)
  }

  setIntensity(v: number): void {
    this.engine.setIntensity(v)
  }

  poke(): void {
    this.engine.poke()
  }

  blink(): void {
    this.engine.blink()
  }

  setSquash(x: number, y: number): void {
    this.squashX = x
    this.squashY = y
  }

  update(dt: number): HTMLCanvasElement {
    this.engine.update(dt)
    this.paint()
    return this.canvas
  }

  private paint(): void {
    const { ctx, pixelSize, view } = this
    const scale = pixelSize / view
    const c = DEFAULT_ENGINE_CONFIG.center
    const r = DEFAULT_ENGINE_CONFIG.radius
    const frame = this.engine.frame

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, pixelSize, pixelSize)
    ctx.scale(scale, scale)

    ctx.save()
    ctx.translate(c, c)
    ctx.scale(this.squashX, this.squashY)
    ctx.translate(-c, -c)

    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.fillStyle = this.bodyColor
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.clip()

    this.paintEye(frame.left)
    this.paintEye(frame.right)
    ctx.restore()
    ctx.restore()
  }

  private paintEye(eye: { matrix: number[]; pill: string; lid: string }): void {
    const { ctx } = this
    const [a, b, c, d, e, f] = eye.matrix
    ctx.save()
    ctx.transform(a, b, c, d, e, f)
    const lid = new Path2D(eye.lid)
    ctx.clip(lid)
    const pill = new Path2D(eye.pill)
    ctx.fillStyle = this.eyeColor
    ctx.fill(pill)
    ctx.restore()
  }
}
