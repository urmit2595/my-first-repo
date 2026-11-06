# Brief 1: build Wick (js/hero.js) and its test page (tests/hero.html)

You are writing the hero module of SPIRELIGHT, an original browser puzzle game (true-isometric impossible geometry,
three.js **r128**, global `THREE`, plain scripts, no ES modules, no npm). Working dir: spirelight/.
Read `design/design.md` sections 0, 2 and 7.5 first (do NOT edit it). Files you may write: **js/hero.js** and
**tests/hero.html** only. (tests/testbed.js exists; read it, do not edit it.)

## Reference
View `art-src/hero/hero-sheet.png` (front / three-quarter / side / back views of Wick) and match it: rich, warm-lit,
detailed, PBR brass. Not pastel, not flat, not minimalist.

## Wick
A tiny brass lamplighter automaton. About **0.85 world units tall, origin at the feet, facing +z** at rotation.y = 0.

Model (all procedural three.js; no external assets; build textures with canvas if useful):
- Lathe-turned egg-shaped brass body with a riveted band/panel seams (rivet rows via InstancedMesh or small spheres), a
  round chest gauge (cream dial, brass bezel, needle that wanders) on the front, small verdigris patina (a canvas
  texture used as a map/roughnessMap/ bumpMap, or vertex colour; roughness ~0.35-0.5, metalness ~0.9, brass #c8963e).
- Head is a glass lantern: a slightly bulbous transparent glass globe (MeshPhysicalMaterial or Standard with
  transparent, low opacity, high specular; keep it cheap), four brass vertical ribs, a brass collar at the bottom,
  a riveted domed brass cap on top with a small neck and a **ring** on top (torus).
- Inside the head is a **living flame that is also the face**: a billboard-free 3D flame made of 2-3 overlapping
  teardrop/lathe meshes with an emissive additive-ish material, vertex displacement or scale/skew flicker in
  update(), a bright core and orange tip, plus **two dark vertical eye slits** on the front that **blink** (scale y
  to ~0.1 for ~0.12 s every 2.5-5 s) and can look slightly left/right.
- `hero.light`: a warm PointLight (#ffb35a, intensity about 1.2 * glow, distance ~4, decay 2) at the flame,
  child of object3D, flicker matches the flame. castShadow false.
- **Teal knitted scarf** (#2f8f8c-ish with knit texture via canvas bump/normal-ish pattern; chunky torus-like wrap
  around the neck plus a knot on the side) with **two tails** driven by a small **verlet chain** (about 5-6 segments each,
  ribbon mesh rebuilt/updated per frame without allocation; gravity, drag, and push opposite to the hero's
  world-space motion). Because the hero moves in the world, the chain must work in world space: track the
  object3D's world position delta each update so the tails trail when he moves and settle when idle. The ribbon
  must have a double-sided, lit material and ~0.08 width. Tails must never penetrate the body badly: add a simple
  sphere/capsule push-out against the torso.
- Jointed brass arms and legs: thin cylinders with ball joints (shoulder, elbow, wrist, hip, knee, ankle), simple
  mitten/three-finger hands, and **rounded boots** (squashed spheres plus sole) like the sheet. Hierarchy of groups so
  animation is joint rotations: hips, torso, head, shoulder.L/R, elbow.L/R, hip.L/R, knee.L/R, key.
- A **wind-up key** on the back (the classic butterfly-shaped brass key on a short shaft) that turns slowly (and
  faster when walking).
- It must read at in-game scale: on a phone Wick is 60-80 px tall. Exaggerate: head ~38% of the height, big glowing
  flame, chunky scarf colour, slightly thick limbs. Silhouette: ring, big round lantern head, scarf tails, small
  body, boots. Add a faint additive halo sprite (soft radial gradient, depthWrite false, small) around the head so the
  glow carries; scaled by setGlow().
- Budget: <= ~35 draw calls and <= ~60k triangles for the whole hero. Share geometries/materials. No per-frame
  allocation in update() (reuse vectors/quaternions). Shadows: body parts castShadow = true; receiveShadow = false.

## API (exact, from design.md 7.5)
```js
window.Hero = { create(THREE, opts) -> hero }
hero.object3D     // THREE.Group; origin at feet; faces +z at rotation.y=0; ~0.85 tall
hero.setAnim(name)   // idle | walk | climb | celebrate | bump | ride | wave   (unknown names -> idle)
hero.update(dt, t, { speed, grounded })  // dt seconds, t total seconds; opts optional. speed (world units/s) scales walk cycle rate (default ~1.4); grounded false -> airborne pose (legs tucked a bit).
hero.light        // PointLight, child of object3D
hero.setGlow(k)   // 0..2, smoothly eased inside update; scales light intensity, flame size, halo
hero.onStep       // property, initially null; engine sets a function; call hero.onStep({foot:'L'|'R'}) on each footfall (when a foot lands during walk/climb)
hero.anim         // current anim name (read only)
hero.dispose()    // dispose geometries/materials/textures
```
Module is one IIFE, `"use strict"`, never throws at load; wrap onStep call in try/catch. opts may contain
`{ quality: 'low'|'med'|'high' }` (low: fewer segments, no halo/glass transparency if desired, no verlet extras).

## Animations (all procedural, with smooth blending: keep a blend weight per anim or cross-fade the pose
parameters over ~0.2 s; switching anims must never pop)
- **idle**: breathing bob + slight squash, flame flicker, occasional look-around (head yaw +-0.5 rad, eyes follow),
  occasional blink, key turns slowly; arms hang with slight sway; scarf settles.
- **walk**: bouncy gait, ~2 steps per world unit at speed 1.4; body bob, lean forward slightly, arm swing opposite to
  legs, head bobs, scarf trails, `onStep` on each foot contact, key spins.
- **climb**: for stairs; higher knee lift, slightly slower cycle, body leans forward, arms pump, onStep on contacts.
- **celebrate**: raise the lantern head up a bit (neck stretch), both arms raised, hop, flame flares (flame scale 1.5x),
  glow target 2 while in this anim (internal setGlow(2) behaviour; restore previous glow when leaving).
- **bump**: "can't go there": head tilts to the side, body shakes small left-right twice, one hand up palm-out, flame
  flickers nervously, then holds a droop. Loops gently (the engine returns to idle itself).
- **ride** (on a lift): balancing, feet planted wider, arms out a little and wobbling, body slightly crouched.
- **wave**: title screen: right arm waves, head tilts, happy bounce, blinks.

## tests/hero.html
Built on `tests/testbed.js` (iso camera). Load three.min.js r128 from the CDN exactly as other pages in this repo would
(see index.html if it exists, else use `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`; tools/shot.js swaps
CDN scripts for local copies). Use testbed lights, enable shadows, add a simple pale paver floor patch (box) under him so he
sits on a surface. URL params:
- `anim=<name>`  default idle. `t=<seconds>` freeze at that time: simulate from 0 to t in 1/60 s steps (call hero.update
  with speed=1.4 for walk/climb) then stop updating (and stop `tb.time`-driven changes) so screenshots are deterministic.
  Without `t`, it runs live.
- `view=large` (default): camera `height` ~1.6 centered on Wick (center [0,0.45,0]), so he fills the frame.
- `view=lineup`: all 7 anims side by side along the screen x axis (use separate hero instances spaced apart,
  each frozen at `t`, default t=1.0), labels via small HTML overlay; camera height ~3.
- `view=small`: in-game scale: the camera height such that Wick is ~70 px tall at 1280x720 (height = 720 * 0.85 / 70 ~ 8.7
  world units visible vertically... compute so that 0.85 units == ~70 px), with a dusk gradient background and 3
  paver tiles, so we can judge readability. Also support `view=small&anim=walk&t=0.7`.
- `walkto=1` (optional): in live mode, move the hero along a looping path to show the scarf trailing and turning
  (rotate object3D.rotation.y toward the move direction).
- `yaw=<degrees>` to rotate the hero (view from front/side/back), default 35 so we see the face from the iso camera.
- Set window.__ready only after the hero is built and frozen frame rendered (the testbed does it after setup resolves
  plus 2 frames). Report console errors with console.error.

## Test / iterate
Run from spirelight/ (one at a time; the machine is shared, keep runs short):
`node tools/shot.js "tests/hero.html?anim=walk&t=1.2&view=large" design/qa/hero/walk-large.png --w 900 --h 900`
and `...view=lineup...` with `--w 1600 --h 600`, and `view=small`. LOOK at the PNGs with your image-reading tool,
compare with `art-src/hero/hero-sheet.png`, fix what looks bad (proportions, floating limbs, clipping, scarf
sticking through, dark/dull materials, flame not glowing, eyes not visible, glass hiding the flame), and iterate
until it looks great, then stop. Do not touch any other file. No console errors.

Finish with a short summary of what you built and any known issues.
