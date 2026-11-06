# GLOWMOTH: design, art direction and contracts

An ORIGINAL one-touch physics flier for the browser. Genre conventions only (hold-to-flap physics flight,
auto-scrolling levels, clone/size pickups, physics hazards and puzzles). Never imitate, reference or name any
other game, studio or brand in code, art, prompts or text; never reuse anyone else's characters, art, levels,
music or look. No readable text or logos in art.

## 1. Pitch
You guide a swarm of glowmoths (small, round, fuzzy moths with a glowing amber belly and big translucent wings)
through the Clockwood, an ancient forest overgrown around giant brass clockwork, at dusk. Hold to flap, release
to fall. The world scrolls on. Grab KINDLE seeds to split into more moths, BLOOM to grow heavy, DWINDLE to shrink
through cracks. Saw-gears, steam vents, crushing pistons, thorns, dripping water and ink-moths snuff them out.
Bring at least one glowmoth to the great lantern at the end of each level to light it; every moth you bring is
counted. A level takes 60-120 s.

## 2. Look (super detailed, painterly)
- Target: `art-src/style/style.png` (the style frame). Landscape 16:9.
- Painterly, high-detail diorama: warm dusk sky (amber, rose, violet), god rays through canopy, layered depth with
  atmospheric haze, glowing mushrooms and fireflies, mossy roots wrapped around brass gears, pipes and ruins.
- The play layer is NOT a black silhouette: foreground terrain is deep teal/indigo stone with moss, lit by warm rim
  light from the sky behind it, with glowing details. Contrast comes from value and light, not flat black.
- The glowmoth must read instantly: brightest warm light in the frame, soft bloom, wing flaps, a short light trail.
- Every frame should have motion: drifting spores and fireflies, swaying foliage, turning background gears,
  falling leaves, light shafts.

## 3. World and coordinates
- World units are pixels at a 1280x720 reference view. x grows to the right (level direction), y grows DOWN
  (matter.js convention). The visible playfield is 720 units tall; its width follows the screen aspect (min 16:9 on
  landscape; on portrait phones the landscape view is letterboxed with a "rotate your device" hint).
- The camera scrolls right at the level's scroll speed (px/s), with optional speed changes at given x. The camera
  never scrolls left. A moth that falls behind the left edge (plus 40 px) or below the bottom is lost.
- Rendering: three.js r128 with a perspective camera looking at the play plane z = 0 (1 world unit = 1 px at
  z = 0). Parallax background layers are planes at negative z (scaled to fill the view), a foreground layer at
  positive z (blurred leaves and branches). Post-processing: UnrealBloomPass (bloom on glowing things), a subtle
  vignette, and colour grading.
- Physics: matter.js 0.19 (gravity y = 1.0, scale 0.001 default). Static terrain and hazards, dynamic props.

## 4. Mechanics
- **Glowmoth**: circle body, radius 16 (normal), 30 (BLOOM), 8 (DWINDLE). Air friction 0.02, restitution 0.2.
  While the player holds (pointer, touch or Space), each moth gets an upward force plus a small forward push,
  capped vertical speed. Released: gravity. Wings animate faster while holding.
- **Pickups** (glowing seeds that pop when touched):
  - KINDLE x3/x5/x10: spawn that many new moths around the toucher.
  - BLOOM / DWINDLE: change size for 10 s (or until the next size pickup). They affect only the moth that touches
    them, but a seed's touch radius is generous.
  - GUST: scroll speed ×1.5 for 6 s. LULL: ×0.6 for 6 s.
- **Hazards** (a touch kills a moth with a burst of sparks): `saw` (spinning brass saw-gear; static or moving on a
  path), `vent` (steam jet on a cycle; the jet kills, the idle vent does not), `piston` (crusher moving on a cycle),
  `thorns` (static bramble patches along terrain), `drip` (falling water drops from a source on an interval),
  `inkmoth` (dark moth that drifts toward the nearest glowmoth when within 300 px, slower than the swarm).
- **Dynamic props**: `log` (rigid bar, pushable), `boulder` (heavy circle), `gearwheel` (free-spinning wheel on a
  pin), `seesaw` (plank on a pivot), `pendulum` (weight on a chain), `gate` (a barrier that opens when a `plate`
  receives enough moths' weight or a boulder). They are physical: moths can push them, and big (BLOOM) moths push
  harder.
- **Checkpoints**: small lanterns. Passing one with at least one moth saves it. On losing every moth, restart at the
  last checkpoint with the number of moths you had when you passed it (minimum 1).
- **Goal**: the great lantern. The level is done when any moth touches it. Score: moths delivered; stars:
  ★ = 1 moth, ★★ = ≥ 30% of the level's `target`, ★★★ = ≥ `target`. Also track best moths per level.
- **Feel**: a soft flap whoosh, chimes for pickups, a crunch and spark burst on death, slow motion when the swarm
  splits on a big KINDLE, a lantern-lighting climax (bloom flare, camera push, warm light floods the screen).

## 5. Level format (`levels/levelNN.json`)
```json
{
  "id": 1, "name": "First Ember", "length": 7000, "target": 6,
  "scroll": [ { "x": 0, "speed": 110 }, { "x": 3200, "speed": 140 } ],
  "spawn": { "x": 260, "y": 330, "count": 1 },
  "goal": { "x": 6820, "y": 360 },
  "checkpoints": [ { "x": 3500, "y": 340 } ],
  "terrain": [ { "kind": "ground", "points": [[0,720],[0,600],[400,620]] } ],
  "props": [ { "type": "log", "x": 1500, "y": 500, "w": 260, "h": 34 } ],
  "hazards": [ { "type": "saw", "x": 2200, "y": 400, "r": 60, "spin": 3, "path": [[2200,300],[2200,500]], "speed": 120 } ],
  "pickups": [ { "type": "kindle", "x": 1200, "y": 360, "n": 3 } ],
  "decor": [ { "id": "mushroom-b", "x": 900, "y": 610, "s": 1.0, "layer": "back" } ]
}
```
- `terrain[].points`: a closed polygon (clockwise, y down) in world units; kinds `ground` (rising from the bottom),
  `ceiling` (hanging from the top), `island` (free-floating rock). Terrain is drawn with the world's rock texture,
  moss and grass fringes along its upper edges, root tendrils along lower edges, and rim light.
- Distances: keep the flyable channel ≥ 140 px tall except deliberate DWINDLE gaps (≥ 40 px).
- `decor` ids come from `assets/kit.json` (art), placed at `layer` "back" (behind the play plane), "front" (in front,
  non-colliding) or "terrain" (stuck on terrain edges).

## 6. Assets (`assets/`; art agents write them, `assets/kit.json` lists them)
```
assets/bg/<layer>.webp      parallax layers for the Clockwood: sky, far, mid, near (wide, tileable horizontally)
assets/terrain/rock.jpg      seamless rock/moss texture for terrain fill; moss-edge.webp and roots-edge.webp strips
assets/sprites/moth.webp     glowmoth animation atlas (+ moth.json frames: idle/flap cycle, 6-8 frames)
assets/sprites/*.webp        pickups, hazards, props, lanterns, ink-moth, particles (+ JSON rects where atlased)
assets/decor/atlas.webp      decor atlas (+ atlas.json): mushrooms, ferns, flowers, gears, pipes, crystals
assets/ui/*.webp             logo, buttons, icons
assets/kit.json              index: every file above with sizes, frame rects, anchors and intended world sizes
```

### kit.json schema (all paths relative to `assets/`; missing keys must not crash the engine)
```json
{
  "bg": {
    "sky":  { "file": "bg/sky.webp", "depth": 4000, "tile": true }
  },
  "sets": {
    "mid":  { "atlas": "sets/mid.webp",  "depth": 900, "items": { "waterfall-ruin": { "rect": [0,0,900,700], "h": 620, "anchor": [0.5, 1] } } },
    "near": { "atlas": "sets/near.webp", "depth": 320, "items": { "gear-tree": { "rect": [0,0,700,900], "h": 760, "anchor": [0.5, 1] } } }
  },
  "terrain": {
    "fill":      { "file": "terrain/rock.jpg", "scale": 512 },
    "mossEdge":  { "file": "terrain/moss-edge.webp", "h": 56 },
    "rootsEdge": { "file": "terrain/roots-edge.webp", "h": 72 }
  },
  "sprites": {
    "moth":    { "file": "sprites/moth.webp", "frames": [[0,0,256,256]], "size": 44, "fps": 18 },
    "kindle":  { "file": "sprites/pickups.webp", "rect": [0,0,128,128], "size": 56 },
    "saw":     { "file": "sprites/hazards.webp", "rect": [0,0,256,256], "size": 120 },
    "lantern": { "file": "sprites/lantern.webp", "frames": [[0,0,256,512],[256,0,256,512]], "size": 240 }
  },
  "decor": {
    "atlas": "decor/atlas.webp",
    "items": { "mushroom-a": { "rect": [0,0,180,220], "h": 110, "anchor": [0.5, 1] } }
  },
  "fg": { "atlas": "fg/atlas.webp", "items": { "leaves-a": { "rect": [0,0,512,400], "h": 420 } } }
}
```
- `bg.sky`: an opaque panorama (sky, far forest, clock towers, haze) that tiles horizontally; `depth` is how far behind the
  play plane it sits (bigger = slower parallax).
- `sets.mid` / `sets.near`: cut-out set pieces (keyed, with alpha) that the engine scatters along the level on planes at
  z = -depth (mid: waterfall ruins, giant gear-trees, aqueduct arches, half-buried gear wheels, ruined towers; near:
  trunks, root arches, fern clusters, brass pipe frames). `h` is the height in world units at that depth's plane
  (the engine scales for perspective), `anchor` the ground point. The engine places them with seeded variety, with the
  bottom hidden in haze/fog, so the scene reads as deep continuous scenery.
- `moth` is TWO sprites: `mothBody` (rect) and `mothWing` (one wing, drawn on black: use additive or screen blending
  so it stays translucent and glowing; the engine mirrors and flaps it in code). Same for `inkmothBody` / `inkmothWing`.
- `size` is the intended on-screen diameter or height in world units at the play plane. `frames`/`rect` are pixel rects
  [x, y, w, h], top-left origin. Sprite keys used by the engine: mothBody, mothWing, mothGlow, inkmothBody, inkmothWing, kindle, bloom, dwindle, gust,
  lull, saw, vent, steam, piston, thorns, drip, log, boulder, gearwheel, plank, pendulum, chain, gate, plate,
  checkpoint (unlit and lit frames), lantern (unlit and lit frames), spark, spore, leaf, firefly, glow.

## 7. Code layout
- `index.html`: page shell, UI screens (title, level select, pause, results), loads scripts.
- `js/engine.js`: renderer, camera, parallax, post-processing, physics world, level loading, moths, input,
  pickups, hazards, props, checkpoints, goal, events. Emits events on `Game.bus` (`flap`, `pickup {type}`,
  `mothLost {x, y, cause}`, `split {n}`, `checkpoint`, `goal {moths}`, `levelStart`, `levelEnd {moths, stars}`,
  `restart`).
- `js/fx.js`: particles, light shafts, ambient life, screen shake, slow motion and bloom pulses driven by events
  (written by Codex).
- `js/ui.js`: menus, level select with stars, results, progress saved in localStorage.
- Tests: `tools/shot.js` (headless screenshots with local three.js and matter.js) and a bot that flies levels.

### Engine API (`window.Game`, used by index.html, js/ui.js, js/fx.js and tools/shot.js)
- `Game.init({canvas, root, ui})` → Promise; loads `assets/kit.json`, textures and `levels/index.json`, builds the
  renderer, shows the title backdrop (a slow camera drift through level 1's start), then sets `Game.ready = true`.
- `Game.startLevel(n)`, `Game.restartLevel()`, `Game.pause(bool)`, `Game.setHold(bool)` (input; the engine also
  listens to pointer/touch/Space itself while a level runs), `Game.state` ("title" | "play" | "paused" | "won" |
  "lost"), `Game.levels` (metadata from levels/index.json: id, name, target), `Game.save` (progress object, persisted
  under localStorage key `glowmoth-v1` by js/ui.js through `Game.persist()`).
- `Game.bus.on(name, fn)` / `emit(name, data)`; `Game.scene`, `Game.camera`, `Game.renderer`, `Game.composer`,
  `Game.THREE`, `Game.world` (matter), `Game.moths` (live list: `{body, size, ...}`), `Game.time` (scaled game time),
  `Game.setTimeScale(scale, seconds)`, `Game.shake(amount)`, `Game.worldToScreen(x, y)`.
- `Game.debug()` → `{state, level, moths, swarmX, swarmY, viewMidY, camX, fps}` for bots and tests.
- Query `?test` in the URL: skip the title drift and audio, keep everything else.

## 8. Ownership (never edit files you do not own; never run git)
| owner | files |
|---|---|
| orchestrator | design/*, index.html (shell), tools/* |
| engine agent | js/engine.js |
| level agent | levels/*.json |
| art agents | art-src/**, assets/** (each agent its listed files) |
| fx (Codex) | js/fx.js |
| ui agent | js/ui.js |
