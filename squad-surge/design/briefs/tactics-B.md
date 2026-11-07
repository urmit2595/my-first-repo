# Task for Codex: Squad Surge "Tactics Update", run B (feedback, coaching, meta)

You are working in /home/user/my-first-repo/squad-surge, a browser runner-shooter (three.js r128, plain scripts).
Read first: `design/strategy.md` (THE spec: sections 2–3), `design/engagement.md` (existing systems), `js/juice.js`,
`js/meta.js`, and skim `index.html` for the bus, ctx and HUD markup. Another Codex run (run A) is implementing the
mechanics in index.html, js/powerups.js and js/objects3d.js RIGHT NOW. It emits the events in design/strategy.md
section 3 and provides ctx.belt, ctx.tactics, ctx.threat and ctx.surgeReady. Code against that contract, defensively:
if an event or field never arrives, nothing may break.

EDIT ONLY: `js/juice.js` and `js/meta.js`. Do not run git.

## Implement
1. **Callouts (juice.js),** using the existing callout queue and style:
   - "PERFECT AIRSTRIKE!", "PERFECT SHIELD!", "PERFECT GIANT!" and "PERFECT SURGE!": big, gold, with a ring burst.
   - "WASTED": a small grey chip near the used button.
   - "MISFIRE": muted, for misused.
   - "BANKED ×N → +M×" at `bank`.
   - "SURGE READY!" once, at `surgeReady`.
   - Threat warnings: a top-centre banner "⚠ SWARM AHEAD", "⚠ BARRICADE" or "⚠ MORTARS" at `threat`, with the counter
     icon (assets/ui/icons/pu-airstrike.webp, pu-giant.webp, pu-shield.webp). It hides at `threatEnd`.
2. **Swap offer (juice.js):** at `swapOffer`, a chip above the belt showing the new icon, "SWAP?", and a 3 s countdown ring.
   It clears at `swapDone` or `swapExpired`.
3. **Coach marks (juice.js):** at `tacticsCoach {kind, slot}`:
   - a pulsing hand or finger pointer and a short line, for example "Tap to call an AIRSTRIKE!", aimed at that belt slot's
     button. Find it by the ids in index.html, or by `[data-slot]`; wait for run A's markup and query defensively.
   - only one at a time
   - dismissed on `powerupUse` or after 4 s
3. **Sound:** if juice.js owns the sound effects, add short distinct cues for activate, PERFECT, wasted, swap and
   surge-ready. Keep them synthesized and short, respecting the sound setting.
4. **Results (meta.js):**
   - add a "TACTICS" line to the results tally: perfect uses, banked bonus and wasted. When there were 2 or more PERFECTs
     and 0 wasted, show a small "TACTICIAN" badge.
   - on a near-miss loss, add one strategic tip based on what happened, for example "You had a SHIELD when the mortars
     hit — tap it!" or "Save an AIRSTRIKE for the swarm before the boss". Read it from the events you tracked during the
     run.
5. **Missions and trophies (meta.js):** add at least 6 tactics missions and at least 3 tactics trophies, using the
   existing pool system. Examples:
   - "Score 3 PERFECT uses in one run"
   - "Bank 2 power-ups"
   - "Clear a SWARM with an AIRSTRIKE"
   - "Win without wasting a power-up"
   - "Smash 2 BARRICADES as a GIANT"
   - "Block 10 mortar hits with SHIELD"
   - trophy "Tactician" (10 PERFECTs in total), "Hoarder" (bank 2 in 5 levels), "Never Wasted" (5 clean wins)
   These are progress-only medals, as today: NO currency, NO shop, NO upgrades. That is a hard user constraint.
6. **Stats:** track the totals in meta's save (perfect, wasted, banked, threats countered).

## Quality
- Keep the existing style, no per-frame allocation, and wrap storage in try/catch. Nothing may throw if run A's events
  are missing.
- Run `node --check` on both files.
- Finish with a short summary of what you added and the event names you rely on.
