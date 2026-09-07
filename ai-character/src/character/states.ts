import { rand, randSign, vec, chance, type Vec2 } from './math'
import { spring } from './spring'
import type {
  AICharacterState,
  Behavior,
  EyePose,
  Gesture,
  GestureContext,
  GestureSpec,
  PartialPose,
  StateDefinition,
} from './types'

export const NEUTRAL_POSE: EyePose = {
  width: 1,
  height: 1,
  tilt: 0,
  shiftAz: 0,
  shiftEl: 0,
  topLid: 0,
  bottomLid: 0,
  topCurve: 0,
  bottomCurve: 0,
  topSlant: 0,
  bottomSlant: 0,
}

export const pose = (p: PartialPose = {}): EyePose => ({ ...NEUTRAL_POSE, ...p })

const IDLE_BEHAVIOR: Behavior = {
  gaze: {
    bias: vec(0, 0.02),
    spread: vec(0.34, 0.2),
    interval: [1.6, 4.2],
    centerChance: 0.35,
    tracking: 0.9,
    gain: 1,
    spring: spring(2.6, 0.72),
  },
  blink: { interval: [2.2, 6], closeMs: 75, holdMs: 35, openMs: 150, doubleChance: 0.12 },
  roll: 0,
  micro: { jitter: 0.0035, drift: 0.012 },
  breath: { amp: 0.006, rate: 0.22 },
  poseSpring: spring(2.0, 0.8),
}

type BehaviorOverrides = Omit<Partial<Behavior>, 'gaze' | 'blink' | 'micro' | 'breath'> & {
  gaze?: Partial<Behavior['gaze']>
  blink?: Partial<Behavior['blink']>
  micro?: Partial<Behavior['micro']>
  breath?: Partial<Behavior['breath']>
}

const behavior = (b: BehaviorOverrides = {}): Behavior => ({
  ...IDLE_BEHAVIOR,
  ...b,
  gaze: { ...IDLE_BEHAVIOR.gaze, ...b.gaze },
  blink: { ...IDLE_BEHAVIOR.blink, ...b.blink },
  micro: { ...IDLE_BEHAVIOR.micro, ...b.micro },
  breath: { ...IDLE_BEHAVIOR.breath, ...b.breath },
})

const every = (min: number, max: number, build: (ctx: GestureContext) => Gesture): GestureSpec => ({
  interval: [min, max],
  build,
})

const around = (center: Vec2, spreadX: number, spreadY: number): Vec2 =>
  vec(center.x + rand(-spreadX, spreadX), center.y + rand(-spreadY, spreadY))

const snappy = spring(3.4, 0.6)
const soft = spring(1.2, 1)

export const STATES: Record<AICharacterState, StateDefinition> = {
  idle: {
    pose: pose(),
    behavior: IDLE_BEHAVIOR,
    gestures: [
      // Occasional slow, thoughtful half-squint that releases.
      every(9, 18, () => ({
        duration: 1.6,
        keys: [
          { at: 0, pose: { topLid: 0.05, topCurve: 0.15, height: 0.97 }, poseSpring: soft },
          { at: 1.0, poseSpring: spring(2, 0.8) },
        ],
      })),
    ],
  },

  curious: {
    pose: {
      left: pose({ width: 1.02, height: 1.04, shiftEl: 0.01 }),
      right: pose({ width: 1.1, height: 1.12, shiftEl: 0.02 }),
    },
    behavior: behavior({
      gaze: {
        spread: vec(0.3, 0.2),
        interval: [0.9, 2.2],
        centerChance: 0.2,
        tracking: 1,
        gain: 1.15,
        spring: spring(3.2, 0.62),
      },
      blink: { interval: [2.5, 5.5] },
      roll: 0.1,
      micro: { jitter: 0.004, drift: 0.012 },
      poseSpring: spring(2.6, 0.7),
    }),
    gestures: [
      every(3, 6, (ctx) => {
        const a = around(ctx.bias, 0.4, 0.25)
        const b = vec(-a.x * 0.8, a.y * 0.5 + 0.1)
        return {
          duration: 1.1,
          keys: [
            { at: 0, gaze: a, gazeSpring: spring(3.6, 0.6) },
            { at: 0.32, gaze: b },
            { at: 0.7, gaze: 'pointer' },
          ],
        }
      }),
      every(5, 9, () => ({
        duration: 0.9,
        keys: [
          { at: 0, right: { width: 1.18, height: 1.2 }, left: { topLid: 0.12 } },
          { at: 0.5, pose: {} },
        ],
      })),
    ],
  },

  happy: {
    pose: pose({ width: 1.12, height: 0.98, bottomLid: 0.38, bottomCurve: 0.85, shiftEl: 0.025 }),
    behavior: behavior({
      gaze: { bias: vec(0, 0.03), spread: vec(0.25, 0.15), interval: [1.8, 4], spring: spring(2.4, 0.7) },
      blink: { interval: [3, 7] },
      breath: { amp: 0.008, rate: 0.24 },
      poseSpring: spring(2.6, 0.6),
    }),
    onEnter: () => ({
      duration: 0.5,
      keys: [
        { at: 0, pose: { height: 1.22, width: 0.96, shiftEl: 0.06, bottomLid: 0.2 }, poseSpring: spring(3.2, 0.55) },
        { at: 0.16, pose: {} },
      ],
    }),
    gestures: [
      every(3, 6, () => ({
        duration: 0.9,
        keys: [
          { at: 0, pose: { bottomLid: 0.5, bottomCurve: 1, width: 1.18, shiftEl: 0.04 } },
          { at: 0.5, pose: {} },
        ],
      })),
    ],
  },

  sad: {
    pose: pose({
      width: 0.94,
      height: 0.95,
      tilt: 0.14,
      topLid: 0.22,
      topCurve: 0.1,
      topSlant: 0.5,
      shiftEl: -0.03,
    }),
    behavior: behavior({
      gaze: {
        bias: vec(0, -0.32),
        spread: vec(0.2, 0.1),
        interval: [3, 6],
        centerChance: 0.15,
        tracking: 0.45,
        gain: 0.7,
        spring: spring(1.4, 1),
      },
      blink: { interval: [3, 6], closeMs: 140, holdMs: 90, openMs: 260, doubleChance: 0.05 },
      micro: { jitter: 0.002, drift: 0.006 },
      breath: { amp: 0.01, rate: 0.16 },
      poseSpring: spring(1.3, 1),
    }),
    gestures: [
      // A sigh: sink lower, then slowly come back up.
      every(5, 9, (ctx) => ({
        duration: 2.4,
        keys: [
          { at: 0, gaze: vec(ctx.bias.x, -0.5), pose: { topLid: 0.45, height: 0.86 }, poseSpring: spring(0.9, 1) },
          { at: 1.3, gaze: 'bias', poseSpring: spring(1.3, 1) },
        ],
      })),
      // Glance up at the viewer, then look away again.
      every(6, 11, () => ({
        duration: 2,
        keys: [
          { at: 0, gaze: 'pointer', gazeSpring: spring(1.6, 0.9) },
          { at: 1.2, gaze: 'bias', gazeSpring: spring(1.2, 1) },
        ],
      })),
    ],
  },

  surprised: {
    pose: pose({ width: 1.32, height: 1.14, shiftEl: 0.04, shiftAz: 0.015 }),
    behavior: behavior({
      gaze: {
        bias: vec(0, 0.08),
        spread: vec(0.08, 0.05),
        interval: [2, 4],
        tracking: 1,
        gain: 0.8,
        centerChance: 0.5,
        spring: spring(4, 0.55),
      },
      blink: { interval: [2.5, 5], closeMs: 60, holdMs: 20, openMs: 110 },
      micro: { jitter: 0.002, drift: 0.005 },
      poseSpring: spring(3.4, 0.5),
    }),
    onEnter: () => ({
      duration: 0.7,
      keys: [
        { at: 0, pose: { height: 0.7, width: 0.92 }, poseSpring: spring(6, 0.9) },
        { at: 0.07, pose: { width: 1.48, height: 1.24, shiftEl: 0.06 }, poseSpring: spring(3.6, 0.45) },
        { at: 0.3, pose: {} },
        { at: 0.55, blink: true },
      ],
    }),
    gestures: [
      every(3, 6, () => ({
        duration: 0.6,
        keys: [
          { at: 0, pose: { width: 1.42, height: 1.2 }, poseSpring: snappy },
          { at: 0.25, pose: {} },
        ],
      })),
    ],
  },

  confused: {
    pose: {
      left: pose({ width: 0.96, height: 0.98, topLid: 0.3, topCurve: 0.1, topSlant: -0.35, tilt: -0.06 }),
      right: pose({ width: 1.08, height: 1.1, tilt: 0.03 }),
    },
    behavior: behavior({
      gaze: {
        bias: vec(0.1, 0.12),
        spread: vec(0.3, 0.15),
        interval: [0.8, 1.8],
        centerChance: 0.25,
        tracking: 0.7,
        gain: 0.9,
        spring: spring(3, 0.7),
      },
      blink: { interval: [2.5, 5], doubleChance: 0.25 },
      roll: 0.15,
      poseSpring: spring(2, 0.75),
    }),
    gestures: [
      every(2.5, 5, (ctx) => {
        const a = around(ctx.bias, 0.35, 0.12)
        const b = vec(-a.x, a.y + rand(-0.08, 0.08))
        return {
          duration: 1.4,
          keys: [
            { at: 0, gaze: a, gazeSpring: spring(3.4, 0.7) },
            { at: 0.28, gaze: b },
            { at: 0.6, gaze: a },
            { at: 0.95, gaze: 'pointer' },
          ],
        }
      }),
      // Swap the head-tilt direction and which eye is squinting.
      every(6, 10, () => ({
        duration: 3,
        keys: [
          {
            at: 0,
            roll: -0.15,
            left: { topLid: 0, topSlant: 0, tilt: 0.03, width: 1.08, height: 1.1 },
            right: { topLid: 0.3, topCurve: 0.1, topSlant: -0.35, tilt: -0.06, width: 0.96, height: 0.98 },
            poseSpring: spring(1.6, 0.8),
          },
          { at: 0.1, blink: true },
        ],
      })),
    ],
  },

  sleepy: {
    pose: pose({
      width: 1.06,
      height: 0.9,
      topLid: 0.5,
      topCurve: 0.3,
      topSlant: 0.1,
      bottomLid: 0.04,
      shiftEl: -0.02,
    }),
    behavior: behavior({
      gaze: {
        bias: vec(0, -0.22),
        spread: vec(0.18, 0.08),
        interval: [3.5, 7],
        centerChance: 0.2,
        tracking: 0.35,
        gain: 0.6,
        spring: spring(1.1, 1),
      },
      blink: { interval: [3, 6], closeMs: 260, holdMs: 220, openMs: 420, doubleChance: 0.05 },
      roll: 0.05,
      micro: { jitter: 0.002, drift: 0.01 },
      breath: { amp: 0.012, rate: 0.14 },
      poseSpring: spring(1.2, 1),
    }),
    gestures: [
      // Nod off: lids sink slowly, then jolt back open.
      every(5, 9, () => ({
        duration: 3.8,
        keys: [
          { at: 0, pose: { topLid: 0.82, height: 0.84, shiftEl: -0.04 }, poseSpring: spring(0.45, 1), gaze: vec(0, -0.34), gazeSpring: spring(0.6, 1) },
          { at: 2.6, pose: { topLid: 0.42, height: 0.92, shiftEl: 0 }, poseSpring: spring(3.6, 0.6), gaze: 'bias', gazeSpring: spring(2.4, 0.7) },
          { at: 2.9, blink: true },
          { at: 3.3, pose: {} },
        ],
      })),
    ],
  },

  thinking: {
    pose: pose({ width: 0.96, height: 1, topLid: 0.2, topCurve: 0.05, topSlant: -0.25, shiftEl: 0.01 }),
    behavior: behavior({
      gaze: {
        bias: vec(0.4, 0.35),
        spread: vec(0.12, 0.08),
        interval: [2.5, 5],
        centerChance: 0.1,
        tracking: 0.25,
        gain: 0.8,
        spring: spring(2.6, 0.78),
      },
      blink: { interval: [2.5, 5.5] },
      roll: 0.06,
      micro: { jitter: 0.003, drift: 0.015 },
      poseSpring: spring(1.8, 0.85),
    }),
    gestures: [
      every(2.5, 5, (ctx) => {
        const side = ctx.gaze.x >= 0 ? -1 : 1
        return {
          duration: 2.6,
          keys: [
            { at: 0, gaze: vec(0.45 * side, rand(0.3, 0.42)), gazeSpring: spring(2.8, 0.7) },
            { at: 0.08, blink: chance(0.5) },
            { at: 1.9, gaze: vec(0.1 * side, 0.42) },
            { at: 2.35, gaze: vec(0.42 * side, 0.34) },
          ],
        }
      }),
      // Brief squint of concentration.
      every(6, 10, () => ({
        duration: 1.5,
        keys: [
          { at: 0, pose: { topLid: 0.32, topSlant: -0.35, width: 0.92 }, poseSpring: spring(1.6, 0.9) },
          { at: 0.9, pose: {} },
        ],
      })),
    ],
  },

  listening: {
    pose: pose({ width: 1.06, height: 1.05, shiftEl: 0.015 }),
    behavior: behavior({
      gaze: {
        spread: vec(0.1, 0.08),
        interval: [4, 7],
        centerChance: 0.6,
        tracking: 1,
        gain: 1,
        spring: spring(2.4, 0.8),
      },
      blink: { interval: [3.5, 7], closeMs: 80, holdMs: 40, openMs: 160 },
      roll: 0.1,
      rollTowardPointer: true,
      micro: { jitter: 0.002, drift: 0.006 },
      breath: { amp: 0.006, rate: 0.22 },
      poseSpring: spring(2.2, 0.8),
    }),
    gestures: [
      // Attentive nod.
      every(3, 5.5, () => ({
        duration: 0.8,
        keys: [
          { at: 0, pose: { shiftEl: -0.03, height: 1.0 }, poseSpring: spring(3.2, 0.7) },
          { at: 0.22, pose: { shiftEl: 0.03, height: 1.08 } },
          { at: 0.45, pose: {} },
        ],
      })),
    ],
  },

  speaking: {
    pose: pose({ width: 1.02, height: 1.02 }),
    behavior: behavior({
      gaze: {
        spread: vec(0.25, 0.15),
        interval: [2, 4],
        centerChance: 0.5,
        tracking: 0.85,
        gain: 0.9,
        spring: spring(2.8, 0.72),
      },
      blink: { interval: [2.5, 5.5], doubleChance: 0.1 },
      speech: true,
      poseSpring: spring(2.4, 0.7),
    }),
    gestures: [
      // Emphasis: eyes widen for a beat.
      every(3, 6, () => ({
        duration: 0.5,
        keys: [
          { at: 0, pose: { height: 1.12, width: 1.06, shiftEl: 0.02 }, poseSpring: spring(3.5, 0.55) },
          { at: 0.18, pose: {} },
        ],
      })),
      // Look away while "finding the words", then return.
      every(4, 8, () => ({
        duration: 1.1,
        keys: [
          { at: 0, gaze: vec(rand(0.25, 0.45) * randSign(), rand(0.15, 0.35)), gazeSpring: spring(3, 0.7) },
          { at: 0.55, gaze: 'pointer' },
        ],
      })),
    ],
  },

  excited: {
    pose: pose({ width: 1.14, height: 1.16, shiftEl: 0.03 }),
    behavior: behavior({
      gaze: {
        spread: vec(0.35, 0.2),
        interval: [0.7, 1.6],
        centerChance: 0.35,
        tracking: 1,
        gain: 1.1,
        spring: spring(3.6, 0.55),
      },
      blink: { interval: [1.8, 4], closeMs: 60, holdMs: 20, openMs: 110, doubleChance: 0.25 },
      micro: { jitter: 0.004, drift: 0.01 },
      breath: { amp: 0.01, rate: 0.35 },
      poseSpring: spring(3, 0.5),
      bounce: [0.7, 1.5],
    }),
    onEnter: () => ({
      duration: 0.5,
      keys: [
        { at: 0, pose: { height: 1.32, width: 1.02, shiftEl: 0.07 }, poseSpring: spring(3.4, 0.5) },
        { at: 0.12, pose: {} },
      ],
    }),
    gestures: [
      every(4, 7, () => ({
        duration: 0.8,
        keys: [
          { at: 0, pose: { bottomLid: 0.32, bottomCurve: 0.8, width: 1.2 }, poseSpring: spring(3, 0.6) },
          { at: 0.45, pose: {} },
        ],
      })),
    ],
  },

  annoyed: {
    pose: pose({ width: 1, height: 0.96, topLid: 0.45, topCurve: 0, topSlant: -0.3, tilt: -0.1, shiftEl: -0.01 }),
    behavior: behavior({
      gaze: {
        bias: vec(0.45, 0.12),
        spread: vec(0.1, 0.05),
        interval: [3, 6],
        centerChance: 0.15,
        tracking: 0.3,
        gain: 0.8,
        spring: spring(2, 0.9),
      },
      blink: { interval: [3, 7], closeMs: 110, holdMs: 80, openMs: 200, doubleChance: 0.02 },
      micro: { jitter: 0.0015, drift: 0.005 },
      breath: { amp: 0.005, rate: 0.2 },
      poseSpring: spring(1.8, 0.9),
    }),
    gestures: [
      // Eye roll.
      every(4.5, 8, (ctx) => {
        const side = ctx.bias.x >= 0 ? 1 : -1
        return {
          duration: 1.5,
          keys: [
            { at: 0, gaze: vec(0.35 * side, 0.5), gazeSpring: spring(2.4, 0.85), pose: { topLid: 0.3 } },
            { at: 0.3, gaze: vec(-0.35 * side, 0.5) },
            { at: 0.6, gaze: vec(-0.45 * side, 0.1), blink: true },
            { at: 0.85, gaze: 'bias' },
          ],
        }
      }),
      // Unimpressed glance at the viewer, then away again.
      every(3, 6, () => ({
        duration: 1.3,
        keys: [
          { at: 0, gaze: 'pointer', gazeSpring: spring(2.2, 0.9) },
          { at: 0.75, gaze: 'bias' },
        ],
      })),
    ],
  },

  shocked: {
    pose: pose({ width: 1.5, height: 1.18, shiftAz: 0.03, shiftEl: 0.03 }),
    behavior: behavior({
      gaze: {
        bias: vec(0, 0.04),
        spread: vec(0.04, 0.03),
        interval: [4, 8],
        centerChance: 0.8,
        tracking: 1,
        gain: 0.5,
        spring: spring(5, 0.8),
      },
      blink: { interval: [4.5, 8], closeMs: 50, holdMs: 15, openMs: 90, doubleChance: 0.6 },
      micro: { jitter: 0, drift: 0.002 },
      breath: { amp: 0.003, rate: 0.5 },
      poseSpring: spring(4, 0.45),
      tremor: 1,
    }),
    onEnter: () => ({
      duration: 0.6,
      keys: [
        { at: 0, pose: { width: 0.85, height: 0.8, shiftEl: -0.02 }, poseSpring: spring(7, 0.9) },
        { at: 0.06, pose: { width: 1.64, height: 1.28, shiftAz: 0.05, shiftEl: 0.05 }, poseSpring: spring(4, 0.4) },
        { at: 0.3, pose: {} },
      ],
    }),
    gestures: [
      every(2.5, 5, () => ({
        duration: 0.5,
        keys: [
          { at: 0, pose: { width: 1.6, height: 1.24 }, poseSpring: spring(5, 0.5) },
          { at: 0.2, pose: {} },
        ],
      })),
    ],
  },
}
