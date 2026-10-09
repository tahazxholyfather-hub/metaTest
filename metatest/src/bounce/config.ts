/** Tunable gameplay numbers. Physics is in world pixels and seconds. */

export const TILE = 48
export const BALL_R = 17
export const VIEW_W = 640
export const VIEW_H = 360

export const PHYS = {
  step: 1 / 120,
  maxSteps: 8,
  gravity: 1680,
  maxFall: 920,
  jumpSpeed: 630,
  bounceSpeed: 880,
  maxRun: 236,
  maxSlope: 372,
  groundAccel: 1040,
  groundFriction: 700,
  airAccel: 420,
  airFriction: 80,
  slopeAccel: 1560,
  coyote: 0.09,
  jumpBuffer: 0.1,
  jumpCut: 0.48,
  snap: 16,
  detach: 0.08,
  wallInset: 13,
  wallBounce: 0.28,
  wallBounceMin: 210,
  waterGravity: 0.3,
  waterDrag: 2.6,
  waterAccel: 520,
  swim: 300,
  drown: 3.4,
  invuln: 0.75,
  maxSquash: 0.11,
} as const

export const CAM = {
  deadX: 28,
  deadY: 22,
  lookX: 110,
  lookYUp: 78,
  lookYDown: 30,
  biasY: -26,
  smoothTimeX: 0.18,
  smoothTimeY: 0.14,
  lookLambda: 5,
} as const

export const SAVE_KEY = 'met-bounce-save-v1'

export const MET_BODY = '#C9B8FF'
export const MET_EYE = '#171226'
export const MET_ACCENT = '#8B5CF6'
