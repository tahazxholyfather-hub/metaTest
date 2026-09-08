# Met

Met is the AI's official identity in MetaTest: one flat circle and two black
eyes. Every emotion — and the illusion that the body is a 3D ball — comes from
how the eyes move, deform and sit on the surface. The engine lives in
`character/` (vendored verbatim from the standalone `ai-character-eyes`
prototype, zero dependencies beyond React) and is wrapped as `Met` so theming,
naming and status mapping live in one place.

```tsx
import { Met, chatStatusToMetState, subjectToMetColor } from '../../components/met';

<Met size={96} state={chatStatusToMetState(status)} color={subjectToMetColor(subjectKey)} interactive glow />
```

## Props

| Prop | Notes |
|---|---|
| `state` | `idle` `curious` `happy` `sad` `surprised` `confused` `sleepy` `thinking` `listening` `speaking` `excited` `annoyed` `shocked` |
| `color` | Theme name (`violet` `blue` `green` `pink` `neutral`) or any CSS colour |
| `interactive` | Follows the pointer/finger and reacts to taps. Only the "live" instance should have this on. |
| `reducedMotion` | Force calm motion (decorative/small instances). Defaults to the OS preference. |
| `glow` | Soft coloured halo — for the nav rail and hero placements |
| `lookAt` / `audioLevel` / `intensity` | Programmatic gaze, real-audio speech drive, expression strength |
| `ref` | `{ blink(), poke() }` |

## Where each instance lives

| Context | Size | `interactive` | `state` |
|---|---|---|---|
| Desktop floating rail / mobile chat header | 40–56px | yes | live chat status |
| Empty chat hero | 150–200px | yes | live chat status |
| Main navigation (side nav, bottom nav, mobile menu) | 22–26px | no, `reducedMotion` | fixed `idle` |
| Assistant message avatar | 22–28px | no, `reducedMotion` | fixed `idle` |

Only one instance per screen is "alive" (interactive, mirroring the chat
status). Everything else is a calm idle portrait, so dozens of avatars don't
each fight for attention. All instances share a single `requestAnimationFrame`
loop and pause automatically when off-screen.

## Status mapping

`chatStatusToMetState` maps the chat pipeline to eye states:
`ready → idle`, `listening/sending → listening`, `thinking/processing → thinking`,
`generating/speaking → speaking`, `success → happy`, `error → confused`.
