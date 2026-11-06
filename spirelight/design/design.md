# SPIRELIGHT: design and contracts

This is the single source of truth for every agent working on Spirelight. Read sections 0–2 and the sections your
brief names. If something here is unclear or wrong, write it in `design/requests.md` (see 11). Do not guess silently.

## 0. Ground rules

- **Original work only.** Spirelight is an original isometric impossible-geometry puzzle game. Do not copy any existing
  game's name, characters, art, levels, music or look. In particular: no pastel flat-shaded minimalism, no white-robed
  princess in a cone hat, no crow people, no totem companion, and no recreated levels from other games. Our look is
  rich, textured and warm-lit (section 2).
- **Tech:** plain browser scripts, three.js **r128** only, from the CDN in `index.html`, plus its `examples/js`
  add-ons from jsdelivr `three@0.128.0`. No other libraries, no ES modules, no build step, no network calls at runtime
  except loading our own files.
- Each module is one IIFE defining one global. It is `"use strict"`, never throws at load time, and wraps event
  handlers in try/catch. When a module it depends on is missing or broken, it falls back to something plain (the game
  must still run).
- **Write only the files you own** (section 11).
- Keep the frame loop allocation-free (reuse vectors), and dispose of what you create when a level unloads.

## 1. Pitch

The world is a scatter of ancient clockwork spires floating above a sea of clouds. Their great beacons have gone dark.
**Wick**, a tiny brass lamplighter automaton whose head is a glass lantern with a living flame, climbs each spire to
relight its beacon.

Each level is one hand-built diorama seen in true isometric projection. The player taps a pale paving stone and Wick
walks there. The player turns cranks to rotate parts of the spire, slides lifts along brass rails, and steps on pressure
plates. Paths join when they *look* joined, so a rotated bridge can link two walkways that are really far apart. When
Wick reaches the beacon, it blazes, and light cascades down through every lantern and window of the spire.

The tone is calm, wondrous and tactile: heavy brass that clicks into place, warm light against a cool sky, and a
satisfying payoff on every level.

**Length:** 10 levels in 4 chapters. Each chapter has its own sky theme.

| Chapter | Theme | Levels |
|---|---|---|
| I. Embers | `dusk` | 1–3 |
| II. Lanterns | `night` | 4–6 |
| III. Veils | `aurora` | 7–8 |
| IV. Daybreak | `dawn` | 9–10 |

**Collectibles:** each level hides 0–3 optional **glimmers**, floating sparks. The total count shows on the title
screen and the spires map. They are never required.

## 2. Look (art direction)

Reference frames are in `art-src/style/style-1.png` (key art) and `art-src/hero/hero-sheet.png` (Wick). Match their
richness, not their exact layout.

- **Materials:**
  - warm weathered sandstone blocks with carved trim bands
  - pale cream limestone **pavers on every walkable top**, with a thin brass inlay at the edges, so walkable surfaces
    always read at a glance
  - brass and verdigris-green copper machinery: gears, cranks, pipes, cages
  - deep blue-violet slate roofs and copper domes
  - moss, ivy, and small glowing cyan/blue flowers
  - arched windows glowing amber
  - iron lanterns
- **Palette:**

  | Element | Colours |
  |---|---|
  | Sandstone | `#d9a46a` → `#b97a4a`, shadows lean plum `#5a3a52` |
  | Pavers | `#efe2c6` |
  | Brass | `#c8963e`, highlight `#ffd27a`, verdigris `#4fa597` |
  | Slate | `#3b3d5c` |
  | Moss | `#6f8f3a` |
  | Glow flowers | `#6ff3ff` |
  | Lantern light | `#ffb35a` |
  | Dusk sky | `#1d1b45` → `#7b4b8f` → `#ff9a6a` at the horizon |

- **Lighting:**
  - a low warm key light (sun) with soft shadows
  - a cool sky fill (hemisphere)
  - emissive windows and lanterns with bloom
  - ACES filmic tone mapping
- **Rendering bar:** "super detailed".
  - Bevelled blocks, PBR textures with normal maps, and baked per-vertex ambient occlusion.
  - Per-block variation (tint jitter, UV offsets, weathering, moss, cracks), plus small props everywhere.
  - Background: an animated cloud sea, a painted sky and distant spires.
  - Post-processing: bloom, subtle vignette and grain, FXAA.
- **Readability beats detail.** At a glance the player must see:
  - where Wick can walk (pavers)
  - what can be moved (brass handles with a soft pulsing ring)
  - where the goal is (the beacon)
  - where Wick is (his warm glow)
- **Preserving the illusion.** The impossible joins only work if a surface looks the same at any depth:
  - Never use camera-distance fog, height fog or depth-of-field on the diorama.
  - Gradients and mist must be screen-space (based on screen y), not world-space.
  - Do not let the colour of a block depend on its absolute world position, except through real lights and shadows.

## 3. Player-facing mechanics

1. **Walk:** tap or click a paver and Wick walks the shortest route there. If the target is unreachable, Wick tilts his
   head ("can't"), a faint ripple shows on the tapped spot, and he stays put.
2. **Rotor:** a group of blocks turns about an axis in 90° steps. The player drags its brass crank or wheel: the group
   follows the pointer and clicks into the nearest allowed angle on release. A short tap on the handle turns it one step.
3. **Slider:** a group moves along an axis between stops, like a lift or a sliding bridge. Its knob is dragged the same
   way.
4. **Pressure plate:** when Wick steps onto a plate, he stops there and a mechanism moves by itself.
5. **Impossible joins:** two walkways connect when their edges meet on screen. Two ways to make one:
   - Turn a bridge until it *looks* connected to a far walkway.
   - Use a **veil**: a column or arch that hides a junction and lets Wick pass behind it.
6. **Stairs** only work when they climb up the screen (away from the viewer). A turned staircase that faces the viewer
   is seen edge-on and cannot be climbed.
7. **Goal:** reach the tile in front of the beacon. Wick raises his lantern, the beacon ignites, and light cascades down
   the spire.

## 4. Geometry (the core of the game)

### 4.1 Space, camera and projection

- One world unit = one block. +y is up. A **cell** `(x,y,z)` (integers) is the cube `[x,x+1]×[y,y+1]×[z,z+1]`.
- **Camera:**
  - orthographic, looking along `−(1,1,1)` with `up = +y`
  - placement: `camera.position = target + 50·(1,1,1)`, then `camera.lookAt(target)`
  - never tilt, rotate or use perspective
- A cube shows three faces: the top `+y`, `+x` (lower right on screen) and `+z` (lower left on screen).
- **Projection coordinates:** `p = x − y`, `q = z − y`.
  - Screen offset in world units: `sx = (p − q)/√2` and `sy = −(p + q)/√6`.
  - +x moves p+1 (down-right), +z moves q+1 (down-left), and +y moves p−1, q−1 (straight up).
- **Depth toward the viewer:** `d = x + y + z` (bigger is nearer).
- Two 3D points look identical exactly when they differ by `k·(1,1,1)`.
- **View ray** through screen point `(p,q)`: `X(t) = (p + t, t, q + t)`. A larger t is nearer the camera.

### 4.2 Solids and ray casting

Every block is a convex solid, written as a list of half-spaces `a·X ≤ b`.

- **Cube:** six half-spaces.
- **Stair wedge** rising toward horizontal unit vector `u`:
  - The cube plus one more half-space: `(Y − y) ≤ (X − L)·u`, where L is any point on the cell's `−u` face (the low
    end).
  - The ramp's height above the cell floor equals the distance travelled along u from the low face.
- **Ray clip:** for each half-space, along `X(t)` we have `a·X(t) = a_x·p + a_z·q + t·s`, where `s = a_x + a_y + a_z`.
  Let `r = b − a_x·p − a_z·q`.
  - If `s > 0`, the constraint is `t ≤ r/s`.
  - If `s < 0`, it is `t ≥ r/s`.
  - If `s = 0`, the ray misses whenever `r < 0`; otherwise this half-space adds no constraint.
  - The ray hits when `tmin < tmax − 1e-6`.
  - The visible point is at `t = tmax`. The **face hit** is the half-space that set `tmax` (on a tie, prefer the top or
    the ramp).
- The **frontmost hit** at `(p,q)` is the solid with the largest `tmax`.
- Decor never takes part in ray casting. Only blocks do: cubes, stairs and veils.

### 4.3 Groups, reference pose and transforms

Block coordinates in a level file are world cells in the **reference pose**, where every mechanism value is 0.

- **Static group:** identity transform.
- **Rotor:**
  - Fields: `axis ∈ {x,y,z}`, `pivot P` (3D), and `angles`, a subset of `{0, 90, 180, 270}` in degrees.
  - In the pivot, the two coordinates perpendicular to the axis must both be integers or both be half-integers. The
    coordinate along the axis is ignored.
  - Rotation follows the three.js / right-hand convention:
    - y: `[[c,0,s],[0,1,0],[−s,0,c]]`
    - x: `[[1,0,0],[0,c,−s],[0,s,c]]`
    - z: `[[c,−s,0],[s,c,0],[0,0,1]]`
  - A cell's centre `m = cell + 0.5` maps to `m' = R(m − P) + P`, and the world cell is `m' − 0.5` (exact integers).
- **Slider:** `axis ∈ {x,y,z}` (positive direction) and integer `stops`. The offset is `value · axis`.
- **Stairs** carry a local rise direction u and a local up vector, both rotated by R.
- **Render hierarchy**, so that geometry and rendering always agree:

  ```
  pivotNode   (position = P + offset, rotation[axis] = angle in radians)
    contentNode   (position = −P)
      meshes, in reference world coordinates
  ```

- **Occupancy** is the set of world cells filled by blocks of every group at the current values.
  - Two blocks in one cell in the start state is an error in the level.
  - Two blocks in one cell in another reachable state is a solver warning.

### 4.4 Walkables

A **walkable** is a surface Wick can stand on. Its id is `group:x,y,z`, using the block's reference cell. Level aliases
map names to ids.

- **Tile:**
  - Definition: the top face of a cube block with `walk !== false`, whose world cell above `(x, y+1, z)` is not
    occupied.
  - Stand point: `S = (x+0.5, y+1, z+0.5)`.
- **Stair:**
  - Definition: a stair block whose rotated up is still +y and whose world rise direction u is `−x` or `−z`, with its
    cell above empty. A stair rising toward +x or +z is seen edge-on and is never walkable.
  - Stand point: `S = (x+0.5, y+0.5, z+0.5)`.
- **Ports** are edge midpoints. Each has a 3D point `P3` on the surface and an outward 2D direction `e` in (p,q) space.
  - Tile at cell `(x,y,z)`, with `h = y+1`:

    | Edge | P3 | e |
    |---|---|---|
    | +x | `(x+1, h, z+½)` | `(1,0)` |
    | −x | `(x, h, z+½)` | `(−1,0)` |
    | +z | `(x+½, h, z+1)` | `(0,1)` |
    | −z | `(x+½, h, z)` | `(0,−1)` |

  - Stair rising toward u:
    - The **high port** is the centre of the `+u` top edge at height `y+1`, with `e = proj(u)`.
    - The **low port** is the centre of the `−u` bottom edge at height `y`, with `e = proj(−u)`.
    - `proj`: +x → (1,0), −x → (−1,0), +z → (0,1), −z → (0,−1).
  - `P2 = (P3.x − P3.y, P3.z − P3.y)`. Coordinates are multiples of ½, so store them as integers ×2.

### 4.5 Connections (the rule)

Ports A (on walkable W1) and B (on W2), with W1 ≠ W2, **connect** when all of these hold:

1. `P2(A) = P2(B)`, and `e(A) = −e(B)`.
2. Both walkables are standable.
3. Let `k = P3(B).x − P3(A).x`. (`P3(B) − P3(A) = k·(1,1,1)` always holds here.)
   - `k = 0` is a real 3D neighbour. It **always connects**, even when hidden behind something: Wick simply walks behind
     it.
   - `k ≠ 0` is an **impossible join**. It connects only if the junction **looks continuous** (the visibility test,
     next).

**Visibility test** for an impossible join:

- Let `c = P2(A)`, `e = e(A)` and `n = (−e.q, e.p)`.
- Take three samples on W1's side, `c − 0.18e + j·0.3n`, and three on W2's side, `c + 0.18e + j·0.3n`, with
  `j ∈ {−1, 0, 1}`.
- Cast the view ray at each sample. The frontmost hit must be either:
  - the walkable surface of that side's walkable (the top face of its cube, or its ramp), or
  - any face of a **veil** block (veils hide junctions without breaking them).
- If any sample fails, there is no connection.

Worked examples, all of which the unit tests must cover:

| Case | Setup | Result |
|---|---|---|
| Plain neighbours | Tiles `(0,0,0)` and `(1,0,0)` | k = 0, connected |
| Staircase illusion | W1 `(0,0,0)`, W2 `(1,1,0)`, junction at W1's −z port, `c = (−0.5,−1)` | W2's front face (+z) is in front of W1's top on W1's side. Not connected. |
| Impossible bridge | W1 `(0,0,0)`, W2 `(−1,−1,−2)` (one lower and one further back) | Both tops are visible at the junction. Connected, with `k = −1`. |
| Veil | The staircase-illusion pair plus a veil at cell `(2,2,1)`, nearer the camera, covering all six samples | Connected. That cell's silhouette also hides W2's whole top: Wick walks behind the pillar. |
| Stair | Stair at `(0,1,0)` rising `−x`, tile `(1,0,0)` below its low end, tile `(−1,1,0)` at its high end | Both connected, k = 0 |
| Edge-on stair | The same stair rotated to rise `+x` | Not walkable |

### 4.6 Picking (tap to walk)

- Convert the tap to `(p,q)` and cast the ray. If the frontmost hit is a walkable surface, that walkable is the target.
- Otherwise, sample a ring of radius 0.35 around the tap and take the nearest sample whose frontmost hit is a walkable
  surface.
- Handles are checked first, in screen space (section 6).

### 4.7 Paths

- Run BFS over walkables: the fewest tiles wins, and ties are broken toward the straighter route.
- A path is a list of steps `{tile, enterPort3, exitPort3, k}`.
- Wick walks `S(W1) → P3(A on W1)`, then jumps by `k·(1,1,1)` to `P3(B on W2)`. The jump is invisible on screen. He then
  walks on to `S(W2)`.

## 5. Level format (`levels/levels.js`)

```js
window.LEVELS = window.LEVELS || [];
LEVELS.push({
  id: "first-light",            // unique, kebab-case
  name: "First Light",
  chapter: 1,                   // 1..4 (theme table in section 1)
  theme: "dusk",                // dusk | night | aurora | dawn
  intro: "Every spire keeps one lamp.",   // one short poetic line, shown on the level card
  hint: "Tap a pale stone to walk there.", // shown when the player asks for a hint
  start: "start",               // tile alias (or id "group:x,y,z")
  goal: "goal",                 // tile alias; the beacon decor sits behind it
  view: { center: [3, 4, 3], height: 16, portrait: { center: [3, 5, 3], height: 20 } },  // optional camera override: world point and VISIBLE world height (landscape); `portrait` overrides it when the screen is taller than wide
  groups: [
    { id: "base", blocks: [
        { box: [0,0,0, 4,0,4], style: "darkstone", walk: false }, // inclusive cell range x0,y0,z0, x1,y1,z1
        { box: [0,1,0, 4,1,0], style: "sandstone" },              // walkable tops by default
        { at: [0,2,0], style: "sandstone", id: "start" },         // single cell; id = alias of its top tile
        { stair: [2,2,0], up: "-x", style: "sandstone" },         // stair cell, rising toward -x
        { at: [4,2,4], style: "column", kind: "veil" },           // veil: hides junctions, never walkable
    ]},
    { id: "bridge",
      rotor: { axis: "y", pivot: [6.5, 0, 2.5], angles: [0, 90], start: 0 },
      handle: { type: "crank", at: [6,3,2], face: "+y", on: "self" },  // on: "self" (moves with group) | "base"
      blocks: [ { box: [5,3,2, 8,3,2], style: "brass" } ] },
    { id: "lift",
      slider: { axis: "y", stops: [0, 1, 2], start: 0 },
      handle: { type: "knob", at: [9,1,1], face: "+x", on: "base" },
      blocks: [ { at: [9,1,0], style: "wood", id: "liftTop" } ] },
  ],
  plates: [ { tile: "p1", group: "bridge", to: 90 } ],   // or { tile, group, step: 1 } (next allowed value); once: true
  glimmers: ["g1", "g2"],       // tile aliases (optional, 0..3)
  decor: [                      // purely visual (section 7.3); attach to a group with "group" (default "base")
    { type: "beacon", at: [3,6,1], face: "+y" },
    { type: "lantern", at: [0,2,1], face: "+x" },
    { type: "ivy", at: [4,1,2], face: "+z" },
  ],
  solution: [ ["walk", "p1"], ["mech", "bridge", 90], ["walk", "goal"] ],  // verified by tools/solve.js and in-engine
});
```

Rules:
- `blocks` entries:
  - `{box:[x0,y0,z0,x1,y1,z1]}` (inclusive range), `{at:[x,y,z]}` or `{stair:[x,y,z], up}`.
  - Optional fields: `style`, `walk` (default true for cubes), `kind` (`"cube"` default, or `"veil"`) and `id` (only on
    `at`/`stair`).
  - A later entry replaces an earlier one in the same cell of the same group.
- Group ids are unique, and `"base"` is required. A group has at most one of `rotor` or `slider`. `start` is the
  initial value, and `handle` is optional (a group can be plate-only).
- A tile alias resolves to `group:x,y,z`. Plates, glimmers, start and goal all refer to tiles.
- Styles (section 7.2):
  - `sandstone` (default), `brick`, `marble`, `darkstone`, `brass`, `copper`, `slate`, `wood`
  - `column` (a round column filling the cell; good for veils)
  - `hedge` (a leafy block; also good for veils)
- `solution` holds the intended solution as actions:
  - `["walk", tile]` walks to that tile. The walk stops early at a plate; that is part of the plan.
  - `["mech", group, value]` sets a mechanism's value.
- An optional entry with `id: "title"` is a decorative diorama for the title screen. It is not counted as a level.

## 6. Engine behaviour

- **Walking:**
  - Speed is 2.4 tiles/s, and 0.75× on stairs.
  - Wick faces his direction of motion. He turns smoothly, about 0.12 s per 90°.
  - Footsteps call `hero.onStep`.
- **Impossible join:**
  - Wick's logical position jumps by `k·(1,1,1)` at the junction midpoint.
  - If his mesh clips into nearby blocks while crossing, offset only the mesh (not his light) toward the camera along
    (1,1,1), by at most 0.3, for the crossing.
- **Plates** truncate a path: Wick stops on the plate, the action plays, then the player continues.
- **Handles:**
  - Hit-testing is in screen space, within a 36 CSS px radius of the handle's projected centre. It takes priority over
    walking.
  - Hovering on desktop shows a grab cursor and a brighter ring.
  - Handles pulse softly until the player first uses one in that level.
- **Drag mapping** (works for any axis and handle):
  - Each frame, take the screen tangent `T = ∂(handle screen pos)/∂value` at the current value.
  - `Δvalue = (pointerDelta · T) / |T|²`.
  - Rotors use degrees; sliders use units.
  - Clamp to the range of the allowed values, with soft resistance beyond it.
- **Release:**
  - A critically damped spring (≈0.35 s) eases the group to the nearest allowed value, then `mechSnap` fires and the
    geometry is recomputed.
  - A tap without movement (under 6 px) steps to the next allowed value. Rotors wrap; two-value mechanisms ping-pong.
- **While a mechanism moves:**
  - Walking pauses: Wick finishes the step to the next tile centre and waits.
  - If Wick stands on a y-rotor or a slider that moves, he **rides** it (re-parented to the content node, keeping his
    world transform).
  - x/z rotors cannot move while Wick stands on them. A drag gives a small resisted wiggle and `mechLocked`.
- **Goal:**
  - When Wick arrives on the goal tile: input locks, `goal` fires, and Wick turns toward the beacon and plays
    `celebrate`.
  - At 0.9 s: `beacon` (ignition and the light cascade).
  - At 3.6 s: `levelComplete`.
- **Camera:**
  - Fit the projected bounds of the level's blocks over all mechanism values, with a 10% margin plus room for the HUD.
    `level.view` overrides this.
  - A tiny slow drift (±0.05 units) adds life. It is off under reduced motion.
  - Both orientations work: portrait is the primary phone layout and landscape is the desktop layout.
- **Quality tiers:**

  | Tier | Shadows | Bloom | FXAA | Pixel ratio |
  |---|---|---|---|---|
  | `high` | 2048 | on | on | ≤ 2 |
  | `medium` | 1024 | on | — | ≤ 1.5 |
  | `low` | off | off | — | 1 |

  `auto` starts at high and steps down if the 3 s average stays under 45 fps.

## 7. Module contracts

Script order in `index.html`:
1. three r128
2. `examples/js/utils/BufferGeometryUtils.js`
3. post-processing: CopyShader, LuminosityHighPassShader, FXAAShader, EffectComposer, RenderPass, ShaderPass,
   UnrealBloomPass
4. `js/geom.js`
5. `levels/levels.js`
6. `js/blocks.js`
7. `js/decor.js`
8. `js/world.js`
9. `js/hero.js`
10. `js/engine.js`
11. `js/fx.js`
12. `js/ui.js`
13. the boot script

### 7.1 SpireGeom (`js/geom.js`): pure logic, no three.js

The file is UMD: it sets `window.SpireGeom` in the browser and `module.exports` in Node.

```js
const w = SpireGeom.load(levelDef);   // validates; throws Error with a clear message on bad data
w.groups           // [{ id, kind: "static"|"rotor"|"slider", axis, pivot, values: [...], value, hasHandle }]
w.setValue(groupId, v); w.getValue(groupId)
w.transform(groupId, v?)   // { R: [9 numbers row-major], pivot: [x,y,z], offset: [x,y,z], angle: deg }
w.compute()        // recompute walkables + graph for the current values (cached by state key)
w.walkables        // [{ id, alias, group, kind: "tile"|"stair", ref: [x,y,z], cell: [x,y,z], stand: [x,y,z],
                   //    standable, ports: [{ p2: [p,q], e: [ep,eq], p3: [x,y,z] }] }]
w.walkable(idOrAlias) → walkable | null
w.neighbors(id)    // [{ to, from3: [x,y,z], to3: [x,y,z], k }]
w.path(fromId, toId) → [{ id, from3, to3, k }...] | null  // first entry is the start tile (no ports)
w.reachable(fromId) → Set<id>
w.raycast(p, q)    // { t, group, cell, face: "+x"|"+y"|"+z"|"ramp"|..., kind, walkableId|null } | null
w.pick(p, q)       // walkable id | null (with the 0.35 tolerance ring)
w.project([x,y,z]) → [p, q]
w.bounds()         // { min: [x,y,z], max: [x,y,z] } over all cells in all mechanism values
w.stateKey()       // string
SpireGeom.solve(levelDef, { maxStates }) // { ok, actions, states, reachableGlimmers, trivial, warnings, errors }
```

**Solver:**
- A state is the mechanism values, Wick's tile, and the used once-plates.
- The moves are:
  - walk to any tile reachable in the current configuration (plate tiles end a walk and apply their action)
  - set any handle mechanism to any allowed value, unless it is locked by a rider
- It returns the shortest action list.
- Warnings:
  - the goal is reachable without touching anything (`trivial`)
  - unreachable glimmers
  - dead-end states
  - overlapping blocks
  - invalid pivots
  - unwalkable stairs
  - handle positions inside blocks

CLI: `node tools/solve.js [--level id|index] [--all] [--svg out.svg] [--graph]`. The SVG view draws the projected level
with tile ids and connection lines (impossible joins dashed), for designers.

### 7.2 Blocks (`js/blocks.js`): how blocks look

```js
Blocks.init(THREE, renderer) → Promise          // load textures, build materials; resolves even if assets fail
Blocks.build(group, ctx) → THREE.Object3D
  // group: { id, blocks: [{ cell: [x,y,z], style, kind: "cube"|"stair"|"veil", walk: bool, up: "-x"|.. }] }
  //        cells expanded one per entry, REFERENCE coordinates
  // ctx:   { occupied(x,y,z) → bool (same group, reference coords), theme, quality, seed }
  // returns meshes in reference world coordinates, geometry merged per material
Blocks.styles      // { name: { label } }
Blocks.update(dt, t)                             // optional animated materials
```

- Walkable cube tops (`walk !== false`) get the paver treatment. Variants: brass grating on `brass`, planks on `wood`.
  Non-walkable tops look clearly different (rough stone, roof tiles, moss).
- Apply AO from `ctx.occupied` inside the group.
- Details come from a hash of the cell: windows on exposed walls, moss on top edges, cracks, trim bands.

### 7.3 Decor (`js/decor.js`): props and mechanism parts

```js
Decor.init(THREE, renderer) → Promise
Decor.build(item, ctx) → THREE.Object3D | null
  // item: { type, at: [x,y,z], face: "+y"|"+x"|"-x"|"+z"|"-z"|"-y", rot: 0|90|180|270, ...type params }
  //       placed ON that face of cell `at` (reference coords)
  // ctx:  { theme, quality, seed }
  // object.userData may hold: update(dt, t), setLit(on, instant), press(on), collect(), ignite(), spin(value)
Decor.types        // { type: { params } }
```

Required types:

| Group | Types |
|---|---|
| Mechanism parts | `crank` (rotor handle), `wheel` (big valve wheel handle), `lever`, `knob` (slider handle), `rail` (slider track) |
| Level parts | `plate` (`press`), `glimmer` (`collect`), `beacon` (`ignite`), `lantern` (`setLit`), `streetlamp`, `window` (`setLit`) |
| Machinery | `gear` (`spin`), `pipe`, `clock` |
| Architecture | `railing`, `arch`, `dome`, `finial`, `chimney`, `bell`, `banner`, `waterfall` |
| Plants | `ivy`, `flowers`, `vines`, `plant`, `tree` |

Added after the review (`design/review.md`):

| Type | Params | What it is |
|---|---|---|
| `keel` | `at` (cell it hangs under), `w`, `d` (cells), `depth` (cells) | The spire's underside: stepped corbel rings, a gear cluster and a long brass pendant hanging below `at` |
| `strut` | `from`, `to` (world points, reference coords, may be fractional) | A brass truss or stone arch-strut tying floating parts to the spine |
| `hinge` | `at`, `face`, `axis` (`"x"`/`"z"`) | Hinge barrel for an x/z rotor's pivot; the engine adds one automatically when the type exists |
| `chain` | `from`, `to` | A hanging iron chain (drawbridges, lifts) |
| `corbel` | `at`, `face` | A carved bracket under an overhang |

Decor never takes part in ray casting, so these can never break an illusion.

The engine calls `spin(value)` on a mechanism's handle and gears every frame while the mechanism moves. FX calls
`setLit` on lanterns and windows for the cascade.

### 7.4 World (`js/world.js`): sky, clouds, light rig

```js
World.init(THREE, renderer, scene, camera) → Promise
World.setTheme(name)    // dusk | night | aurora | dawn: backdrop, sky, cloud sea, lights, exposure
World.fit(bounds)       // aim the shadow camera tightly; place the cloud sea under the level
World.update(dt, t)
World.lights            // { key: DirectionalLight (castShadow), hemi, rim? }
World.themes            // names
```

- The backdrop is screen-anchored: the camera is orthographic, so it is a full-screen layer behind everything.
- Any mist over the diorama is screen-space.

### 7.5 Hero (`js/hero.js`): Wick

```js
Hero.create(THREE, opts) → hero
hero.object3D     // origin at the feet, faces +z at rotation.y = 0, about 0.85 units tall
hero.setAnim(name)   // idle | walk | climb | celebrate | bump | ride | wave
hero.update(dt, t, { speed, grounded })
hero.light        // PointLight in the lantern head (warm), child of object3D
hero.setGlow(k)   // 0..2
hero.onStep       // set by the engine; called on each footfall
```

### 7.6 Game (`js/engine.js`)

```js
Game.init({ canvas, root, ui }) → Promise; Game.ready   // builds everything, shows nothing yet
Game.start()          // called by index.html after FX/UI setup: honours ?level=N, else showTitle()
Game.THREE, Game.renderer, Game.scene, Game.camera, Game.composer, Game.root, Game.ui
Game.bus.on(ev, fn) / off(ev, fn) / emit(ev, data)
Game.state            // "loading" | "title" | "play" | "paused" | "complete"
Game.levels           // playable levels (LEVELS without "title"), Game.levelIndex, Game.level, Game.geom (SpireGeom world)
Game.groups           // { id: { def, pivotNode, contentNode, value, moving, handle } }
Game.decor            // [{ item, object3D, worldPos(target?) → THREE.Vector3 (world; fills target if given) }] for the current level (FX uses it for the cascade)
Game.hero             // { object3D, tile, walking, api (the Hero instance) }
Game.time, Game.dt, Game.reducedMotion, Game.quality
Game.save             // { unlocked: 1, done: { [levelId]: { glimmers: n } }, sound: true, music: true, quality: "auto" }
Game.saveNow()
Game.showTitle(); Game.startLevel(i); Game.restart(); Game.nextLevel(); Game.pause(bool)
Game.worldToScreen([x,y,z]) → { x, y }     // CSS px inside root
Game.setQuality("auto"|"high"|"medium"|"low")
// test API
Game.debug()          // { state, level, heroTile, reachable: [...], groups: { id: value }, calls, tris, fps }
Game.tapTile(id); Game.setMech(id, value) → Promise; Game.runSolution(i) → Promise<{ ok, ms }>
```

URL flags:
- `?test` skips waits and the intro.
- `?level=N` starts level N (1-based).
- `?debug` overlays the connection graph and tile ids.
- `?quality=low|medium|high`

The save lives in localStorage under the key `spirelight-v1`.

### 7.7 FX (`js/fx.js`) and UI (`js/ui.js`)

- `FX.setup(Game)`:
  - Particles: ≤ 1500 live, ≤ 8 draw calls, pooled.
  - Synthesized WebAudio: no files, started on the first gesture, respecting `Game.save.sound` and `Game.save.music`.
  - `FX.sound(name)` for UI clicks.
  - Under `prefers-reduced-motion`, use half the particles and no camera motion.
- `UI.setup(Game)`:
  - DOM only, inside `Game.ui`.
  - Screens: title, spires map (level select), HUD (pause, restart, hint, glimmers), intro card, pause, settings,
    level-complete card, ending.
  - Touch-friendly (≥ 44 px targets), keyboard-usable and responsive (portrait and landscape).

## 8. Events (`Game.bus`)

All positions in event payloads are world coordinates as `[x, y, z]` arrays.

| event | data | when |
|---|---|---|
| `title` | `{}` | title screen shown |
| `levelStart` | `{ index, level }` | level built, intro card time |
| `tap` | `{ x, y, tile, reachable, pos }` | a walk tap (x, y in CSS px; tile = walkable id or null; pos = its world stand point or null) |
| `path` | `{ points: [[x,y,z]...] }` | a walk begins (world stand points) |
| `heroStep` | `{ from, to, k, at }` | each tile transition: from/to are walkable ids, k ≠ 0 means an impossible join, at = world [x,y,z] of the junction on the `from` side |
| `heroStop` | `{ tile }` | the walk ended |
| `mechGrab` | `{ id, kind }` | a handle was grabbed |
| `mechMove` | `{ id, value, delta }` | every frame while a mechanism moves |
| `mechTick` | `{ id, pos }` | every 15° (rotor) or 0.25 units (slider) passed (pos = handle world position) |
| `mechSnap` | `{ id, value, pos }` | settled on an allowed value (pos = handle world position) |
| `mechLocked` | `{ id }` | the move was refused (Wick on an x/z rotor) |
| `plate` | `{ tile, group, pos, target }` | a plate was pressed (pos = plate world position, target = world centre of the group it moves) |
| `glimmer` | `{ tile, count, total, pos }` | a glimmer was collected (pos = its world position) |
| `goal` | `{ index }` | Wick reached the goal |
| `beacon` | `{ index, pos }` | the beacon ignites: the engine has just called the beacon decor's `ignite()`; FX runs the cascade (`setLit` on the other decor) and the particles. pos = world [x,y,z] of the beacon flame |
| `levelComplete` | `{ index, glimmers, total, next }` | show the complete card |
| `restart` | `{ index }` | the level restarted |
| `pause` | `{ paused }` | the game was paused or resumed |
| `quality` | `{ level }` | the quality tier changed |

## 9. Assets

| Folder | Contents |
|---|---|
| `assets/tex/` | Seamless material textures (1024², WebP, ≤ 400 KB each). Normal maps end in `_n`. |
| `assets/sky/` | Painted backdrops (≈ 2048×1152 WebP, ≤ 700 KB each) |
| `assets/decor/` | Alpha cut-outs (ivy, flowers, banners, cloud puffs) |
| `assets/ui/` | Logo, icons, card art |
| `assets/fonts/display.woff2` | Cinzel Decorative, under the OFL (licence in the same folder) |

- Raw generations go in `art-src/<area>/` and are committed. Intermediates are ignored by `art-src/.gitignore`.
- The whole game stays ≤ 15 MB.
- Image generation uses Codex:
  - `python3 tools/codex_image.py --out art-src/<area> --name NAME --prompt-file FILE [--ref IMG]`
  - One image takes about 1–4 minutes. Run several in parallel with `nohup … &`.
- Processing tools:
  - `tools/kit_tools.py`: chroma-key, `keyblack`, `split`, `pack`, `seamless`, `fit`
  - `tools/webpify.py`
- Code via Codex: `tools/codex_code.sh BRIEF.md LOG [effort]` edits files in place. Run it in the background.

## 10. Testing

- **Screenshots:**
  - `node tools/shot.js PAGE OUT.png [--w --h --dpr --wait --until --eval --mobile --reduced]`, run from `spirelight/`.
  - It serves the folder and swaps the CDN scripts for local copies.
  - `tools/harness.js` is there for custom Playwright scripts.
- **Module test pages:**
  - Each art module has `tests/<module>.html`, built on `tests/testbed.js`, which provides the game's exact iso camera.
  - Set `window.__ready = true` when the page is ready. The testbed does this for you.
- **Headless runs** use swiftshader, which is slow: judge fps from draw calls and triangles, not from the frame rate.
  - Budget: ≤ 150 draw calls and ≤ 400k triangles per level at the high tier.
- **Solver:** `node tools/solve.js --all` passes for every level.
- **Full game:** `Game.runSolution(i)` completes every level in the real engine.
- Save QA screenshots to `design/qa/<area>/`.

## 11. Ownership and coordination

| File(s) | Owner |
|---|---|
| `design/design.md`, `tools/harness.js`, `tools/shot.js`, `tests/testbed.js` | orchestrator |
| `js/geom.js`, `tools/solve.js`, `tests/geom.test.js` | geometry agent |
| `levels/levels.js` | geometry agent writes the seed levels, then hands over to the level designer |
| `js/engine.js`, `index.html`, `tests/engine-*.js` | engine agent |
| `js/blocks.js`, `assets/tex/*`, `art-src/tex/*`, `tests/blocks.html` | materials agent |
| `js/decor.js`, `assets/decor/*`, `art-src/decor/*`, `tests/decor.html` | decor agent |
| `js/world.js`, `assets/sky/*`, `art-src/sky/*`, `tests/world.html` | world agent |
| `js/hero.js`, `art-src/hero/*`, `tests/hero.html` | hero agent (Codex writes the code) |
| `js/fx.js`, `tests/fx.html` | FX/audio agent (Codex writes the code) |
| `js/ui.js`, `assets/ui/*`, `art-src/ui/*` | UI agent |

- **Requests:** to ask another module for a change, append to `design/requests.md`, one line in the form
  `- [from → to] request`. The orchestrator relays it. Never edit another agent's file.
- Do not commit or push. The orchestrator does that.
