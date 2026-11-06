# Brief 3: SPIRELIGHT FX round (`js/fx.js`, `tests/fx.html`)

Continue from the current `js/fx.js` and `tests/fx.html`. Do not start over. Keep what works.
Write only `js/fx.js` and `tests/fx.html`. Do not edit `design/*`, `js/engine.js`, `js/world.js`, `js/ui.js`,
`index.html`, `levels/`, or other agents' files. Do not git commit. Do not install packages.

Read first: `design/design.md` section 8 (the payloads, especially `plate` and `heroStep`), `design/review.md` items
P1-8, P2-4 and P1-1 (the theme table), and `tests/fx-brief-2.md` as the last brief (keep its rules).

## 1. Plate: a spark trail to the target (review P1-8)

`plate` now carries `{ tile, group, pos, target }`. `pos` is the plate's world position. `target` is the world centre of
the group the plate moves.

- On `plate`, send a **0.6 s spark trail** along a straight line from `pos` to `target`. Spawn about 14 small warm sparks
  spaced evenly along the segment, and each one travels toward `target` over 0.6 s, fading near the end. Keep the
  existing ring at `pos`.
- Interpolate in world space. Orthographic projection is linear, so a world line projects to a straight screen line.
- If `target` is missing, skip the trail and keep only the ring.
- If `pos` and `target` are equal, skip the trail.

## 2. Path preview and heroStep sparkle (review P2-4)

- **`path`:** the dotted route preview must be **faint and short-lived**. Make the whole preview last about **0.4 s**
  from the moment it starts, at about 45% of the current dot alpha. Dot spacing stays at 0.3 units.
- Draw the preview **straight between consecutive points, including across impossible joins**. A join is where
  `points[i]` and `points[i+1]` differ by `k(1,1,1)`. Draw one straight dotted segment across the jump, and make the dots
  on that segment a little brighter, so the line visibly jumps. Do not smooth or re-route the points.
- **`heroStep` with `k ≠ 0`:** a small sparkle at `d.at` (world, the junction). Use about 10 particles, teal-white, over
  about 0.4 s. Keep the existing shimmer if it is still useful, but `d.at` is the source of truth. If `at` is missing,
  fall back to the midpoint of the two stand points.

## 3. Light shafts per theme (review P1-1, night and aurora)

World is removing the sun rays at night, so the CSS shafts must follow the theme:

- **`dusk`:** unchanged (`opacity .09`).
- **`dawn`:** halve them (`opacity .045`).
- **`night` and `aurora`:** off. Remove the shaft layer, or set its `display: none`.
- Get the theme from `levelStart` (`data.level.theme`), and from `Game.level.theme` if present. The title screen uses
  `dusk`. Apply it immediately on `levelStart` and `title`. Do not depend on any World event.
- The beacon flash and the ambient motes keep working on every theme.

## 4. Night beacon cascade: the lanterns are the brightest things (review P1-1)

The night key line in the review: "The lantern cascade should be the brightest thing on screen."

On `beacon` at `night` (and generally, but most strongly at night):
- **Do not** wash the whole screen. Replace the full-screen flash with a **small radial glow centred on the beacon's
  screen position** (`Game.worldToScreen(pos)`, falling back to the screen centre), of about 0.35 of the viewport height,
  fading in 0.2 s and out over 1.4 s. Use `mix-blend-mode: screen`. Keep the colours warm.
- On each lantern as it lights (during the 2 s cascade): a **bright gold-white spark burst** of about 8 particles, and a
  short gold ring at the lantern. These sparks should be the brightest particles on the screen at night, so make them
  the brightest colour and largest size in the pool.
- During the cascade (about 3 s from `beacon`), **dim the ambient motes and fireflies to about 40%** on night and aurora.
  Restore them afterwards.
- On other themes keep the current behaviour, with the flash at a moderate strength. Dawn uses the smaller glow too.

## 5. Test

Run these after the changes:

1. `node --check js/fx.js`.
2. Harness: `node tools/shot.js "tests/fx.html?only=plate" design/qa/fx/r3-plate.png --wait 600`, then the same for
   `path`, `heroStep` (`k: 1`), and `beacon` with a night theme (`__fxFire('levelStart', {level:{theme:'night'}})`
   first). Add `?theme=night` or similar if it helps. Save each shot to `design/qa/fx/`.
3. Check the console output of each run: no errors, no page errors.
4. Real game, phone size: `node tools/shot.js "index.html?test&level=5" design/qa/fx/l5.png --w 390 --h 844 --dpr 2 --wait 4000`.
   If the engine fails to boot, say so and stop. Do not fix the engine.

## 6. Report back

End with a short summary, under 120 words: what changed, the shot paths, the console result, and anything you could not
verify. Do not paste code into the summary.
