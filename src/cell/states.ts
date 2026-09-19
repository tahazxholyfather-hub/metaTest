import type { CellBehavior, CellMood, CellParams, CellState, StateDefinition } from './types';

/** Baseline (idle) values. Every state overrides a subset. */
export const BASE_PARAMS: CellParams = {
  browLY: 0,
  browRY: 0,
  browLRot: 0,
  browRRot: 0,
  eyeOpen: 1,
  eyeCurve: 0,
  pupilScale: 1,
  lookX: 0,
  lookY: 0,
  mouthW: 24,
  mouthOpen: 0.05,
  mouthCurve: 0.38,
  mouthRound: 0,
  bodyScale: 1,
  bodyTilt: 0,
  bodyX: 0,
  bodyY: 0,
  bobAmp: 3,
  bobRate: 0.28,
  swayAmp: 2,
  wobbleAmp: 2.4,
  wobbleSpeed: 1,
  breathAmp: 0.012,
  breathRate: 0.26,
  shiver: 0,
  nucScale: 1,
  nucPulse: 0.022,
  nucGlow: 0.55,
  orgSpeed: 1,
  glow: 1,
  rim: 1,
  coreLight: 1,
  colorShift: 0,
  blush: 0.14,
  zzz: 0,
  sparkle: 0,
  ring: 0,
  ringSpeed: 1,
};

export const BASE_BEHAVIOR: CellBehavior = {
  blink: [2.4, 6.5],
  blinkDur: 0.14,
  wander: 'subtle',
  wanderAmt: 0.35,
  micro: true,
  autoTalk: false,
};

export const STATES: Record<CellState, StateDefinition> = {
  idle: {
    params: {},
    behavior: {},
  },

  listening: {
    params: {
      browLY: -3.5, browRY: -3.5,
      eyeOpen: 1.06, pupilScale: 1.12,
      mouthW: 19, mouthCurve: 0.28, mouthOpen: 0.02,
      bodyTilt: -3.5, bobAmp: 2, wobbleAmp: 1.6,
      rim: 1.28, glow: 1.15, nucPulse: 0.032, nucGlow: 0.68,
    },
    behavior: { blink: [3, 7], wander: 'focus', wanderAmt: 0.16 },
  },

  thinking: {
    params: {
      browLY: -4.5, browRY: 2, browLRot: -5, browRRot: 7,
      eyeOpen: 0.92, lookX: 0.38, lookY: -0.6,
      mouthW: 15, mouthCurve: 0.1, mouthOpen: 0.02, mouthRound: 0.3,
      bodyTilt: 2.5, wobbleSpeed: 0.85, bobRate: 0.22,
      nucPulse: 0.04, nucGlow: 0.72, orgSpeed: 1.25,
    },
    behavior: { blink: [3, 8], wander: 'updrift', wanderAmt: 0.3 },
  },

  processing: {
    params: {
      browLY: 1, browRY: 1, browLRot: 5, browRRot: 5,
      eyeOpen: 0.82, pupilScale: 0.9, lookY: 0.08,
      mouthW: 17, mouthCurve: 0.06, mouthOpen: 0.01,
      wobbleSpeed: 1.35, bobAmp: 1.6, bobRate: 0.4,
      nucPulse: 0.065, nucGlow: 0.95, orgSpeed: 2.1,
      glow: 1.12, rim: 1.12, ring: 1, ringSpeed: 1.7, coreLight: 1.2,
    },
    behavior: { blink: [4, 8], wander: 'none' },
  },

  speaking: {
    params: {
      browLY: -2, browRY: -2,
      eyeOpen: 1.02,
      mouthW: 26, mouthCurve: 0.45,
      bobAmp: 3.5, bobRate: 0.5,
      nucPulse: 0.045, nucGlow: 0.8, glow: 1.15, rim: 1.15, orgSpeed: 1.3,
    },
    behavior: { blink: [2.5, 6], wander: 'subtle', wanderAmt: 0.22, autoTalk: true },
  },

  happy: {
    params: {
      browLY: -3, browRY: -3,
      eyeCurve: 1,
      mouthW: 30, mouthCurve: 0.85, mouthOpen: 0.24,
      blush: 0.55, bobAmp: 4, bobRate: 0.5, bodyScale: 1.01,
      glow: 1.25, rim: 1.15, nucGlow: 0.78, sparkle: 0.3,
    },
    behavior: { blink: null, wander: 'none' },
  },

  excited: {
    params: {
      browLY: -6.5, browRY: -6.5,
      eyeOpen: 1.16, pupilScale: 1.22,
      mouthW: 30, mouthCurve: 0.9, mouthOpen: 0.55,
      blush: 0.6, bobAmp: 6, bobRate: 0.95, bodyScale: 1.03,
      wobbleAmp: 3.6, wobbleSpeed: 1.45,
      glow: 1.4, rim: 1.3, nucPulse: 0.06, nucGlow: 1, sparkle: 1, orgSpeed: 1.9,
    },
    behavior: { blink: [2, 5], wander: 'subtle', wanderAmt: 0.28 },
  },

  surprised: {
    params: {
      browLY: -9.5, browRY: -9.5,
      eyeOpen: 1.3, pupilScale: 0.84,
      mouthW: 24, mouthCurve: 0, mouthOpen: 0.45, mouthRound: 1,
      bodyScale: 1.02, bodyY: -4, wobbleAmp: 1.2, bobAmp: 1,
      glow: 1.3, rim: 1.35, nucScale: 1.04, nucGlow: 0.8,
    },
    behavior: { blink: [4, 8], wander: 'none' },
  },

  confused: {
    params: {
      browLY: -7, browRY: 2.5, browLRot: -9, browRRot: -5,
      eyeOpen: 0.96, lookX: -0.3, lookY: -0.18,
      mouthW: 16, mouthCurve: -0.18, mouthOpen: 0.06, mouthRound: 0.3,
      bodyTilt: 4.5, wobbleSpeed: 0.9, glow: 0.95,
    },
    behavior: { blink: [2, 5], wander: 'shifty', wanderAmt: 0.5 },
  },

  curious: {
    params: {
      browLY: -6, browRY: -2,
      eyeOpen: 1.1, pupilScale: 1.16, lookX: 0.45, lookY: -0.28,
      mouthW: 17, mouthCurve: 0.3, mouthOpen: 0.14, mouthRound: 0.45,
      bodyTilt: -5.5, bobAmp: 2.5, glow: 1.1, rim: 1.1, nucGlow: 0.65,
    },
    behavior: { blink: [2.5, 6], wander: 'focus', wanderAmt: 0.2 },
  },

  focused: {
    params: {
      browLY: 2, browRY: 2, browLRot: 6, browRRot: 6,
      eyeOpen: 0.78, pupilScale: 0.88, lookY: 0.06,
      mouthW: 15, mouthCurve: 0.04, mouthOpen: 0,
      wobbleAmp: 1.2, bobAmp: 1.2, swayAmp: 0.6,
      rim: 1.12, glow: 0.92, nucGlow: 0.7, nucPulse: 0.03,
    },
    behavior: { blink: [4, 9], wander: 'none' },
  },

  sad: {
    params: {
      browLY: 2, browRY: 2, browLRot: -14, browRRot: -14,
      eyeOpen: 0.72, lookY: 0.42, pupilScale: 0.96,
      mouthW: 20, mouthCurve: -0.7, mouthOpen: 0.03,
      bodyY: 5, bodyScale: 0.985, bobAmp: 1.2, bobRate: 0.17,
      wobbleAmp: 1.5, wobbleSpeed: 0.7, breathRate: 0.2,
      glow: 0.68, rim: 0.8, nucGlow: 0.38, coreLight: 0.82, blush: 0,
    },
    behavior: { blink: [3, 7], blinkDur: 0.22, wander: 'down', wanderAmt: 0.2 },
  },

  worried: {
    params: {
      browLY: -2.5, browRY: -2.5, browLRot: -16, browRRot: -16,
      eyeOpen: 1.05, pupilScale: 0.9,
      mouthW: 16, mouthCurve: -0.45, mouthOpen: 0.1, mouthRound: 0.25,
      shiver: 0.5, wobbleAmp: 2.8, wobbleSpeed: 1.5, bobRate: 0.36,
      glow: 0.9, nucPulse: 0.05, blush: 0,
    },
    behavior: { blink: [1.5, 4], wander: 'shifty', wanderAmt: 0.45 },
  },

  angry: {
    params: {
      browLY: 4, browRY: 4, browLRot: 17, browRRot: 17,
      eyeOpen: 0.68, pupilScale: 0.8,
      mouthW: 24, mouthCurve: -0.6, mouthOpen: 0.1,
      shiver: 0.4, wobbleAmp: 3, wobbleSpeed: 1.6, bodyScale: 1.012,
      rim: 1.3, glow: 1.15, colorShift: -0.45,
      nucGlow: 0.9, nucPulse: 0.055, blush: 0,
    },
    behavior: { blink: [3, 7], wander: 'none' },
  },

  sleepy: {
    params: {
      browLY: 3, browRY: 3,
      eyeOpen: 0.34, lookY: 0.3,
      mouthW: 17, mouthCurve: 0.16, mouthOpen: 0.1,
      bodyTilt: 3, bodyY: 4, bobRate: 0.14, bobAmp: 2,
      breathRate: 0.16, breathAmp: 0.02, wobbleSpeed: 0.6,
      glow: 0.75, rim: 0.85, nucGlow: 0.4, zzz: 0.4, orgSpeed: 0.5,
    },
    behavior: { blink: [1.4, 3.2], blinkDur: 0.42, wander: 'none' },
  },

  sleeping: {
    params: {
      browLY: 2, browRY: 2,
      eyeOpen: 0.04,
      mouthW: 14, mouthCurve: 0.22, mouthOpen: 0.07,
      bodyY: 6, bodyScale: 0.99, bobAmp: 1, bobRate: 0.1,
      breathRate: 0.115, breathAmp: 0.028,
      wobbleAmp: 1.2, wobbleSpeed: 0.4,
      glow: 0.55, rim: 0.7, nucGlow: 0.28, coreLight: 0.75,
      zzz: 1, orgSpeed: 0.35, blush: 0.08,
    },
    behavior: { blink: null, wander: 'none', micro: false },
  },

  error: {
    params: {
      browLY: -2, browRY: -2, browLRot: -12, browRRot: -12,
      eyeOpen: 1.1, pupilScale: 0.8,
      mouthW: 17, mouthCurve: -0.5, mouthOpen: 0.16, mouthRound: 0.3,
      shiver: 0.8, wobbleAmp: 3.2, wobbleSpeed: 1.7,
      glow: 1.2, rim: 1.4, colorShift: -1,
      nucPulse: 0.075, nucGlow: 0.95, orgSpeed: 1.6, blush: 0,
    },
    behavior: { blink: [2, 4], wander: 'shifty', wanderAmt: 0.35 },
  },

  success: {
    params: {
      browLY: -4, browRY: -4,
      eyeCurve: 1,
      mouthW: 28, mouthCurve: 0.9, mouthOpen: 0.26,
      blush: 0.45, bobAmp: 4, bobRate: 0.6, bodyScale: 1.02,
      glow: 1.35, rim: 1.3, colorShift: 1,
      nucGlow: 0.9, sparkle: 1,
    },
    behavior: { blink: null, wander: 'none' },
  },

  loading: {
    params: {
      eyeOpen: 0.86, lookY: -0.1,
      mouthW: 15, mouthCurve: 0.15, mouthOpen: 0.02,
      bobRate: 0.24, wobbleSpeed: 0.9,
      nucPulse: 0.05, nucGlow: 0.8, orgSpeed: 1.5,
      glow: 1.05, ring: 1, ringSpeed: 0.8, coreLight: 1.1,
    },
    behavior: { blink: [3, 7], wander: 'orbit', wanderAmt: 0.3 },
  },

  attention: {
    params: {
      browLY: -7.5, browRY: -7.5,
      eyeOpen: 1.15, pupilScale: 1.06,
      mouthW: 22, mouthCurve: 0.42, mouthOpen: 0.12,
      bodyY: -5, bodyScale: 1.03, bobAmp: 1.5, wobbleAmp: 1.5,
      rim: 1.35, glow: 1.3, sparkle: 0.4, nucGlow: 0.85,
    },
    behavior: { blink: [2.5, 6], wander: 'focus', wanderAmt: 0.15 },
  },
};

/** Face-only parameters an expression overlay is allowed to override. */
export const FACE_PARAMS = [
  'browLY', 'browRY', 'browLRot', 'browRRot',
  'eyeOpen', 'eyeCurve', 'pupilScale', 'lookX', 'lookY',
  'mouthW', 'mouthOpen', 'mouthCurve', 'mouthRound', 'blush',
] as const;

/** Long-lived additive mood biases, applied after state/expression blending. */
export const MOOD_BIAS: Record<CellMood, Partial<CellParams>> = {
  neutral: {},
  happy: { mouthCurve: 0.18, browLY: -1.5, browRY: -1.5, glow: 0.1, blush: 0.12, bobAmp: 0.6 },
  sad: { mouthCurve: -0.28, browLRot: -6, browRRot: -6, eyeOpen: -0.08, glow: -0.16, nucGlow: -0.1 },
  tired: { eyeOpen: -0.24, browLY: 1.5, browRY: 1.5, bobRate: -0.07, glow: -0.14, wobbleSpeed: -0.2 },
  calm: { wobbleAmp: -0.8, bobRate: -0.07, swayAmp: -0.8, breathRate: -0.05 },
  energetic: { bobAmp: 1.5, wobbleSpeed: 0.22, glow: 0.14, pupilScale: 0.06, bobRate: 0.1 },
};
