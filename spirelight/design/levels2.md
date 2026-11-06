# Spirelight: levels 6–10 (design notes)

These levels live in `levels/levels2.js`, which loads after `levels/levels.js`. Verify them with `node tools/solve.js --all`. Each level was designed on paper first, then built and iterated with the solver until its shortest solution matched the intent. After that, each was checked in the SVG schematics (`design/qa/levels2/<id>.png`) and in the engine at 390×844 (`design/qa/levels2/6.png` … `10.png`).

## The arc

| # | id | Chapter / theme | Place | New idea (the aha) | Shortest solution | Actions | Mechanisms |
|---|---|---|---|---|---|---|---|
| 6 | two-crossings | Lanterns / night | harbour clock tower | One drawbridge, two crossings. The lowered deck hides the quay that lies behind it. | mech draw 0 · walk isle · mech draw 90 · walk goal | 4 | 1 |
| 7 | veiled-steps | Veils / aurora | observatory | A veil pillar on a dial. Every broken step is whole while the pillar stands in front of it. You begin *behind* the pillar. | walk court · mech dial 90 · walk ledge · mech dial 180 · walk goal | 5 | 1 |
| 8 | greenhouse-spire | Veils / aurora | glasshouse | One planter is a carousel, a bridge by looks and a hedge veil. A plate on the far side lifts a step. | walk hub · mech planter 90 · walk p1 · walk hub · mech planter 180 · walk goal | 6 | 2 (+ plate) |
| 9 | clock-spiral | Daybreak / dawn | clockwork ring stair | The Penrose loop is required: the ring's foot joins its own top (k = 2). The minute hand is the last bridge. | mech hand 0 · walk hub · mech hand 90 · walk goal | 4 | 1 |
| 10 | beacon-spire | Daybreak / dawn | the tall spire | The lift plays three parts. It carries you; its **middle stop** is the route (it joins the back balcony by looks); sent up **empty**, its glass canopy is the veil for the last broken step. | walk bell · mech lift 0 · walk car · mech lift 2 · walk crown · mech lift 3 · mech turret 0 · walk goal | 8 | 3 (+ plate) |

- **Difficulty:** levels 6, 7 and 8 rise in required actions (4 → 5 → 6) and in distinct ideas (1 → 2 → 3).
- **Level 9:** a breather. It is short, but its aha (the loop) is the strongest single illusion in the game.
- **Level 10:** the only level with three interacting mechanisms.
- **Note for the levels 1–5 designer:** after their rework, level 5 (chime-stair) needs 7 actions, so the chapter II curve dips at level 6. Level 6 is the chapter's new-rule level (the x/z lock), so the dip is acceptable, but it is worth knowing.

## Rules I designed against (geometry notes)

- **x/z rotors have walkable tops only at angle 0.** A tile needs its *reference* top to face +y, so a drawbridge flipped to 180 is upside down and never walkable. The review's "flip it to 180" version of level 6 cannot work. The level 6 design reaches "two crossings" through occlusion instead: lowering the deck covers the quay, and raising it uncovers it.
- **Every veil hides a pair of one fixed shape.** Take a lower tile W1 and a step W2 = W1 + (1,1,0), with the junction on W1's −z edge, or W2 = W1 + (0,1,1), with the junction on W1's −x edge. The veil must sit at W1 + (2,2,1) or W1 + (1,2,2), plus m·(1,1,1) with m ≥ 0. Levels 7, 8 and 10 were placed with this rule, and the helper `veilfind` confirmed each placement.
- **Anything screen-identical with a route tile hides it.** A block that differs from a tile by k·(1,1,1) with k > 0 covers it. Behind a 2×2 shaft, tiles are only visible where |x − z| ≥ 3, or where they sit above the shaft's top. This drove the back climb in level 10 and the floating beacon ledge in level 9.
- **A tile beside a nearer step's back edge joins it freely**, without a veil. Every veiled step therefore keeps its "back neighbours" free of tiles. This is why level 10's back walkway runs along x = −1.

## Level notes

### 6 · Two Crossings (night)

**Idea.** The z-rotor drawbridge (pivot on its dock end, angles 0 and 90, start 90) spans dock → isle when lowered. The quay `(2,-1,1)` lies one lower and one further back, so it is screen-identical with the deck's isle-side plank. While the deck is down, the deck covers the quay. Raise the deck again and the quay appears exactly where the plank was, joined to the isle by looks (k = 1).

**Aha.** You cannot raise the bridge while standing on it (the lock wiggle). Cross, step off, then raise it, and the "bridge" is still there.

**Route.** From the quay, two stairs hug the dock's front and a third and fourth climb the tower's flank to the beacon, which stands in front of the clock-tower spine.

**Glimmers.**
- **g1** `(1,-2,-1)`: a perch hanging behind the isle that joins the isle's back tile by looks (k = 2). A look-around.
- **g2** `(3,1,4)`: a floating balcony that joins the deck's front edge only while the deck is lowered. A look-around.
- With a single two-valued mechanism, every state is a solution state, so neither glimmer can depend on a non-solution state.

**Hint.** "A lowered bridge can hide what lies beneath it."

### 7 · The Veiled Steps (aurora)

**Kept.** The original's idea: a veil pillar on the arm of a turntable dial (y-rotor, 4 angles).

**Changes:**
- **The start.** Wick now starts on a raised marble dais, and the pillar starts in front of the dais's step down. The level *shows* the rule before asking you to use it. A walk before the first turn makes the level 5 actions.
- **The pillar's angles.** The pillar's reference position is now the dais corner, so the dial reads 0 = dais, 90 = ledge, 180 = upper walk, 270 = the alcove.
- **g2 (new).** It sits on a stepped alcove carved into the observatory wall: the niche `(2,1,3)` behind the dais, then the marble step `(3,2,3)`. That step joins the niche only with the pillar at **270**, a position the solution never uses. Wick must turn the dial while still on the dais, collect g2, then turn back.
- **g1.** Kept: the balcony off the upper walk.
- **Portrait.** The courtyard was trimmed to two rows, so the walk span is now 6.4 world units.

**Hint.** "Behind the pillar, a broken step is whole again."

### 8 · Greenhouse Spire (aurora)

**The planter** is a y-rotor with a wooden hub, a two-plank arm, and a topiary trunk whose clipped crown `(4,4,2)` is `style:"hedge", kind:"veil"`. Each angle gives it a different role:

| Angle | Role |
|---|---|
| 0 | the arm docks at the potting terrace (start) |
| 90 | ridden there with Wick aboard, the arm meets the far walk by looks (k = −1) |
| 180 | the arm meets the step stone by looks; at the same time the hedge crown stands in front of the broken step from the stone up to the terrace, so Wick walks behind the hedge |
| 270 | the arm meets the g1 perch |

**Plate.** `p1` on the far walk raises the step stone (a slider). A pipe runs from the plate toward the stone.

**Why 6 actions.**
1. You must board the planter before turning it, because the terrace is only adjacent at 0.
2. You must ride it to 90.
3. Walk to the plate.
4. You must come **back aboard**: from the far walk, turning to 180 would strand you.
5. Ride to 180.
6. Walk up.

**Glimmers.**
- **g1:** needs angle 270, a non-solution state.
- **g2** `(1,1,0)`: joins the flank of the arm's tip by looks while the arm points back (90). A look-around.

**Hint.** "The planter is a bridge, a carousel and a curtain. Ride it."

### 9 · The Clockwork Stair (dawn)

**The P0-3 fix, applied as verified:**
- The start moves to `(5,0,6)`.
- The front flight `(3,1,6)` becomes `up:"+x"`: edge-on, visibly broken, with tufts, vines and ivy on it.
- g3 sits at `(2,1,6)` and is reached only by walking *down* from the top.

The only way up is the loop: the ring's foot `(0,0,0)` joins its own top by looks (k = 2).

**Intended warning.** `stair base:3,1,6 is never walkable` is on purpose: it is the broken flight.

**New second half.** It replaces the bridge, walkway, plate and lift that were copied from level 3. The clock's great minute hand is a 3-cell y-rotor (wood, with a brass hub) on a spindle beside the dial platform:
- It starts at 90, pointing across.
- Turned to 0, it docks against a short stair up from the platform. Board it.
- Turned back to 90 with Wick aboard, its far tip touches the floating beacon ledge.

The beacon ledge floats in front of a slender clock-tower spine. The spine starts at y = 1, so it never covers the ring's back row: cells where y = z, or y = z + 1, would cover it.

**Glimmers.**
- **g1:** the front spur.
- **g2** `(4,2,-1)`: off the hand's back tip, by looks. A look-around.
- **g3:** reached by walking down from the top.

**Hint.** "Where the stair begins, it also ends."

**Known limit.** The ring's back tiles `(1,0,0)` and `(2,0,0)` are drawn behind the platform's stair and spindle. They are still walkable, and the loop's junction at `(0,0,0)` is visible, so on screen the ring reads as passing behind the clock. The ring makes this the widest of my levels (block span 9.2 world units, walkable span 6.4).

### 10 · Beacon Spire (dawn, finale)

**Composition.** A central 2×2 shaft with a crown. The route winds:
1. bottom dock
2. ferry
3. lift on the shaft's right face
4. back balcony
5. stairs behind the shaft
6. walkway over the back
7. crown
8. turret
9. summit

A slender spire rises behind the beacon. It fits portrait: the walkable span is 5.7 world units wide and 9 tall.

**Mechanisms:**
- **Ferry** (y-rotor, angles 0 and 180, *no handle*). Its brass hub is a bell-stone plate (`step:1`). Stepping on it swings the plank arm from the dock to the lift's foot.
- **Lift** (slider, stops 0/2/3, starts at 3). Its car carries a glass canopy two cells above it, a veil column. Its three parts:

  | Stop | Part it plays |
  |---|---|
  | 2 (middle) | **the route**: the car's back edge meets the back balcony by looks (k = −1) |
  | 3 (top) | a decoy for Wick (only the g1 balcony is there); sent up **empty**, the canopy at `(3,5,1)` veils the broken step from the crown `(1,3,0)` up to the turret top `(2,4,0)` |

- **Turret** (y-rotor; its hub is the turret top). It turns the last stair. It starts at 180, edge-on; at 0 it climbs away to the goal. A callback to level 2.

**Aha.** Getting *off* the lift halfway and then sending it on without you.

**Glimmers.**
- **g1** `(3,3,2)`: reached only by riding the lift all the way up, which the solution never does. A non-solution state.
- **g2** `(-1,5,-1)`: at the summit, tucked behind the beacon plinth. You must walk past the goal tile and round the plinth: a look-around. A goal only counts when a walk ends on it.
- **A summit glimmer via turret 270 is impossible.** At 270 the stair's high end lands exactly on the screen spot of the back walkway tile `(0,3,-4)`, joining it with k = −2, so it would only loop back.

**Hint.** "The lift need not carry you all the way. What rides it when you don't?"

## Originality and acceptance (P0-2)

- **Fresh modules.** Levels 8, 9 and 10 no longer contain level 3's bridge tower, far walkway, plate or lift. Nothing is copied between levels.
- **No shared groups.** I ran a scratch check comparing every non-base group (pivot or slider axis, plus its exact cell set) across all 11 entries. It found no duplicates.
- **No new genre clichés.** Domes and plates are drawn by the decor module.

## Composition and decor (P1-6, P1-8, P1-9, P1-13)

**Per-level figures:**

| Level | Cells | Decor items | Walk span sx (≤ 6.5) | Block span sx |
|---|---|---|---|---|
| 6 | 167 | 54 | 4.9 | 7.8 |
| 7 | 195 | 54 | 6.4 | 8.5 |
| 8 | 163 | 53 | 5.7 | 7.1 |
| 9 | 163 | 54 | 6.4 | 9.2 |
| 10 | 155 | 58 | 5.7 | 7.8 |

All five are taller than wide. The engine's portrait fit frames the walkables, handles and beacon, so block mass may bleed off the edges (level 6's tower crown is pannable).

**Every level has:**
- a spine behind the beacon
- one or two `keel`s
- `strut`s to floating perches
- `corbel`s under overhangs
- railings on non-junction drops
- gears and pipes at each mechanism
- lanterns along the walks, unlit for the cascade, with at most one lit window

**Mechanism dressing:**
- **Chains:** on level 6's drawbridge, level 10's lift canopy and level 9's minute hand.
- **Plates (P1-8):** level 8 has a pipe from p1 toward the step and a chain plus rail on the step. Level 10's plate is on the ferry it moves, so it needs none.
- **Strut and chain items carry an `at` as well:** the engine seeds decor from `item.at`.
- **Styles:** 4–5 block styles per level, sandstone first.
