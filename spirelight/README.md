# Spirelight

Spirelight is an original isometric puzzle game for the browser, built around impossible geometry.

Ancient clockwork spires float above a sea of clouds, and their great beacons have gone dark. **Wick** is a small
brass lamplighter automaton whose head is a glass lantern with a living flame. He climbs each spire to light its
beacon again. Paths join when they *look* joined: turn a bridge until it seems to meet a far ledge, and Wick walks
across.

- **Ten spires** in four chapters (Embers, Lanterns, Veils, Daybreak), each chapter under its own sky: dusk, night,
  aurora and dawn.
- **Mechanics:**
  - tap to walk
  - cranks that rotate parts of a spire
  - sliding lifts that Wick rides
  - chime-stone pressure plates
  - impossible bridges
  - veils (pillars Wick walks behind to come out somewhere impossible)
  - stairs that only climb up the screen
- **Glimmers:** optional sparks hidden off the main path. Reaching most of them takes a mechanism setting that the
  solution doesn't use.
- **Light:** every level ends with the beacon igniting and a cascade of light running down the spire.

## Play

Serve the folder with any static file server and open `index.html`:

```sh
cd spirelight && python3 -m http.server 8000   # then open http://localhost:8000
```

The game loads three.js r128 from cdnjs/jsdelivr, so it needs an internet connection on first load.

**Controls:**
- **Walk:** tap or click a pale paving stone.
- **Turn or slide a mechanism:** drag its brass handle, or tap the handle to step it once.
- **Pan:** drag empty sky when a spire is larger than the screen.
- **Pause:** Esc.

The game works in portrait and landscape, respects `prefers-reduced-motion`, and keeps progress in `localStorage`
(`spirelight-v1`).

## How it works

The camera is a true isometric orthographic camera looking along −(1,1,1). Two points that differ by k·(1,1,1) land
on the same pixel, and the whole game is built on that.

- Walkable surfaces expose edge **ports** in projected coordinates (p, q) = (x − y, z − y).
- Two walkables connect when their ports meet on screen:
  - Real neighbours (k = 0) always connect.
  - "Impossible" joins (k ≠ 0) connect only when the junction *looks* continuous. A ray-cast visibility test checks
    six sample points; veil blocks hide a junction without breaking it.
- The full specification is in `design/design.md`, section 4.

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Page shell and boot. It loads three.js r128 and its post-processing add-ons, then the modules below. |
| `js/geom.js` | `SpireGeom`, pure logic shared by the browser and Node: projection, ports, connections, ray casting, picking, paths and the puzzle solver |
| `js/engine.js` | `Game`: renderer, isometric camera, post-processing, input, walking, mechanisms, goal sequence, save, test API |
| `js/blocks.js` | Block visuals: PBR materials, bevels, vertex AO, pavers, cornices, corbels, windows, weathering |
| `js/decor.js` | Props and mechanism parts: cranks, wheels, lifts, chime plates, beacon, lanterns, keels, plants, waterfalls … |
| `js/world.js` | Painted skies, cloud sea, light rig and environment maps for the four themes |
| `js/hero.js` | Wick: a procedural skinned brass automaton with a verlet scarf and blended animations |
| `js/fx.js` | Particles and fully synthesized WebAudio (ambient music, mechanism ratchets, chimes, the beacon swell) |
| `js/ui.js` | Title, spires map, HUD, intro and completion cards, settings, ending |
| `levels/levels.js`, `levels/levels2.js` | The ten levels (1–5 plus the title diorama, then 6–10) in the format of `design/design.md` §5 |
| `assets/` | Textures, skies, cut-outs, UI art (WebP), and the display font (Cinzel Decorative, SIL OFL) |
| `art-src/` | Raw generated art and prompts |
| `design/` | Design contract, level notes, the review and QA screenshots |

## Tools and tests

Run these from `spirelight/`:

```sh
node tests/geom.test.js                     # geometry unit tests
node tools/solve.js --all                   # verify every level is solvable, glimmers reachable, no shortcuts warned
node tools/solve.js --level sky-bridge --svg design/qa/x.svg && node tools/svgshot.js design/qa/x.svg   # see a level
node tools/shot.js "index.html?test&level=3" out.png --w 390 --h 844 --dpr 2 --until "Game.settled"   # screenshot
node tests/engine-run.js all                # play every level's solution in the real engine (headless)
node tests/engine-drag.js                   # drag every handle with real pointer events
node tests/engine-perf.js 10                # draw-call breakdown for a level
```

- **URL flags:**
  - `?level=N` starts level N.
  - `?test` skips intros.
  - `?debug` overlays the connection graph and tile ids.
  - `?quality=low|medium|high` sets the quality tier.
- **Headless tests** use Playwright with Chromium (swiftshader). Set `SL_VENDOR` to a folder holding the three.js r128
  npm package if the CDNs are unreachable.

## Credits

- Spirelight is an original game made for this repository.
- Code, levels and art were produced by a team of AI agents (Claude and Codex), coordinated through `design/design.md`.
- The art was generated for this project; the raw images and prompts are in `art-src/`.
- [three.js](https://threejs.org) r128 is MIT-licensed.
- The display font is [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) by Natanael Gama, under
  the SIL Open Font License.
