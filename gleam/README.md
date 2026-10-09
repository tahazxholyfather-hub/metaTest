# Gleam

A standalone 2D bounce-platform adventure. A white sphere with two expressive eyes rolls through four seasons — verdant, industrial, gravity, and bio — across 44 stages.

The character engine is the existing eyes-only `AICharacter` implementation (sphere-projected eyes, 13 emotional states, blinks, saccades). It is reused, not redesigned.

## Run

```bash
cd gleam
npm install
python3 scripts/generate-assets.py   # already run if placeholders exist
npm run dev
```

Then open the printed local URL.

```bash
npm run build
npm run preview
```

## Replace artwork / audio

Drop files over the placeholders. No code changes.

| Slot | Path |
| --- | --- |
| Studio logo | `public/assets/game/studio-logo-placeholder.png` |
| Game cover | `public/assets/game/cover-placeholder.png` |
| Season covers | `public/assets/seasons/season-1-cover.png` … `season-4-cover.png` |
| Optional parallax | `public/assets/seasons/season-N/bg-far.png` |
| Music | `public/assets/audio/music/*.wav` |
| SFX | `public/assets/audio/sfx/*.wav` |

Season and UI layout do not assume a fixed pixel size for those images.

## Add a season

1. Create `src/data/levels/season5.ts` with 10 levels + a boss (`compileLevel` / `bossLevel`).
2. Append a `SeasonDef` in `src/data/seasons.ts`.
3. Add a cover image at `public/assets/seasons/season-5-cover.png` and a key in `AssetManifest`.

The engine, HUD, save format, and progression do not need to change.

## Controls

- Desktop: A/D or arrows to roll, space / W / up to jump, Esc to pause. Gamepad supported.
- Touch: left / right / jump buttons with multi-touch and safe-area padding.

Progress and settings persist through `SaveManager` (localStorage adapter, swappable).
