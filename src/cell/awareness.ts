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
}

export const ZERO_IMPULSE: FaceImpulse = {
  x: 0, y: 0, scale: 0, tilt: 0, browY: 0, mouthCurve: 0, eyeOpen: 0,
  lookX: 0, lookY: 0, mouthOpen: 0, mouthRound: 0, blush: 0,
  browLRot: 0, browRRot: 0, eyeCurve: 0, pupilScale: 0, shiver: 0,
  winkL: 0, winkR: 0,
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

/** Anticipation squash then a springy pop — used as a shared click "hit" feel. */
function pokeHit(strength = 1): ImpulseSpec {
  return {
    dur: 0.42,
    fn: (k, imp) => {
      if (k < 0.16) {
        const a = k / 0.16;
        imp.scale -= 0.045 * strength * a;
        imp.y += 3.5 * strength * a;
      } else {
        const u = (k - 0.16) / 0.84;
        const e = envelope(u);
        imp.scale += 0.055 * strength * e;
        imp.y -= 7.5 * strength * e;
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
    hold: 0.55,
    params: { mouthCurve: 0.82, mouthW: 28, mouthOpen: 0.12, blush: 0.42, browLY: -2.5, browRY: -2.5 },
    impulses: [pokeHit(0.85)],
  }),
  laugh: () => ({
    id: 'laugh',
    hold: 0.7,
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
    hold: 0.42,
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
};

const PLAYFUL_IDS = ['smile', 'giggle', 'wink', 'curious', 'nuzzle', 'bounce', 'blink', 'surprise', 'laugh'];
const ANNOYED_IDS = ['annoyed', 'blink', 'huff', 'flinch', 'curious'];
const ANGRY_IDS = ['huff', 'angry', 'annoyed', 'flinch'];
const OVER_IDS = ['overwhelmed', 'flinch', 'angry'];
const MICRO_IDS = ['glance', 'tinySmile', 'tinyTilt', 'browUp', 'blink'];

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
  else if (state === 'happy' || state === 'excited' || state === 'success') ids = ['laugh', 'giggle', 'bounce', 'wink', 'smile'];
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
