# Brief: SPIRELIGHT FX and audio (`js/fx.js`, `tests/fx.html`)

You are writing two files in `/home/user/my-first-repo/spirelight/`. Write nothing else. Do not edit `design/design.md`,
`js/engine.js`, `js/ui.js`, `index.html`, `levels/`, or any other file. Do not git commit. Do not install packages.

## Read first

1. `design/design.md` in full. It is the contract. Sections 0, 1, 2 (look and palette), 4.1 (projection), 7.7 (your
   API), 8 (events), 10 (testing) and 11 matter most.
2. `js/geom.js` and `js/blocks.js`, `js/decor.js` if they exist. They may be stubs or missing. Do not depend on their
   internals beyond the contract in design.md section 7.
3. `tests/testbed.js` (the isometric testbed you will use in `tests/fx.html`).
4. `tools/shot.js` and `tools/harness.js` to see how pages are served and tested. The CDN scripts are swapped for local
   copies in tests, so use the same CDN URLs as `index.html`.

The mood reference is `art-src/style/style-1.png`: warm amber lanterns, teal-cyan glow flowers, dusk sky, drifting
light. Effects should feel calm, wondrous and tactile, never busy.

## Module shape

- `js/fx.js` is one IIFE, `"use strict"`, that defines `window.FX`. It never throws at load time. Every event handler,
  frame update and audio call is wrapped in try/catch. If anything is missing (Game.decor, Game.geom, Game.hero, a
  group), skip that effect quietly. The game must still run.
- Define `window.FX` at load time with a working `FX.sound` that does nothing until setup. The boot script calls
  `FX.setup(Game)` after `Game.init`. Setup must be idempotent.
- Public API:
  - `FX.setup(Game)`
  - `FX.sound(name)`: plays a named sound, respecting `Game.save.sound`. Names: `click`, `footstep`, `tick`, `snap`,
    `locked`, `plate`, `glimmer`, `tk`, `beacon`, `complete`. Unknown names do nothing.
  - `FX.unlock()`: starts audio if allowed. Gesture listeners call it. Tests call it too.
  - `FX.debug()` returns `{ live, poolSize, drawCalls, rings, audio, played: {name: count}, music, ambient }` for tests.
- Use `Game.bus.on(ev, fn)` for the events in design.md section 8. Keep the references so `Game.bus.off` could remove
  them. Do not use other engine internals.

## Gestures and audio

- Create the `AudioContext` lazily, on the first `pointerdown`, `keydown` or `touchend` on `window` (capture phase).
  Call `resume()` on that gesture if the context is suspended. Before a gesture, every sound call is a no-op.
- Signal chain: `sfxBus` and `musicBus` feed a `DynamicsCompressor`, then `master`, then destination. Master gain is
  -14 dB, which is `0.2` linear. Keep the buses at sensible relative levels: music about 0.5 of sfx.
- Reverb: a short synthesized convolver. Make the impulse from decaying noise (2.5 s, low-passed tail). No files.
- Respect the settings. `Game.save.sound === false` silences sfx. `Game.save.music === false` silences the bed. Treat
  `undefined` as on. The UI changes these flags on `Game.save` and calls `Game.saveNow()`, so poll the flags about four
  times per second in the frame loop. Fade the bed in and out over 0.8 s. Do not wait for a bus event.
- Stop the bed and cancel scheduled notes when `Game.state` is `loading` or `complete`. Duck the bed while
  `Game.state === "paused"`.
- The music is generative and calm. It runs during `title` and `play`.
  - Key depends on the theme: `dusk` uses D pentatonic, `night` uses A minor pentatonic, `aurora` uses E pentatonic,
    `dawn` uses G major pentatonic. Get the theme from `Game.level.theme` when present (on `levelStart`, `data.level`).
    The title screen uses `dusk`.
  - Pad: two or three detuned triangle voices through a low-pass around 900 Hz. Chord changes every 12 s
    (I, vi, IV, V in that key). Attack 2 s, release 3 s.
  - Music-box arpeggios: a random note every 4 to 7 s, mostly stepwise, never twice in a row. Each note is a sine plus
    a quiet 4th partial, with a 2.5 s decay and a reverb send.
  - Wind: looped white noise through a band-pass around 400 Hz, Q about 0.7. An LFO modulates the gain between about
    0.02 and 0.05. Very quiet.
- Sound effects (all short, synthesized, and quiet enough to sit under the music):
  - `footstep`: soft brass tick, a 1800 Hz sine tick of about 25 ms with a tiny noise click. Vary pitch a little on each
    step.
  - `tick` (mechTick): a brighter ratchet click, about 2500 Hz, 15 ms.
  - `snap` (mechSnap): a low clunk (sine around 90 Hz, fast decay) plus a filtered noise thump.
  - `locked` (mechLocked): a dull thud. Low-passed noise around 200 Hz, 120 ms.
  - `plate` (press): a low thud plus a soft bright tone a fifth above.
  - `glimmer`: an FM bell. Carrier ratio 3.5, modulation index decaying from 4 to 0 over 0.9 s. Play a rising pair of
    pentatonic notes.
  - `tk` (unreachable tap): a tiny sine at 900 Hz with a fast pitch drop, 40 ms.
  - `beacon` (ignition swell): a rising chord (four voices) over 2 s, a filtered noise sweep, and a shimmer of high
    sparkly partials. Ends in a warm bloom.
  - `complete`: the level complete motif, a 6-note music-box melody in the theme key, over about 4 s, with the bed
    dipping under it.
  - `click` (UI): a soft sine at 1600 Hz, 25 ms, with a small decay.
- Per-sound rate limit: at most one footstep every 80 ms and one tick every 30 ms, so fast drags do not spam.

## Visual system (three.js r128, one frame loop)

Use one FX root `THREE.Group` attached to `Game.scene`. Re-attach it if the engine removed it, on `levelStart`.

Drive everything from your own `requestAnimationFrame` loop. Clamp `dt` to 0.05 and use `Game.time` only if it exists.
The loop must be allocation-free. Reuse vectors, colours and matrices. Use typed arrays for pools.

**Draw-call budget: at most 8 total, and aim for 3 or 4.** Plan for:
1. One `THREE.Points` for additive glow particles (sparks, fireflies, glimmer bursts, embers, light dots, beacon motes).
   Use a `ShaderMaterial` with per-vertex `position`, `color`, `size` (device pixels, not attenuated) and `alpha`. Use
   `AdditiveBlending`, `depthWrite: false` and `depthTest: true`, so particles hide behind blocks. Give the particles a
   soft radial texture drawn once on a canvas (no image file).
2. One `THREE.Points` for normal-blended dust (dust motes, dust puffs, sand-coloured puffs). Same shader, normal
   blending.
3. One `THREE.InstancedMesh` of a flat `RingGeometry` for ring ripples, laid on the horizontal top surface of a tile
   (rotate by −π/2 about X, lift 0.02). Use per-instance colour (`setColorAt`) and additive blending, so fading is a
   colour scale toward black. Pool of 24 instances. The unreachable ripple is dim, faintly red (`#ff6b6b` at about 35%
   brightness). The reachable ripple is soft gold-white (`#ffd98a`), then amber.

**Pool capacity:** the particle pool holds at most 1500 live particles. When it is full, recycle the oldest transient
one. Under `Game.reducedMotion`, halve every spawn count and the pool size. On `quality` events with
`level === "low"`, halve again.

**Particle shader:** keep it tiny. The point size should be `size * uScale`. Set `uScale` from the renderer's
`domElement.height / 2 * devicePixelRatio`, clamped to a sensible range. Update the uniform on resize.

**Screen-space light shafts** are not in the scene. Make them a DOM overlay: a `div` with `pointer-events: none` and
`mix-blend-mode: screen`, inserted into `Game.root` below `Game.ui` (place it before `Game.ui` if that is a child of
`Game.root`). Draw the rays with a `conic-gradient` or repeating linear gradients, low opacity (0.06 to 0.12), slowly
rotating or swaying. Origin is the sun side: project the first `DirectionalLight` with `castShadow` from the scene
against the screen. If it is not available, use the upper-left. Themes: `dusk` and `dawn` warm amber, `aurora` teal
and violet, `night` cool blue at lower strength. Hide shafts under reduced motion, and on `quality` `low`.

**Positions:**
- A tile's world point: `Game.geom.walkable(tileId).stand`, with `group` and `ref` from the walkable. Stand points are
  in reference coordinates. Apply the group's transform: `Game.geom.transform(groupId)` returns
  `{ R (9 numbers, row-major), pivot, offset }`, so `p' = R·(s − pivot) + pivot + offset`. If anything is missing, use
  the stand point as-is.
- `tap` event: if `tile` is given, use its tile point. Otherwise use a `THREE.Raycaster` from the CSS `x,y` (converted to
  NDC against `Game.root`'s size) to the plane `y = 1`.
- `path` event: `points` are world stand points. Lay light dots along each segment every 0.3 units.
- `heroStep` event: `from` and `to` may be walkable ids (strings) or `[x,y,z]` points. Handle both defensively. Wick's
  feet are `Game.hero.object3D.position` (the origin is at his feet). Use that for dust puffs. For the junction shimmer
  on `k ≠ 0`, use the midpoint of the two stand points, or Wick's position if those are missing.
- Mechanism handle: `Game.groups[id].handle` may have an `object3D`. If it does, use its world position. Otherwise use
  the group's `pivotNode.getWorldPosition`.
- Decor: `Game.decor[i].object3D` is the decor root. `Game.decor[i].worldPos()` returns the world position, possibly as
  a vector or an array. Handle both. `object3D.userData.setLit`, `press`, `collect`, `ignite`, `spin` are the decor
  hooks (design.md section 7.3). FX calls `setLit` for the cascade. FX does **not** call `ignite` (the engine owns that).

## Effects, by event

- **Ambient (title and play, always on):**
  - Fireflies: about 18 teal-gold glow particles, drifting in slow Lissajous paths over the level bounds (from
    `Game.geom.bounds()`, or a default box around the origin). Each blinks slowly.
  - Dust motes: about 60 small warm particles, slowly rising and drifting with the same bounds.
  - Petals: occasionally, a faint pale-pink petal drifts down (a small rare spawn, one every 6 to 10 s).
  - Light shafts: the DOM overlay described above.
- **tap:**
  - Reachable: a soft gold-white ring ripple on the tile. It expands from 0.3 to 1.1 tile units and fades over 0.6 s.
    Play nothing extra.
  - Unreachable (`reachable === false`): a dim, faintly red ring, slightly smaller and quicker. Play `tk`.
- **path:** a trail of small light dots along the route. Each dot appears in sequence, one every 35 ms, fades over
  1.2 s, and is pooled. Use the tile colour (warm white).
- **heroStep:**
  - A tiny dust puff at Wick's feet every 3rd step (keep a counter). Puffs are sand-coloured, 4 to 5 particles,
    expanding and fading over 0.5 s. Play `footstep` every step (rate-limited).
  - When `k ≠ 0` (an impossible join): a brief shimmer at the junction. A teal-white flicker of 8 particles and a short
    ring of 0.6 units, over 0.4 s. Quiet, no extra sound.
- **heroStop:** nothing.
- **mechGrab:** a few brass sparks at the handle (three particles, warm highlight `#ffd27a`).
- **mechMove:** dust and tiny brass sparks at the handle, one or two per frame, at most. Sparks are short-lived. Keep it
  light.
- **mechTick:** a brief dust puff and a bright brass spark at the handle. Play `tick`.
- **mechSnap:** a burst of brass sparks and dust at the handle, plus a ring of light on the handle's base. Play `snap`.
- **mechLocked:** a small dull dust puff at the handle. Play `locked`.
- **plate:** a ring of light (warm amber, larger than the tap ring) and a dust ring on the tile. Play `plate`.
- **glimmer:** a sparkle burst of about 20 particles, flying up from the tile at about 1 unit per second, drifting
  outward and fading over 1.6 s. Play `glimmer`.
- **beacon:** the light cascade.
  1. Take `Game.decor` items whose `object3D.userData.setLit` is a function. Get their world positions. Sort them by
     distance from the beacon position (`data.pos`, or the beacon's world position if `pos` is missing).
  2. Light them one after another over about 2 s. Item `i` of `N` is lit at `t = 2.0 * i / max(1, N−1)`, using
     `setLit(true, false)` (not instant). At each lit item, spawn 4 to 6 little sparks at its world position, and
     occasionally a short gold ring.
  3. Add a burst of rising warm motes (about 120 across the first 1.5 s) from the beacon.
  4. A warm flash: a full-screen DOM overlay, `background: radial-gradient(#fff3c4cc, #ffb35a33 60%, transparent)`,
     with `mix-blend-mode: screen`, that fades in 0.25 s and out over 1.2 s.
  5. Play `beacon`.
  Schedule these with FX's own clock in the frame loop, not `setTimeout`, so pausing works.
- **goal:** nothing extra. The engine handles the celebration.
- **levelComplete:** drifting embers rise: about 60 warm embers from random points within the level bounds, rising slowly
  over 4 s and fading. Play `complete`.
- **restart:** clear all transient particles, rings and scheduled cascade work. Keep the ambient motes.
- **levelStart:** clear everything and rebuild the ambient layer over the new level's bounds. Read `data.level.theme`.
- **title:** rebuild the ambient layer over the default bounds.
- **pause:** freeze transient motion (dt = 0 for transient effects). Keep the ambient motes slow. Duck the bed.
- **quality:** adjust the particle budget as above.

## Testing harness: `tests/fx.html`

Build `tests/fx.html` on `tests/testbed.js`:

- Load the same three r128 script from cdnjs (the same URL as `index.html`), then `tests/testbed.js`, then
  `js/fx.js`. Do not load `js/engine.js`, `js/ui.js` or any other game module.
- Use `Testbed.start({ height: 12, center: [3, 1, 3], bg: 0x241a3a, lights: true }, tb => { ... })`.
  Add a simple diorama for scale: a few stone-coloured cubes (a platform with a few walkable tops, a stair, a tower with
  a beacon-like box). Use plain `MeshStandardMaterial`, no textures. Keep it under 30 draw calls.
- Build a **fake `Game`** object on `window.Game`, before `FX.setup(Game)`:
  - `THREE`, `scene` (tb.scene), `camera` (tb.camera), `renderer` (tb.renderer), `root` (a `div` covering the viewport
    with `position:fixed; inset:0`), `ui` (a `div` inside root).
  - `bus`: a small emitter with `on`, `off`, `emit`.
  - `state: "title"`, `time`, `dt`, `reducedMotion` (read from `?reduced` or `matchMedia`), `quality: "high"`.
  - `save`: `{ sound: true, music: true, quality: "auto" }`. Read the test's `?sound=0` / `?music=0` flags.
  - `saveNow()`.
  - `worldToScreen([x,y,z])`: project with tb.camera, then map to CSS px in root.
  - `geom`: `walkable(id)` returns `{ stand, group, ref }` for a few fake tiles; `transform(groupId)` returns identity
    with the pivot; `bounds()` returns the diorama bounds.
  - `groups`: one fake group `{ id: "bridge", pivotNode: Object3D, handle: { object3D: Object3D } }`.
  - `hero`: `{ object3D: Object3D at a walkable point }`.
  - `decor`: about 6 lanterns. Each is `{ item: { type: "lantern" }, object3D, worldPos() }`. Each object3D is a small
    box with an emissive material and `userData.setLit = function (on, instant) { ... }` that lerps the emissive
    intensity. Place the lanterns at different distances from the beacon.
  - `level`: `{ theme: "dusk" }`.
- Fire the events on a timer, so every effect can be screenshot. Use a script in the page that runs through them:
  `tap` (reachable), `tap` (unreachable), `path`, `heroStep` (k = 0, then k = 1), `mechGrab`, `mechMove` each frame
  for a while, `mechTick`, `mechSnap`, `plate`, `glimmer`, `beacon` (then `levelComplete` some seconds later).
- Make the schedule controllable from the URL and the console:
  - `window.__fxFire(name, data)` fires one event by name.
  - `?script=0` turns off the timer script.
  - `?only=beacon` runs one scenario and holds still for the screenshot.
- Set `window.__ready = true` after the testbed is ready (Testbed does this).
- Log every FX error to `console.error`. Never swallow errors silently in the harness.
- Keep the harness small. It is a test page, not a showcase.

## Acceptance (self-check before you finish)

- `node --check js/fx.js` passes.
- `window.FX` exists at load, before setup, and `FX.sound("click")` does not throw before a gesture.
- After `FX.setup(Game)`, `FX.debug().live` is at most 1500, and `drawCalls` is at most 8.
- Reduced motion halves the ambient counts (check `FX.debug().poolSize` or the live counts).
- `tests/fx.html` opens with no console errors and no page errors, under `tools/shot.js`. Use `--eval` to call
  `__fxFire` and `FX.debug()`.
- Every effect in the list visibly appears in at least one screenshot, and the beacon cascade lights the lanterns in
  order.

## Report back

End with a short summary (under 200 words): the files you wrote, which events and sounds are implemented, anything you
could not do, and any assumption you made about `from`/`to` in `heroStep`, `pos` in `beacon`, or the decor `worldPos()`
return type. Do not paste code into the summary.
