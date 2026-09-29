import { ORB_ANIMATIONS } from './Orb.animations';

export const orbClass = {
  root: 'chimball-orb',
  halo: 'chimball-orb__halo',
  ground: 'chimball-orb__ground',
  trail: 'chimball-orb__trail',
  streak: 'chimball-orb__streak',
  bond: 'chimball-orb__bond',
  beam: 'chimball-orb__beam',
  sphere: 'chimball-orb__sphere',
  core: 'chimball-orb__core',
  specular: 'chimball-orb__specular',
  crescent: 'chimball-orb__crescent',
  glyph: 'chimball-orb__glyph',
  formula: 'chimball-orb__formula',
  charge: 'chimball-orb__charge',
  mark: 'chimball-orb__mark',
  fx: 'chimball-orb__fx',
  frost: 'chimball-orb__frost',
  ring: 'chimball-orb__ring',
  ringBurst: 'chimball-orb__ring--burst',
  flash: 'chimball-orb__flash',
  burst: 'chimball-orb__burst',
} as const;

const chargeMs = ORB_ANIMATIONS.charge.durationMs;
const bondMs = ORB_ANIMATIONS.bond.durationMs;
const reactMs = ORB_ANIMATIONS.react.durationMs;
const destroyMs = ORB_ANIMATIONS.destroy.durationMs;
const freezeMs = ORB_ANIMATIONS.freeze.durationMs;
const ionizeMs = ORB_ANIMATIONS.ionize.durationMs;

/**
 * One shared stylesheet for every orb.
 * Gradients and transforms only — no filter/blur stacks — so a full board
 * stays cheap on mobile GPUs.
 */
export const ORB_STYLESHEET = `
.${orbClass.root} {
  position: relative;
  width: var(--orb-size);
  height: var(--orb-size);
  display: inline-block;
  vertical-align: middle;
  flex: none;
  overflow: visible;
  isolation: isolate;
  color: #f4f8ff;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: scale 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  direction: ltr;
}

.${orbClass.root} *,
.${orbClass.root} *::before,
.${orbClass.root} *::after {
  box-sizing: border-box;
}

.${orbClass.halo} {
  position: absolute;
  inset: -28%;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(circle,
    color-mix(in srgb, var(--orb-glow) 62%, transparent) 18%,
    color-mix(in srgb, var(--orb-glow) 34%, transparent) 42%,
    transparent 68%);
  opacity: calc(0.62 + 0.34 * var(--orb-intensity));
}

.${orbClass.ground} {
  position: absolute;
  left: 16%;
  width: 68%;
  bottom: -12%;
  height: 20%;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(ellipse at center,
    color-mix(in srgb, var(--orb-glow) 50%, transparent) 0%,
    transparent 72%);
  opacity: calc(0.34 * var(--orb-intensity));
}

.${orbClass.root}[data-state="aiming"] .${orbClass.ground},
.${orbClass.root}[data-play="destroy"] .${orbClass.ground},
.${orbClass.root}[data-state="disabled"] .${orbClass.ground} {
  opacity: 0;
}

.${orbClass.sphere} {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(circle at 32% 26%,
      rgba(255, 255, 255, 0.55) 0%,
      rgba(255, 255, 255, 0.12) 14%,
      transparent 32%),
    radial-gradient(circle at 50% 46%,
      color-mix(in srgb, white 62%, var(--orb-core)) 0%,
      var(--orb-base) 34%,
      color-mix(in srgb, var(--orb-base) 78%, black) 70%,
      color-mix(in srgb, var(--orb-base) 48%, #07111c) 100%);
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--orb-rim) 55%, white),
    inset 0 8px 12px rgba(255, 255, 255, 0.28),
    inset 0 -14px 16px rgba(0, 0, 0, 0.28);
}

.${orbClass.core} {
  position: absolute;
  left: 50%;
  top: 56%;
  width: 72%;
  height: 72%;
  translate: -50% -50%;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 42%,
    color-mix(in srgb, white 78%, var(--orb-core)) 0%,
    color-mix(in srgb, var(--orb-base) 70%, white) 28%,
    transparent 64%);
  opacity: calc(0.72 + 0.22 * var(--orb-intensity));
}

.${orbClass.specular} {
  position: absolute;
  left: 15%;
  top: 9%;
  width: 46%;
  height: 22%;
  border-radius: 50%;
  z-index: 2;
  pointer-events: none;
  rotate: -26deg;
  background: linear-gradient(180deg,
    rgba(255, 255, 255, 0.96) 0%,
    rgba(255, 255, 255, 0.42) 42%,
    rgba(255, 255, 255, 0) 78%);
}

.${orbClass.specular}::after {
  content: "";
  position: absolute;
  left: 10%;
  top: 6%;
  width: 22%;
  height: 46%;
  border-radius: 50%;
  background: white;
}

.${orbClass.crescent} {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  z-index: 2;
  pointer-events: none;
  background: conic-gradient(from 208deg,
    transparent 0deg,
    transparent 14deg,
    rgba(255, 255, 255, 0.88) 40deg,
    rgba(255, 255, 255, 0.18) 68deg,
    transparent 102deg,
    transparent 360deg);
  -webkit-mask: radial-gradient(circle, transparent 63%, #000 68% 74%, transparent 79%);
  mask: radial-gradient(circle, transparent 63%, #000 68% 74%, transparent 79%);
}

.${orbClass.glyph} {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.${orbClass.glyph}::before {
  content: "";
  position: absolute;
  width: 54%;
  height: 54%;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(6, 12, 28, 0.22) 0%,
    rgba(6, 12, 28, 0.06) 52%,
    transparent 74%);
}

.${orbClass.formula} {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: flex-start;
  justify-content: center;
  max-width: 86%;
  font-family: Inter, "Segoe UI", "Noto Sans", system-ui, sans-serif;
  font-weight: 700;
  font-size: calc(var(--orb-size) * var(--orb-symbol-ratio));
  line-height: 0.86;
  letter-spacing: -0.04em;
  color: #f7fbff;
  white-space: nowrap;
  text-shadow:
    0 1px 1px rgba(0, 0, 0, 0.92),
    0 0 2px rgba(0, 0, 0, 0.85);
}

.${orbClass.root}[data-size="lg"] .${orbClass.formula},
.${orbClass.root}[data-size="xl"] .${orbClass.formula} {
  text-shadow:
    0 1px 1px rgba(0, 0, 0, 0.9),
    0 0 min(10px, calc(var(--orb-size) * 0.06)) color-mix(in srgb, var(--orb-glow) 80%, transparent);
}

.${orbClass.charge} {
  font-size: 0.58em;
  line-height: 1;
  margin-left: 0.04em;
  margin-top: 0.08em;
  font-weight: 700;
  color: #fff;
}

.${orbClass.mark} {
  position: relative;
  z-index: 1;
  width: calc(var(--orb-size) * 0.46);
  height: calc(var(--orb-size) * 0.46);
  display: block;
  overflow: visible;
  color: #f7fbff;
  filter: drop-shadow(0 1px 0.6px rgba(0, 0, 0, 0.85));
}

.${orbClass.fx},
.${orbClass.frost} {
  position: absolute;
  inset: -8%;
  z-index: 3;
  pointer-events: none;
  overflow: visible;
}

.${orbClass.frost} {
  inset: 0;
  border-radius: 50%;
  background:
    linear-gradient(118deg, transparent 40%, rgba(255, 255, 255, 0.34) 43%, transparent 47%),
    linear-gradient(64deg, transparent 28%, rgba(214, 242, 255, 0.22) 31%, transparent 35%),
    radial-gradient(circle at 50% 42%, rgba(226, 246, 255, 0.2), transparent 64%);
}

.${orbClass.frost} svg,
.${orbClass.fx} {
  width: 100%;
  height: 100%;
}

.${orbClass.fx} path,
.${orbClass.frost} path,
.${orbClass.fx} circle {
  fill: none;
  stroke: color-mix(in srgb, var(--orb-rim) 78%, white);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.${orbClass.frost} path {
  stroke: rgba(236, 249, 255, 0.78);
  stroke-width: 1.35;
}

.${orbClass.trail},
.${orbClass.bond} {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  z-index: 1;
  pointer-events: none;
}

.${orbClass.trail} {
  rotate: calc(var(--aim-angle) + 180deg);
}

.${orbClass.bond} {
  rotate: var(--bond-angle);
}

.${orbClass.streak} {
  position: absolute;
  top: 0;
  left: 0;
  height: calc(var(--orb-size) * 0.3);
  width: calc(var(--orb-size) * 1.15);
  translate: calc(var(--orb-size) * 0.22) -50%;
  border-radius: 999px;
  background: linear-gradient(90deg,
    #fff 0%,
    var(--orb-glow) 18%,
    color-mix(in srgb, var(--orb-glow) 55%, transparent) 55%,
    transparent 100%);
  -webkit-mask: linear-gradient(90deg, #000 0%, #000 20%, transparent 92%);
  mask: linear-gradient(90deg, #000 0%, #000 20%, transparent 92%);
}

.${orbClass.beam} {
  position: absolute;
  top: 0;
  left: 0;
  height: max(2px, calc(var(--orb-size) * 0.045));
  width: calc(var(--orb-size) * var(--bond-reach));
  translate: calc(var(--orb-size) * 0.4) -50%;
  border-radius: 999px;
  transform-origin: left center;
  background: linear-gradient(90deg,
    transparent 0%,
    color-mix(in srgb, var(--orb-glow) 30%, transparent) 10%,
    var(--orb-glow) 42%,
    color-mix(in srgb, var(--orb-core) 75%, white) 78%,
    transparent 100%);
}

.${orbClass.ring} {
  position: absolute;
  inset: -3%;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--orb-rim) 80%, white);
  opacity: 0;
  z-index: 1;
  pointer-events: none;
}

.${orbClass.ringBurst} {
  inset: -1%;
}

.${orbClass.flash} {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle,
    #fff 0%,
    color-mix(in srgb, var(--orb-core) 55%, white) 32%,
    transparent 68%);
}

.${orbClass.burst} {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.${orbClass.burst} span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--orb-size) * 0.065);
  height: calc(var(--orb-size) * 0.065);
  margin-left: calc(var(--orb-size) * -0.032);
  margin-top: calc(var(--orb-size) * -0.032);
  border-radius: 50%;
  background: color-mix(in srgb, var(--orb-core) 35%, white);
  opacity: 0;
}

.${orbClass.root}[data-state="selected"] {
  scale: 1.06;
  z-index: 2;
}

.${orbClass.root}[data-state="selected"] .${orbClass.halo} {
  opacity: calc(0.55 + 0.4 * var(--orb-intensity));
  scale: 1.08;
}

.${orbClass.root}[data-state="aiming"] .${orbClass.sphere} {
  translate: calc(cos(var(--aim-angle)) * 6%) calc(sin(var(--aim-angle)) * 6%);
}

.${orbClass.root}[data-state="charged"] .${orbClass.core},
.${orbClass.root}[data-state="ionized"] .${orbClass.core} {
  scale: 1.06;
  opacity: 1;
}

.${orbClass.root}[data-state="reacting"] .${orbClass.core} {
  scale: 1.16;
  opacity: 1;
}

.${orbClass.root}[data-state="reacting"] .${orbClass.halo} {
  opacity: 0.95;
}

.${orbClass.root}[data-state="reacting"] .${orbClass.ring}:not(.${orbClass.ringBurst}) {
  opacity: 0.55;
  scale: 1.08;
}

.${orbClass.root}[data-state="disabled"] {
  opacity: 0.5;
}

.${orbClass.root}[data-state="disabled"] .${orbClass.halo} {
  opacity: 0.06;
}

.${orbClass.root}[data-state="disabled"] .${orbClass.core} {
  opacity: 0.28;
}

.${orbClass.root}[data-state="disabled"] .${orbClass.glyph} {
  opacity: 0.55;
}

.${orbClass.root}[data-state="disabled"] .${orbClass.sphere} {
  box-shadow:
    inset 0 0 0 1px rgba(186, 198, 214, 0.4),
    inset 0 -14px 16px rgba(0, 0, 0, 0.5);
}

.${orbClass.root}[data-state="frozen"] .${orbClass.sphere} {
  box-shadow:
    inset 0 0 0 1.5px rgba(236, 248, 255, 0.92),
    inset 0 0 16px rgba(190, 230, 255, 0.28),
    inset 0 -14px 16px rgba(0, 12, 28, 0.42);
}

.${orbClass.root}[data-type="void"] .${orbClass.core} {
  background: radial-gradient(circle at 50% 50%,
    color-mix(in srgb, var(--orb-base) 35%, #140828) 0%,
    var(--orb-base) 42%,
    transparent 68%);
}

.${orbClass.root}[data-type="unstable"] .${orbClass.mark} {
  color: #2a1604;
  filter: none;
}

.${orbClass.fx} text {
  fill: #fff;
  stroke: none;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-weight: 700;
  font-size: 12px;
}

.${orbClass.root}[data-animated="true"][data-state="normal"][data-type="element"] .${orbClass.core} {
  animation: chimball-orb-kf-idle 3.8s ease-in-out infinite;
  animation-delay: calc(var(--orb-phase) * -1s);
}

.${orbClass.root}[data-animated="true"][data-type="catalyst"]:not([data-state="disabled"]):not([data-state="destroying"]) .${orbClass.core} {
  animation: chimball-orb-kf-flame 0.9s ease-in-out infinite;
  animation-delay: calc(var(--orb-phase) * -0.3s);
}

.${orbClass.root}[data-animated="true"][data-type="energy"]:not([data-state="disabled"]):not([data-state="destroying"]) .${orbClass.core} {
  animation: chimball-orb-kf-energy 2.4s ease-in-out infinite;
}

.${orbClass.root}[data-animated="true"][data-type="void"]:not([data-state="disabled"]):not([data-state="destroying"]) .${orbClass.core} {
  animation: chimball-orb-kf-void 2.8s ease-in-out infinite;
}

.${orbClass.root}[data-animated="true"][data-state="unstable"] .${orbClass.core},
.${orbClass.root}[data-animated="true"][data-type="unstable"]:not([data-state="frozen"]):not([data-state="disabled"]) .${orbClass.core} {
  animation: chimball-orb-kf-unstable 1.05s ease-in-out infinite;
}

.${orbClass.root}[data-animated="true"][data-state="ionized"] .${orbClass.fx},
.${orbClass.root}[data-animated="true"][data-state="charged"] .${orbClass.fx},
.${orbClass.root}[data-animated="true"][data-type="ion"]:not([data-state="frozen"]) .${orbClass.fx} {
  animation: chimball-orb-kf-flicker 1.7s ease-in-out infinite;
}

.${orbClass.root}[data-animated="true"][data-state="aiming"] .${orbClass.streak} {
  animation: chimball-orb-kf-trail 0.9s ease-in-out infinite;
}

.${orbClass.root}[data-play="charge"] .${orbClass.sphere} {
  animation: ${ORB_ANIMATIONS.charge.keyframes} ${chargeMs}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.${orbClass.root}[data-play="bond"] .${orbClass.sphere} {
  animation: ${ORB_ANIMATIONS.bond.keyframes} ${bondMs}ms cubic-bezier(0.16, 0.84, 0.32, 1) both;
}

.${orbClass.root}[data-play="bond"] .${orbClass.beam} {
  animation: chimball-orb-kf-beam ${bondMs}ms cubic-bezier(0.16, 0.84, 0.32, 1) both;
}

.${orbClass.root}[data-play="react"] .${orbClass.sphere} {
  animation: ${ORB_ANIMATIONS.react.keyframes} ${reactMs}ms cubic-bezier(0.22, 0.7, 0.2, 1) both;
}

.${orbClass.root}[data-play="react"] .${orbClass.ringBurst} {
  animation: chimball-orb-kf-ring ${reactMs}ms ease-out both;
}

.${orbClass.root}[data-play="react"] .${orbClass.flash} {
  animation: chimball-orb-kf-react-glow ${reactMs}ms ease-in both;
}

.${orbClass.root}[data-play="destroy"] .${orbClass.sphere} {
  animation: ${ORB_ANIMATIONS.destroy.keyframes} ${destroyMs}ms cubic-bezier(0.3, 0.7, 0.2, 1) both;
}

.${orbClass.root}[data-play="destroy"] .${orbClass.flash} {
  animation: chimball-orb-kf-flash ${destroyMs}ms ease-out both;
}

.${orbClass.root}[data-play="destroy"] .${orbClass.halo} {
  animation: chimball-orb-kf-fade ${destroyMs}ms linear both;
}

.${orbClass.root}[data-play="destroy"] .${orbClass.burst} span {
  animation: chimball-orb-kf-burst ${destroyMs}ms ease-out both;
  animation-delay: calc(90ms + var(--i) * 10ms);
}

.${orbClass.root}[data-play="freeze"] .${orbClass.sphere} {
  animation: ${ORB_ANIMATIONS.freeze.keyframes} ${freezeMs}ms ease-out both;
}

.${orbClass.root}[data-play="freeze"] .${orbClass.frost} {
  animation: chimball-orb-kf-frost ${freezeMs}ms ease-out both;
}

.${orbClass.root}[data-play="ionize"] .${orbClass.sphere} {
  animation: ${ORB_ANIMATIONS.ionize.keyframes} ${ionizeMs}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.${orbClass.root}[data-play="ionize"] .${orbClass.charge},
.${orbClass.root}[data-play="charge"] .${orbClass.charge} {
  animation: chimball-orb-kf-pop ${chargeMs}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.${orbClass.root}[data-animated="false"][data-state="destroying"] .${orbClass.sphere} {
  scale: 0.74;
}

.${orbClass.root}[data-animated="false"][data-state="destroying"] .${orbClass.flash} {
  opacity: 0.72;
}

.${orbClass.root}[data-animated="false"][data-state="destroying"] .${orbClass.burst} span {
  opacity: 0.9;
  translate:
    calc(cos(var(--a)) * var(--orb-size) * 0.62)
    calc(sin(var(--a)) * var(--orb-size) * 0.62);
}

.${orbClass.root}[data-play] .${orbClass.sphere} {
  will-change: scale, opacity;
}

@keyframes chimball-orb-kf-idle {
  0%, 100% { opacity: calc(0.5 + 0.35 * var(--orb-intensity)); }
  50% { opacity: calc(0.7 + 0.3 * var(--orb-intensity)); }
}

@keyframes chimball-orb-kf-flame {
  0%, 100% { scale: 1 1; opacity: 0.9; }
  50% { scale: 0.92 1.1; opacity: 1; }
}

@keyframes chimball-orb-kf-energy {
  0%, 100% { opacity: 0.82; scale: 0.96; }
  50% { opacity: 1; scale: 1.06; }
}

@keyframes chimball-orb-kf-void {
  0%, 100% { scale: 1; }
  50% { scale: 0.86; }
}

@keyframes chimball-orb-kf-unstable {
  0%, 100% { opacity: 0.78; scale: 1; }
  35% { opacity: 1; scale: 1.08; }
  55% { opacity: 0.7; scale: 0.96; }
}

@keyframes chimball-orb-kf-flicker {
  0%, 100% { opacity: 0.4; }
  45% { opacity: 1; }
  70% { opacity: 0.55; }
}

@keyframes chimball-orb-kf-trail {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@keyframes ${ORB_ANIMATIONS.charge.keyframes} {
  0% { scale: 1; }
  40% { scale: 1.08; }
  100% { scale: 1; }
}

@keyframes ${ORB_ANIMATIONS.bond.keyframes} {
  0% { scale: 1; }
  45% { scale: 1.04; }
  100% { scale: 1; }
}

@keyframes chimball-orb-kf-beam {
  0% { scale: 0 1; opacity: 0; }
  100% { scale: 1 1; opacity: 1; }
}

@keyframes ${ORB_ANIMATIONS.react.keyframes} {
  0% { scale: 1; }
  16% { scale: 1.02; }
  34% { scale: 0.96; }
  58% { scale: 1.08; }
  80% { scale: 1.12; }
  100% { scale: 1.04; }
}

@keyframes chimball-orb-kf-ring {
  0% { opacity: 0; scale: 0.72; }
  28% { opacity: 0; }
  55% { opacity: 0.85; }
  100% { opacity: 0; scale: 1.55; }
}

@keyframes chimball-orb-kf-react-glow {
  0%, 32% { opacity: 0; }
  62% { opacity: 0.28; }
  84% { opacity: 0.62; }
  100% { opacity: 0.18; }
}

@keyframes ${ORB_ANIMATIONS.destroy.keyframes} {
  0% { scale: 1; opacity: 1; }
  30% { scale: 0.68; opacity: 1; }
  46% { scale: 1.02; opacity: 1; }
  100% { scale: 1.16; opacity: 0; }
}

@keyframes chimball-orb-kf-flash {
  0%, 26% { opacity: 0; }
  44% { opacity: 0.95; }
  100% { opacity: 0; }
}

@keyframes chimball-orb-kf-fade {
  0%, 36% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes chimball-orb-kf-burst {
  0% { opacity: 0; translate: 0 0; }
  22% { opacity: 1; }
  100% {
    opacity: 0;
    translate:
      calc(cos(var(--a)) * var(--orb-size) * 0.58)
      calc(sin(var(--a)) * var(--orb-size) * 0.58);
  }
}

@keyframes ${ORB_ANIMATIONS.freeze.keyframes} {
  0% { scale: 1.04; }
  40% { scale: 0.97; }
  100% { scale: 1; }
}

@keyframes chimball-orb-kf-frost {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes ${ORB_ANIMATIONS.ionize.keyframes} {
  0% { scale: 1; }
  28% { scale: 0.94; }
  62% { scale: 1.07; }
  100% { scale: 1; }
}

@keyframes chimball-orb-kf-pop {
  0% { opacity: 0; translate: 0 3px; }
  55% { opacity: 1; translate: 0 0; }
  100% { opacity: 1; translate: 0 0; }
}

@media (prefers-reduced-motion: reduce) {
  .${orbClass.core},
  .${orbClass.fx},
  .${orbClass.streak} {
    animation: none !important;
  }
}
`;

const STYLE_ID = 'chimball-orb-styles';
let applied = false;

export function ensureOrbStyles(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (applied && existing?.textContent === ORB_STYLESHEET) return;
  const el = existing ?? document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = ORB_STYLESHEET;
  if (!existing) document.head.appendChild(el);
  applied = true;
}
