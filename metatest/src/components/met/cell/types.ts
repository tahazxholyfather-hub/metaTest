import type { CSSProperties } from 'react';

/** All behavioral states the character supports. */
export const CELL_STATES = [
  'idle',
  'listening',
  'thinking',
  'processing',
  'speaking',
  'happy',
  'excited',
  'surprised',
  'confused',
  'curious',
  'focused',
  'sad',
  'worried',
  'angry',
  'sleepy',
  'sleeping',
  'error',
  'success',
  'loading',
  'attention',
] as const;

export type CellState = (typeof CELL_STATES)[number];

export const CELL_MOODS = ['neutral', 'happy', 'sad', 'tired', 'calm', 'energetic'] as const;
export type CellMood = (typeof CELL_MOODS)[number];

/** An expression is a face-only overlay borrowed from any state definition. */
export type CellExpression = CellState;

/** Gaze wander behaviors used by the micro-behavior system. */
export type WanderStyle =
  | 'none'
  | 'subtle'
  | 'focus'
  | 'shifty'
  | 'updrift'
  | 'orbit'
  | 'down';

/** Continuous, spring-animated parameters. Every state targets a subset of these. */
export interface CellParams {
  // Brows (rot > 0 tilts inner end down = angry; rot < 0 = worried/sad)
  browLY: number;
  browRY: number;
  browLRot: number;
  browRRot: number;
  // Eyes
  eyeOpen: number; // 0 closed .. 1 normal .. 1.3 wide
  eyeCurve: number; // 0 normal eye .. 1 happy "∪" arc
  pupilScale: number;
  lookX: number; // -1 .. 1
  lookY: number; // -1 .. 1
  // Mouth
  mouthW: number;
  mouthOpen: number; // 0 .. 1
  mouthCurve: number; // -1 frown .. 1 smile
  mouthRound: number; // 0 .. 1 "o" shape
  // Body
  bodyScale: number;
  bodyTilt: number;
  bodyX: number;
  bodyY: number;
  bobAmp: number;
  bobRate: number;
  swayAmp: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  breathAmp: number;
  breathRate: number;
  shiver: number;
  // Organelles
  nucScale: number;
  nucPulse: number;
  nucGlow: number;
  orgSpeed: number;
  // Light
  glow: number;
  rim: number;
  coreLight: number;
  colorShift: number; // -1 error tint .. 0 base .. 1 success tint
  // Extras
  blush: number;
  zzz: number;
  sparkle: number;
  ring: number;
  ringSpeed: number;
}

export type ParamName = keyof CellParams;

/** Non-spring, per-state behavior configuration. */
export interface CellBehavior {
  /** min/max seconds between blinks; null disables blinking. */
  blink: [number, number] | null;
  /** Blink close+open duration in seconds. */
  blinkDur: number;
  wander: WanderStyle;
  wanderAmt: number;
  /** Enable random idle micro-expressions. */
  micro: boolean;
  /** Internal speech oscillation even without external intensity feed. */
  autoTalk?: boolean;
}

export interface StateDefinition {
  params: Partial<CellParams>;
  behavior: Partial<CellBehavior>;
}

/** Imperative control surface exposed through the component ref. */
export interface AICellHandle {
  setState(state: CellState): void;
  getState(): CellState;
  setSpeaking(isSpeaking: boolean): void;
  setListening(isListening: boolean): void;
  /** Face-only overlay on top of the current state. Pass null to clear. */
  setExpression(expression: CellExpression | null): void;
  setMood(mood: CellMood): void;
  /** 0..1 — global liveliness multiplier (speed, amplitude, glow). */
  setEnergy(value: number): void;
  /** 0..1 — real-time speech/audio amplitude while speaking. */
  setSpeechIntensity(value: number): void;
  /** Trigger a context-aware click reaction (also fired by clicking the character). */
  poke(): void;
}

export interface AICellProps {
  /** Pixel size or any CSS size. Defaults to '100%' (fills its container). */
  size?: number | string;
  initialState?: CellState;
  /** Controlled props — optional, the imperative API works without them. */
  state?: CellState;
  speaking?: boolean;
  listening?: boolean;
  mood?: CellMood;
  energy?: number;
  speechIntensity?: number;
  /** Force reduced motion regardless of OS setting. */
  reducedMotion?: boolean;
  /** Render the soft atmospheric halo behind the cell. Default true. */
  atmosphere?: boolean;
  /** Eye-tracking, proximity and click personality. Default true. */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}
