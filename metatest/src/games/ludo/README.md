# Metch Ludo

Self-contained Ludo match for MetaTest. Game logic lives in `engine/` and never
imports React. The UI in `ui/` only renders `GameState`.

The existing Met / `AICharacter` (round body, eyes only) is reused as every Nuts
token. Eyes look at game events, never the pointer.

## Layout

- `engine/` — board geometry, rules, items, drops, AI, runtime
- `audio/` — short Web Audio cues with mute toggles
- `multiplayer/transport.ts` — local stand-in for a later socket transport
- `ui/` — board, dice, inventory, lobby

Entry route: `/ludo` (wired in `App.tsx` as a top-level page, outside MainApp).

Drop timing, animation lengths, and AI delays are `GameConfig` values in
`engine/config.ts`. Do not hardcode them in components.
