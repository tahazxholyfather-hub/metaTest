import type { Vec2 } from './math'
import type { SpringConfig } from './spring'

export const AI_CHARACTER_STATES = [
  'idle',
  'curious',
  'happy',
  'sad',
  'surprised',
  'confused',
  'sleepy',
  'thinking',
  'listening',
  'speaking',
  'excited',
  'annoyed',
  'shocked',
] as const

export type AICharacterState = (typeof AI_CHARACTER_STATES)[number]

/**
 * Everything an eye can do, expressed in the eye's own frame. Values are
 * mirrored automatically for the left/right eye so a preset reads the same
 * for both ("tilt inward", "outer side lower", "shift outward").
 */
export interface EyePose {
  /** Width multiplier relative to the base eye width. */
  width: number
  /** Height multiplier relative to the base eye height. */
  height: number
  /** Rotation in radians. Positive leans the top of the eye toward the centre line. */
  tilt: number
  /** Shift along the sphere surface in radians. Positive moves the eye outward. */
  shiftAz: number
  /** Shift along the sphere surface in radians. Positive moves the eye up. */
  shiftEl: number
  /** Portion (0–1) of the eye covered from the top. */
  topLid: number
  /** Portion (0–1) of the eye covered from the bottom. */
  bottomLid: number
  /** Curvature of the top lid edge. Positive bulges down into the eye (heavy lid). */
  topCurve: number
  /** Curvature of the bottom lid edge. Positive bulges up into the eye (smiling squint). */
  bottomCurve: number
  /** Slant of the top lid edge. Positive drops the outer side (droop), negative drops the inner side (frown). */
  topSlant: number
  /** Slant of the bottom lid edge, same convention as `topSlant`. */
  bottomSlant: number
}

export type PartialPose = Partial<EyePose>

export interface EyePosePair {
  left: EyePose
  right: EyePose
}

export interface GazeBehavior {
  /** Where the eyes rest when nothing is being tracked (yaw, pitch in radians). */
  bias: Vec2
  /** Random spread around the bias for wandering targets. */
  spread: Vec2
  /** Seconds between wandering saccades. */
  interval: [number, number]
  /** Probability that a wandering target is straight at the viewer instead. */
  centerChance: number
  /** 0–1: how much the pointer overrides wandering. */
  tracking: number
  /** Multiplier on pointer-derived gaze angles. */
  gain: number
  spring: SpringConfig
}

export interface BlinkBehavior {
  interval: [number, number]
  closeMs: number
  holdMs: number
  openMs: number
  doubleChance: number
}

export interface Behavior {
  gaze: GazeBehavior
  blink: BlinkBehavior
  /** Rotation of the whole eye pair around the view axis, like a head tilt. Radians. */
  roll: number
  /** If true, `roll` follows the side the pointer is on. */
  rollTowardPointer?: boolean
  micro: { jitter: number; drift: number }
  breath: { amp: number; rate: number }
  poseSpring: SpringConfig
  /** Optional per-state procedural layers. */
  bounce?: [number, number]
  speech?: boolean
  tremor?: number
}

export type GazeTarget = Vec2 | 'pointer' | 'center' | 'bias'

export interface GestureKey {
  /** Seconds from gesture start. */
  at: number
  gaze?: GazeTarget
  gazeSpring?: SpringConfig
  pose?: PartialPose
  left?: PartialPose
  right?: PartialPose
  poseSpring?: SpringConfig
  roll?: number
  blink?: boolean
}

export interface Gesture {
  duration: number
  keys: GestureKey[]
}

export interface GestureContext {
  bias: Vec2
  pointer: Vec2 | null
  /** Current gaze in radians. */
  gaze: Vec2
}

export interface GestureSpec {
  interval: [number, number]
  build: (ctx: GestureContext) => Gesture
}

export interface StateDefinition {
  pose: EyePose | EyePosePair
  behavior: Behavior
  gestures: GestureSpec[]
  onEnter?: (ctx: GestureContext) => Gesture
}

export interface EyeRender {
  transform: string
  pill: string
  lid: string
}

export interface RenderFrame {
  left: EyeRender
  right: EyeRender
}
