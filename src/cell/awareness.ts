import type { CellParams, CellState } from './types';

/** Additive face/body impulse channels. Unset channels stay 0 each frame. */
export interface FaceImpulse {
  x: number;
  y: number;
  scale: number;
  tilt: number;
  browY: number;
  mouthCurve: number;
  eyeOpen: number;
  lookX: number;
  lookY: number;
  mouthOpen: number;
  mouthRound: number;
  blush: number;
  browLRot: number;
  browRRot: number;
  eyeCurve: number;
  pupilScale: number;
  shiver: number;
  winkL: number;
  winkR: number;
  /** Extra membrane wobble (px), for bursts like sneezes and laughter. */
  wobble: number;
}

export const ZERO_IMPULSE: FaceImpulse = {
  x: 0, y: 0, scale: 0, tilt: 0, browY: 0, mouthCurve: 0, eyeOpen: 0,
  lookX: 0, lookY: 0, mouthOpen: 0, mouthRound: 0, blush: 0,
  browLRot: 0, browRRot: 0, eyeCurve: 0, pupilScale: 0, shiver: 0,
  winkL: 0, winkR: 0, wobble: 0,
};

export type ImpulseFn = (k: number, imp: FaceImpulse) => void;

export interface ImpulseSpec {
  dur: number;
  fn: ImpulseFn;
}

export interface Reaction {
  id: string;
  /** Seconds the face overlay is held at full weight before releasing. */
  hold: number;
  params: Partial<CellParams>;
  impulses: ImpulseSpec[];
  /** Request an immediate blink as part of the reaction. */
  blink?: boolean;
}

const envelope = (k: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, k)));

const smoothstepLocal = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Anticipation squash then a springy pop — used as a shared click "hit" feel. */
function pokeHit(strength = 1): ImpulseSpec {
  return {
    dur: 0.42,
    fn: (k, imp) => {
      if (k < 0.16) {
        const a = k / 0.16;
        imp.scale -= 0.06 * strength * a;
        imp.y += 4.5 * strength * a;
      } else {
        const u = (k - 0.16) / 0.84;
        const e = envelope(u);
        imp.scale += 0.07 * strength * e;
        imp.y -= 11 * strength * e;
      }
    },
  };
}

function hop(dur: number, height: number, extraScale = 0.03): ImpulseSpec {
  return {
    dur,
    fn: (k, imp) => {
      imp.y -= Math.abs(Math.sin(k * Math.PI * 2)) * height * (1 - k * 0.45);
      imp.scale += envelope(k) * extraScale;
    },
  };
}

const REACTIONS: Record<string, (side: number) => Reaction> = {
  smile: () => ({
    id: 'smile',
    hold: 0.95,
    params: { mouthCurve: 0.82, mouthW: 28, mouthOpen: 0.12, blush: 0.42, browLY: -2.5, browRY: -2.5 },
    impulses: [pokeHit(0.85)],
  }),
  laugh: () => ({
    id: 'laugh',
    hold: 1.05,
    params: {
      eyeCurve: 1, mouthCurve: 0.92, mouthW: 30, mouthOpen: 0.38,
      blush: 0.6, browLY: -3.5, browRY: -3.5, sparkle: 0.55,
    },
    impulses: [hop(0.7, 8, 0.025), pokeHit(1.05)],
  }),
  giggle: (side) => ({
    id: 'giggle',
    hold: 0.5,
    params: { mouthCurve: 0.78, mouthW: 26, mouthOpen: 0.22, blush: 0.5, eyeOpen: 1.04 },
    impulses: [
      pokeHit(0.7),
      {
        dur: 0.55,
        fn: (k, imp) => {
          imp.tilt += Math.sin(k * Math.PI * 3) * 3.2 * side * (1 - k);
        },
      },
    ],
  }),
  surprise: () => ({
    id: 'surprise',
    hold: 0.85,
    params: {
      eyeOpen: 1.28, pupilScale: 0.84, mouthW: 22, mouthOpen: 0.42, mouthRound: 1,
      browLY: -9, browRY: -9, mouthCurve: 0,
    },
    impulses: [
      {
        dur: 0.48,
        fn: (k, imp) => {
          imp.scale += 0.07 * envelope(k);
          imp.y -= 6 * envelope(k);
          imp.eyeOpen += 0.08 * envelope(k);
        },
      },
    ],
    blink: false,
  }),
  blink: () => ({
    id: 'blink',
    hold: 0.18,
    params: {},
    impulses: [pokeHit(0.45)],
    blink: true,
  }),
  wink: (side) => ({
    id: 'wink',
    hold: 0.4,
    params: { mouthCurve: 0.7, mouthW: 26, blush: 0.38, browLY: side > 0 ? -4 : -1, browRY: side > 0 ? -1 : -4 },
    impulses: [
      pokeHit(0.55),
      {
        dur: 0.38,
        fn: (k, imp) => {
          const close = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.45;
          const c = Math.min(1, Math.max(0, close));
          if (side > 0) imp.winkL = c;
          else imp.winkR = c;
        },
      },
    ],
  }),
  curious: (side) => ({
    id: 'curious',
    hold: 0.55,
    params: {
      eyeOpen: 1.12, pupilScale: 1.14, mouthW: 17, mouthOpen: 0.14, mouthRound: 0.45,
      mouthCurve: 0.32, browLY: -6, browRY: -2, bodyTilt: -5 * side,
    },
    impulses: [
      pokeHit(0.5),
      { dur: 0.5, fn: (k, imp) => { imp.tilt -= envelope(k) * 4.5 * side; } },
    ],
  }),
  nuzzle: (side) => ({
    id: 'nuzzle',
    hold: 0.5,
    params: { mouthCurve: 0.7, blush: 0.55, eyeOpen: 0.88, bodyTilt: 6 * side },
    impulses: [
      {
        dur: 0.55,
        fn: (k, imp) => {
          imp.tilt += envelope(k) * 6.5 * side;
          imp.scale -= envelope(k) * 0.025;
          imp.x += envelope(k) * 5 * side;
        },
      },
    ],
  }),
  bounce: () => ({
    id: 'bounce',
    hold: 0.45,
    params: { mouthCurve: 0.72, eyeOpen: 1.08, blush: 0.3 },
    impulses: [hop(0.55, 10, 0.04)],
  }),
  annoyed: (side) => ({
    id: 'annoyed',
    hold: 0.55,
    params: {
      browLRot: 11, browRRot: 11, browLY: 3, browRY: 3,
      mouthCurve: -0.38, mouthW: 20, eyeOpen: 0.78, pupilScale: 0.88,
    },
    impulses: [
      pokeHit(0.7),
      {
        dur: 0.4,
        fn: (k, imp) => {
          imp.x -= envelope(k) * 5.5 * side;
          imp.tilt -= envelope(k) * 3 * side;
        },
      },
    ],
  }),
  huff: (side) => ({
    id: 'huff',
    hold: 0.6,
    params: {
      browLRot: 14, browRRot: 14, browLY: 3.5, browRY: 3.5,
      mouthCurve: -0.5, mouthOpen: 0.08, eyeOpen: 0.7, shiver: 0.35, colorShift: -0.25,
    },
    impulses: [
      {
        dur: 0.5,
        fn: (k, imp) => {
          imp.scale += 0.04 * envelope(k);
          imp.shiver += 0.4 * (1 - k);
          imp.tilt += Math.sin(k * 18) * 1.2 * side;
        },
      },
    ],
  }),
  angry: () => ({
    id: 'angry',
    hold: 0.55,
    params: {
      browLRot: 17, browRRot: 17, browLY: 4, browRY: 4,
      eyeOpen: 0.68, pupilScale: 0.8, mouthW: 24, mouthCurve: -0.6, mouthOpen: 0.1,
      shiver: 0.45, colorShift: -0.45,
    },
    impulses: [
      {
        dur: 0.45,
        fn: (k, imp) => {
          imp.x += Math.sin(k * 40) * 5 * Math.pow(1 - k, 1.4);
          imp.scale += 0.04 * envelope(k);
        },
      },
    ],
  }),
  overwhelmed: (side) => ({
    id: 'overwhelmed',
    hold: 0.7,
    params: {
      browLRot: -14, browRRot: -14, browLY: 2, browRY: 2,
      eyeOpen: 1.08, pupilScale: 0.86, mouthW: 16, mouthCurve: -0.55, mouthOpen: 0.12,
      shiver: 0.7, colorShift: -0.55, lookX: 0.45 * side, lookY: 0.2,
    },
    impulses: [
      {
        dur: 0.6,
        fn: (k, imp) => {
          imp.x += Math.sin(k * 28) * 4.5 * Math.pow(1 - k, 1.3);
          imp.lookX += 0.45 * side * (1 - k);
          imp.shiver += 0.5 * (1 - k);
        },
      },
    ],
  }),
  stir: () => ({
    id: 'stir',
    hold: 0.55,
    params: { eyeOpen: 0.42, mouthOpen: 0.12, mouthCurve: 0.2, browLY: 2, browRY: 2 },
    impulses: [
      pokeHit(0.35),
      { dur: 0.5, fn: (k, imp) => { imp.eyeOpen += envelope(k) * 0.22; } },
    ],
    blink: true,
  }),
  flinch: (side) => ({
    id: 'flinch',
    hold: 0.35,
    params: { eyeOpen: 1.15, mouthRound: 0.4, mouthOpen: 0.16, mouthCurve: -0.2 },
    impulses: [
      {
        dur: 0.38,
        fn: (k, imp) => {
          imp.scale -= 0.03 * envelope(k);
          imp.x -= envelope(k) * 6 * side;
          imp.y += envelope(k) * 3;
        },
      },
    ],
    blink: true,
  }),
  glance: (side) => ({
    id: 'glance',
    hold: 0.4,
    params: {},
    impulses: [
      {
        dur: 1.1,
        fn: (k, imp) => {
          imp.lookX += envelope(Math.min(1, k * 1.1)) * 0.55 * side;
          imp.lookY -= envelope(k) * 0.12;
        },
      },
    ],
  }),
  tinySmile: () => ({
    id: 'tinySmile',
    hold: 0.7,
    params: {},
    impulses: [
      { dur: 1.4, fn: (k, imp) => { imp.mouthCurve += envelope(k) * 0.18; } },
    ],
  }),
  tinyTilt: (side) => ({
    id: 'tinyTilt',
    hold: 0.4,
    params: {},
    impulses: [
      { dur: 1.6, fn: (k, imp) => { imp.tilt += envelope(k) * 2.6 * side; } },
    ],
  }),
  browUp: () => ({
    id: 'browUp',
    hold: 0.4,
    params: {},
    impulses: [
      { dur: 1.0, fn: (k, imp) => { imp.browY -= envelope(k) * 3.4; } },
    ],
  }),

  // -- bigger personality beats ---------------------------------------------

  puff: (side) => ({
    id: 'puff',
    hold: 0.8,
    params: {
      mouthCurve: -0.08, mouthW: 12, mouthRound: 0.85, mouthOpen: 0.22,
      blush: 0.7, eyeOpen: 0.82, browLY: 2, browRY: 2,
    },
    impulses: [
      {
        dur: 0.95,
        fn: (k, imp) => {
          const inflate = k < 0.3 ? k / 0.3 : k > 0.75 ? (1 - k) / 0.25 : 1;
          imp.scale += 0.065 * Math.max(0, inflate);
          imp.tilt += envelope(k) * 2 * side;
        },
      },
    ],
  }),
  ticklish: (side) => ({
    id: 'ticklish',
    hold: 0.75,
    params: { eyeCurve: 1, mouthCurve: 0.92, mouthOpen: 0.42, mouthW: 28, blush: 0.6 },
    impulses: [
      {
        dur: 0.85,
        fn: (k, imp) => {
          imp.tilt += Math.sin(k * Math.PI * 5) * 3.6 * side * (1 - k);
          imp.wobble += envelope(k) * 2.2;
          imp.y -= envelope(k) * 4;
        },
      },
    ],
  }),
  spinWiggle: (side) => ({
    id: 'spinWiggle',
    hold: 0.7,
    params: { eyeCurve: 0.8, mouthCurve: 0.85, mouthOpen: 0.25, blush: 0.45 },
    impulses: [
      {
        dur: 1.0,
        fn: (k, imp) => {
          imp.tilt += Math.sin(k * Math.PI * 3) * 8 * side * (1 - k * 0.6);
          imp.x += Math.sin(k * Math.PI * 2) * 5 * side * (1 - k);
          imp.scale += envelope(k) * 0.02;
        },
      },
    ],
  }),
  greet: (side) => ({
    id: 'greet',
    hold: 0.9,
    params: {
      eyeCurve: 0.9, mouthCurve: 0.9, mouthOpen: 0.3, mouthW: 29,
      blush: 0.5, sparkle: 0.7, browLY: -6, browRY: -6,
    },
    impulses: [
      hop(0.8, 9, 0.03),
      {
        dur: 1.0,
        fn: (k, imp) => {
          imp.tilt += Math.sin(k * Math.PI * 4) * 4.5 * side * (1 - k);
        },
      },
    ],
  }),
  yawn: () => ({
    id: 'yawn',
    hold: 1.35,
    params: {
      mouthRound: 0.8, mouthOpen: 1.0, mouthW: 24,
      eyeOpen: 0.13, browLY: -2, browRY: -2, browLRot: -7, browRRot: -7,
      lookY: 0.1,
    },
    impulses: [
      {
        dur: 1.9,
        fn: (k, imp) => {
          // slow inhale-stretch, then a settling sigh
          const s = k < 0.55 ? envelope(k / 0.55) : 0;
          const sigh = k > 0.62 ? envelope((k - 0.62) / 0.38) : 0;
          imp.scale += s * 0.045 - sigh * 0.02;
          imp.y -= s * 5 - sigh * 3;
          imp.tilt -= s * 2.5;
        },
      },
    ],
    blink: true,
  }),
  sneeze: (side) => ({
    id: 'sneeze',
    hold: 1.15,
    params: { mouthRound: 0.55, mouthOpen: 0.35, browLY: -5, browRY: -5, eyeOpen: 1.1 },
    impulses: [
      {
        dur: 1.5,
        fn: (k, imp) => {
          if (k < 0.42) {
            // wind-up: inhale, brows up, tilting back
            const a = k / 0.42;
            imp.scale += a * 0.055;
            imp.y -= a * 6;
            imp.browY -= a * 3;
            imp.eyeOpen += a * 0.15;
          } else if (k < 0.56) {
            // achoo! fast squash forward
            const a = (k - 0.42) / 0.14;
            imp.scale += 0.055 - a * 0.14;
            imp.y += a * 10 - 6;
            imp.tilt += a * 6 * side;
            imp.wobble += a * 4;
          } else {
            // dazed recovery
            const a = (k - 0.56) / 0.44;
            const e = 1 - a;
            imp.scale += -0.085 * e;
            imp.y += 4 * e;
            imp.tilt += 6 * side * e;
            imp.eyeOpen -= 0.25 * e;
            imp.wobble += 2.5 * e;
          }
        },
      },
    ],
    blink: true,
  }),
  stretch: () => ({
    id: 'stretch',
    hold: 1.1,
    params: { eyeCurve: 1, mouthCurve: 0.5, mouthOpen: 0.3, mouthRound: 0.5, browLY: -4, browRY: -4 },
    impulses: [
      {
        dur: 1.7,
        fn: (k, imp) => {
          const s = envelope(Math.min(1, k * 1.25));
          imp.scale += s * 0.055;
          imp.y -= s * 8;
          imp.tilt += Math.sin(k * Math.PI) * 3;
        },
      },
    ],
  }),
  peek: (side) => ({
    id: 'peek',
    hold: 1.3,
    params: {
      eyeOpen: 1.12, pupilScale: 1.14, lookX: 0.6 * side, lookY: -0.1,
      browLY: side > 0 ? -6 : -1, browRY: side > 0 ? -1 : -6,
      mouthW: 16, mouthCurve: 0.3, bodyTilt: -4 * side,
    },
    impulses: [
      {
        dur: 1.8,
        fn: (k, imp) => {
          const e = envelope(Math.min(1, k * 1.3));
          imp.x += e * 11 * side;
          imp.tilt -= e * 4 * side;
        },
      },
    ],
  }),
  dotChase: (side) => ({
    id: 'dotChase',
    hold: 1.5,
    params: { eyeOpen: 1.08, pupilScale: 1.18, mouthW: 15, mouthOpen: 0.1, mouthRound: 0.4 },
    impulses: [
      {
        dur: 1.9,
        fn: (k, imp) => {
          const fade = 1 - smoothstepLocal(0.75, 1, k);
          imp.lookX += Math.cos(k * Math.PI * 3.5) * 0.55 * side * fade;
          imp.lookY += Math.sin(k * Math.PI * 3.5) * 0.42 * fade;
        },
      },
    ],
  }),
};

const PLAYFUL_IDS = ['laugh', 'surprise', 'wink', 'giggle', 'bounce', 'smile', 'ticklish', 'spinWiggle', 'puff', 'curious', 'nuzzle'];
const ANNOYED_IDS = ['annoyed', 'blink', 'huff', 'flinch', 'puff'];
const ANGRY_IDS = ['huff', 'angry', 'annoyed', 'flinch'];
const OVER_IDS = ['overwhelmed', 'flinch', 'angry'];
const MICRO_IDS = ['glance', 'tinySmile', 'tinyTilt', 'browUp', 'blink'];
const BIG_IDLE_IDS = ['yawn', 'stretch', 'spinWiggle', 'peek', 'sneeze', 'dotChase', 'ticklish'];

function pickFrom(ids: string[], recent: string[], rand: () => number): string {
  const pool = ids.filter((id) => !recent.includes(id));
  const use = pool.length ? pool : ids;
  return use[Math.floor(rand() * use.length)]!;
}

function sideFrom(rand: () => number, lookX = 0): number {
  if (Math.abs(lookX) > 0.15) return lookX > 0 ? 1 : -1;
  return rand() < 0.5 ? 1 : -1;
}

export interface PickContext {
  irritation: number;
  state: CellState;
  rand: () => number;
  recent: string[];
  lookX: number;
}

/** Context-aware click reaction. Irritation steers the pool; state flavors it. */
export function pickClickReaction(ctx: PickContext): Reaction {
  const { irritation: u, state, rand, recent, lookX } = ctx;
  const side = sideFrom(rand, lookX);

  let ids: string[];
  if (u >= 0.72) ids = OVER_IDS;
  else if (u >= 0.48) ids = ANGRY_IDS;
  else if (u >= 0.28) ids = ANNOYED_IDS;
  else if (state === 'sleeping' || state === 'sleepy') ids = ['stir', 'blink', 'tinySmile'];
  else if (state === 'sad' || state === 'worried') ids = ['flinch', 'tinySmile', 'blink', 'nuzzle'];
  else if (state === 'angry') ids = ['huff', 'angry', 'annoyed'];
  else if (state === 'happy' || state === 'excited' || state === 'success') ids = ['laugh', 'giggle', 'bounce', 'wink', 'ticklish', 'spinWiggle'];
  else if (state === 'thinking' || state === 'focused' || state === 'processing') ids = ['surprise', 'curious', 'blink', 'smile'];
  else ids = PLAYFUL_IDS;

  const id = pickFrom(ids, recent, rand);
  return REACTIONS[id]!(side);
}

export function pickMicroReaction(ctx: PickContext): Reaction {
  const side = sideFrom(ctx.rand, ctx.lookX);
  let ids = MICRO_IDS;
  if (ctx.state === 'sleeping') ids = ['tinyTilt', 'browUp'];
  else if (ctx.irritation > 0.4) ids = ['glance', 'tinyTilt', 'browUp'];
  const id = pickFrom(ids, ctx.recent, ctx.rand);
  return REACTIONS[id]!(side);
}

export function pickHoverReaction(ctx: PickContext): Reaction {
  const side = sideFrom(ctx.rand, ctx.lookX);
  if (ctx.irritation > 0.45) return REACTIONS.flinch!(side);
  const id = pickFrom(['curious', 'browUp', 'blink', 'tinySmile'], ctx.recent, ctx.rand);
  return REACTIONS[id]!(side);
}

export function pickStartleReaction(ctx: PickContext): Reaction {
  return REACTIONS.surprise!(sideFrom(ctx.rand, ctx.lookX));
}

/** Rare, bigger idle beats — yawns, stretches, sneezes, little dances. */
export function pickBigIdleReaction(ctx: PickContext, bored: number): Reaction {
  const side = sideFrom(ctx.rand, ctx.lookX);
  // When bored, favor sleepy/lazy beats over energetic ones.
  const ids = bored > 0.5 ? ['yawn', 'stretch', 'peek', 'yawn', 'dotChase'] : BIG_IDLE_IDS;
  const id = pickFrom(ids, ctx.recent, ctx.rand);
  return REACTIONS[id]!(side);
}

/** Warm hello when the user's cursor comes back after a long absence. */
export function pickGreetReaction(ctx: PickContext): Reaction {
  return REACTIONS.greet!(sideFrom(ctx.rand, ctx.lookX));
}
