# Task for Codex: Squad Surge "Tactics Update", run A (mechanics)

You are working in /home/user/my-first-repo/squad-surge, a browser runner-shooter (three.js r128, plain scripts).
Read first, fully:
- `design/strategy.md`: THE spec for this task, sections 2 and 3.
- `design/engagement.md`: the existing systems, ctx and bus contracts.
- `index.html`: the game core, including generateLevel, the squad, gates, solids, the boss, the HUD, states and
  `window.__game`.
- `js/powerups.js`: airdrops, the four power-ups and barrels.
- `js/objects3d.js`: the solid visuals.

EDIT ONLY: `index.html`, `js/powerups.js`, `js/objects3d.js`, and new files under `tools/`. Another Codex run is editing
`js/juice.js` and `js/meta.js` at the same time: never touch them. Do not run git.

## Implement design/strategy.md T1–T7 (mechanics side)
1. **T1, the belt:**
   - 2 slots, filled by crates and tool gates. JACKPOT stays instant.
   - HUD buttons at the bottom corners, using the existing icons in assets/ui/icons/pu-*.webp.
   - Keys 1/2 and Q/E.
   - The swap offer when the belt is full (3 s; otherwise +8 soldiers).
   - Buttons must not steer.
   - Expose `ctx.belt` and `ctx.usePowerup(slot)`, and emit the events in section 3.
2. **T2:** fork drops (pairs of crates with icon billboards) from level 2, and tool gates from level 3. The gate half
   shows the power-up icon. Extend the gate visuals in objects3d.js if needed.
3. **T3:** the threats SWARM (from level 2), BARRICADE (from level 3) and MORTARS (from level 4):
   - Spawn 2–3 per level in generateLevel or on the `generate` event, never overlapping.
   - Each has a holo warning sign on the road with the counter icon, about 2.5 s ahead.
   - Emit `threat`, `threatLive` and `threatEnd`.
   - Barricade: blocks across the road with a gap, high HP, and contact kills soldiers. GIANT smashes it.
   - Mortars: tower solids at the edges lob shells at the squad, with red target rings; SHIELD nullifies.
   - Boss: the slam is a threat (SHIELD); AIRSTRIKE deals 18% of the boss's max HP; GIANT doubles boss damage.
   - Make sure counters are likely to be available: place drops or tool gates before threats, and use the guaranteed
     early-level drops from T7.
4. **T4:** PERFECT, WASTED and MISUSED detection, with rewards. The score goes through `ctx.addScore(..., {raw:true})`.
   Expose `ctx.tactics`.
5. **T5:** SURGE holds at full until activated: a bottom-centre button when ready, a tap on the bar, or Space. Emit
   `surgeReady`.
6. **T6:** banking. At boss death each belt item adds +0.5× to the final multiplier. Emit `bank`. Integrate it with
   `ctx.finishLevel(mult)` or the win data so the results show it.
7. **T7, teaching:** the guaranteed AIRSTRIKE before level 2's first SWARM, GIANT before level 3's first BARRICADE, SHIELD
   before level 4's first MORTARS. Emit `tacticsCoach {kind, slot}` when a coach mark should show; js/juice.js draws it.
   The gold "counter" ring on the matching belt button while a threat is live is yours (HUD); fade it after 3 PERFECTs
   overall (store the count in the save).

## Balance (very important)
- A player who NEVER presses a power-up button must still be able to clear levels 1–5 about as before. Level 7 must stay
  winnable for a casual player: the user once complained "I always lose level 7".
- Threats are costly without the counter but survivable.
- Update or add a balance bot under tools/, for example `tools/bot-tactics.js`, modelled on the existing approach:
  - a Playwright page with `window.__game`, renderer.render stubbed, and performance.now ×4
  - three policies: "never uses power-ups", "smart" (uses the counter when `ctx.threat` is live, SURGE on the boss) and
    "random"
  - it reports a win/lose table for levels 1–8
  You cannot launch Chromium in your sandbox, so write the bot carefully. The orchestrator will run it and send you the
  results.

## Quality
- Match the game's existing look and juice. No per-frame allocation, and dispose of per-level objects.
- `node --check` every JS file you touch. Inline scripts in index.html must parse too: extract them to check.
- Finish with a short summary: what you changed where, the new events and ctx fields, the tuning values, and anything
  run B (juice and meta) must know.
