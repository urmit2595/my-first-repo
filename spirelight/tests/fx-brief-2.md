# Brief 2: SPIRELIGHT FX (`js/fx.js`, `tests/fx.html`), continue from the current files

Run 1 was killed by a container restart. Its files on disk are the starting point: `js/fx.js` (about 695 lines, passes
`node --check`) and `tests/fx.html`. Do not start over. Keep what works, and fix what is listed below.
Write only `js/fx.js` and `tests/fx.html`. Do not edit `design/design.md`, `js/engine.js`, `js/ui.js`, `index.html`,
`levels/`, or other agents' files. Do not git commit. Do not install packages.

Read `design/design.md` sections 7.7 and 8 again. Section 8 has been updated. The earlier brief (`tests/fx-brief.md`)
still holds the full effect and audio list, so use it as the reference for anything not covered here.

## 1. Event payload changes (design.md section 8, now authoritative)

Every event position is a **world** `[x,y,z]` array in `d.pos`. Use it first. Use the tile lookup only as a fallback.

- `tap`: `{ x, y, tile, reachable, pos }`. Ring at `pos` (world). `pos` may be missing on an unreachable tap with no
  tile. Fall back to the raycast on the plane y = 1.
- `plate`: `{ tile, group, pos }`. Use `pos`.
- `glimmer`: `{ tile, count, total, pos }`. Use `pos`.
- `mechTick`: `{ id, pos }`. Use `pos` for the sparks.
- `mechSnap`: `{ id, value, pos }`. Use `pos` for the burst and ring. Keep the pivot-node fallback.
- `beacon`: `{ index, pos }`, world coordinates. This is the cascade origin.
- `heroStep`: `{ from, to, k, at }`. `from` and `to` are walkable ids (strings). `at` is the world `[x,y,z]` of the
  junction. Use `at` for the `k ≠ 0` shimmer. Do not use the old "from may be a point" handling.
- Dust puffs at Wick's feet: `Game.hero.object3D.getWorldPosition(v)`. Do not use the tile.
- `Game.decor[i].worldPos(target?)` returns a `THREE.Vector3` in world space. If a `target` is passed, fill it and
  return it. Remove the array-handling branch.
- `Game.groups[id].handle.object3D` is used for the handle position when it is present. Otherwise use the group's
  `pivotNode.getWorldPosition`.
- The **engine calls `ignite()`** on the beacon decor. **FX does not call `ignite`.** FX does the cascade: it calls
  `setLit(true, false)` on the other lit decor, sorted by distance from `pos`, and spawns the particles. Keep the
  scheduling on FX's own clock, as before.

## 2. Known problems in the current build (from the screenshot pass)

Screenshots at `design/qa/fx/` (`fx-beacon.png`, `fx-tap.png`, `fx-path.png`, `fx-plate.png`, `fx-glimmer.png`,
`fx-levelComplete.png`). Harness: `node tools/shot.js "tests/fx.html?script=0" OUT --eval "..."`.

- **Plate and glimmer spawn nothing.** The live count stays at 78 (ambient only). The handlers call
  `point(d.tile, a)` and the fake Game has no such tile, so they return early. Fix: use `d.pos` first (section 1).
- **Tap ring works.** `rings` reaches 1. Keep it, but use `pos` first.
- **`played` counters stay at 0 while audio is locked.** Count every request in `played` even when the context is not
  running. Then the tests can check that a call happened. Audio itself still needs a gesture.
- **Audio is locked in headless runs.** `FX.debug().audio` is `"locked"` until `FX.unlock()` runs. Make sure
  `FX.unlock()` creates and resumes the context, and that after it `audio` reads `"running"`. The music bed should start
  (`music.running` true) when `Game.save.music !== false` and `Game.state` is `title` or `play`.
- The light shafts and the ambient motes look right. Do not change them unless a fix is needed.
- The ambient motes are faint on the warm background. A small brightness bump is fine.

## 3. Harness changes (`tests/fx.html`)

Update the fake `Game` so it matches the real payloads:

- Add real tiles to the fake `geom`: `p1`, `g1`, `start`, `goal`, `bridge_1` and a few more, each with a `stand` point
  and `group`. `transform(group)` returns identity with the pivot. This makes the tile fallback testable too.
- `hero.object3D` is a real `Object3D` at a walkable point. `getWorldPosition` works. (It must, since the fx code now
  depends on it.)
- `decor[i].worldPos(target)` returns a `THREE.Vector3`. Fill and return `target` when given.
- Fire the events with the new payloads: `tap` and `plate` and `glimmer` each with `pos`. `heroStep` with
  `{ from, to, k, at }`, where `from` and `to` are ids and `at` is a world point (test `k: 0` and `k: 1`).
- Add a `?audio=1` flag (or a visible "Unlock" button) that calls `FX.unlock()` on the first click, so audio can be
  tested by hand.
- Keep the URL flags from brief 1: `?only=NAME`, `?script=0`, `?reduced`, `?sound=0`, `?music=0`.

## 4. Acceptance (check before you finish)

- `node --check js/fx.js` passes. Load-time code never throws.
- `window.FX` exists before setup. `FX.sound("click")` before `FX.unlock()` does nothing and does not throw.
- After `FX.unlock()` with sound on, `FX.debug().audio === "running"` and `played` increments for each called sound.
- `FX.debug().live <= 1500`, `drawCalls <= 8`, and `rings <= 24`.
- With `?reduced` (`Game.reducedMotion = true`), the ambient live count is about half the normal ambient count.
- Screenshots show every effect: tap ring (gold and red), path dots, heroStep dust, mechSnap burst, plate ring,
  glimmer burst, beacon cascade (lanterns lit one after another, with sparks), levelComplete embers.
- The fake `Game` in `tests/fx.html` fires every event without errors, and the console shows no errors and no page
  errors under `tools/shot.js`.
- No per-frame allocation: no `new` for vectors, colours or matrices inside the update loop.

## 5. Report back

End with a short summary, under 150 words: what changed, which acceptance items pass, and anything you could not
verify. Do not paste code into the summary.
