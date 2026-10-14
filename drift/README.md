# Drift — Endless Atmospheric Adventure Runner

A calm, tense 2D side-scrolling journey built with **HTML5 Canvas** and **vanilla JavaScript**. Distance is your score; the world is the challenge.

## Play

Serve the folder over HTTP (required for ES modules):

```bash
cd drift
npx --yes serve -p 4173
```

Open `http://localhost:4173` in a browser.

Or: `python3 -m http.server 4173` from the `drift` directory.

## Controls

| Input | Action |
|--------|--------|
| ← / A | Brake / move left |
| → / D | Speed up |
| Space / ↑ / W | Jump |
| 1–4 | Use rope / light / glide / hook |
| E | Continue at rest point (after a short pause) |
| Enter | Start from title |

## Architecture

```
drift/
  index.html          # Entry + canvas
  style.css           # HUD overlay
  js/
    main.js           # Game loop, input, states
    player.js         # Physics + gleam character rendering
    world.js          # Chunks, hazards, rest points, branches
    biomes.js         # Seven biomes + blending
    camera.js         # Lead, zoom, shake, pan
    tools.js          # Rope, light, glide, hook
    particles.js      # Ambient + burst particles
    audio.js          # Web Audio layers + SFX
    ui.js             # Distance, tools, rest/death UI
    utils.js          # Math, RNG, constants
    character.js      # Bundled eyes-only character (from gleam branch)
```

The **character** is imported from your existing **gleam** branch (`cursor/gleam-bounce-adventure-77d3`): the same `CharacterEngine` and canvas adapter (`drawCharacter`), with rolling, squash/stretch, and expressive eyes.

To rebuild `character.js` after editing sources under `character-source/`:

```bash
cd drift && npm run build:character
```

## Features (prototype)

- Auto-run physics with surface friction (ice, mud, wet, etc.)
- Procedural chunks: platforms, gaps, hazards, tool pickups
- Seven biomes with palette blending and parallax silhouettes
- Four tools with basic combinations (hook + glide, light + glide)
- Rest campfires as checkpoints
- Branching hard/easy paths
- Adaptive procedural music + SFX via Web Audio API
- Darkness in dark forest / cave without the light tool

## License

Prototype for personal / portfolio use. Character engine carried from the gleam branch in this repository.
