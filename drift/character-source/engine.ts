import { NEUTRAL_POSE, STATES } from './states'
import { Spring, spring, SpringVec2, type SpringConfig } from './spring'
import { fbm, noise1 } from './noise'
import {
  lidClipPath,
  mCompose,
  mRotate,
  mScale,
  mToString,
  mTranslate,
  pillPath,
  projectOnSphere,
} from './geometry'
import {
  TAU,
  chance,
  clamp,
  damp,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  rand,
  vec,
  type Vec2,
} from './math'
import type {
  AICharacterState,
  Behavior,
  BlinkBehavior,
  EyePose,
  EyeRender,
  Gesture,
  GestureContext,
  GestureKey,
  GestureSpec,
  PartialPose,
  RenderFrame,
  StateDefinition,
} from './types'

export interface EngineConfig {
  /** Radius of the body circle in viewBox units. */
  radius: number
  /** Centre of the body circle (both axes) in viewBox units. */
  center: number
  /** Base eye width as a fraction of the radius. */
  eyeWidth: number
  /** Base eye height as a fraction of the radius. */
  eyeHeight: number
  /** Half the angular distance between the eyes, radians. */
  eyeSeparation: number
  /** Resting elevation of the eyes on the sphere, radians. */
  eyeElevation: number
  maxYaw: number
  maxPitch: number
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  radius: 96,
  center: 100,
  eyeWidth: 0.16,
  eyeHeight: 0.4,
  eyeSeparation: 0.33,
  eyeElevation: 0.06,
  maxYaw: 0.74,
  maxPitch: 0.5,
}

/** Meridian tilt is physically ~1, but softened so a downward gaze never reads as a frown. */
const MERIDIAN_STRENGTH = 0.75

const POSE_KEYS = Object.keys(NEUTRAL_POSE) as (keyof EyePose)[]

const ROLL_SPRING = spring(1.4, 0.9)
const SACCADE_THRESHOLD = 0.06
const PURSUIT_RATE = 7

const lerpPose = (a: EyePose, b: EyePose, t: number): EyePose => {
  const out = { ...a }
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], t)
  return out
}

class EyeRig {
  readonly side: -1 | 1
  readonly seed: number
  private springs: Record<keyof EyePose, Spring>
  readonly pose: EyePose = { ...NEUTRAL_POSE }

  constructor(side: -1 | 1, initial: EyePose, config: SpringConfig) {
    this.side = side
    this.seed = side < 0 ? 3.1 : 17.7
    this.springs = {} as Record<keyof EyePose, Spring>
    for (const k of POSE_KEYS) this.springs[k] = new Spring(initial[k], config)
  }

  configure(config: SpringConfig): void {
    for (const k of POSE_KEYS) this.springs[k].configure(config)
  }

  setTargets(target: EyePose): void {
    for (const k of POSE_KEYS) this.springs[k].target = target[k]
  }

  update(dt: number): EyePose {
    for (const k of POSE_KEYS) this.pose[k] = this.springs[k].update(dt)
    return this.pose
  }
}

class Blinker {
  private running = false
  private elapsed = 0
  private close = 0.075
  private hold = 0.035
  private open = 0.15
  private queueDouble = false
  private eyeDelay = 0

  get active(): boolean {
    return this.running
  }

  start(b: BlinkBehavior, speed = 1, allowDouble = true): void {
    if (this.running) return
    this.close = (b.closeMs / 1000) * speed
    this.hold = (b.holdMs / 1000) * speed
    this.open = (b.openMs / 1000) * speed
    this.queueDouble = allowDouble && chance(b.doubleChance)
    this.eyeDelay = rand(0, 0.012)
    this.elapsed = 0
    this.running = true
  }

  /** Returns true on the frame a blink completes. */
  update(dt: number): boolean {
    if (!this.running) return false
    this.elapsed += dt
    const total = this.close + this.hold + this.open + this.eyeDelay
    if (this.elapsed >= total) {
      if (this.queueDouble) {
        // Second blink of a double: short gap, slightly quicker reopening.
        this.queueDouble = false
        this.elapsed = -0.07
        this.open *= 0.9
        return true
      }
      this.running = false
      return true
    }
    return false
  }

  /** Closure 0..1 for one eye; `side` staggers the two eyes by a few ms. */
  value(side: -1 | 1): number {
    if (!this.running) return 0
    const t = this.elapsed - (side > 0 ? this.eyeDelay : 0)
    if (t <= 0) return 0
    if (t < this.close) return easeInOutCubic(t / this.close)
    if (t < this.close + this.hold) return 1
    const o = (t - this.close - this.hold) / this.open
    return o >= 1 ? 0 : 1 - easeOutCubic(o)
  }
}

/**
 * Synthesises a speech-like rhythm: bursts of syllables at 4–6 Hz separated
 * by short pauses. If an external audio level is supplied it is used instead.
 */
class SpeechEngine {
  private level = new Spring(0, spring(7, 0.75))
  private nextAt = 0
  private syllablesLeft = 0
  private releaseAt = 0

  update(dt: number, now: number, external: number | null): number {
    if (external !== null) {
      this.level.target = clamp(external, 0, 1)
      return this.level.update(dt)
    }
    if (now >= this.nextAt) {
      if (this.syllablesLeft <= 0) {
        this.syllablesLeft = Math.floor(rand(3, 9))
        this.nextAt = now + rand(0.25, 0.7)
      } else {
        this.syllablesLeft -= 1
        this.level.target = rand(0.55, 1)
        this.releaseAt = now + rand(0.06, 0.1)
        this.nextAt = now + rand(0.16, 0.26)
      }
    }
    if (now >= this.releaseAt) this.level.target = 0.08
    return this.level.update(dt)
  }

  reset(): void {
    this.level.snap(0)
    this.nextAt = 0
    this.syllablesLeft = 0
  }
}

interface ActiveGesture {
  gesture: Gesture
  startedAt: number
  keyIndex: number
  gaze: GestureKey['gaze'] | undefined
  gazeSpring: SpringConfig | undefined
  poseSpring: SpringConfig | undefined
  roll: number | undefined
  both: PartialPose
  left: PartialPose
  right: PartialPose
}

export interface EngineHooks {
  onBlink?: () => void
}

export class CharacterEngine {
  readonly config: EngineConfig
  private hooks: EngineHooks

  private time = 0
  private stateName: AICharacterState = 'idle'
  private def: StateDefinition = STATES.idle
  private intensity = 1
  private motionScale = 1
  private audioLevel: number | null = null

  // Pointer, in units of body radii relative to the centre (y down).
  private pointer: Vec2 | null = null
  private pointerAt = -Infinity
  private lookAt: Vec2 | null = null

  // Gaze pipeline.
  private readonly gaze: SpringVec2
  private intent = vec(0, 0)
  private wanderTarget = vec(0, 0)
  private nextWanderAt = 0
  private glanceTarget: Vec2 | null = null
  private glanceUntil = 0
  private pendingSince = -1
  private pendingLatency = 0.08
  private anticipation = vec(0, 0)
  private anticipationUntil = 0
  private correction = vec(0, 0)
  private correctionAt = Infinity
  private correctionUntil = 0

  private readonly roll = new Spring(0, ROLL_SPRING)
  private readonly eyes: [EyeRig, EyeRig]
  private readonly blinker = new Blinker()
  private nextBlinkAt = 0
  private readonly speech = new SpeechEngine()
  private readonly bounce = new Spring(0, spring(3, 0.22))
  private nextBounceAt = 0

  private gesture: ActiveGesture | null = null
  private gestureTimers: number[] = []

  readonly frame: RenderFrame

  constructor(config: Partial<EngineConfig> = {}, hooks: EngineHooks = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config }
    this.hooks = hooks
    const b = this.def.behavior
    this.gaze = new SpringVec2(0, 0, b.gaze.spring)
    const initial = this.basePose()
    this.eyes = [new EyeRig(-1, initial.left, b.poseSpring), new EyeRig(1, initial.right, b.poseSpring)]
    this.frame = {
      left: { transform: '', pill: '', lid: '' },
      right: { transform: '', pill: '', lid: '' },
    }
    this.scheduleBlink()
    this.resetGestureTimers()
    this.nextWanderAt = this.time + 0.4
    this.update(0)
  }

  // ---------------------------------------------------------------- inputs

  /** Swap callbacks after construction (React re-renders pass new closures). */
  setHooks(hooks: EngineHooks): void {
    this.hooks = hooks
  }

  setState(name: AICharacterState): void {
    if (name === this.stateName) return
    this.stateName = name
    this.def = STATES[name] ?? STATES.idle
    const b = this.def.behavior
    this.gaze.configure(b.gaze.spring)
    for (const eye of this.eyes) eye.configure(b.poseSpring)
    this.gesture = null
    this.resetGestureTimers()
    this.nextWanderAt = this.time + rand(0.3, 0.9)
    this.nextBlinkAt = Math.min(this.nextBlinkAt, this.time + rand(0.6, 1.6))
    this.nextBounceAt = this.time + 0.2
    this.speech.reset()
    if (this.def.onEnter) this.play(this.def.onEnter(this.context()))
  }

  setIntensity(value: number): void {
    this.intensity = clamp(value, 0, 1)
  }

  setMotionScale(value: number): void {
    this.motionScale = clamp(value, 0, 1)
  }

  setAudioLevel(level: number | null): void {
    this.audioLevel = level
  }

  /** Pointer position relative to the body centre, in body radii (y down). */
  setPointer(p: Vec2 | null): void {
    this.pointer = p ? { x: p.x, y: p.y } : null
    if (p) this.pointerAt = this.time
  }

  /** Programmatic gaze in the range -1..1 on each axis. Overrides the pointer. */
  setLookAt(p: Vec2 | null): void {
    this.lookAt = p ? { x: clamp(p.x, -1, 1), y: clamp(p.y, -1, 1) } : null
  }

  blink(): void {
    this.blinker.start(this.def.behavior.blink, 1, false)
  }

  /** Reaction to being tapped: a quick squash and a double blink. */
  poke(): void {
    this.play({
      duration: 0.7,
      keys: [
        { at: 0, pose: { height: 0.78, width: 1.16, shiftEl: -0.015 }, poseSpring: spring(6, 0.7) },
        { at: 0.09, pose: { height: 1.16, width: 1.06, shiftEl: 0.03 }, poseSpring: spring(3.6, 0.5), blink: true },
        { at: 0.3, pose: {} },
        { at: 0.42, blink: true },
      ],
    })
  }

  play(gesture: Gesture): void {
    if (this.gesture) {
      this.gaze.configure(this.def.behavior.gaze.spring)
      for (const eye of this.eyes) eye.configure(this.def.behavior.poseSpring)
    }
    this.gesture = {
      gesture,
      startedAt: this.time,
      keyIndex: -1,
      gaze: undefined,
      gazeSpring: undefined,
      poseSpring: undefined,
      roll: undefined,
      both: {},
      left: {},
      right: {},
    }
  }

  /**
   * Advance time without rendering every step, so a character that was
   * paused (off-screen, hidden tab) resumes already settled into its pose.
   */
  settle(seconds: number): RenderFrame {
    const step = 1 / 30
    for (let t = 0; t < seconds; t += step) this.update(step)
    return this.frame
  }

  // ---------------------------------------------------------------- update

  update(dt: number): RenderFrame {
    this.time += dt
    const now = this.time
    const b = this.def.behavior
    const ms = this.motionScale

    this.updateGesture(now)
    this.updateGaze(dt, now, b)
    this.updateBlink(dt, now, b)

    const speech = b.speech ? this.speech.update(dt, now, this.audioLevel) : 0
    const bounce = this.updateBounce(dt, now, b) * ms
    const rollTarget = this.resolveRoll(b) * this.intensity
    this.roll.target = rollTarget
    this.roll.update(dt)

    const base = this.basePose()
    const targets: [EyePose, EyePose] = [base.left, base.right]
    if (this.gesture) {
      targets[0] = { ...targets[0], ...this.gesture.both, ...this.gesture.left }
      targets[1] = { ...targets[1], ...this.gesture.both, ...this.gesture.right }
    }

    const converge = this.convergence()
    const breath = Math.sin(TAU * b.breath.rate * now) * b.breath.amp * ms
    const driftAz = fbm(now * 0.25, 100) * b.micro.drift * ms
    const driftEl = fbm(now * 0.21, 200) * b.micro.drift * ms
    const tremor = (b.tremor ?? 0) * ms

    for (let i = 0; i < 2; i++) {
      const eye = this.eyes[i]
      eye.setTargets(targets[i])
      const p = eye.update(dt)
      const s = eye.side
      const blink = this.blinker.value(s)
      const seed = eye.seed

      const jitterAz = fbm(now * 1.7, seed) * b.micro.jitter * ms
      const jitterEl = fbm(now * 1.9, seed + 11) * b.micro.jitter * ms
      const tremorAz = tremor * 0.0045 * noise1(now * 23, seed + 20)
      const tremorEl = tremor * 0.0035 * noise1(now * 19, seed + 30)
      const wobbleW = 1 + 0.012 * noise1(now * 0.9, seed + 5) * ms
      const wobbleH = 1 + 0.012 * noise1(now * 0.8, seed + 7) * ms

      const az =
        this.gaze.x.value +
        s * (this.config.eyeSeparation + p.shiftAz - converge) +
        driftAz +
        jitterAz +
        tremorAz
      const el =
        this.gaze.y.value +
        this.config.eyeElevation +
        p.shiftEl +
        breath +
        driftEl +
        jitterEl +
        tremorEl +
        bounce * 0.02 +
        speech * 0.012

      const widthMul = p.width * wobbleW * (1 + 0.22 * blink) * (1 - 0.05 * bounce) * (1 + 0.02 * speech)
      const heightMul =
        p.height * wobbleH * (1 - 0.94 * blink) * (1 + 0.1 * bounce) * (1 + 0.07 * speech) * (1 + breath * 1.5)

      this.renderEye(i === 0 ? this.frame.left : this.frame.right, s, az, el, widthMul, heightMul, p, blink)
    }

    return this.frame
  }

  // ---------------------------------------------------------------- pieces

  private basePose(): { left: EyePose; right: EyePose } {
    const p = this.def.pose
    const left = 'left' in p ? p.left : p
    const right = 'right' in p ? p.right : p
    if (this.intensity >= 1) return { left, right }
    return {
      left: lerpPose(NEUTRAL_POSE, left, this.intensity),
      right: lerpPose(NEUTRAL_POSE, right, this.intensity),
    }
  }

  private context(): GestureContext {
    return {
      bias: this.def.behavior.gaze.bias,
      pointer: this.pointerGaze(),
      gaze: vec(this.gaze.x.value, this.gaze.y.value),
    }
  }

  private resetGestureTimers(): void {
    this.gestureTimers = this.def.gestures.map((g) => this.time + rand(g.interval[0], g.interval[1]) * 0.7)
  }

  private updateGesture(now: number): void {
    const g = this.gesture
    if (g) {
      const elapsed = now - g.startedAt
      if (elapsed >= g.gesture.duration) {
        this.gesture = null
        this.gaze.configure(this.def.behavior.gaze.spring)
        for (const eye of this.eyes) eye.configure(this.def.behavior.poseSpring)
      } else {
        const keys = g.gesture.keys
        while (g.keyIndex + 1 < keys.length && keys[g.keyIndex + 1].at <= elapsed) {
          g.keyIndex += 1
          this.applyKey(g, keys[g.keyIndex])
        }
      }
    }
    if (this.gesture) return
    const specs: GestureSpec[] = this.def.gestures
    for (let i = 0; i < specs.length; i++) {
      if (now >= this.gestureTimers[i]) {
        const spec = specs[i]
        this.gestureTimers[i] = now + rand(spec.interval[0], spec.interval[1])
        this.play(spec.build(this.context()))
        break
      }
    }
  }

  private applyKey(g: ActiveGesture, key: GestureKey): void {
    if (key.gaze !== undefined) g.gaze = key.gaze
    if (key.gazeSpring) {
      g.gazeSpring = key.gazeSpring
      this.gaze.configure(key.gazeSpring)
    }
    if (key.pose || key.left || key.right) {
      g.both = key.pose ?? {}
      g.left = key.left ?? {}
      g.right = key.right ?? {}
    }
    if (key.poseSpring) {
      g.poseSpring = key.poseSpring
      for (const eye of this.eyes) eye.configure(key.poseSpring)
    }
    if (key.roll !== undefined) g.roll = key.roll
    if (key.blink) this.blinker.start(this.def.behavior.blink, 1, false)
  }

  private pointerSource(): Vec2 | null {
    if (this.lookAt) return { x: this.lookAt.x * 1.8, y: this.lookAt.y * 1.8 }
    if (this.pointer && this.time - this.pointerAt < 3.5) return this.pointer
    return null
  }

  private pointerGaze(): Vec2 | null {
    const p = this.pointerSource()
    if (!p) return null
    const gain = this.def.behavior.gaze.gain
    return vec(
      clamp(Math.atan(p.x * 0.6) * gain, -this.config.maxYaw, this.config.maxYaw),
      clamp(Math.atan(-p.y * 0.6) * gain, -this.config.maxPitch, this.config.maxPitch),
    )
  }

  private convergence(): number {
    const p = this.pointerSource()
    if (!p) return 0
    const d = Math.hypot(p.x, p.y)
    return clamp((1.6 - d) / 1.6, 0, 1) * 0.06
  }

  private resolveRoll(b: Behavior): number {
    if (this.gesture?.roll !== undefined) return this.gesture.roll
    if (!b.rollTowardPointer) return b.roll
    const pg = this.pointerGaze()
    const x = pg ? pg.x : this.gaze.x.value
    return b.roll * (x >= 0 ? 1 : -1)
  }

  private resolveGazeTarget(target: NonNullable<GestureKey['gaze']>, pointer: Vec2 | null, b: Behavior): Vec2 {
    if (target === 'pointer') return pointer ?? vec(0, 0)
    if (target === 'center') return vec(0, 0)
    if (target === 'bias') return b.gaze.bias
    return target
  }

  private updateGaze(dt: number, now: number, b: Behavior): void {
    const pointer = this.pointerGaze()

    if (now >= this.nextWanderAt) {
      if (pointer) {
        if (chance(0.45) && this.motionScale > 0.5) {
          this.glanceTarget = vec(
            clamp(pointer.x + rand(-0.35, 0.35), -this.config.maxYaw, this.config.maxYaw),
            clamp(pointer.y + rand(-0.2, 0.25), -this.config.maxPitch, this.config.maxPitch),
          )
          this.glanceUntil = now + rand(0.35, 0.8)
        }
        this.nextWanderAt = now + rand(b.gaze.interval[0], b.gaze.interval[1]) * 2.2
      } else {
        this.wanderTarget = chance(b.gaze.centerChance)
          ? vec(rand(-0.04, 0.04), rand(-0.03, 0.03))
          : vec(
              b.gaze.bias.x + rand(-b.gaze.spread.x, b.gaze.spread.x),
              b.gaze.bias.y + rand(-b.gaze.spread.y, b.gaze.spread.y),
            )
        this.nextWanderAt = now + rand(b.gaze.interval[0], b.gaze.interval[1])
      }
    }

    let desired: Vec2
    if (this.gesture?.gaze !== undefined) {
      desired = this.resolveGazeTarget(this.gesture.gaze, pointer, b)
    } else if (this.glanceTarget && now < this.glanceUntil) {
      desired = this.glanceTarget
    } else if (pointer) {
      const t = b.gaze.tracking
      desired = vec(lerp(this.wanderTarget.x, pointer.x, t), lerp(this.wanderTarget.y, pointer.y, t))
    } else {
      desired = this.wanderTarget
    }
    if (now >= this.glanceUntil) this.glanceTarget = null

    // Saccade vs. smooth pursuit.
    const dx = desired.x - this.intent.x
    const dy = desired.y - this.intent.y
    const d = Math.hypot(dx, dy)
    if (d > SACCADE_THRESHOLD) {
      if (this.pendingSince < 0) {
        this.pendingSince = now
        this.pendingLatency = rand(0.05, 0.12)
      }
      if (now - this.pendingSince >= this.pendingLatency) {
        this.pendingSince = -1
        this.intent = { ...desired }
        if (d > 0.22 && this.motionScale > 0.5) {
          const k = Math.min(0.045, d * 0.14)
          this.anticipation = vec((-dx / d) * k, (-dy / d) * k)
          this.anticipationUntil = now + 0.065
        }
        if (d > 0.42 && chance(0.25)) this.blinker.start(b.blink, 0.85, false)
        const c = Math.min(0.022, d * 0.06)
        this.correction = vec(rand(-c, c), rand(-c, c))
        this.correctionAt = now + rand(0.18, 0.26)
        this.correctionUntil = this.correctionAt + rand(0.3, 0.5)
      }
    } else {
      this.pendingSince = -1
      this.intent.x = damp(this.intent.x, desired.x, PURSUIT_RATE, dt)
      this.intent.y = damp(this.intent.y, desired.y, PURSUIT_RATE, dt)
    }

    let tx = this.intent.x
    let ty = this.intent.y
    if (now < this.anticipationUntil) {
      tx += this.anticipation.x
      ty += this.anticipation.y
    }
    if (now >= this.correctionAt && now < this.correctionUntil) {
      tx += this.correction.x
      ty += this.correction.y
    }
    const limited = this.limitGaze(tx, ty)
    this.gaze.setTarget(limited.x, limited.y)
    this.gaze.update(dt)
  }

  /** Keep the gaze inside an ellipse so diagonal corners are no more extreme than the axes. */
  private limitGaze(yaw: number, pitch: number): Vec2 {
    const nx = yaw / this.config.maxYaw
    const ny = pitch / this.config.maxPitch
    const n = Math.hypot(nx, ny)
    if (n <= 1) return vec(yaw, pitch)
    return vec(yaw / n, pitch / n)
  }

  private scheduleBlink(): void {
    const [min, max] = this.def.behavior.blink.interval
    this.nextBlinkAt = this.time + rand(min, max)
  }

  private updateBlink(dt: number, now: number, b: Behavior): void {
    if (!this.blinker.active && now >= this.nextBlinkAt) {
      this.blinker.start(b.blink)
      this.scheduleBlink()
    }
    if (this.blinker.update(dt)) {
      this.hooks.onBlink?.()
    }
  }

  private updateBounce(dt: number, now: number, b: Behavior): number {
    if (b.bounce && now >= this.nextBounceAt) {
      this.bounce.impulse(rand(2.4, 3.6))
      this.nextBounceAt = now + rand(b.bounce[0], b.bounce[1])
    }
    return this.bounce.update(dt)
  }

  private renderEye(
    out: EyeRender,
    side: -1 | 1,
    az: number,
    el: number,
    widthMul: number,
    heightMul: number,
    p: EyePose,
    blink: number,
  ): void {
    const { radius, center } = this.config
    const sample = projectOnSphere(az, el, radius)
    const foreshorten = Math.max(0.15, sample.z)
    const perspective = 0.86 + 0.14 * sample.z

    const w = radius * this.config.eyeWidth * widthMul
    const h = radius * this.config.eyeHeight * heightMul
    // While closing, the eye settles a little toward where the lids would meet.
    const closingDrop = blink * radius * this.config.eyeHeight * p.height * 0.12

    const m = mCompose(
      mTranslate(center, center),
      mRotate(this.roll.value),
      mTranslate(sample.x, sample.y),
      mRotate(sample.radialAngle),
      mScale(foreshorten, 1),
      mRotate(-sample.radialAngle),
      mRotate(sample.meridianAngle * MERIDIAN_STRENGTH - side * p.tilt),
      mScale(perspective, perspective),
      mTranslate(0, closingDrop),
    )

    out.transform = mToString(m)
    out.pill = pillPath(w, h)
    out.lid = lidClipPath(w, h, side, p)
  }
}
