# Task for Codex: write js/fx.js (atmosphere, effects, audio) for GLOWMOTH

You are working in /home/user/my-first-repo/glowmoth (an original browser game, three.js r128 + matter.js).
WRITE ONLY `js/fx.js` with `window.FX = { setup(Game) }`. Do not modify any other file.

## Read first
- `design/design.md` (whole; section 7 lists the Engine API and events you use).
- `js/engine.js` (window.Game): how the scene, camera, layers, moths, time scale and bus work. Use only its public API:
  `Game.scene, Game.camera, Game.THREE, Game.bus.on(...), Game.moths, Game.time, Game.setTimeScale(scale, seconds),
  Game.shake(amount), Game.worldToScreen(x, y), Game.state, Game.save`.
- The style frame `art-src/style/style-1.png`: the mood to bring alive (dusk god rays, fireflies, spores, mist).
- `assets/kit.json`: particle sprites you may use if present (spark, spore, leaf, firefly, glow); otherwise draw
  small canvas textures yourself (soft radial glows, a leaf shape).

## Build
1. **Ambient life** (always on during title and play, in world space so it parallaxes with depth):
   - drifting spores and dust motes in 3 depth bands (additive, slow, some catching the light)
   - fireflies that wander and blink near the play layer and in the midground
   - falling leaves tumbling across the screen
   - 3-5 slow-swaying god-ray light shafts (additive gradient planes) from the upper sky
   - a faint low mist band near the bottom of the screen
   Keep all of it subtle so gameplay reads clearly.
2. **Events** (from `Game.bus`):
   - `flap`: a tiny wing-dust puff under the swarm (rate-limited).
   - `pickup {type}`: a burst ring plus sparkles in the pickup's colour (kindle green, bloom rose, dwindle blue, gust
     cyan, lull violet) and a chime.
   - `split {n}`: for n ≥ 5, slow motion `Game.setTimeScale(0.35, 0.5)` plus a radial light burst.
   - `mothLost {x, y, cause}`: a spark and ember burst, a small `Game.shake`, and a soft crunch.
   - `checkpoint`: the lantern flares and a swirl of motes rises.
   - `goal {moths}`: the climax. Motes spiral into the great lantern, the bloom flares, warm light floods the screen,
     then it settles.
   - `levelStart`: fade in from dark.
   - `restart`: a soft fade.
3. **Audio** (WebAudio, synthesized, no files):
   - a gentle ambient bed (warm pad chord plus filtered wind noise, slowly evolving)
   - a flap whoosh (filtered noise, pitch varies)
   - pickup chimes (FM bell, pitch per type)
   - death crunch (noise plus a low thump)
   - checkpoint and lantern swells (rising chord)
   Start audio on the first user gesture; respect `Game.save.sound` (and changes to it); master volume about −14 dB.
4. **Rules**: pooled and instanced particles (≤ 1500 live, ≤ 10 extra draw calls), no per-frame allocation,
   `prefers-reduced-motion` = no shake, half the particles and no slow motion. Never throw (wrap handlers), no external
   libraries, nothing that changes gameplay.

Check: `node --check js/fx.js`. Another agent will run the game headless and send you errors and screenshots.
