# Spirelight: review lead's fix list

2026-11-06. An independent review of levels, visuals, interaction, originality and code. No game files were edited.

**Evidence** is in `design/qa/review-lead/`:

- **Probes:**
  - `probe-sizes.js`: Wick's height in px, tile size, screen fill and handle positions for every level at 390×844.
  - `probe-drag.js`: drags a handle in six directions.
  - `probe-visual.js`, `probe-themes.js`: screenshots.
  - `probe-intro-*.js`: DOM and class traces for the intro card.
- **Shots:** `*.png`.
- **Solver diagrams:** `<level-id>.svg/.png`, solution states.
- **QA bot images reused:** `design/qa/review/L*-p.png`.

Level redesigns marked **(verified)** were checked with `SpireGeom.solve` on a scratch copy of the level.

## Top 5 changes that would most improve the game

1. **Fix the dead crank drag (P0-1).** On level 2, the crank tutorial, dragging the crank does nothing in any direction: `mechMove` delta is 0. Only a tap moves it, yet the hint says "Drag the brass crank".
2. **Stop recycling one puzzle (P0-2).** Levels 3, 8, 9 and 10 reuse the same bridge tower cell for cell, and level 10 is level 8 plus a dock. The second half of the game is the same "turn the bridge to 90, walk to p1" four times.
3. **Make the Clockwork Stair need its stair (P0-3, verified fix).** Today the titular ring is optional scenery.
4. **Make portrait readable (P0-4).** Wick is 19–23 px tall on levels 5, 6 and 10. Tiles are 23–27 px wide, smaller than the 36 px handle hit radius. On level 6 the level uses only 137 of 844 px of screen height.
5. **Restore the key art's lighting (P1-1, P1-2).** Dusk and dawn read as pale pastel and night reads as bright royal blue. Ambient and environment fill flatten every face, and pavers, sandstone, marble and Wick all sit at nearly the same brightness. This is both the biggest "super detailed" gap and an originality risk, because pastel is the look we were told to avoid.

---

## P0: must fix before release

**P0-1. engine: rotor drag is dead when every block of the group is on the pivot axis.**

- **Evidence:** `probe-drag.js test 2 turntable` reports `cur` = 0 for drags right, left, up, down and both diagonals, while a tap steps to 90. On level 2 the turntable cells (2,0,1) and (2,1,1) lie on the pivot (2.5, ·, 1.5).
- **Cause:** `g.blockRef` ("farthest from the pivot axis") lands on the axis. `tangent()` then returns 0, and `onMove` exits at `den < 1e-6`.
- **Fix:** in `dragRef`/`onMove`, when `|T|` at both `handle.ref` and `blockRef` is under about 0.6 px/°, switch to a **rotary gesture**:
  - Δvalue = the change in `atan2(pointer − handleScreenCentre)` in degrees.
  - The sign comes from whether the axis points toward the camera (y: clockwise on screen is +).
  - Use the rotary gesture as the default for `crank` and `wheel` handles on y-rotors anyway. It feels like turning a crank, whereas pushing a far block feels like nothing.
- **Regression test:** add a drag test (not only `setMech`) for every handle in `tests/engine-*.js`. Level 4's slider and level 6's z-rotor drag correctly today.

**P0-2. levels: chapters III–IV recycle level 3.**

- **The shared module:** levels 3, 8, 9 and 10 all use:
  - `bridge` rotor, pivot [4.5,0,2.5], hub (4,2,2), wood (5..6,2,2)
  - far walkway (1..3,1,-2), plate p1 (1,1,-2), plate-lift (0,0,-2)
- **Exact copies:** level 10's greenhouse section is level 8's, cell for cell, including glimmers g1 (1,2,2) and g2 (-3,2,0).
- **Fix:** keep level 3 as the one "bridge by looks" lesson. Rebuild the others so that each adds a new combination:
  - **Level 8 (Greenhouse):** make the veil a **hedge** (`style:"hedge", kind:"veil"`) on a y-rotor planter, so one mechanism plays two roles: at 90 its bridge arm meets a far walkway by looks, and at 180 its hedge hides a broken stair. Drop the copied tower, plate and lift.
  - **Level 10 (finale):** a vertical spire. Start at the bottom dock and reach the beacon at the summit, with the route winding up around a central shaft (this fits portrait).
    - Its "aha" should be a new combination, not a checklist. For example, the lift's middle stop *is* the route, not only a glimmer ledge (g3 today).
    - Or a rotor that carries the veil pillar, so that turning the bridge also moves the veil.
    - No module copied verbatim from earlier levels.
  - **Acceptance:** after the rework, no two levels share a group with an identical pivot and blocks.

**P0-3. levels: level 9's shortcut makes the "Clockwork Stair" pointless.** The start (0,0,0) joins the ring's top (2,2,3) by looks (k=2), and (1,0,0) joins the platform and hub. The ring lap is never walked, and the hint ("Follow it round and keep going") misleads.

- **Verified fix:**
  1. Move `id:"start"` to a new brick cell `{at:[5,0,6]}`, the front-right corner of the ring.
  2. Change `{stair:[3,1,6]}` to `up:"+x"`. The front flight becomes edge-on and visibly broken, so the long climb is impossible.
  3. Add `{at:[2,1,6], style:"marble", id:"g3"}`. It can only be reached by walking *down* from the top.
- **Result:** the solver gives `start > …x=5 column… > z=0 row > (0,0,0) > top (k=2)`. The only way up is to walk the ring's foot into its top, so the impossible loop becomes the aha. The solution, `[bridge 90, walk p1, draw 0, walk goal]`, is unchanged, and all 3 glimmers are reachable.
- **Follow-ups:**
  - The solver's new warning, "stair 3,1,6 never walkable", is intended. Add rubble/crack decor to the flight.
  - New hint: "Where the stair begins, it also ends."

**P0-4. engine + levels: portrait scale.**

- **Measurements at 390×844:**

  | Level | Wick height | Tile size |
  |---|---|---|
  | L6 | 19 px | 23 px |
  | L10 | 21 px | 24 px |
  | L5 | 23 px | 27 px |
  | L7, L9 | 27 px | 32 px |
  | L1–L4 | 35–39 px | – |

- **Screen use:** the walkable area spans 297×137 px on L6 and 308×178 px on L5, leaving about 60% of the screen as empty sky.
- **engine (`computeFitBox`/`fitCamera`):**
  - In portrait, fit to **walkables + handles + beacon**, not to taper and decor. Let the underside bleed off the bottom.
  - Use a 10% margin, as the spec says (the code uses 4%).
  - Enforce a minimum of **34 px per tile**. When the level is bigger than that allows, allow one-finger pan (drag on empty sky) and an auto-follow that keeps Wick in the middle 60%.
- **levels:** in portrait a level's screen footprint should be taller than wide. Aim for an `sx` span ≤ 6.5 world units (about 9 tiles across).
  - L5, L6 and L10 are wide diagonals and need re-blocking into vertical stacks (see P1-9).
  - Add this rule to `levels.md`.

**P0-5. engine: the handle hit area swallows walk taps on small levels.**

- **Problem:** the hit radius is a fixed 36 CSS px and takes priority over walking, and a tap without movement *steps the mechanism*.
  - On L5, L6 and L10 a tile is only 23–27 px, so a tap on a paver next to a crank turns the bridge instead of walking.
  - L10's draw and elevator handles are 64 px apart, so their hit circles overlap.
- **Fix:**
  - Set `radius = clamp(0.75 × tilePx, 22, 36)`.
  - If `geom.pick` finds a walkable directly under the pointer (first ray, not the tolerance ring) and the pointer is more than `0.5 × radius` from the handle centre, walk instead of grabbing.

---

## P1: should fix

### Puzzle and level design

**P1-3. levels: level 6 is shallow and contradicts its own intro.**

- **Problem:** both cranks are on the base, so the shortest solution is `drawA 0, drawB 0, walk goal` (3 actions, no thinking). The intro says "Wake them one at a time". The x/z lock rule, which the hint teaches, never matters.
- **Redesign, "one bridge, two crossings":** use a single z-rotor drawbridge.
  - At 0 it spans dock→isle. At 180, flipped over a pivot on the isle's far edge, it spans isle→far ledge by looks (k=−1).
  - The player must cross, **step off** onto the isle, then flip it. Turning it while standing on it triggers the lock wiggle, which teaches the rule.
  - Move the isle or ledge so that the flipped deck has empty cells. The pivot needs y below the isle top.
- **Acceptance:** the solver's shortest path is ≥ 4 actions, with a `mech` after the first `walk`.

**P1-4. levels: level 5 has no decision.**

- **Problem:** p1 (2,0,3) sits on the only path from the start, so the level plays itself: walk, ride, walk.
- **Fix:**
  - Move p1 off the main path, so the span must be *found*.
  - Make p2 a counting plate: `{tile:"p2", group:"arm", step:1}` with arm angles [0,90,270]. The player re-steps onto it to "ring" the arm round, which fits "Chime".
  - My quick test failed with overlaps: at 180/270 the arm hits the belfry wall (3..5,2..4,-1) and the goal tiles. Re-block the arm's sweep first.
- **levels/decor:** the hint says "Orange rings are pressure plates", but the plates render as bronze discs on brass grating. Either change the hint or add the orange ring (P1-12).

**P1-5. levels: handles sit on faces the camera cannot see.**

- **Level 3:** the bridge crank is on face `-x` of (3,2,4), so only a floating ring shows (`l3-intro-p.png`). **Verified fix:** add `{at:[3,3,4], style:"brass", walk:false}` and set `handle:{type:"crank", at:[3,3,4], face:"+y", on:"base"}`. The solution and glimmer are unchanged and there are no warnings.
- **Level 10:** the elevator knob is on face `-x` of (9,0,4). **Verified fix:** `handle:{type:"knob", at:[9,0,5], face:"+z", on:"base"}`.
- **Prevention:** add a solver or engine lint that warns when a handle face is `-x`, `-z` or `-y`.

**P1-6. levels: glimmers.**

- **Count:** there are 14 today (the title screen says "0 / 14"; the brief said 13), and the target is about 20. Several are just one tile off the path (L1 g1, L5 g1), and L10's g1/g2 are copies of L8's.
- **Rule:** a good glimmer needs a **non-solution state** or a **look-around**.
- **Additions:**
  - L4 g2 at (4,4,0), the far end of the gallery (verified reachable).
  - L9 g3 at (2,1,6) (verified, P0-3).
  - L2 g2 on a ledge that is reachable only with the turntable at 90 or 270.
  - L7 g2 that needs dial 270 (today 270 reaches nothing new: 9 tiles, the same as 90 and 180).
  - L6 g2 that needs the bridge raised again after crossing.
  - Two in the new L10, one of them at the summit beside the beacon.
- **Verification:** run `solve.js --all` after each addition.

**P1-7. levels: difficulty curve.**

- **Current shape:** 1 trivial → 2 → 3 (illusion and plate at once) → 4 (lift, easier than 3) → 5 linear → 6 shallow → **7, the hardest and best** → 8, 9, 10 repeat level 3.
- **Fix:**
  - Swap the content of levels 3 and 4 so the lift comes before the first illusion. Keep the themes by setting `theme`/`chapter` per slot.
  - After P0-2, make level 8 > level 7 > level 6 in required actions *and* distinct ideas.
  - The finale should be the only level with ≥ 3 interacting mechanisms.

**P1-8. levels: plates do not telegraph what they move.** After a plate fires on L3, L5, L8, L9 or L10, the moving part is often off in another corner.

- **levels:** run a `pipe` or `chain` decor along the base from each plate toward its target group.
- **fx:** on the `plate` event, send a 0.6 s spark along a straight screen-space line from the plate's `pos` to the target group's centre (it is in the `plate` payload's `group`).

**P1-9. levels + decor: compositions are scattered chunks, not spires.**

- **Spire-shaped:** L4, L7 and the title read as spires.
- **Not spire-shaped:**
  - L3, L5, L6, L9 and L10 are 2–3 separate slabs at different heights.
  - L2 is one flat slab.
- **Fix, without touching the geometry:**
  - (a) Give every level a central **spine**: a tall non-walkable shaft that rises behind the beacon.
  - (b) Use one shared **keel** under the whole footprint. Today the underside is a tiny `taper` plus one copper finial; the key art has stepped corbel rings, a gear cluster and a long brass pendant.
  - (c) Visually tie floating islands to the spine with **decor struts and arches**. Decor never takes part in the raycast, so struts cannot break illusions.
- **New decor types:** `keel` (params `w`, `d`, `depth`) and `strut` (`from`, `to`).

### Visual quality

**P1-1. world: exposure, fill and sky per theme.** The key art is deep teal/violet over saturated orange; ours is pale cyan-pink (dusk) and white-peach (dawn). The fill is too strong: hemisphere 0.85–1.0 plus a PMREM sky environment on every block, against a key light of only 1.4. As a result every face has nearly the same brightness, and cast shadows barely show (`l1-intro-p.png`, `l9-p.png`). Starting values in `DATA`:

| Theme | Exposure | Key light | Hemisphere | Other |
|---|---|---|---|---|
| dusk | 0.95 | 2.1 | 0.45 | Sky gain about −20% at the top, so the zenith reads `#1d1b45`. |
| night | 0.78 | 0.8 (moon) | 0.4 | Turn `rays` and `glare` off (night currently shows sun rays, `L4-p.png`). Zenith navy `#0d1030`. The lantern cascade should be the brightest thing on screen. |
| aurora | 0.9 | – | 0.5 | Cloud sea darker (mint is too bright and saturated). |
| dawn | 0.92 | 2.2, low from the left | 0.5 | Cloud sea at peach mid-tone, not white. Lower the glare. |

- Keep all mist screen-space.
- Compare every change side by side with `art-src/style/style-1.png` at 390×844.

**P1-2. blocks: the material palette lacks value separation.**

| Material | Current | Fix |
|---|---|---|
| sandstone | tint `0xfff2e4` (near white), so its texture reads pale peach, the same as the pavers | Tint about `0xf0c08e` so sides read honey `#d9a46a`→`#b97a4a`, against cream pavers `#efe2c6` |
| marble (plinths) | rough 0.34: glossy bathroom marble | rough 0.6, warmer tint |
| scene environment on stone | – | `envMapIntensity` ≤ 0.3 on all non-metals (`useSceneEnvironment`) |
| pavers | specular hot spots (`wick-crops.png`) | rough 0.85; keep the albedo below the bloom threshold |
| slate | saturated violet-blue cubes (L4, L7, title) | Darken and desaturate toward `#3b3d5c`; add a roof-tile ridge so a roof does not read as a purple box |

**P1-10. blocks/decor: hedge and wood.**

- **Hedge (L8, L10):** reads as a grid of separate rounded leafy cubes with visible seams. Merge adjacent hedge cells into one continuous mass with an irregular silhouette (leaf cards overhanging the edges), and use darker inner AO.
- **Wood (drawbridges in L6, L9, L10):** raised, they read as plain wardrobes. Add iron straps and plank gaps, a hinge barrel at the rotor pivot (`decor` type `hinge`, which the engine can add automatically for x/z rotors), and chains to the nearest post.

**P1-11. hero: Wick is gold on cream and disappears.**

- **Problem:** in `wick-crops.png`, the body hue matches the pavers and the lantern glow casts no visible pool. On L6 the streetlamp next to him reads more strongly than he does.
- **Fixes:**
  - Darker bronze legs and torso (keep the brass highlights).
  - A larger, more saturated teal scarf.
  - `hero.light` intensity ×1.6, plus an additive warm ground decal (radius about 0.6) under him.
  - A thin dark rim or contact shadow.
  - Scale 1.15×.
  - Readability check: Wick must be the highest-contrast object within 2 tiles of him in every theme.

**P1-12. decor: interactive things need one consistent language.**

- **Problem:** plates, the walkable brass hub and lift tops all use the same brass grating, so plates and walkable machinery look the same.
- **Fixes:**
  - **Plates:** stone with a round inset, an orange emissive ring, and a small bell or chime stone. This is also more original than plain discs.
  - **Handles:** add a subtle brass "grab" collar that stays visible after the hint ring stops pulsing (today the ring vanishes for good after first use, `g.used`).
  - **Raised drawbridges:** add an arrow-like chain cue.

**P1-13. decor + levels: detail density is below the key art.** Large sandstone walls are bare planes with one tiny window. Per level:

- A carved **trim band** at each platform's top edge (blocks: a cornice bevel on every exposed face whose cell above is empty).
- **Corbel brackets** under every overhang (decor `corbel`, or automatic from blocks).
- **Railings** on edges over long drops that are not junctions.
- **Gear trains** at every rotor pivot (engine: an automatic `gear` decor on the pivot face).
- **Pipes** linking the machinery.
- **Target density:** about 40–60 decor items per level, against 14–35 today. Lean on instanced and shared geometry (see P1-14).

### Interaction and UX

**P1-14. engine: draw calls.**

- **Measurements:** my probe at 21:10 measured 205–290 calls on L5–L10. The QA bot at 21:20 measured 120–171. L9 and L10 are still over the 150 budget.
- **Status:** the engine agent is on this. Keep the draw-call budget in mind before adding the P1-13 decor:
  - Merge static decor per level by material.
  - Instance lanterns, windows and flowers.

**P1-15. ui: the level-complete card hides the payoff.**

- **Problem:** the card covers 60% of the portrait screen and the whole lit spire (`l9-complete-p.png`, `design/qa/engine/level9-done.png`), right after the beacon cascade.
- **Fix:**
  - Hold the card until the cascade ends (about 2.5 s after `beacon`).
  - Show it as a compact bottom sheet: the title, the glimmers and one primary button, below the diorama.
  - Let a tap anywhere skip the wait.

**P1-16. engine: tap feedback during motion.** `onDown` silently drops taps while any mechanism moves (`if (anyMoving()) return`). Queue the tap and walk once the mechanism settles (`pending` exists for mechanisms), or at least show the "can't" ripple.

---

## P2: nice to have

**P2-1. ui: title wordmark collides with the tower.** In portrait the tower's crown sits under "LIGHT" and the tagline; in landscape the T touches the tower (`title-p.png`, QA notes 1–2). Fix either way:

- Give the `title` level a `view` override that sits about 1.5 units lower.
- Or move the wordmark up and shrink the diorama. The beacon should be visible.

**P2-2. ui: intro card timing.** It is a fixed 3.8 s timer from `levelStart`. Its children fade in over 0.9–1.45 s, so it is fully readable for only about 2.3 s, and on a slow first frame it can vanish before it is seen. (It is not broken: traced, it shows at +3.3 s and hides at +9.1 s in headless.) Start the timer on the first rendered frame after `levelStart`, and dismiss it on the first input.

**P2-3. ui: the HUD backdrop leaves a visible tone seam** about 100 px from the top on night levels (`L4-p.png`, `L5-p.png`, `L6-p.png`). Feather the HUD gradient over 60 px or remove it.

**P2-4. fx/engine: path preview.** On a walk tap, draw a faint dotted line of the route for 0.4 s. This works with the `path` event points and sells impossible joins, because the line visibly "jumps". Hide the join with a sparkle at `heroStep` when `k ≠ 0`.

**P2-5. levels: hint text.**

- L9: see P0-3.
- L6: "Raised bridges sleep. Wake them one at a time" is false today; fix it or redesign per P1-3.
- L10: the hint is a checklist ("drawbridge, lift, bridge, plate, pillar"). After P0-2, rewrite it as a nudge.

**P2-6. world: the waterfall reads as a laser beam** falling into the clouds (L1–L4). Widen it toward the bottom, add spray puffs where it meets the cloud sea, and lower its emissive so bloom does not turn it into a white line.

**P2-7. engine: per-frame allocations (minor):**

- `updateFX` allocates `var o=[0,0,0]` every frame.
- `safe(function(){…})` closures are created every frame in `updateHero` (hero.update), `tickMech` (spin) and `updateFX` (setHover).
- The literal `[0.05,0.4,0.8][i]` is built inside the crossing loop.
- `updateGoal` calls `b.worldPos()` with no target.
- **Fix:** hoist them all to module scope.
- **Also:**
  - `if (!lock.goalPhase || true)` is dead code.
  - A `decorUpdaters` item that throws is spliced out silently. Log it once with the decor type so bugs are not hidden.

**P2-8. engine: the test timeout is tight.** `runSolution` uses a fixed 60 s timeout, and L10 needs 57.9 s headless (QA notes). Scale it with solution length, or run tests with `Game.timeScale = 3`.

**P2-9. engine: double resize.** Both the ResizeObserver and `window.resize` are registered. The `cam.sized` check makes it harmless, but drop the window listener when ResizeObserver exists.

**P2-10. levels/fx: L1 "First Light"** is a trivial walk by design. Make the payoff the lesson: put the glimmer behind the tower's back corner, so the first level teaches "look around the spire".

---

## Originality check

- **Clean:**
  - The name, Wick (a brass lantern-head automaton), the clockwork and lamplighter fiction, the beacon cascade, and the chapter themes.
  - No princess, crow people or totem; no level is a recreation of a known one.
  - L9's loop is the public-domain Penrose stair.
- **Risks:**
  1. **The skies drift pastel.** Dusk and dawn are the soft cyan, pink and peach of the very style section 0 forbids. Fixing P1-1 also fixes this.
  2. **L2 matches a genre-famous first puzzle** (crank-turn a path into place). The stair-on-turntable framing is ours, but give it our own dressing: a gear-driven turntable with a visible clock dial, not a bare crank on a plinth.
  3. **Round pressure discs and teal onion domes** echo the genre's iconography. Prefer chime-stone plates (P1-12) and copper or verdigris lantern-domes in line with the key art's brass cage.

---

## Report

The game runs clean: all ten solutions complete with no errors. The weak spots are in feel, structure and lighting.

- **Feel:** the crank tutorial on level 2 cannot be dragged (P0-1). Separately, on small levels, taps meant for walking turn mechanisms instead (P0-5).
- **Structure:** the back half of the game reuses level 3's bridge tower verbatim in levels 8, 9 and 10, and the finale is level 8 plus a dock (P0-2).
  - Level 9's own stair is optional because of the k=2 shortcut. A solver-verified three-line fix makes the impossible loop the required aha (P0-3).
  - Level 6 is solvable in one trip and its intro contradicts it.
  - Level 5 plays itself (P1-3, P1-4).
- **Portrait:** Wick is 19–23 px tall on levels 5, 6 and 10, with about 60% of the screen empty. This needs an engine fit change and taller level footprints (P0-4).
- **Lighting:** heavy fill, high exposure and a pastel sky flatten everything away from the key art. This also moves toward the forbidden pastel look (P1-1, P1-2).
- **Readability:**
  - Wick blends into the pavers (P1-11).
  - Plates look like walkable brass (P1-12).
  - Two handles sit on faces the camera cannot see, with verified relocations (P1-5).
- **Glimmers:** 14 today. Six are proposed to reach about 20, each tied to a non-solution state (P1-6).
