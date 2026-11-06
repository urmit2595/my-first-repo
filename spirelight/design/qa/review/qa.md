# SPIRELIGHT QA review

Date: 2026-11-06. Branch `ccr-26285320-7spz0v`. No game files were edited and nothing was committed.

## Method

- **Solutions:** each level ran its built-in solution with `Game.runSolution(i-1)` on `index.html?test` at 1280x720, one level at a time, using the shared harness. The "ms" column is the engine's own solution time. `tests/engine-run.js` was not used directly because it writes `tests/engine-index.html` and `design/qa/engine/`, both outside the allowed output path. The same loop was run from a scratchpad script that writes nothing into the repo.
- **Start screens:** `tools/shot.js` on `index.html?test&level=N` with `--wait 3000`. Portrait is 390x844 at dpr 2, landscape is 1280x720. Calls and tris are read from `Game.debug()` at capture time.
- **Title:** `index.html`, `--wait 4000`, same two sizes.

## Results

| Level | id | Solution ok / ms | Portrait calls / tris | Landscape calls / tris | Errors |
|---|---|---|---|---|---|
| L1 | first-light | ok / 11572 | 92 / 157880 | 90 / 157872 | none |
| L2 | turning-stair | ok / 19523 | 92 / 146763 | 91 / 146761 | none |
| L3 | sky-bridge | ok / 11974 | 101 / 148899 | 97 / 148891 | none |
| L4 | lamp-lift | ok / 20193 | 103 / 165555 | 101 / 165555 | none |
| L5 | chime-stair | ok / 42781 | 120 / 172837 | 118 / 172837 | none |
| L6 | twin-drawbridges | ok / 43492 | 125 / 172659 | 123 / 172651 | none |
| L7 | veiled-steps | ok / 19464 | 109 / 170871 | 109 / 170871 | none |
| L8 | greenhouse-spire | ok / 32019 | 136 / 174250 | 138 / 174250 | none |
| L9 | clock-spiral | ok / 36916 | 146 / 187702 | 142 / 187694 | none |
| L10 | beacon-spire | ok / 57868 | 171 / 198839 | 169 / 198839 | none |
| Title | (no level) | n/a | 101 / 155501 | 101 / 155501 | none |

All ten solutions reached `state: complete`. No console errors, page errors, or HTTP 4xx/5xx responses were logged in the solution runs or in the 22 start-screen captures. L10 took 57.9 s, close to the 60 s budget.

Screenshots are in `/home/user/my-first-repo/spirelight/design/qa/review/`: `L{1-10}-p.png`, `L{1-10}-l.png`, `title-p.png`, `title-l.png`.

## Visual problems

Nothing was broken in the sense of missing textures, black or blank areas, invisible Wick, or a level cut off by the screen edge. The Wick is visible in every level capture, though it is small in `L10-l.png`. The problems below are minor.

1. **Title wordmark collides with the tower art (landscape).** In `title-l.png`, the final "T" of SPIRELIGHT runs into the left edge of the tower model.
2. **Title wordmark and tagline sit over the spire (portrait).** In `title-p.png`, the lantern and chimney of the tower sit behind "LIGHT" and the tagline. It is legible but crowded.
3. **Faint horizontal seam near the top edge.** In `L4-p.png`, `L5-p.png` and `L6-p.png` there is a visible change in sky tone about 100 px from the top. In `L4-l.png` and `L5-l.png` there is a fainter line near the top. This is probably the HUD backdrop edge. It needs checking on a real device.
4. **Sun glare behind the top-right HUD (landscape).** In `L4-l.png`, `L5-l.png` and `L10-l.png` the sun glare sits under the glimmer counter and the hint button. This is cosmetic.
5. **Small playfield in landscape L10.** In `L10-l.png` the tower occupies a narrow central column with a lot of empty sky, so the Wick and goal are small. The level is fully in frame.
