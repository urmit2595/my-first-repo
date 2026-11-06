# Task for Codex: extend js/juice.js for the Surge Update

You are working in /home/user/my-first-repo/squad-surge (browser runner-shooter, three.js r128). EDIT ONLY `js/juice.js`
(you wrote it earlier; keep everything that works). Do not modify any other file.

## Read first
- `design/engagement.md`: the Surge Update features and section 3 (events and ctx APIs).
- `index.html`: search for `bus.emit(` to see every event and its data; the HUD markup (`#scoreBox`, `#count` with
  `#combo` and `#surgeBar`), `render()` and `frame()` (the `frame` event now carries `realDt`; use it for shake decay and
  UI timers so they keep running during hit-stop and slow motion).
- `js/meta.js` (menus, results tally, toasts: do not duplicate them) and the power-up icons in `assets/ui/icons/`
  (`pu-shield.webp`, `pu-airstrike.webp`, `pu-giant.webp`, `pu-jackpot.webp`, `surge.webp`, `flame.webp`).

## Add (in-run moments only; one callout at a time, centre-top, about 0.8 s each, queued)
1. `combo {count, tier, name}`: tiered callout NICE / GREAT / SURGE! / UNSTOPPABLE with the multiplier (x1.5, x2, x3,
   x4), bigger and hotter per tier; pop the `#combo` element.
2. `surge {on}`: on → golden screen-edge glow and faint speed lines for the duration, a +6° FOV punch easing back, a
   "SURGE!" callout with the surge icon; off → fade out. Pulse `#surgeBar` while it fills past 80%.
3. `airdrop {x, z}`: a "SUPPLY DROP!" callout with the airdrop icon.
4. `powerup {type}`: a banner with the power-up icon and name (SHIELD / AIRSTRIKE / GIANT / JACKPOT); `shield` and
   `giant` `{on}` events: a subtle coloured screen tint while active (blue for shield, orange for giant).
5. `explosion {x, z, radius}`: camera shake scaled by radius and distance to the squad (trauma model: add trauma,
   shake by trauma², decay on realDt).
6. `gatePass` with `half.jackpot`: golden flash and a "JACKPOT!" callout.
7. `bossEnrage`: "BOSS IS ANGRY!" in red, and a red vignette pulse.
8. `bonusStart`, `bonusWall {index, mult}`, `bonusEnd {mult}`: a growing "xN" stamp at centre for each wall broken
   (bigger and gold toward x10), a final big "xN BONUS!" on `bonusEnd`.
9. `squadMilestone {n}`: "BIG SQUAD!" (100), "MEGA SQUAD!" (250), "ULTRA SQUAD!" (500) callout and a short camera pull-back.
10. `score {delta}`: when one event gives ≥ 150 points, a small "+N" that flies into the `#scoreBox` and makes it pop.
11. Hit-stop and slow-mo are done by the game; do not change time.

Keep the rules from your first brief: respect `prefers-reduced-motion` (no shakes or camera moves, fades only), never
throw, no external libraries, no timers left running, no gameplay changes, few DOM writes per frame.
Check: `node --check js/juice.js`. Another agent will run the game and send you any errors.
