// ../gleam/src/character/types.ts
var AI_CHARACTER_STATES = [
  "idle",
  "curious",
  "happy",
  "sad",
  "surprised",
  "confused",
  "sleepy",
  "thinking",
  "listening",
  "speaking",
  "excited",
  "annoyed",
  "shocked"
];

// ../gleam/src/character/math.ts
var TAU = Math.PI * 2;
var vec = (x = 0, y = 0) => ({ x, y });
var clamp = (v, min, max) => v < min ? min : v > max ? max : v;
var lerp = (a, b, t) => a + (b - a) * t;
var damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
var rand = (min, max) => min + Math.random() * (max - min);
var randSign = () => Math.random() < 0.5 ? -1 : 1;
var chance = (p) => Math.random() < p;
var easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
var easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// ../gleam/src/character/spring.ts
var spring = (frequency, damping) => ({ frequency, damping });
var MAX_STEP = 1 / 120;
var Spring = class {
  value;
  velocity = 0;
  target;
  k;
  c;
  constructor(value, config) {
    this.value = value;
    this.target = value;
    this.k = 0;
    this.c = 0;
    this.configure(config);
  }
  configure(config) {
    const omega = TAU * Math.max(0.01, config.frequency);
    this.k = omega * omega;
    this.c = 2 * config.damping * omega;
  }
  /** Jump straight to a value with no motion. */
  snap(value) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
  /** Add an instantaneous velocity kick (used for bounces and pops). */
  impulse(velocity) {
    this.velocity += velocity;
  }
  update(dt) {
    let remaining = dt;
    while (remaining > 0) {
      const h = remaining > MAX_STEP ? MAX_STEP : remaining;
      remaining -= h;
      const accel = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
};
var SpringVec2 = class {
  x;
  y;
  constructor(x, y, config) {
    this.x = new Spring(x, config);
    this.y = new Spring(y, config);
  }
  configure(config) {
    this.x.configure(config);
    this.y.configure(config);
  }
  setTarget(x, y) {
    this.x.target = x;
    this.y.target = y;
  }
  snap(x, y) {
    this.x.snap(x);
    this.y.snap(y);
  }
  update(dt) {
    this.x.update(dt);
    this.y.update(dt);
  }
  get speed() {
    return Math.hypot(this.x.velocity, this.y.velocity);
  }
};

// ../gleam/src/character/states.ts
var NEUTRAL_POSE = {
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
  bottomSlant: 0
};
var pose = (p = {}) => ({ ...NEUTRAL_POSE, ...p });
var IDLE_BEHAVIOR = {
  gaze: {
    bias: vec(0, 0.02),
    spread: vec(0.34, 0.2),
    interval: [1.6, 4.2],
    centerChance: 0.35,
    tracking: 0.9,
    gain: 1,
    spring: spring(2.6, 0.72)
  },
  blink: { interval: [2.2, 6], closeMs: 75, holdMs: 35, openMs: 150, doubleChance: 0.12 },
  roll: 0,
  micro: { jitter: 35e-4, drift: 0.012 },
  breath: { amp: 6e-3, rate: 0.22 },
  poseSpring: spring(2, 0.8)
};
var behavior = (b = {}) => ({
  ...IDLE_BEHAVIOR,
  ...b,
  gaze: { ...IDLE_BEHAVIOR.gaze, ...b.gaze },
  blink: { ...IDLE_BEHAVIOR.blink, ...b.blink },
  micro: { ...IDLE_BEHAVIOR.micro, ...b.micro },
  breath: { ...IDLE_BEHAVIOR.breath, ...b.breath }
});
var every = (min, max, build) => ({
  interval: [min, max],
  build
});
var around = (center, spreadX, spreadY) => vec(center.x + rand(-spreadX, spreadX), center.y + rand(-spreadY, spreadY));
var snappy = spring(3.4, 0.6);
var soft = spring(1.2, 1);
var STATES = {
  idle: {
    pose: pose(),
    behavior: IDLE_BEHAVIOR,
    gestures: [
      // Occasional slow, thoughtful half-squint that releases.
      every(9, 18, () => ({
        duration: 1.6,
        keys: [
          { at: 0, pose: { topLid: 0.05, topCurve: 0.15, height: 0.97 }, poseSpring: soft },
          { at: 1, poseSpring: spring(2, 0.8) }
        ]
      }))
    ]
  },
  curious: {
    pose: {
      left: pose({ width: 1.02, height: 1.04, shiftEl: 0.01 }),
      right: pose({ width: 1.1, height: 1.12, shiftEl: 0.02 })
    },
    behavior: behavior({
      gaze: {
        spread: vec(0.3, 0.2),
        interval: [0.9, 2.2],
        centerChance: 0.2,
        tracking: 1,
        gain: 1.15,
        spring: spring(3.2, 0.62)
      },
      blink: { interval: [2.5, 5.5] },
      roll: 0.1,
      micro: { jitter: 4e-3, drift: 0.012 },
      poseSpring: spring(2.6, 0.7)
    }),
    gestures: [
      every(3, 6, (ctx) => {
        const a = around(ctx.bias, 0.4, 0.25);
        const b = vec(-a.x * 0.8, a.y * 0.5 + 0.1);
        return {
          duration: 1.1,
          keys: [
            { at: 0, gaze: a, gazeSpring: spring(3.6, 0.6) },
            { at: 0.32, gaze: b },
            { at: 0.7, gaze: "pointer" }
          ]
        };
      }),
      every(5, 9, () => ({
        duration: 0.9,
        keys: [
          { at: 0, right: { width: 1.18, height: 1.2 }, left: { topLid: 0.12 } },
          { at: 0.5, pose: {} }
        ]
      }))
    ]
  },
  happy: {
    pose: pose({ width: 1.12, height: 0.98, bottomLid: 0.38, bottomCurve: 0.85, shiftEl: 0.025 }),
    behavior: behavior({
      gaze: { bias: vec(0, 0.03), spread: vec(0.25, 0.15), interval: [1.8, 4], spring: spring(2.4, 0.7) },
      blink: { interval: [3, 7] },
      breath: { amp: 8e-3, rate: 0.24 },
      poseSpring: spring(2.6, 0.6)
    }),
    onEnter: () => ({
      duration: 0.5,
      keys: [
        { at: 0, pose: { height: 1.22, width: 0.96, shiftEl: 0.06, bottomLid: 0.2 }, poseSpring: spring(3.2, 0.55) },
        { at: 0.16, pose: {} }
      ]
    }),
    gestures: [
      every(3, 6, () => ({
        duration: 0.9,
        keys: [
          { at: 0, pose: { bottomLid: 0.5, bottomCurve: 1, width: 1.18, shiftEl: 0.04 } },
          { at: 0.5, pose: {} }
        ]
      }))
    ]
  },
  sad: {
    pose: pose({
      width: 0.94,
      height: 0.95,
      tilt: 0.14,
      topLid: 0.22,
      topCurve: 0.1,
      topSlant: 0.5,
      shiftEl: -0.03
    }),
    behavior: behavior({
      gaze: {
        bias: vec(0, -0.32),
        spread: vec(0.2, 0.1),
        interval: [3, 6],
        centerChance: 0.15,
        tracking: 0.45,
        gain: 0.7,
        spring: spring(1.4, 1)
      },
      blink: { interval: [3, 6], closeMs: 140, holdMs: 90, openMs: 260, doubleChance: 0.05 },
      micro: { jitter: 2e-3, drift: 6e-3 },
      breath: { amp: 0.01, rate: 0.16 },
      poseSpring: spring(1.3, 1)
    }),
    gestures: [
      // A sigh: sink lower, then slowly come back up.
      every(5, 9, (ctx) => ({
        duration: 2.4,
        keys: [
          { at: 0, gaze: vec(ctx.bias.x, -0.5), pose: { topLid: 0.45, height: 0.86 }, poseSpring: spring(0.9, 1) },
          { at: 1.3, gaze: "bias", poseSpring: spring(1.3, 1) }
        ]
      })),
      // Glance up at the viewer, then look away again.
      every(6, 11, () => ({
        duration: 2,
        keys: [
          { at: 0, gaze: "pointer", gazeSpring: spring(1.6, 0.9) },
          { at: 1.2, gaze: "bias", gazeSpring: spring(1.2, 1) }
        ]
      }))
    ]
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
        spring: spring(4, 0.55)
      },
      blink: { interval: [2.5, 5], closeMs: 60, holdMs: 20, openMs: 110 },
      micro: { jitter: 2e-3, drift: 5e-3 },
      poseSpring: spring(3.4, 0.5)
    }),
    onEnter: () => ({
      duration: 0.7,
      keys: [
        { at: 0, pose: { height: 0.7, width: 0.92 }, poseSpring: spring(6, 0.9) },
        { at: 0.07, pose: { width: 1.48, height: 1.24, shiftEl: 0.06 }, poseSpring: spring(3.6, 0.45) },
        { at: 0.3, pose: {} },
        { at: 0.55, blink: true }
      ]
    }),
    gestures: [
      every(3, 6, () => ({
        duration: 0.6,
        keys: [
          { at: 0, pose: { width: 1.42, height: 1.2 }, poseSpring: snappy },
          { at: 0.25, pose: {} }
        ]
      }))
    ]
  },
  confused: {
    pose: {
      left: pose({ width: 0.96, height: 0.98, topLid: 0.3, topCurve: 0.1, topSlant: -0.35, tilt: -0.06 }),
      right: pose({ width: 1.08, height: 1.1, tilt: 0.03 })
    },
    behavior: behavior({
      gaze: {
        bias: vec(0.1, 0.12),
        spread: vec(0.3, 0.15),
        interval: [0.8, 1.8],
        centerChance: 0.25,
        tracking: 0.7,
        gain: 0.9,
        spring: spring(3, 0.7)
      },
      blink: { interval: [2.5, 5], doubleChance: 0.25 },
      roll: 0.15,
      poseSpring: spring(2, 0.75)
    }),
    gestures: [
      every(2.5, 5, (ctx) => {
        const a = around(ctx.bias, 0.35, 0.12);
        const b = vec(-a.x, a.y + rand(-0.08, 0.08));
        return {
          duration: 1.4,
          keys: [
            { at: 0, gaze: a, gazeSpring: spring(3.4, 0.7) },
            { at: 0.28, gaze: b },
            { at: 0.6, gaze: a },
            { at: 0.95, gaze: "pointer" }
          ]
        };
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
            poseSpring: spring(1.6, 0.8)
          },
          { at: 0.1, blink: true }
        ]
      }))
    ]
  },
  sleepy: {
    pose: pose({
      width: 1.06,
      height: 0.9,
      topLid: 0.5,
      topCurve: 0.3,
      topSlant: 0.1,
      bottomLid: 0.04,
      shiftEl: -0.02
    }),
    behavior: behavior({
      gaze: {
        bias: vec(0, -0.22),
        spread: vec(0.18, 0.08),
        interval: [3.5, 7],
        centerChance: 0.2,
        tracking: 0.35,
        gain: 0.6,
        spring: spring(1.1, 1)
      },
      blink: { interval: [3, 6], closeMs: 260, holdMs: 220, openMs: 420, doubleChance: 0.05 },
      roll: 0.05,
      micro: { jitter: 2e-3, drift: 0.01 },
      breath: { amp: 0.012, rate: 0.14 },
      poseSpring: spring(1.2, 1)
    }),
    gestures: [
      // Nod off: lids sink slowly, then jolt back open.
      every(5, 9, () => ({
        duration: 3.8,
        keys: [
          { at: 0, pose: { topLid: 0.82, height: 0.84, shiftEl: -0.04 }, poseSpring: spring(0.45, 1), gaze: vec(0, -0.34), gazeSpring: spring(0.6, 1) },
          { at: 2.6, pose: { topLid: 0.42, height: 0.92, shiftEl: 0 }, poseSpring: spring(3.6, 0.6), gaze: "bias", gazeSpring: spring(2.4, 0.7) },
          { at: 2.9, blink: true },
          { at: 3.3, pose: {} }
        ]
      }))
    ]
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
        spring: spring(2.6, 0.78)
      },
      blink: { interval: [2.5, 5.5] },
      roll: 0.06,
      micro: { jitter: 3e-3, drift: 0.015 },
      poseSpring: spring(1.8, 0.85)
    }),
    gestures: [
      every(2.5, 5, (ctx) => {
        const side = ctx.gaze.x >= 0 ? -1 : 1;
        return {
          duration: 2.6,
          keys: [
            { at: 0, gaze: vec(0.45 * side, rand(0.3, 0.42)), gazeSpring: spring(2.8, 0.7) },
            { at: 0.08, blink: chance(0.5) },
            // Tiny flutter, gears turning, before the gaze settles again.
            { at: 1.7, gaze: vec(0.36 * side, 0.4), gazeSpring: spring(4.5, 0.7) },
            { at: 1.85, gaze: vec(0.5 * side, 0.34) },
            { at: 2, gaze: vec(0.1 * side, 0.42), gazeSpring: spring(2.8, 0.7) },
            { at: 2.4, gaze: vec(0.42 * side, 0.34) }
          ]
        };
      }),
      // Brief squint of concentration.
      every(6, 10, () => ({
        duration: 1.5,
        keys: [
          { at: 0, pose: { topLid: 0.32, topSlant: -0.35, width: 0.92 }, poseSpring: spring(1.6, 0.9) },
          { at: 0.9, pose: {} }
        ]
      }))
    ]
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
        spring: spring(2.4, 0.8)
      },
      blink: { interval: [3.5, 7], closeMs: 80, holdMs: 40, openMs: 160 },
      roll: 0.1,
      rollTowardPointer: true,
      // Very little jitter, but a slow horizontal scan as if reading the speaker's face.
      micro: { jitter: 15e-4, drift: 0.02 },
      breath: { amp: 6e-3, rate: 0.22 },
      poseSpring: spring(2.2, 0.8)
    }),
    gestures: [
      // Attentive nod: dip, then come up a little wider, as if taking it in.
      every(3, 5.5, () => ({
        duration: 1,
        keys: [
          { at: 0, pose: { shiftEl: -0.04, height: 0.98 }, poseSpring: spring(3.2, 0.7) },
          { at: 0.24, pose: { shiftEl: 0.035, height: 1.12, width: 1.1 } },
          { at: 0.6, pose: {} }
        ]
      }))
    ]
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
        spring: spring(2.8, 0.72)
      },
      blink: { interval: [2.5, 5.5], doubleChance: 0.1 },
      speech: true,
      poseSpring: spring(2.4, 0.7)
    }),
    gestures: [
      // Emphasis: eyes widen for a beat.
      every(3, 6, () => ({
        duration: 0.5,
        keys: [
          { at: 0, pose: { height: 1.12, width: 1.06, shiftEl: 0.02 }, poseSpring: spring(3.5, 0.55) },
          { at: 0.18, pose: {} }
        ]
      })),
      // Look away while "finding the words", then return.
      every(4, 8, () => ({
        duration: 1.1,
        keys: [
          { at: 0, gaze: vec(rand(0.25, 0.45) * randSign(), rand(0.15, 0.35)), gazeSpring: spring(3, 0.7) },
          { at: 0.55, gaze: "pointer" }
        ]
      }))
    ]
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
        spring: spring(3.6, 0.55)
      },
      blink: { interval: [1.8, 4], closeMs: 60, holdMs: 20, openMs: 110, doubleChance: 0.25 },
      micro: { jitter: 4e-3, drift: 0.01 },
      breath: { amp: 0.01, rate: 0.35 },
      poseSpring: spring(3, 0.5),
      bounce: [0.7, 1.5]
    }),
    onEnter: () => ({
      duration: 0.5,
      keys: [
        { at: 0, pose: { height: 1.32, width: 1.02, shiftEl: 0.07 }, poseSpring: spring(3.4, 0.5) },
        { at: 0.12, pose: {} }
      ]
    }),
    gestures: [
      every(4, 7, () => ({
        duration: 0.8,
        keys: [
          { at: 0, pose: { bottomLid: 0.32, bottomCurve: 0.8, width: 1.2 }, poseSpring: spring(3, 0.6) },
          { at: 0.45, pose: {} }
        ]
      }))
    ]
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
        spring: spring(2, 0.9)
      },
      blink: { interval: [3, 7], closeMs: 110, holdMs: 80, openMs: 200, doubleChance: 0.02 },
      micro: { jitter: 15e-4, drift: 5e-3 },
      breath: { amp: 5e-3, rate: 0.2 },
      poseSpring: spring(1.8, 0.9)
    }),
    gestures: [
      // Eye roll.
      every(4.5, 8, (ctx) => {
        const side = ctx.bias.x >= 0 ? 1 : -1;
        return {
          duration: 1.5,
          keys: [
            { at: 0, gaze: vec(0.35 * side, 0.5), gazeSpring: spring(2.4, 0.85), pose: { topLid: 0.3 } },
            { at: 0.3, gaze: vec(-0.3 * side, 0.52) },
            // Hang at the apex for a beat before dropping: the visual "sigh".
            { at: 0.72, gaze: vec(-0.45 * side, 0.1), blink: true },
            { at: 0.98, gaze: "bias" }
          ]
        };
      }),
      // Unimpressed glance at the viewer, then away again.
      every(3, 6, () => ({
        duration: 1.3,
        keys: [
          { at: 0, gaze: "pointer", gazeSpring: spring(2.2, 0.9) },
          { at: 0.75, gaze: "bias" }
        ]
      }))
    ]
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
        spring: spring(5, 0.8)
      },
      blink: { interval: [4.5, 8], closeMs: 50, holdMs: 15, openMs: 90, doubleChance: 0.6 },
      micro: { jitter: 0, drift: 2e-3 },
      breath: { amp: 3e-3, rate: 0.5 },
      poseSpring: spring(4, 0.45),
      tremor: 1
    }),
    onEnter: () => ({
      duration: 0.6,
      keys: [
        { at: 0, pose: { width: 0.85, height: 0.8, shiftEl: -0.02 }, poseSpring: spring(7, 0.9) },
        { at: 0.06, pose: { width: 1.64, height: 1.28, shiftAz: 0.05, shiftEl: 0.05 }, poseSpring: spring(4, 0.4) },
        { at: 0.3, pose: {} }
      ]
    }),
    gestures: [
      every(2.5, 5, () => ({
        duration: 0.5,
        keys: [
          { at: 0, pose: { width: 1.6, height: 1.24 }, poseSpring: spring(5, 0.5) },
          { at: 0.2, pose: {} }
        ]
      }))
    ]
  }
};

// ../gleam/src/character/noise.ts
var hash = (n) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
function noise1(t, seed = 0) {
  const offset = seed * 57.31;
  const i = Math.floor(t);
  const f2 = t - i;
  const u = f2 * f2 * (3 - 2 * f2);
  return lerp(hash(i + offset), hash(i + 1 + offset), u) * 2 - 1;
}
function fbm(t, seed = 0) {
  return noise1(t, seed) * 0.68 + noise1(t * 2.7 + 13.7, seed + 1) * 0.32;
}

// ../gleam/src/character/geometry.ts
function projectOnSphere(azimuth, elevation, radius) {
  const cosEl = Math.cos(elevation);
  const sinEl = Math.sin(elevation);
  const sinAz = Math.sin(azimuth);
  const cosAz = Math.cos(azimuth);
  const x = radius * cosEl * sinAz;
  const y = -radius * sinEl;
  const z = Math.max(0, cosEl * cosAz);
  const meridianAngle = Math.atan2(-sinEl * sinAz, cosEl);
  const radialAngle = Math.atan2(y, x);
  return { x, y, z, meridianAngle, radialAngle };
}
var mIdentity = () => [1, 0, 0, 1, 0, 0];
function mMultiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
var mTranslate = (x, y) => [1, 0, 0, 1, x, y];
function mRotate(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, -s, c, 0, 0];
}
var mScale = (sx, sy) => [sx, 0, 0, sy, 0, 0];
function mCompose(...ms) {
  let out = mIdentity();
  for (const m of ms) out = mMultiply(out, m);
  return out;
}
var f = (n) => Math.abs(n) < 1e-6 ? "0" : n.toFixed(4);
var mToString = (m) => `matrix(${f(m[0])} ${f(m[1])} ${f(m[2])} ${f(m[3])} ${f(m[4])} ${f(m[5])})`;
function pillPath(width, height) {
  const w = Math.max(0.01, width);
  const h = Math.max(0.01, height);
  const r = Math.min(w, h) / 2;
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  return `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}Z`;
}
function lidClipPath(width, height, side, lid) {
  const w = Math.max(0.01, width);
  const h = Math.max(0.01, height);
  const halfSpan = w * 0.8;
  const xInner = -side * halfSpan;
  const xOuter = side * halfSpan;
  const slantAmp = h * 0.22;
  const curveAmp = h * 0.9;
  const margin = h * 0.08;
  const yTop = -h / 2 - margin + lid.topLid * (h + margin);
  const yTopOuter = yTop + lid.topSlant * slantAmp;
  const yTopInner = yTop - lid.topSlant * slantAmp;
  const yTopCtrl = yTop + lid.topCurve * curveAmp;
  const yBot = h / 2 + margin - lid.bottomLid * (h + margin);
  const yBotOuter = yBot + lid.bottomSlant * slantAmp;
  const yBotInner = yBot - lid.bottomSlant * slantAmp;
  const yBotCtrl = yBot - lid.bottomCurve * curveAmp;
  const bo = Math.max(yBotOuter, yTopOuter);
  const bi = Math.max(yBotInner, yTopInner);
  return `M${f(xInner)} ${f(yTopInner)}Q0 ${f(yTopCtrl)} ${f(xOuter)} ${f(yTopOuter)}V${f(bo)}Q0 ${f(yBotCtrl)} ${f(xInner)} ${f(bi)}Z`;
}

// ../gleam/src/character/engine.ts
var DEFAULT_ENGINE_CONFIG = {
  radius: 96,
  center: 100,
  eyeWidth: 0.16,
  eyeHeight: 0.4,
  eyeSeparation: 0.33,
  eyeElevation: 0.06,
  maxYaw: 0.74,
  maxPitch: 0.5
};
var MERIDIAN_STRENGTH = 0.75;
var POSE_KEYS = Object.keys(NEUTRAL_POSE);
var ROLL_SPRING = spring(1.4, 0.9);
var SACCADE_THRESHOLD = 0.06;
var PURSUIT_RATE = 7;
var lerpPose = (a, b, t) => {
  const out = { ...a };
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
};
var EyeRig = class {
  side;
  seed;
  springs;
  pose = { ...NEUTRAL_POSE };
  constructor(side, initial, config) {
    this.side = side;
    this.seed = side < 0 ? 3.1 : 17.7;
    this.springs = {};
    for (const k of POSE_KEYS) this.springs[k] = new Spring(initial[k], config);
  }
  configure(config) {
    for (const k of POSE_KEYS) this.springs[k].configure(config);
  }
  setTargets(target) {
    for (const k of POSE_KEYS) this.springs[k].target = target[k];
  }
  update(dt) {
    for (const k of POSE_KEYS) this.pose[k] = this.springs[k].update(dt);
    return this.pose;
  }
};
var Blinker = class {
  running = false;
  elapsed = 0;
  close = 0.075;
  hold = 0.035;
  open = 0.15;
  queueDouble = false;
  eyeDelay = 0;
  get active() {
    return this.running;
  }
  start(b, speed = 1, allowDouble = true) {
    if (this.running) return;
    this.close = b.closeMs / 1e3 * speed;
    this.hold = b.holdMs / 1e3 * speed;
    this.open = b.openMs / 1e3 * speed;
    this.queueDouble = allowDouble && chance(b.doubleChance);
    this.eyeDelay = rand(0, 0.012);
    this.elapsed = 0;
    this.running = true;
  }
  /** Returns true on the frame a blink completes. */
  update(dt) {
    if (!this.running) return false;
    this.elapsed += dt;
    const total = this.close + this.hold + this.open + this.eyeDelay;
    if (this.elapsed >= total) {
      if (this.queueDouble) {
        this.queueDouble = false;
        this.elapsed = -0.07;
        this.open *= 0.9;
        return true;
      }
      this.running = false;
      return true;
    }
    return false;
  }
  /** Closure 0..1 for one eye; `side` staggers the two eyes by a few ms. */
  value(side) {
    if (!this.running) return 0;
    const t = this.elapsed - (side > 0 ? this.eyeDelay : 0);
    if (t <= 0) return 0;
    if (t < this.close) return easeInOutCubic(t / this.close);
    if (t < this.close + this.hold) return 1;
    const o = (t - this.close - this.hold) / this.open;
    return o >= 1 ? 0 : 1 - easeOutCubic(o);
  }
};
var SpeechEngine = class {
  level = new Spring(0, spring(7, 0.75));
  nextAt = 0;
  syllablesLeft = 0;
  releaseAt = 0;
  update(dt, now, external) {
    if (external !== null) {
      this.level.target = clamp(external, 0, 1);
      return this.level.update(dt);
    }
    if (now >= this.nextAt) {
      if (this.syllablesLeft <= 0) {
        this.syllablesLeft = Math.floor(rand(3, 9));
        this.nextAt = now + rand(0.25, 0.7);
      } else {
        this.syllablesLeft -= 1;
        this.level.target = rand(0.55, 1);
        this.releaseAt = now + rand(0.06, 0.1);
        this.nextAt = now + rand(0.16, 0.26);
      }
    }
    if (now >= this.releaseAt) this.level.target = 0.08;
    return this.level.update(dt);
  }
  reset() {
    this.level.snap(0);
    this.nextAt = 0;
    this.syllablesLeft = 0;
  }
};
var CharacterEngine = class {
  config;
  hooks;
  time = 0;
  stateName = "idle";
  def = STATES.idle;
  intensity = 1;
  motionScale = 1;
  audioLevel = null;
  // Pointer, in units of body radii relative to the centre (y down).
  pointer = null;
  pointerAt = -Infinity;
  lookAt = null;
  // Gaze pipeline.
  gaze;
  intent = vec(0, 0);
  wanderTarget = vec(0, 0);
  nextWanderAt = 0;
  glanceTarget = null;
  glanceUntil = 0;
  pendingSince = -1;
  pendingLatency = 0.08;
  anticipation = vec(0, 0);
  anticipationUntil = 0;
  correction = vec(0, 0);
  correctionAt = Infinity;
  correctionUntil = 0;
  roll = new Spring(0, ROLL_SPRING);
  eyes;
  blinker = new Blinker();
  nextBlinkAt = 0;
  speech = new SpeechEngine();
  bounce = new Spring(0, spring(3, 0.22));
  nextBounceAt = 0;
  gesture = null;
  gestureTimers = [];
  frame;
  constructor(config = {}, hooks = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.hooks = hooks;
    const b = this.def.behavior;
    this.gaze = new SpringVec2(0, 0, b.gaze.spring);
    const initial = this.basePose();
    this.eyes = [new EyeRig(-1, initial.left, b.poseSpring), new EyeRig(1, initial.right, b.poseSpring)];
    this.frame = {
      left: { transform: "", pill: "", lid: "" },
      right: { transform: "", pill: "", lid: "" }
    };
    this.scheduleBlink();
    this.resetGestureTimers();
    this.nextWanderAt = this.time + 0.4;
    this.update(0);
  }
  // ---------------------------------------------------------------- inputs
  /** Swap callbacks after construction (React re-renders pass new closures). */
  setHooks(hooks) {
    this.hooks = hooks;
  }
  setState(name) {
    if (name === this.stateName) return;
    this.stateName = name;
    this.def = STATES[name] ?? STATES.idle;
    const b = this.def.behavior;
    this.gaze.configure(b.gaze.spring);
    for (const eye of this.eyes) eye.configure(b.poseSpring);
    this.gesture = null;
    this.resetGestureTimers();
    this.nextWanderAt = this.time + rand(0.3, 0.9);
    this.nextBlinkAt = Math.min(this.nextBlinkAt, this.time + rand(0.6, 1.6));
    this.nextBounceAt = this.time + 0.2;
    this.speech.reset();
    if (this.def.onEnter) this.play(this.def.onEnter(this.context()));
  }
  setIntensity(value) {
    this.intensity = clamp(value, 0, 1);
  }
  setMotionScale(value) {
    this.motionScale = clamp(value, 0, 1);
  }
  setAudioLevel(level) {
    this.audioLevel = level;
  }
  /** Pointer position relative to the body centre, in body radii (y down). */
  setPointer(p) {
    this.pointer = p ? { x: p.x, y: p.y } : null;
    if (p) this.pointerAt = this.time;
  }
  /** Programmatic gaze in the range -1..1 on each axis. Overrides the pointer. */
  setLookAt(p) {
    this.lookAt = p ? { x: clamp(p.x, -1, 1), y: clamp(p.y, -1, 1) } : null;
  }
  blink() {
    this.blinker.start(this.def.behavior.blink, 1, false);
  }
  /** Reaction to being tapped: a quick squash and a double blink. */
  poke() {
    this.play({
      duration: 0.7,
      keys: [
        { at: 0, pose: { height: 0.78, width: 1.16, shiftEl: -0.015 }, poseSpring: spring(6, 0.7) },
        { at: 0.09, pose: { height: 1.16, width: 1.06, shiftEl: 0.03 }, poseSpring: spring(3.6, 0.5), blink: true },
        { at: 0.3, pose: {} },
        { at: 0.42, blink: true }
      ]
    });
  }
  play(gesture) {
    if (this.gesture) {
      this.gaze.configure(this.def.behavior.gaze.spring);
      for (const eye of this.eyes) eye.configure(this.def.behavior.poseSpring);
    }
    this.gesture = {
      gesture,
      startedAt: this.time,
      keyIndex: -1,
      gaze: void 0,
      gazeSpring: void 0,
      poseSpring: void 0,
      roll: void 0,
      both: {},
      left: {},
      right: {}
    };
  }
  /**
   * Advance time without rendering every step, so a character that was
   * paused (off-screen, hidden tab) resumes already settled into its pose.
   */
  settle(seconds) {
    const step = 1 / 30;
    for (let t = 0; t < seconds; t += step) this.update(step);
    return this.frame;
  }
  // ---------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    const now = this.time;
    const b = this.def.behavior;
    const ms = this.motionScale;
    this.updateGesture(now);
    this.updateGaze(dt, now, b);
    this.updateBlink(dt, now, b);
    const speech = b.speech ? this.speech.update(dt, now, this.audioLevel) : 0;
    const bounce = this.updateBounce(dt, now, b) * ms;
    const rollTarget = this.resolveRoll(b) * this.intensity;
    this.roll.target = rollTarget;
    this.roll.update(dt);
    const base = this.basePose();
    const targets = [base.left, base.right];
    if (this.gesture) {
      targets[0] = { ...targets[0], ...this.gesture.both, ...this.gesture.left };
      targets[1] = { ...targets[1], ...this.gesture.both, ...this.gesture.right };
    }
    const converge = this.convergence();
    const breath = Math.sin(TAU * b.breath.rate * now) * b.breath.amp * ms;
    const driftAz = fbm(now * 0.25, 100) * b.micro.drift * ms;
    const driftEl = fbm(now * 0.21, 200) * b.micro.drift * ms;
    const tremor = (b.tremor ?? 0) * ms;
    for (let i = 0; i < 2; i++) {
      const eye = this.eyes[i];
      eye.setTargets(targets[i]);
      const p = eye.update(dt);
      const s = eye.side;
      const blink = this.blinker.value(s);
      const seed = eye.seed;
      const jitterAz = fbm(now * 1.7, seed) * b.micro.jitter * ms;
      const jitterEl = fbm(now * 1.9, seed + 11) * b.micro.jitter * ms;
      const tremorAz = tremor * 45e-4 * noise1(now * 23, seed + 20);
      const tremorEl = tremor * 35e-4 * noise1(now * 19, seed + 30);
      const wobbleW = 1 + 0.012 * noise1(now * 0.9, seed + 5) * ms;
      const wobbleH = 1 + 0.012 * noise1(now * 0.8, seed + 7) * ms;
      const az = this.gaze.x.value + s * (this.config.eyeSeparation + p.shiftAz - converge) + driftAz + jitterAz + tremorAz;
      const el = this.gaze.y.value + this.config.eyeElevation + p.shiftEl + breath + driftEl + jitterEl + tremorEl + bounce * 0.02 + speech * 0.012;
      const widthMul = p.width * wobbleW * (1 + 0.22 * blink) * (1 - 0.05 * bounce) * (1 + 0.02 * speech);
      const heightMul = p.height * wobbleH * (1 - 0.94 * blink) * (1 + 0.1 * bounce) * (1 + 0.07 * speech) * (1 + breath * 1.5);
      this.renderEye(i === 0 ? this.frame.left : this.frame.right, s, az, el, widthMul, heightMul, p, blink);
    }
    return this.frame;
  }
  // ---------------------------------------------------------------- pieces
  basePose() {
    const p = this.def.pose;
    const left = "left" in p ? p.left : p;
    const right = "right" in p ? p.right : p;
    if (this.intensity >= 1) return { left, right };
    return {
      left: lerpPose(NEUTRAL_POSE, left, this.intensity),
      right: lerpPose(NEUTRAL_POSE, right, this.intensity)
    };
  }
  context() {
    return {
      bias: this.def.behavior.gaze.bias,
      pointer: this.pointerGaze(),
      gaze: vec(this.gaze.x.value, this.gaze.y.value)
    };
  }
  resetGestureTimers() {
    this.gestureTimers = this.def.gestures.map((g) => this.time + rand(g.interval[0], g.interval[1]) * 0.7);
  }
  updateGesture(now) {
    const g = this.gesture;
    if (g) {
      const elapsed = now - g.startedAt;
      if (elapsed >= g.gesture.duration) {
        this.gesture = null;
        this.gaze.configure(this.def.behavior.gaze.spring);
        for (const eye of this.eyes) eye.configure(this.def.behavior.poseSpring);
      } else {
        const keys = g.gesture.keys;
        while (g.keyIndex + 1 < keys.length && keys[g.keyIndex + 1].at <= elapsed) {
          g.keyIndex += 1;
          this.applyKey(g, keys[g.keyIndex]);
        }
      }
    }
    if (this.gesture) return;
    const specs = this.def.gestures;
    for (let i = 0; i < specs.length; i++) {
      if (now >= this.gestureTimers[i]) {
        const spec = specs[i];
        this.gestureTimers[i] = now + rand(spec.interval[0], spec.interval[1]);
        this.play(spec.build(this.context()));
        break;
      }
    }
  }
  applyKey(g, key) {
    if (key.gaze !== void 0) g.gaze = key.gaze;
    if (key.gazeSpring) {
      g.gazeSpring = key.gazeSpring;
      this.gaze.configure(key.gazeSpring);
    }
    if (key.pose || key.left || key.right) {
      g.both = key.pose ?? {};
      g.left = key.left ?? {};
      g.right = key.right ?? {};
    }
    if (key.poseSpring) {
      g.poseSpring = key.poseSpring;
      for (const eye of this.eyes) eye.configure(key.poseSpring);
    }
    if (key.roll !== void 0) g.roll = key.roll;
    if (key.blink) this.blinker.start(this.def.behavior.blink, 1, false);
  }
  pointerSource() {
    if (this.lookAt) return { x: this.lookAt.x * 1.8, y: this.lookAt.y * 1.8 };
    if (this.pointer && this.time - this.pointerAt < 3.5) return this.pointer;
    return null;
  }
  pointerGaze() {
    const p = this.pointerSource();
    if (!p) return null;
    const gain = this.def.behavior.gaze.gain;
    return vec(
      clamp(Math.atan(p.x * 0.6) * gain, -this.config.maxYaw, this.config.maxYaw),
      clamp(Math.atan(-p.y * 0.6) * gain, -this.config.maxPitch, this.config.maxPitch)
    );
  }
  convergence() {
    const p = this.pointerSource();
    if (!p) return 0;
    const d = Math.hypot(p.x, p.y);
    return clamp((1.6 - d) / 1.6, 0, 1) * 0.06;
  }
  resolveRoll(b) {
    if (this.gesture?.roll !== void 0) return this.gesture.roll;
    if (!b.rollTowardPointer) return b.roll;
    const pg = this.pointerGaze();
    const x = pg ? pg.x : this.gaze.x.value;
    return b.roll * (x >= 0 ? 1 : -1);
  }
  resolveGazeTarget(target, pointer, b) {
    if (target === "pointer") return pointer ?? vec(0, 0);
    if (target === "center") return vec(0, 0);
    if (target === "bias") return b.gaze.bias;
    return target;
  }
  updateGaze(dt, now, b) {
    const pointer = this.pointerGaze();
    if (now >= this.nextWanderAt) {
      if (pointer) {
        if (chance(0.45) && this.motionScale > 0.5) {
          this.glanceTarget = vec(
            clamp(pointer.x + rand(-0.35, 0.35), -this.config.maxYaw, this.config.maxYaw),
            clamp(pointer.y + rand(-0.2, 0.25), -this.config.maxPitch, this.config.maxPitch)
          );
          this.glanceUntil = now + rand(0.35, 0.8);
        }
        this.nextWanderAt = now + rand(b.gaze.interval[0], b.gaze.interval[1]) * 2.2;
      } else {
        this.wanderTarget = chance(b.gaze.centerChance) ? vec(rand(-0.04, 0.04), rand(-0.03, 0.03)) : vec(
          b.gaze.bias.x + rand(-b.gaze.spread.x, b.gaze.spread.x),
          b.gaze.bias.y + rand(-b.gaze.spread.y, b.gaze.spread.y)
        );
        this.nextWanderAt = now + rand(b.gaze.interval[0], b.gaze.interval[1]);
      }
    }
    let desired;
    if (this.gesture?.gaze !== void 0) {
      desired = this.resolveGazeTarget(this.gesture.gaze, pointer, b);
    } else if (this.glanceTarget && now < this.glanceUntil) {
      desired = this.glanceTarget;
    } else if (pointer) {
      const t = b.gaze.tracking;
      desired = vec(lerp(this.wanderTarget.x, pointer.x, t), lerp(this.wanderTarget.y, pointer.y, t));
    } else {
      desired = this.wanderTarget;
    }
    if (now >= this.glanceUntil) this.glanceTarget = null;
    const dx = desired.x - this.intent.x;
    const dy = desired.y - this.intent.y;
    const d = Math.hypot(dx, dy);
    if (d > SACCADE_THRESHOLD) {
      if (this.pendingSince < 0) {
        this.pendingSince = now;
        this.pendingLatency = rand(0.05, 0.12);
      }
      if (now - this.pendingSince >= this.pendingLatency) {
        this.pendingSince = -1;
        this.intent = { ...desired };
        if (d > 0.22 && this.motionScale > 0.5) {
          const k = Math.min(0.045, d * 0.14);
          this.anticipation = vec(-dx / d * k, -dy / d * k);
          this.anticipationUntil = now + 0.065;
        }
        if (d > 0.42 && chance(0.25)) this.blinker.start(b.blink, 0.85, false);
        const c = Math.min(0.022, d * 0.06);
        this.correction = vec(rand(-c, c), rand(-c, c));
        this.correctionAt = now + rand(0.18, 0.26);
        this.correctionUntil = this.correctionAt + rand(0.3, 0.5);
      }
    } else {
      this.pendingSince = -1;
      this.intent.x = damp(this.intent.x, desired.x, PURSUIT_RATE, dt);
      this.intent.y = damp(this.intent.y, desired.y, PURSUIT_RATE, dt);
    }
    let tx = this.intent.x;
    let ty = this.intent.y;
    if (now < this.anticipationUntil) {
      tx += this.anticipation.x;
      ty += this.anticipation.y;
    }
    if (now >= this.correctionAt && now < this.correctionUntil) {
      tx += this.correction.x;
      ty += this.correction.y;
    }
    const limited = this.limitGaze(tx, ty);
    this.gaze.setTarget(limited.x, limited.y);
    this.gaze.update(dt);
  }
  /** Keep the gaze inside an ellipse so diagonal corners are no more extreme than the axes. */
  limitGaze(yaw, pitch) {
    const nx = yaw / this.config.maxYaw;
    const ny = pitch / this.config.maxPitch;
    const n = Math.hypot(nx, ny);
    if (n <= 1) return vec(yaw, pitch);
    return vec(yaw / n, pitch / n);
  }
  scheduleBlink() {
    const [min, max] = this.def.behavior.blink.interval;
    this.nextBlinkAt = this.time + rand(min, max);
  }
  updateBlink(dt, now, b) {
    if (!this.blinker.active && now >= this.nextBlinkAt) {
      this.blinker.start(b.blink);
      this.scheduleBlink();
    }
    if (this.blinker.update(dt)) {
      this.hooks.onBlink?.();
    }
  }
  updateBounce(dt, now, b) {
    if (b.bounce && now >= this.nextBounceAt) {
      this.bounce.impulse(rand(2.4, 3.6));
      this.nextBounceAt = now + rand(b.bounce[0], b.bounce[1]);
    }
    return this.bounce.update(dt);
  }
  renderEye(out, side, az, el, widthMul, heightMul, p, blink) {
    const { radius, center } = this.config;
    const sample = projectOnSphere(az, el, radius);
    const foreshorten = Math.max(0.15, sample.z);
    const perspective = 0.86 + 0.14 * sample.z;
    const w = radius * this.config.eyeWidth * widthMul;
    const h = radius * this.config.eyeHeight * heightMul;
    const closingDrop = blink * radius * this.config.eyeHeight * p.height * 0.12;
    const m = mCompose(
      mTranslate(center, center),
      mRotate(this.roll.value),
      mTranslate(sample.x, sample.y),
      mRotate(sample.radialAngle),
      mScale(foreshorten, 1),
      mRotate(-sample.radialAngle),
      mRotate(sample.meridianAngle * MERIDIAN_STRENGTH - side * p.tilt),
      mScale(perspective, perspective),
      mTranslate(0, closingDrop)
    );
    out.transform = mToString(m);
    out.pill = pillPath(w, h);
    out.lid = lidClipPath(w, h, side, p);
  }
};

// ../gleam/src/character/canvasRender.ts
var BODY_COLOR = "#F5F1EA";
var EYE_COLOR = "#0E0E10";
var MATRIX_RE = /matrix\(([^)]+)\)/;
function parseMatrix(transform) {
  const m = transform.match(MATRIX_RE);
  if (!m) return [1, 0, 0, 1, 0, 0];
  const p = m[1].trim().split(/[\s,]+/).map(Number);
  if (p.length < 6 || p.some((n) => Number.isNaN(n))) return [1, 0, 0, 1, 0, 0];
  return [p[0], p[1], p[2], p[3], p[4], p[5]];
}
function drawEye(ctx, eye, eyeColor) {
  if (!eye.pill || !eye.transform) return;
  const [a, b, c, d, e, f2] = parseMatrix(eye.transform);
  ctx.save();
  ctx.transform(a, b, c, d, e, f2);
  try {
    const lid = new Path2D(eye.lid);
    ctx.clip(lid);
    const pill = new Path2D(eye.pill);
    ctx.fillStyle = eyeColor;
    ctx.fill(pill);
  } catch {
  }
  ctx.restore();
}
function drawCharacter(ctx, engine, opts = {}) {
  const view = DEFAULT_ENGINE_CONFIG.center * 2;
  const dest = opts.destSize ?? view;
  const color = opts.color ?? BODY_COLOR;
  const eyeColor = opts.eyeColor ?? EYE_COLOR;
  const { radius, center } = engine.config;
  const frame2 = engine.frame;
  ctx.save();
  ctx.clearRect(0, 0, dest, dest);
  if (dest !== view) ctx.scale(dest / view, dest / view);
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();
  drawEye(ctx, frame2.left, eyeColor);
  drawEye(ctx, frame2.right, eyeColor);
  ctx.restore();
  ctx.restore();
}

// ../gleam/src/character/ticker.ts
var subscribers = /* @__PURE__ */ new Set();
var rafId = 0;
var last = 0;
var MAX_DT = 1 / 20;
function frame(now) {
  const dt = Math.min((now - last) / 1e3, MAX_DT);
  last = now;
  for (const fn of subscribers) fn(dt);
  rafId = subscribers.size > 0 ? requestAnimationFrame(frame) : 0;
}
function subscribe(fn) {
  subscribers.add(fn);
  if (!rafId) {
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
export {
  AI_CHARACTER_STATES,
  BODY_COLOR,
  CharacterEngine,
  DEFAULT_ENGINE_CONFIG,
  EYE_COLOR,
  NEUTRAL_POSE,
  STATES,
  drawCharacter,
  parseMatrix,
  subscribe as subscribeTicker
};
