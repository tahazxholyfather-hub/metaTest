# AI Character

A production-ready React + TypeScript character that is, visually, almost nothing: one flat circle and two black eyes. No mouth, no eyebrows, no limbs, no shading. Every emotion and the entire illusion of the body being a 3D ball come from how the eyes move, deform and sit on the surface.

```tsx
import { AICharacter } from './character'

<AICharacter state="thinking" interactive />
```

## Running the demo

```bash
npm install
npm run dev
```

The playground lets you switch between all states, toggle pointer tracking, scrub intensity, aim the gaze, change colours, and see the generated JSX. `?state=curious` deep-links to a state.

## The illusion

The body is a plain `<circle>` that never transforms. Each eye is treated as a decal glued to an imaginary unit sphere and projected orthographically onto the flat disc:

- **Position** follows the great circle: the eye slides further and the spacing compresses as the gaze turns.
- **Foreshortening** squeezes the eye along the radial direction by `cos(angle from view axis)`, so the far eye thins out toward the rim.
- **Meridian tilt** rotates the eye's vertical axis to follow the local meridian, so eyes converge toward the poles when looking up or down.
- **Depth scale** shrinks eyes slightly toward the rim.
- **Vergence** pulls the eyes together when the pointer is close to the face.

All of that lives in `src/character/geometry.ts` and the `renderEye` step of `src/character/engine.ts`.

## The animation system

`CharacterEngine` runs a small physics-driven rig every frame (one shared `requestAnimationFrame` loop for every instance on the page):

- **Gaze**: a saccade model, not a tween. A reaction latency, an anticipation pull-back on large jumps, an under-damped spring for overshoot, and a scheduled micro-correction afterwards. Small pointer movements are followed with smooth pursuit instead. Wandering targets, "glances" away from the pointer, and state-specific gaze biases (thinking looks up and to the side, sad looks down, etc.).
- **Pose springs**: 11 shape parameters per eye (width, height, tilt, surface shift, two lids with curvature and slant) each on its own spring; every state ships its own spring stiffness/damping so `surprised` pops with overshoot while `sleepy` oozes.
- **Blinks**: fast ease-in close, hold, slower ease-out open; optional double blinks; per-state timing; occasional blink triggered by big saccades; a few milliseconds of stagger between eyes.
- **Micro-life**: per-eye fractal-noise jitter, shared slow drift, breathing, tiny independent size wobble, head-tilt "roll" of the whole eye pair.
- **Gestures**: keyframed sequences with per-key spring overrides (sighs, eye rolls, nods, nodding off and jolting awake, darting looks, beaming) scheduled at random intervals per state, plus `onEnter` gestures for state transitions.
- **Procedural layers**: speech rhythm (synthesised syllables or a real `audioLevel`), bounce (excited), tremor (shocked).

## API

```tsx
<AICharacter
  state="listening"     // see AI_CHARACTER_STATES
  interactive           // follow the pointer/finger, react to taps
  size={320}            // number (px) or any CSS size; defaults to 100% width
  color="#F5F1EA"
  eyeColor="#0E0E10"
  intensity={0.8}       // 0..1 blend from neutral to the full expression
  lookAt={{ x: 0.4, y: -0.2 }} // -1..1 each axis (y down), overrides the pointer
  audioLevel={level}    // 0..1, drives the speaking rhythm from real audio
  reducedMotion={false} // defaults to the OS preference
  onBlink={() => {}}
  ref={handle}          // handle.blink(), handle.poke()
/>
```

States: `idle`, `curious`, `happy`, `sad`, `surprised`, `confused`, `sleepy`, `thinking`, `listening`, `speaking`, `excited`, `annoyed`, `shocked`.

Other exports: `AI_CHARACTER_STATES`, `STATES` (the presets, if you want to inspect or fork them), `CharacterEngine` (framework-agnostic; drive it from any renderer), and the relevant types.

## Notes

- Zero dependencies beyond React. The component is a single SVG; copy `src/character/` into any React 19 project.
- Rendering writes SVG attributes directly from the frame loop, so React never re-renders per frame.
- Instances pause when off-screen (IntersectionObserver) and settle into their pose before resuming, so nothing is ever caught mid-transition when it scrolls into view.
- `prefers-reduced-motion` tones down micro-movement, glances and anticipation while keeping the essentials (state expression, tracking, blinks).
- Works with mouse and touch (`pointer` events); tapping the body triggers a small reaction.
