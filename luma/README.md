# Luma

A standalone 2D bounce adventure starring the existing eyes-only sphere character.

## Play

```bash
cd luma
npm install
npm run dev
```

Open the printed local URL. Keyboard: **A/D** or arrows to move, **Space / W / Z** to jump, **Esc** to pause. On a phone, on-screen pads appear automatically. A gamepad is supported if the browser exposes one.

```bash
npm run build
npm run preview
```

## Replaceable artwork

Drop final images over these paths — no code changes required:

- `public/assets/game/studio-logo-placeholder.png`
- `public/assets/game/cover-placeholder.png`
- `public/assets/seasons/season-1-cover.png` … `season-4-cover.png`
- `public/assets/season-1/world-bg.png` … `season-4/world-bg.png`
- `public/assets/audio/sfx/*.wav`
- `public/assets/audio/music/*.wav`

The character itself is the original `CharacterEngine` (sphere-projected eyes, lids, blinks, states). Do not replace it with a generic circle.

## Seasons

44 stages: four worlds × (10 levels + boss). New seasons are data files plus a theme entry — the engine is not rewritten.
