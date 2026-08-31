import {
  Spring, clamp, clamp01, fnoise, hash1, hexToRgb, lerp, mixRgb, mulberry32, rgbCss, smoothstep, vnoise,
  type RGB,
} from './math';
import {
  BROW_L, BROW_R, CELL_CX, CELL_CY, MITO, MOUTH, NUCLEUS,
  PUPIL_TRAVEL_X, PUPIL_TRAVEL_Y, VESICLE, membranePath, mouthPath,
} from './geometry';
import { BASE_BEHAVIOR, BASE_PARAMS, FACE_PARAMS, MOOD_BIAS, STATES } from './states';
import type { CellBehavior, CellExpression, CellMood, CellState, ParamName } from './types';

// ---------------------------------------------------------------------------
// Render frame — everything the DOM writer needs, preallocated and mutated.

export interface DotFrame {
  x: number;
  y: number;
  o: number;
}

export interface SparkleFrame {
  x: number;
  y: number;
  o: number;
  s: number;
}

export interface ZzzFrame {
  x: number;
  y: number;
  o: number;
  s: number;
}

export interface CellFrame {
  bodyTransform: string;
  membraneD: string;
  atmosphereOpacity: number;
  atmosphereScale: number;
  shadowOpacity: number;
  shadowScale: number;
  bloomOpacity: number;
  rimOpacity: number;
  innerGlowOpacity: number;
  coreLightOpacity: number;
  // tinted colors
  rimTop: string;
  rimBot: string;
  bloomColor: string;
  atmoColor: string;
  nucGlowColor: string;
  rimShadow: string; // css filter string for the rim path
  // face
  eyeOpenL: number;
  eyeOpenR: number;
  eyeCurve: number;
  lidOpacity: number;
  pupilX: number;
  pupilY: number;
  pupilScale: number;
  browLTransform: string;
  browRTransform: string;
  mouthD: string;
  mouthFillOpacity: number;
  mouthStrokeW: number;
  blushOpacity: number;
  // organelles
  nucleusTransform: string;
  nucleusGlow: number;
  mitoTransform: string;
  vesicleTransform: string;
  dots: DotFrame[];
  sparkles: SparkleFrame[];
  ringOpacity: number;
  ringRotation: number;
  zzz: ZzzFrame[];
}

const DOT_COUNT = 9;
const SPARKLE_COUNT = 6;

// Base palette (from the reference sheet) and tint targets.
const RIM_TOP: RGB = hexToRgb('#D8CCFF');
const RIM_BOT: RGB = hexToRgb('#8B5CF6');
const BLOOM: RGB = hexToRgb('#7C3AED');
const NUC_GLOW: RGB = hexToRgb('#A855F7');
const ERR = {
  rimTop: hexToRgb('#FFC2CE'), rimBot: hexToRgb('#F43F5E'),
  bloom: hexToRgb('#E11D48'), nuc: hexToRgb('#FB7185'),
};
const OK = {
  rimTop: hexToRgb('#C8FBE8'), rimBot: hexToRgb('#34D399'),
  bloom: hexToRgb('#10B981'), nuc: hexToRgb('#6EE7B7'),
};

// Per-group spring tuning: faces snap, body settles, light drifts.
const FACE_SET = new Set<ParamName>(FACE_PARAMS);
const SNAPPY: [number, number] = [150, 19];
const MEDIUM: [number, number] = [90, 15.5];
const SOFT: [number, number] = [62, 13];
const SOFT_PARAMS = new Set<ParamName>([
  'bobAmp', 'bobRate', 'swayAmp', 'wobbleAmp', 'wobbleSpeed', 'breathAmp', 'breathRate',
  'orgSpeed', 'glow', 'rim', 'coreLight', 'colorShift', 'zzz', 'sparkle', 'ring', 'ringSpeed',
]);

interface Impulse {
  t0: number;
  dur: number;
  fn: (k: number, imp: ImpulseAcc) => void;
}

interface ImpulseAcc {
  x: number;
  y: number;
  scale: number;
  tilt: number;
  browY: number;
  mouthCurve: number;
  eyeOpen: number;
}

interface OrganelleSeed {
  angle: number;
  dist: number;
  r: number;
  phase: number;
}

export interface CellEngineOptions {
  onFrame: (frame: CellFrame) => void;
  seed?: number;
  initialState?: CellState;
}

export class CellEngine {
  private springs = new Map<ParamName, Spring>();
  private onFrame: (frame: CellFrame) => void;
  private frame: CellFrame;

  private state: CellState = 'idle';
  private prevBeforeSpeaking: CellState | null = null;
  private prevBeforeListening: CellState | null = null;
  private expression: CellExpression | null = null;
  private exprWeight = new Spring(0, 120, 18);
  private mood: CellMood = 'neutral';
  private energy = 0.5;
  reducedMotion = false;

  private speaking = false;
  private extIntensity = 0;
  private extIntensityAt = -Infinity;
  private sSmooth = 0;

  private tReal = 0;
  private tAnim = 0;
  private lastNow = 0;
  private raf = 0;
  private runningFlag = false;
  private paused = false;

  // schedulers
  private nextBlink = 1.2;
  private blinkStart = -1;
  private blinkDur = 0.14;
  private nextWander = 0;
  private wanderTarget = { x: 0, y: 0 };
  private wanderCur = { x: 0, y: 0 };
  private shiftySide = 1;
  private nextMicro = 8;
  private stateChangedAt = 0;
  private impulses: Impulse[] = [];
  private imp: ImpulseAcc = { x: 0, y: 0, scale: 0, tilt: 0, browY: 0, mouthCurve: 0, eyeOpen: 0 };

  private dotSeeds: OrganelleSeed[];
  private sparkleSeeds: OrganelleSeed[];

  constructor(opts: CellEngineOptions) {
    this.onFrame = opts.onFrame;
    const rng = mulberry32(opts.seed ?? 20260831);

    for (const key of Object.keys(BASE_PARAMS) as ParamName[]) {
      const [k, c] = FACE_SET.has(key) ? SNAPPY : SOFT_PARAMS.has(key) ? SOFT : MEDIUM;
      this.springs.set(key, new Spring(BASE_PARAMS[key], k, c));
    }

    // Inner floating dots: scattered through the cytoplasm, away from the face.
    this.dotSeeds = Array.from({ length: DOT_COUNT }, (_, i) => {
      const angle = (i / DOT_COUNT) * Math.PI * 2 + rng() * 0.7;
      const dist = 0.55 + rng() * 0.36;
      return { angle, dist, r: 1.6 + rng() * 2.6, phase: rng() * 100 };
    });
    this.sparkleSeeds = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
      angle: (i / SPARKLE_COUNT) * Math.PI * 2 + rng() * 0.9,
      dist: 168 + rng() * 22,
      r: 1.4 + rng() * 1.6,
      phase: rng() * 100,
    }));

    this.frame = {
      bodyTransform: '', membraneD: '',
      atmosphereOpacity: 0.5, atmosphereScale: 1,
      shadowOpacity: 0.3, shadowScale: 1,
      bloomOpacity: 0.4, rimOpacity: 0.9, innerGlowOpacity: 0.22, coreLightOpacity: 0.25,
      rimTop: rgbCss(RIM_TOP), rimBot: rgbCss(RIM_BOT), bloomColor: rgbCss(BLOOM),
      atmoColor: rgbCss(BLOOM), nucGlowColor: rgbCss(NUC_GLOW), rimShadow: '',
      eyeOpenL: 1, eyeOpenR: 1, eyeCurve: 0, lidOpacity: 0,
      pupilX: 0, pupilY: 0, pupilScale: 1,
      browLTransform: '', browRTransform: '',
      mouthD: '', mouthFillOpacity: 0, mouthStrokeW: 4.5, blushOpacity: 0,
      nucleusTransform: '', nucleusGlow: 0.55, mitoTransform: '', vesicleTransform: '',
      dots: Array.from({ length: DOT_COUNT }, () => ({ x: 0, y: 0, o: 0 })),
      sparkles: Array.from({ length: SPARKLE_COUNT }, () => ({ x: 0, y: 0, o: 0, s: 1 })),
      ringOpacity: 0, ringRotation: 0,
      zzz: Array.from({ length: 3 }, () => ({ x: 0, y: 0, o: 0, s: 1 })),
    };

    if (opts.initialState) this.setState(opts.initialState, true);
  }

  // -- public control ------------------------------------------------------

  setState(state: CellState, immediate = false): void {
    if (!STATES[state] || state === this.state) return;
    this.state = state;
    this.stateChangedAt = this.tReal;
    this.prevBeforeSpeaking = null;
    this.prevBeforeListening = null;
    this.scheduleBlinkSoon();
    if (immediate) {
      this.applyTargets();
      for (const s of this.springs.values()) s.snap(s.target);
    } else if (!this.reducedMotion) {
      this.addEntryImpulse(state);
    }
  }

  getState(): CellState {
    return this.state;
  }

  setSpeaking(on: boolean): void {
    this.speaking = on;
    if (on) {
      if (this.state !== 'speaking') {
        this.prevBeforeSpeaking = this.state;
        this.state = 'speaking';
        this.stateChangedAt = this.tReal;
      }
    } else if (this.state === 'speaking') {
      this.state = this.prevBeforeSpeaking ?? 'idle';
      this.prevBeforeSpeaking = null;
      this.stateChangedAt = this.tReal;
    }
  }

  setListening(on: boolean): void {
    if (on) {
      if (this.state !== 'listening') {
        this.prevBeforeListening = this.state;
        this.state = 'listening';
        this.stateChangedAt = this.tReal;
      }
    } else if (this.state === 'listening') {
      this.state = this.prevBeforeListening ?? 'idle';
      this.prevBeforeListening = null;
      this.stateChangedAt = this.tReal;
    }
  }

  setExpression(expression: CellExpression | null): void {
    if (expression) {
      this.expression = expression;
      this.exprWeight.target = 1;
    } else {
      this.exprWeight.target = 0;
    }
  }

  setMood(mood: CellMood): void {
    this.mood = mood;
  }

  setEnergy(value: number): void {
    this.energy = clamp01(value);
  }

  setSpeechIntensity(value: number): void {
    this.extIntensity = clamp01(value);
    this.extIntensityAt = this.tReal;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.lastNow = 0; // avoid a giant dt after resume
  }

  start(): void {
    if (this.runningFlag) return;
    this.runningFlag = true;
    this.lastNow = 0;
    const loop = (now: number) => {
      if (!this.runningFlag) return;
      this.raf = requestAnimationFrame(loop);
      if (this.paused) return;
      if (this.lastNow === 0) {
        this.lastNow = now;
        return;
      }
      const dt = Math.min((now - this.lastNow) / 1000, 0.05);
      this.lastNow = now;
      this.tick(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.runningFlag = false;
    cancelAnimationFrame(this.raf);
  }

  // -- internals -----------------------------------------------------------

  private behavior(): CellBehavior {
    return { ...BASE_BEHAVIOR, ...STATES[this.state].behavior };
  }

  private p(name: ParamName): number {
    return this.springs.get(name)!.value;
  }

  private applyTargets(): void {
    const def = STATES[this.state].params;
    const exprDef = this.expression ? STATES[this.expression].params : null;
    const w = clamp01(this.exprWeight.value);
    const bias = MOOD_BIAS[this.mood];
    for (const key of Object.keys(BASE_PARAMS) as ParamName[]) {
      let target = def[key] ?? BASE_PARAMS[key];
      if (exprDef && w > 0.001 && FACE_SET.has(key)) {
        const ev = exprDef[key] ?? BASE_PARAMS[key];
        target = lerp(target, ev, w);
      }
      const b = bias[key];
      if (b !== undefined) target += b;
      this.springs.get(key)!.target = target;
    }
  }

  private addEntryImpulse(state: CellState): void {
    const t0 = this.tReal;
    const add = (dur: number, fn: Impulse['fn']) => this.impulses.push({ t0, dur, fn });
    switch (state) {
      case 'error':
        add(0.55, (k, imp) => {
          imp.x += Math.sin(k * 42) * 6.5 * Math.pow(1 - k, 1.6);
        });
        break;
      case 'surprised':
        add(0.5, (k, imp) => {
          imp.scale += 0.085 * Math.sin(Math.PI * k) * (1 - 0.35 * k);
          imp.y -= 5 * Math.sin(Math.PI * k);
        });
        break;
      case 'happy':
      case 'success':
      case 'excited':
        add(0.85, (k, imp) => {
          imp.y -= Math.abs(Math.sin(k * Math.PI * 2)) * 9 * (1 - k * 0.55);
          imp.scale += Math.sin(k * Math.PI) * 0.02;
        });
        break;
      case 'attention':
        add(0.45, (k, imp) => {
          imp.y -= Math.sin(Math.PI * k) * 12;
        });
        break;
      case 'angry':
        add(0.4, (k, imp) => {
          imp.scale += 0.05 * Math.sin(Math.PI * k);
        });
        break;
      default:
        break;
    }
  }

  private scheduleBlinkSoon(): void {
    this.nextBlink = Math.min(this.nextBlink, this.tReal + 0.9 + hash1(Math.floor(this.tReal * 997), 5) * 1.2);
  }

  private updateBlink(behavior: CellBehavior): number {
    const t = this.tReal;
    if (this.blinkStart >= 0) {
      const k = (t - this.blinkStart) / this.blinkDur;
      if (k >= 1) {
        this.blinkStart = -1;
        // occasional double blink
        if (behavior.blink && hash1(Math.floor(t * 1013), 17) < 0.14) {
          this.nextBlink = t + 0.24;
        }
      } else {
        // fast close, slower open
        const phase = k < 0.42 ? 1 - k / 0.42 : (k - 0.42) / 0.58;
        const e = phase * phase * (3 - 2 * phase);
        return 0.04 + e * 0.96;
      }
    }
    if (behavior.blink && t >= this.nextBlink) {
      this.blinkStart = t;
      this.blinkDur = behavior.blinkDur;
      const [mn, mx] = behavior.blink;
      const r = hash1(Math.floor(t * 883), 29);
      const slow = this.reducedMotion ? 2.2 : 1;
      this.nextBlink = t + (mn + r * (mx - mn)) * slow;
    }
    return 1;
  }

  private updateWander(behavior: CellBehavior, dt: number): void {
    const t = this.tAnim;
    const amt = behavior.wanderAmt;
    if (this.reducedMotion || behavior.wander === 'none') {
      this.wanderTarget.x = 0;
      this.wanderTarget.y = 0;
    } else if (behavior.wander === 'orbit') {
      this.wanderTarget.x = Math.cos(t * 0.75) * 0.38 * amt * 2;
      this.wanderTarget.y = Math.sin(t * 0.75) * 0.3 * amt * 2 - 0.08;
    } else if (this.tReal >= this.nextWander) {
      const r1 = hash1(Math.floor(this.tReal * 769), 41);
      const r2 = hash1(Math.floor(this.tReal * 641), 43);
      switch (behavior.wander) {
        case 'subtle':
          this.wanderTarget.x = (r1 - 0.5) * 2 * amt * 0.9;
          this.wanderTarget.y = (r2 - 0.5) * 2 * amt * 0.6;
          this.nextWander = this.tReal + 1.6 + r1 * 3.2;
          break;
        case 'focus':
          this.wanderTarget.x = (r1 - 0.5) * amt;
          this.wanderTarget.y = (r2 - 0.5) * amt * 0.7;
          this.nextWander = this.tReal + 2.2 + r2 * 3.5;
          break;
        case 'shifty':
          this.shiftySide *= -1;
          this.wanderTarget.x = this.shiftySide * (0.35 + r1 * 0.45) * amt * 1.6;
          this.wanderTarget.y = (r2 - 0.5) * 0.3;
          this.nextWander = this.tReal + 0.7 + r1 * 1.1;
          break;
        case 'updrift':
          this.wanderTarget.x = (r1 - 0.5) * 1.6 * amt;
          this.wanderTarget.y = -(0.15 + r2 * 0.3) * amt;
          this.nextWander = this.tReal + 2 + r1 * 3;
          break;
        case 'down':
          this.wanderTarget.x = (r1 - 0.5) * amt;
          this.wanderTarget.y = (r2 - 0.3) * amt * 0.5;
          this.nextWander = this.tReal + 2.5 + r2 * 3;
          break;
      }
    }
    // saccade-quick approach to target, plus a whisper of continuous drift
    const k = Math.min(1, dt * 13);
    this.wanderCur.x += (this.wanderTarget.x - this.wanderCur.x) * k;
    this.wanderCur.y += (this.wanderTarget.y - this.wanderCur.y) * k;
  }

  private updateMicro(behavior: CellBehavior): void {
    if (this.reducedMotion || !behavior.micro) return;
    const t = this.tReal;
    if (t < this.nextMicro || t - this.stateChangedAt < 2.2) return;
    const r = hash1(Math.floor(t * 547), 61);
    const t0 = t;
    if (r < 0.3) {
      // small brow lift, like a quiet "hm"
      this.impulses.push({
        t0, dur: 1.1,
        fn: (k, imp) => {
          imp.browY -= Math.sin(Math.PI * Math.min(1, k * 1.4)) * 3.2;
        },
      });
    } else if (r < 0.55) {
      this.impulses.push({
        t0, dur: 1.6,
        fn: (k, imp) => {
          imp.mouthCurve += Math.sin(Math.PI * k) * 0.16;
        },
      });
    } else if (r < 0.8) {
      this.impulses.push({
        t0, dur: 1.8,
        fn: (k, imp) => {
          imp.tilt += Math.sin(Math.PI * k) * 2.4 * (r > 0.68 ? -1 : 1);
        },
      });
    } else {
      this.impulses.push({
        t0, dur: 0.9,
        fn: (k, imp) => {
          imp.eyeOpen += Math.sin(Math.PI * k) * 0.12;
        },
      });
    }
    this.nextMicro = t + 6 + hash1(Math.floor(t * 331), 67) * 9;
  }

  private updateImpulses(): void {
    const imp = this.imp;
    imp.x = 0; imp.y = 0; imp.scale = 0; imp.tilt = 0; imp.browY = 0; imp.mouthCurve = 0; imp.eyeOpen = 0;
    const t = this.tReal;
    for (let i = this.impulses.length - 1; i >= 0; i--) {
      const im = this.impulses[i];
      const k = (t - im.t0) / im.dur;
      if (k >= 1) {
        this.impulses.splice(i, 1);
        continue;
      }
      im.fn(Math.max(0, k), imp);
    }
  }

  private speechTarget(behavior: CellBehavior): number {
    const external = this.tReal - this.extIntensityAt < 0.35 ? this.extIntensity : null;
    const active = this.speaking || this.state === 'speaking' || external !== null;
    if (!active) return 0;
    if (external !== null) return external;
    if (!behavior.autoTalk && !this.speaking) return 0;
    // Internal pseudo-speech: syllables gated by phrase pauses.
    const t = this.tAnim;
    const syll = Math.max(0, fnoise(t * 6.4, 105));
    const gate = smoothstep(-0.35, 0.2, vnoise(t * 0.85, 108));
    return clamp01((0.3 + 0.85 * syll) * gate);
  }

  private tick(dt: number): void {
    const speedMul = 0.55 + 0.9 * this.energy;
    const ampMul = 0.6 + 0.8 * this.energy;
    const glowMul = 0.85 + 0.3 * this.energy;
    const motion = this.reducedMotion ? 0 : 1;

    this.tReal += dt;
    this.tAnim += dt * speedMul;
    const t = this.tAnim;
    const behavior = this.behavior();

    // 1. springs toward blended targets
    this.exprWeight.update(dt);
    if (this.exprWeight.value < 0.002 && this.exprWeight.target === 0) this.expression = null;
    this.applyTargets();
    for (const s of this.springs.values()) s.update(dt);

    // 2. behaviors
    const blink = this.updateBlink(behavior);
    this.updateWander(behavior, dt);
    this.updateMicro(behavior);
    this.updateImpulses();

    // 3. speech envelope: fast attack, slower release
    const sTarget = this.speechTarget(behavior);
    const tau = sTarget > this.sSmooth ? 0.045 : 0.16;
    this.sSmooth += (sTarget - this.sSmooth) * (1 - Math.exp(-dt / tau));
    const sp = this.sSmooth;

    const f = this.frame;
    const imp = this.imp;

    // 4. body & membrane -----------------------------------------------------
    const breath = Math.sin(t * Math.PI * 2 * this.p('breathRate'));
    const breathAmp = this.p('breathAmp') * ampMul * (motion === 0 ? 0.25 : 1);
    const squashX = 1 + breath * breathAmp * 0.7;
    const squashY = 1 - breath * breathAmp * 1.05;
    const wobble = (this.p('wobbleAmp') + sp * 1.9) * ampMul * motion;
    f.membraneD = membranePath(t, wobble, this.p('wobbleSpeed'), squashX, squashY, 1 + sp * 0.008);

    const shiver = this.p('shiver') * motion;
    const bob = Math.sin(t * Math.PI * 2 * this.p('bobRate')) * this.p('bobAmp') * ampMul * motion;
    const sway = fnoise(t * 0.13, 203) * this.p('swayAmp') * 1.9 * motion;
    const driftTilt = fnoise(t * 0.09, 207) * 1.3 * motion;
    const bx = this.p('bodyX') + sway + (shiver > 0 ? vnoise(this.tReal * 31, 211) * 2.3 * shiver : 0) + imp.x;
    const by = this.p('bodyY') + bob + (shiver > 0 ? vnoise(this.tReal * 27, 213) * 1.1 * shiver : 0) + imp.y;
    const bs = this.p('bodyScale') + sp * 0.012 * motion + imp.scale;
    const tilt = this.p('bodyTilt') + driftTilt + imp.tilt;
    f.bodyTransform =
      `translate(${bx.toFixed(2)},${by.toFixed(2)}) rotate(${tilt.toFixed(2)},${CELL_CX},${CELL_CY})` +
      ` translate(${CELL_CX},${CELL_CY}) scale(${bs.toFixed(4)}) translate(${-CELL_CX},${-CELL_CY})`;

    // 5. light ----------------------------------------------------------------
    const glow = this.p('glow') * glowMul;
    const rim = this.p('rim') * glowMul;
    f.atmosphereOpacity = clamp(0.42 * glow + sp * 0.1, 0, 0.8);
    f.atmosphereScale = 1 + breath * 0.02 + sp * 0.025;
    f.bloomOpacity = clamp(0.4 * rim + sp * 0.12, 0, 0.85);
    f.rimOpacity = clamp(0.85 * rim, 0.3, 1);
    f.innerGlowOpacity = clamp(0.2 * rim, 0, 0.5);
    f.coreLightOpacity = clamp(0.22 * this.p('coreLight') * glowMul + sp * 0.06, 0, 0.6);
    f.shadowOpacity = clamp(0.34 * glow, 0.12, 0.5);
    f.shadowScale = 1 - (by + bob) * 0.006;

    const shift = clamp(this.p('colorShift'), -1, 1);
    const tt = Math.abs(shift) * 0.85;
    const tint = shift < 0 ? ERR : OK;
    f.rimTop = rgbCss(mixRgb(RIM_TOP, tint.rimTop, tt));
    f.rimBot = rgbCss(mixRgb(RIM_BOT, tint.rimBot, tt));
    f.bloomColor = rgbCss(mixRgb(BLOOM, tint.bloom, tt));
    f.atmoColor = rgbCss(mixRgb(BLOOM, tint.bloom, tt * 0.9));
    f.nucGlowColor = rgbCss(mixRgb(NUC_GLOW, tint.nuc, tt * 0.7));
    const shadowA = rgbCss(mixRgb(RIM_BOT, tint.rimBot, tt), clamp(0.75 * rim, 0.2, 0.9));
    const shadowB = rgbCss(mixRgb(BLOOM, tint.bloom, tt), clamp(0.4 * rim + sp * 0.15, 0.1, 0.65));
    f.rimShadow = `drop-shadow(0 0 5px ${shadowA}) drop-shadow(0 0 18px ${shadowB})`;

    // 6. face -------------------------------------------------------------------
    const eyeOpen = clamp(this.p('eyeOpen') * blink + imp.eyeOpen, 0.03, 1.38);
    f.eyeOpenL = eyeOpen;
    f.eyeOpenR = eyeOpen;
    f.eyeCurve = clamp01(this.p('eyeCurve'));
    f.lidOpacity = smoothstep(0.17, 0.07, eyeOpen) * (1 - f.eyeCurve);
    const lookX = clamp(this.p('lookX') + this.wanderCur.x + vnoise(t * 0.5, 221) * 0.045 * motion, -1, 1);
    const lookY = clamp(this.p('lookY') + this.wanderCur.y + vnoise(t * 0.43, 223) * 0.04 * motion, -1, 1);
    f.pupilX = lookX * PUPIL_TRAVEL_X;
    f.pupilY = lookY * PUPIL_TRAVEL_Y;
    f.pupilScale = this.p('pupilScale') * (1 + fnoise(t * 0.3, 227) * 0.02);

    const browY = imp.browY;
    f.browLTransform =
      `translate(${BROW_L.x},${(BROW_L.y + this.p('browLY') + browY).toFixed(2)}) rotate(${this.p('browLRot').toFixed(2)})`;
    f.browRTransform =
      `translate(${BROW_R.x},${(BROW_R.y + this.p('browRY') + browY).toFixed(2)}) scale(-1,1) rotate(${this.p('browRRot').toFixed(2)})`;

    const artA = fnoise(this.tReal * 9.3, 231);
    const artB = vnoise(this.tReal * 7.1, 233);
    const open = clamp(this.p('mouthOpen') + sp * (0.62 + 0.3 * Math.max(0, artA)), 0, 1.15);
    const mw = this.p('mouthW') * (1 + sp * (-0.1 + 0.18 * artB));
    const round = clamp01(this.p('mouthRound') + sp * 0.3 * (0.5 + 0.5 * artB));
    f.mouthD = mouthPath({
      cx: MOUTH.x, cy: MOUTH.y, w: mw, open,
      curve: clamp(this.p('mouthCurve') + imp.mouthCurve, -1, 1), round,
    });
    f.mouthFillOpacity = smoothstep(0.05, 0.2, open + round * 0.35);
    f.mouthStrokeW = clamp(4.6 - open * 1.4, 3, 4.6);
    f.blushOpacity = clamp01(this.p('blush')) * 0.5;

    // 7. organelles ---------------------------------------------------------------
    const orgSpeed = this.p('orgSpeed');
    const od = motion; // organelle drift stops under reduced motion
    const nucPulse = 1 + this.p('nucPulse') * ampMul * Math.sin(t * Math.PI * 2 * 0.55) + sp * 0.05 * motion;
    const ns = (this.p('nucScale') * nucPulse).toFixed(4);
    const nx = NUCLEUS.x + fnoise(t * 0.16 * orgSpeed, 301) * 4 * od;
    const ny = NUCLEUS.y + fnoise(t * 0.13 * orgSpeed, 303) * 3.5 * od;
    f.nucleusTransform =
      `translate(${nx.toFixed(2)},${ny.toFixed(2)}) scale(${ns})`;
    f.nucleusGlow = clamp(this.p('nucGlow') * glowMul + sp * 0.4, 0, 1.2);

    const mx = MITO.x + fnoise(t * 0.12 * orgSpeed, 311) * 6 * od;
    const my = MITO.y + fnoise(t * 0.1 * orgSpeed, 313) * 5 * od;
    const mr = -33 + fnoise(t * 0.08 * orgSpeed, 317) * 9 * od;
    f.mitoTransform = `translate(${mx.toFixed(2)},${my.toFixed(2)}) rotate(${mr.toFixed(2)})`;

    const vx = VESICLE.x + fnoise(t * 0.15 * orgSpeed, 331) * 7 * od;
    const vy = VESICLE.y + fnoise(t * 0.12 * orgSpeed, 333) * 6 * od;
    const vr = 37 + fnoise(t * 0.1 * orgSpeed, 337) * 11 * od;
    f.vesicleTransform = `translate(${vx.toFixed(2)},${vy.toFixed(2)}) rotate(${vr.toFixed(2)})`;

    for (let i = 0; i < DOT_COUNT; i++) {
      const s = this.dotSeeds[i];
      const d = f.dots[i];
      const drift = 6 + (i % 3) * 2;
      d.x = CELL_CX + Math.cos(s.angle) * s.dist * 130 + fnoise(t * 0.14 * orgSpeed + s.phase, 401 + i) * drift * od;
      d.y = CELL_CY + Math.sin(s.angle) * s.dist * 130 + fnoise(t * 0.11 * orgSpeed + s.phase, 431 + i) * drift * od;
      d.o = 0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.7 + s.phase * 4)) + sp * 0.08;
    }

    // 8. extras ------------------------------------------------------------------
    const sparkle = clamp01(this.p('sparkle'));
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const s = this.sparkleSeeds[i];
      const sf = f.sparkles[i];
      if (sparkle < 0.01 || motion === 0) {
        sf.o = motion === 0 ? sparkle * 0.4 : 0;
        if (sf.o === 0) continue;
      }
      const a = s.angle + t * 0.12;
      const rr = s.dist + fnoise(t * 0.3 + s.phase, 501 + i) * 6;
      sf.x = CELL_CX + Math.cos(a) * rr;
      sf.y = CELL_CY + Math.sin(a) * rr * 0.96;
      const tw = 0.5 + 0.5 * Math.sin(t * 2.3 + s.phase * 7);
      sf.o = sparkle * (0.25 + 0.7 * tw);
      sf.s = 0.7 + 0.55 * tw;
    }

    f.ringOpacity = clamp01(this.p('ring')) * 0.5;
    f.ringRotation = (this.tAnim * 42 * this.p('ringSpeed')) % 360;

    const zzz = clamp01(this.p('zzz'));
    for (let i = 0; i < 3; i++) {
      const zp = ((t * 0.14 + (2 - i) * 0.34) % 1 + 1) % 1;
      const z = f.zzz[i];
      z.x = 302 + i * 3 + Math.sin(zp * 6.2 + i) * 5;
      z.y = 96 - zp * 46;
      z.o = zzz * smoothstep(0, 0.18, zp) * (1 - smoothstep(0.62, 0.98, zp));
      z.s = 0.65 + zp * 0.55 + i * 0.12;
    }

    this.onFrame(f);
  }
}
