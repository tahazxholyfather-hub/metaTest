import { CharacterEngine } from '../../components/met/character'
import type { AICharacterState } from '../../components/met/character'
import { BALL_R, MET_BODY, MET_EYE, PHYS } from '../config'
import type { PlayerBody } from '../Simulation'

const VIEW = 200
const BODY = 96
/** Sprite size whose body circle matches the physics radius. */
export const MET_PX = (BALL_R * 2 * VIEW) / (BODY * 2)

const MATRIX = /matrix\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s*\)/

export class MetPainter {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly engine = new CharacterEngine()
  private expression: AICharacterState = 'idle'

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.width = VIEW
    canvas.height = VIEW
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.engine.settle(0.4)
    this.paint(0, { roll: 0, squash: 0, grounded: true, vy: 0 } as PlayerBody)
  }

  setExpression(next: AICharacterState): void {
    if (next === this.expression) return
    this.expression = next
    this.engine.setState(next)
  }

  setGaze(x: number, y: number): void {
    this.engine.setLookAt({ x, y })
  }

  paint(dt: number, player: PlayerBody): void {
    const frame = this.engine.update(dt)
    const squash = player.squash
    const stretch = player.grounded ? 0 : Math.min(PHYS.maxSquash * 0.55, Math.abs(player.vy) / 2800)
    const sx = 1 + squash * 0.75 - stretch * 0.45
    const sy = 1 - squash + stretch
    const ctx = this.ctx
    const c = VIEW / 2
    ctx.clearRect(0, 0, VIEW, VIEW)
    ctx.save()
    ctx.translate(c, c)
    ctx.scale(sx, sy)
    ctx.translate(-c, -c)

    const gradient = ctx.createRadialGradient(c - BODY * 0.32, c - BODY * 0.38, BODY * 0.08, c, c, BODY)
    gradient.addColorStop(0, '#efe8ff')
    gradient.addColorStop(0.55, MET_BODY)
    gradient.addColorStop(1, '#a894e8')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(c, c, BODY, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, BODY, 0, Math.PI * 2)
    ctx.clip()
    ctx.translate(c, c)
    ctx.rotate(player.roll)
    ctx.fillStyle = 'rgba(72, 52, 120, 0.22)'
    ctx.beginPath()
    ctx.ellipse(BODY * 0.42, 0, BODY * 0.5, BODY * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.beginPath()
    ctx.ellipse(-BODY * 0.38, -BODY * 0.08, BODY * 0.22, BODY * 0.46, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, BODY - 0.5, 0, Math.PI * 2)
    ctx.clip()
    this.eye(frame.left.transform, frame.left.lid, frame.left.pill)
    this.eye(frame.right.transform, frame.right.lid, frame.right.pill)
    ctx.restore()

    ctx.strokeStyle = 'rgba(40, 28, 70, 0.28)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(c, c, BODY - 1.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private eye(transform: string, lid: string, pill: string): void {
    const match = MATRIX.exec(transform)
    if (!match || !pill) return
    const ctx = this.ctx
    ctx.save()
    ctx.transform(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]))
    if (lid) {
      ctx.beginPath()
      ctx.clip(new Path2D(lid))
    }
    ctx.fillStyle = MET_EYE
    ctx.fill(new Path2D(pill))
    ctx.restore()
  }
}
