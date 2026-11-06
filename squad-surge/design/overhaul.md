# Squad Surge graphics overhaul: plan and contracts

Owner request: the graphics look amateurish; make them look like a polished, premium casual mobile game.
Squad Surge is an ORIGINAL game. Never imitate, reference or name any other game, studio or brand in prompts,
art or code. No real-world logos, brand names or readable text in any art.

## 1. Target look
- **Style frame: `art-src/style/style-a.png`** (second option: `style-b.png`). Every new piece of art must
  match it: premium stylized 3D, toy-like, glossy plastic and soft clay materials, chunky rounded bevelled
  shapes, soft global illumination with gentle ambient occlusion, warm key light from the UPPER LEFT, saturated
  but harmonious colours, crisp silhouettes, no outlines.
- Characters (soldiers, zombies, grunts, brutes, ogre boss) stay as they are: pre-rendered sprites in
  `assets/*.png`. The environment and track objects must look like they belong in the same render.
- What makes the style frame read as "premium", and what we are missing today:
  1. The street is lined with real buildings right behind the sidewalk (facades along the road), dense props on
     the sidewalks (lamps, barrels, sandbags, barricades, crates, trees, wrecked cars, power poles), and a rich
     skyline with sky at the top. Today: grey boxes with drawn-on windows and orange cubes.
  2. Warm, directional golden-hour light, soft long shadows, atmospheric haze. Today: flat ambient light.
  3. Road detail: asphalt with cracks and patches, dashed centre line, bevelled curbs with yellow-black hazard
     stripes, cobblestone sidewalks. Today: flat textures and a grey box rail.
  4. Track objects are real 3D: glowing glass gate panels on chrome capsule posts; glossy blocks, crates and
     cases. Today: flat pictures on planes.

## 2. Themes (ids are fixed; `THEMES[i].id` in index.html)
| id | level look | ground | buildings? | key props |
|---|---|---|---|---|
| `town` | golden hour, sunny old European-style small town, partly ruined | cobble sidewalks, grassy dirt beyond | yes: pastel plaster townhouses, terracotta roofs, shutters, balconies, striped shop awnings | street lamps, barrels, sandbag walls, wooden X barricades, wrecked rusty cars, power poles, round leafy trees, crates, benches, flower planters |
| `ruins` | overcast late afternoon, smoky orange-grey haze, war-damaged city | cracked concrete, rubble | yes: damaged concrete apartment blocks (4-6 storeys), broken windows, burn marks | rubble piles, burned-out cars, steel tank traps, barbed-wire coils, concrete barriers, broken lamps, sandbag bunkers, burned trees |
| `bridge` | bright midday, long suspension bridge over a sparkling bay | water far below | no | bridge lamp posts, guard rails, traffic cones, road barriers, wrecked cars, checkpoint huts, sandbags; far: islands, distant generic city skyline |
| `pier` | fresh morning, wooden harbour pier | water, wooden deck | optional: wooden boat sheds | stacked crates, fishing nets, buoys, rope coils, barrels, bollards, lobster traps, moored small fishing boats (in water), lamp posts; far: lighthouse on a rocky headland |
| `desert` | hot late afternoon, desert highway, heat haze | sand | optional: small adobe roadside buildings | saguaro cacti, shrubs, boulders, rusty abandoned pickup, oil drums, fence posts, blank road signs, palm trees, wrecked bus; far: mesas, dunes |
| `arena` | night, floodlit military training arena | concrete | yes: stadium stand walls | floodlight towers, concrete barriers, stacked tyres, sandbag walls, ammo crates, oil drums, flag poles with plain banners, watch towers; far: stadium silhouettes, starry sky |

## 3. World scale and layout (units)
- Road half-width `ROAD = 6` (road spans x = -6..6), squad runs toward -z. Soldier sprite is 1.3 tall.
- A storey is about 3, a door about 2.2, a car about 1.6 tall and 4 long, a street lamp about 5, a tree 6-8.
- Curb: x = ±6..±6.5 (raised 0.25). Sidewalk: |x| 6.5..10.5. Building fronts: |x| = 11 (towns, ruins).
- Prop zones (`zone` in kit.json): `curb` |x| 7..8 (lamps, poles, hydrants, signs), `walk` |x| 8.2..10.3
  (barrels, crates, sandbags, benches, planters, barricades), `lot` |x| 11..24 where no building stands (cars,
  trees, sheds, rubble), `far` |x| 25..80 (big background items), `water` |x| 12..70 (boats, buoys; bridge and pier).
- Camera: chase camera behind and above the squad, pitched about 20-25 degrees down. Things far up the road and
  the roadside are seen almost front-on, from slightly above.

## 4. Art pipeline (Codex image generation)
- Generate with `python3 tools/codex_image.py --out art-src/<theme> --name <name> --ref art-src/style/style-a.png --prompt-file <file>`
  (Codex `gpt-6-astra` image tool; one image takes about 1-2 minutes; run at most 2 at once per agent; it
  retries itself). Do not use the `mcp__codex__generate_image` MCP tool: it times out after 60 s.
- Always pass the style frame as a reference and end every prompt with the style line:
  "Premium stylized 3D render, toy-like, glossy plastic and soft clay materials, chunky rounded bevelled shapes,
  soft global illumination and gentle ambient occlusion, warm key light from the upper left, saturated but
  harmonious colours, crisp clean silhouettes, no outlines, no text, no letters, no numbers, no logos."
- Process with `uv run tools/kit_tools.py key|split|pack|seamless|fit` (see the file's docstring).
- **Prop sheets**: 6-9 different objects per image on a flat, pure #00FF00 green background (use pure #FF00FF
  magenta instead when any object is green: trees, cacti, shrubs, grass). Objects in a loose grid with wide gaps,
  none touching each other or the image edge, each complete and upright, one object per cell, three-quarter
  front view from slightly above (about 20 degrees down), as seen from a road. Soft contact shading on the object
  itself but NO shadow cast on the background, no ground patch, no floor.
- **Facades** (buildings): one building elevation per image on flat green, straight-on orthographic front
  elevation (no perspective, no side wall visible), ground floor at the bottom, the image stops at the eaves
  (no roof; the 3D roof is built in code). Margins of green all round so it crops cleanly. Ruins may have a
  broken, irregular top edge (alpha). Keep shop signs blank.
- **Textures** (ground, sidewalk, roof tiles, wood deck, sand, road asphalt): top-down orthographic, evenly lit,
  no shadows, no perspective, fills the frame; then `kit_tools seamless` to 1024x1024 JPEG.
- **Backdrops**: landscape panorama of the far distance only (sky + skyline/hills), no road, no foreground props.
  The bottom 25% must fade into a smooth, flat, single-colour atmospheric haze band (record its colour).
- Raw generations go to `art-src/<theme>/` (kept in git as source art). Game-ready files go to `assets/env/...`.
- Before saving anything, look at every generation (Read tool). Regenerate anything off-style, with text,
  with a background that will not key cleanly, or with objects touching.

## 5. Asset contract (what the game loads)
```
assets/env/common/road.jpg            seamless asphalt (no lane markings; lines are drawn in code), 1024², JPEG q85
assets/env/common/decals.png + .json  keyed road decals atlas: cracks, tar patches, manhole, oil stain, skid marks
assets/env/<theme>/kit.json           the theme manifest below
assets/env/<theme>/backdrop.jpg       ≤ 2048 wide, JPEG q85
assets/env/<theme>/backdrop.json      {"file": "backdrop.jpg", "haze": "#e9c39b"}  (written by the backdrops agent, not in kit.json)
assets/env/<theme>/*.jpg              seamless textures named in kit.json, 1024², JPEG q85
assets/env/<theme>/facades/*.png      keyed facades, ≤ 1024 on the long side
assets/env/<theme>/props.png + props.json   prop atlas (≤ 2048x2048) from kit_tools pack
assets/ui/logo.png                    "SQUAD SURGE" title logo, keyed, ≤ 1024 wide
```
`kit.json` (all paths relative to the theme folder; any key may be missing and the game must cope):
```json
{
  "theme": "town",
  "textures": {
    "ground":   { "file": "ground.jpg",   "tile": 10 },
    "sidewalk": { "file": "sidewalk.jpg", "tile": 4 },
    "roof":     { "file": "roof.jpg",     "tile": 3 }
  },
  "facades": [ { "file": "facades/townhouse-a.png", "w": 8, "h": 9 } ],
  "props": {
    "atlas": "props.png",
    "items": [ { "name": "street-lamp", "rect": [0, 0, 120, 600], "h": 5, "zone": "curb", "weight": 2, "flip": true } ]
  }
}
```
- `w`, `h`: intended world size. `rect`: atlas pixels [x, y, w, h], top-left origin (copy from props.json).
- `weight`: relative frequency. `flip`: allowed to mirror for the other side of the road (default true).
- Billboard anchor is the bottom centre of the sprite (where it touches the ground).

## 6. Code architecture (index.html owns the game; modules own the looks)
Load order: `three.min.js` (r128, cdnjs) → `js/scenery.js` → `js/objects3d.js` → `js/juice.js` → main inline script.
Modules only define globals at load time; the main script calls `X.setup(ctx)` once after creating the renderer.
`ctx` gives: `THREE, renderer, scene, camera, world` (scenery group, Scenery clears and fills it), `track` (gate and
solid visuals group, Obj3D owns it), `ROAD, TEX, bus, save, $, gameEl, makeLabel, drawLabel, setSpriteTint(color),
rng(seed), WEAPONS, sfx(name), vibe(ms), floatText(x, y, z, text, colour)`, and live getters `L`, `state`, `layers`.
Level switches go through `goLevel(level, nextState)`, which awaits `Scenery.preload(theme)` first.

- `window.Scenery` (js/scenery.js): renderer colour pipeline, lights, shadows, sky/backdrop, ground/water, road,
  curbs, sidewalks, buildings, props. API: `setup(ctx)`, `preload(theme) → Promise`, `build(theme, length)`
  (clears and fills `world` for a new level), `update(dt)` (called every frame before render).
- `window.Obj3D` (js/objects3d.js): visuals of gates and shootable solids. API: `setup(ctx)`, `clear()` (remove and dispose all track visuals before a new level), `gate(gate)` (build
  visuals; gate = {z, halves:[{x, hw, side, op, v}]}), `gateHalf(gate, half, good, text)` (refresh one half),
  `gateUsed(gate, half)` (the squad went through `half`), `solid(o)` (o = {kind, x, z, hw, hp, reward?, weapon?,
  ammo?}), `solidLabel(o, text, color)`, `solidHit(o)`, `solidBreak(o)`, `update(dt)`.
  Kinds: blockBlue (+1 reward), blockYellow (big reward), crate, tyres, weaponCase (o.weapon = index into
  ctx.WEAPONS, show that gun inside), ammo.
- `window.Juice` (js/juice.js): animation and game feel, reacting to bus events. API: `setup(ctx)`.
- Event bus `ctx.bus.on(name, fn)`; events and data:
  `levelStart {level, name, theme}`, `state {from, to}`, `gatePass {gate, half, before, after}`,
  `gateShot {gate, half}`, `solidHit {o}`, `solidBreak {o, earned}`, `enemyHit {e}`, `enemyDie {e}`,
  `soldiersAdded {n, total}`, `soldiersLost {n, total}`, `weapon {index, name}`, `rateUp {mult}`,
  `bossStart {boss}`, `bossWarn {boss}`, `bossSlam {boss, killed}`, `bossDown {boss}`,
  `win {stars, n, level, newBest}`, `lose {pct, atBoss}`,
  `frame {dt, camera, look, L, state}` (every frame after the game aimed the camera at `look` and before
  Obj3D.update, Scenery.update and render; handlers may move the camera (re-aim it with `camera.lookAt(look)`)
  and change `camera.fov`; the game resets position, aim and fov every frame).
- Gameplay (positions, hit boxes, numbers, rules) stays in index.html. Modules must not change game rules.

## 7. Budgets
- 60 fps on a mid-range phone: keep draw calls under ~150 (merge static geometry per material, instance props),
  shadow map 1024-2048 with a tight frustum that follows the squad, pixel ratio ≤ 2.
- Load only the current theme's kit (preload the next theme on the win screen). All env assets for one theme ≤ ~3 MB.

## 8. Testing
- Serve: `cd /home/user/my-first-repo/squad-surge && python3 -m http.server <your port>`.
- `node tools/shot.js --levels 1,2,3,4,5,6 --out <dir> [--views home,play,boss]` starts its own server, routes
  three.js to a local copy (cdnjs is blocked in this sandbox), saves screenshots and prints fps, draw calls,
  texture/geometry counts and every console error. Use your own `--out` folder. swiftshader fps is low and only
  useful for comparisons.
- Test hooks: `window.__game` (state, L, startLevel, setState, save).

## 9. Ownership (do not edit files you do not own; never run git)
| owner | files |
|---|---|
| orchestrator | index.html, design/overhaul.md, tools/codex_image.py, tools/kit_tools.py, tools/shot.js |
| art A: town + ruins + common | art-src/{town,ruins,common}, assets/env/{town,ruins,common} (except backdrop.*) |
| art B: bridge + pier + desert | art-src/{bridge,pier,desert}, assets/env/{bridge,pier,desert} (except backdrop.*) |
| art C: arena + all backdrops + logo | art-src/{arena,backdrops,ui}, assets/env/arena, assets/env/*/backdrop.{jpg,json}, assets/ui/ |
| scenery code | js/scenery.js |
| 3D objects code | js/objects3d.js |
| juice (Codex) | js/juice.js |
