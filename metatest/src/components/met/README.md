# Met

The AI tutor's living character — a self-contained SVG + Canvas-free animation
engine (`cell/`) ported from the standalone `ai-cell-character` prototype,
wrapped as `Met` for consistent naming/branding across the app.

```tsx
import { Met, chatStatusToMetState } from '@/components/met';
// or: import { Met } from '../../components/met';

<Met size={96} state="idle" mood="happy" interactive energy={0.6} />
```

## Where each size/mode is used

| Context | Size | `interactive` | `state` source |
|---|---|---|---|
| Intro screen | large (~220–280px) | yes | fixed `idle` |
| Sidebar (desktop) / history sheet (mobile) | ~80–96px | yes | live `chatStatus` via `chatStatusToMetState` |
| Mobile chat header (once a conversation exists) | ~36px | no | live `chatStatus` |
| Message bubble avatar / typing indicator | ~32px | no, `reducedMotion` | fixed `idle` (static) |

Per the product spec: **only** the sidebar/header Met reflects live states,
moods, and eye-tracking. Every avatar rendered inside the message list is
intentionally static (`reducedMotion`, `interactive={false}`) — it is a
portrait, not a second live character, both for visual clarity and so dozens
of chat bubbles don't each run their own animation loop.

See `cell/types.ts` for the full `CellState`/`CellMood`/`AICellHandle` API —
`setState`, `setSpeaking`, `setListening`, `setMood`, `setEnergy`,
`setSpeechIntensity`, `poke()`.
