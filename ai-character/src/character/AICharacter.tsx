import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react'
import { CharacterEngine, DEFAULT_ENGINE_CONFIG } from './engine'
import { subscribe } from './ticker'
import type { Vec2 } from './math'
import type { AICharacterState } from './types'

export interface AICharacterHandle {
  /** Trigger a single blink. */
  blink: () => void
  /** Play the "poked" reaction (quick squash + double blink). */
  poke: () => void
}

export interface AICharacterProps {
  /** Emotional/behavioural state. Everything is expressed through the eyes. */
  state?: AICharacterState
  /** Follow the mouse / finger and react to taps. */
  interactive?: boolean
  /** CSS size of the character. Numbers are pixels. Defaults to filling the container width. */
  size?: number | string
  /** Body colour. */
  color?: string
  /** Eye colour. */
  eyeColor?: string
  /** Programmatic gaze direction, each axis -1..1 (y down). Overrides the pointer while set. */
  lookAt?: Vec2 | null
  /** How strongly the state is expressed, 0..1. */
  intensity?: number
  /** Optional 0..1 loudness used to drive the `speaking` state from real audio. */
  audioLevel?: number | null
  /** Force reduced motion on/off. Defaults to the OS preference. */
  reducedMotion?: boolean
  className?: string
  style?: CSSProperties
  /** Accessible label. Defaults to a description of the current state. */
  label?: string
  onBlink?: () => void
  ref?: Ref<AICharacterHandle>
}

const VIEW = DEFAULT_ENGINE_CONFIG.center * 2
const SVG_STYLE: CSSProperties = {
  display: 'block',
  height: 'auto',
  aspectRatio: '1 / 1',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}

export function AICharacter({
  state = 'idle',
  interactive = false,
  size = '100%',
  color = '#F5F1EA',
  eyeColor = '#0E0E10',
  lookAt = null,
  intensity = 1,
  audioLevel = null,
  reducedMotion,
  className,
  style,
  label,
  onBlink,
  ref,
}: AICharacterProps) {
  const id = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const leftG = useRef<SVGGElement>(null)
  const rightG = useRef<SVGGElement>(null)
  const leftPill = useRef<SVGPathElement>(null)
  const rightPill = useRef<SVGPathElement>(null)
  const leftLid = useRef<SVGPathElement>(null)
  const rightLid = useRef<SVGPathElement>(null)

  const onBlinkRef = useRef(onBlink)
  onBlinkRef.current = onBlink

  const engineRef = useRef<CharacterEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new CharacterEngine({}, { onBlink: () => onBlinkRef.current?.() })
  }
  const engine = engineRef.current

  useImperativeHandle(ref, () => ({ blink: () => engine.blink(), poke: () => engine.poke() }), [engine])

  useEffect(() => engine.setState(state), [engine, state])
  useEffect(() => engine.setIntensity(intensity), [engine, intensity])
  useEffect(() => engine.setAudioLevel(audioLevel), [engine, audioLevel])
  useEffect(() => engine.setLookAt(lookAt), [engine, lookAt])

  // Reduced motion: honour the OS setting unless explicitly overridden.
  useEffect(() => {
    if (reducedMotion !== undefined) {
      engine.setMotionScale(reducedMotion ? 0.3 : 1)
      return
    }
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => engine.setMotionScale(mq.matches ? 0.3 : 1)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [engine, reducedMotion])

  // Pointer tracking (mouse + touch) relative to the body centre.
  const pointerClient = useRef<Vec2 | null>(null)
  const pointerDirty = useRef(false)
  useEffect(() => {
    if (!interactive) {
      pointerClient.current = null
      engine.setPointer(null)
      return
    }
    const move = (e: PointerEvent) => {
      pointerClient.current = { x: e.clientX, y: e.clientY }
      pointerDirty.current = true
    }
    const leave = () => {
      pointerClient.current = null
      pointerDirty.current = true
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', move, { passive: true })
    document.documentElement.addEventListener('mouseleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      document.documentElement.removeEventListener('mouseleave', leave)
    }
  }, [engine, interactive])

  // Frame loop: pauses while off-screen, shares one rAF with other instances.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const tick = (dt: number) => {
      if (pointerDirty.current) {
        pointerDirty.current = false
        const p = pointerClient.current
        if (p) {
          const rect = svg.getBoundingClientRect()
          const r = (rect.width / VIEW) * DEFAULT_ENGINE_CONFIG.radius
          if (r > 0) {
            engine.setPointer({
              x: (p.x - (rect.left + rect.width / 2)) / r,
              y: (p.y - (rect.top + rect.height / 2)) / r,
            })
          }
        } else {
          engine.setPointer(null)
        }
      }

      const frame = engine.update(dt)
      leftG.current?.setAttribute('transform', frame.left.transform)
      rightG.current?.setAttribute('transform', frame.right.transform)
      leftPill.current?.setAttribute('d', frame.left.pill)
      rightPill.current?.setAttribute('d', frame.right.pill)
      leftLid.current?.setAttribute('d', frame.left.lid)
      rightLid.current?.setAttribute('d', frame.right.lid)
    }

    let unsubscribe: (() => void) | null = null
    const start = () => {
      if (!unsubscribe) unsubscribe = subscribe(tick)
    }
    const stop = () => {
      unsubscribe?.()
      unsubscribe = null
    }

    let observer: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
        rootMargin: '10%',
      })
      observer.observe(svg)
    } else {
      start()
    }

    tick(0)
    return () => {
      observer?.disconnect()
      stop()
    }
  }, [engine])

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    if (Math.hypot(dx, dy) <= rect.width / 2) engine.poke()
  }

  const c = DEFAULT_ENGINE_CONFIG.center
  const r = DEFAULT_ENGINE_CONFIG.radius
  const width = typeof size === 'number' ? `${size}px` : size

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...SVG_STYLE, width, ...style }}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={label ?? `AI character, ${state}`}
      onPointerDown={handlePointerDown}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <circle cx={c} cy={c} r={r} />
        </clipPath>
        <clipPath id={`${id}-lid-l`} clipPathUnits="userSpaceOnUse">
          <path ref={leftLid} />
        </clipPath>
        <clipPath id={`${id}-lid-r`} clipPathUnits="userSpaceOnUse">
          <path ref={rightLid} />
        </clipPath>
      </defs>
      <circle cx={c} cy={c} r={r} fill={color} />
      <g clipPath={`url(#${id}-body)`}>
        <g ref={leftG}>
          <g clipPath={`url(#${id}-lid-l)`}>
            <path ref={leftPill} fill={eyeColor} />
          </g>
        </g>
        <g ref={rightG}>
          <g clipPath={`url(#${id}-lid-r)`}>
            <path ref={rightPill} fill={eyeColor} />
          </g>
        </g>
      </g>
    </svg>
  )
}
