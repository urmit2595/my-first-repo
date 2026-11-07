# Tactics run A handoff

Mechanics live in `index.html`; supply planning/activation in `js/powerups.js`; icons, tool gates, barricades, mortar towers and warning/target visuals in `js/objects3d.js`. No changes to juice/meta or git operations.

## Run B contract

- `ctx.belt` contains two types/nulls; slots are **zero-based**. Buttons are `#belt0`/`#belt1`, also `[data-slot="0"]`/`[data-slot="1"]`.
- `ctx.usePowerup(slot)` activates, or accepts the outstanding swap **without activating it**. `ctx.collectPowerup(type)` is the pickup entry point. JACKPOT remains instant.
- `ctx.tactics` / `L.tactics`: `perfect`, `used`, `wasted`, `misused`, `banked`, `surgePerfect`. `perfect` and `used` include SURGE; `surgePerfect` is its subset.
- `ctx.threat` / `L.threat`: current live encounter, or null. Kinds are `swarm`, `barricade`, `mortars`, `slam`; counters are `airstrike`, `giant`, `shield`, `shield`.
- `ctx.surgeReady` / `L.surgeReady`, `ctx.useSurge()`.
- All section 3 events are emitted: `belt`, `powerupGot`, `swapOffer`, `swapDone`, `swapExpired`, `powerupUse`, `threat`, `threatLive`, `threatEnd`, `surgeReady`, `bank`, `tacticsCoach`.
- **SURGE also emits `powerupUse`**, with `type:"surge"`, `slot:null`, and the PERFECT flag, before `surge {on:true, perfect}`. No extra slow motion for PERFECT SURGE.
- `tacticsCoach.kind` is the tool type, not the encounter kind. Each teaching encounter emits at most once. Persistent counters are `save.tacticsCounters[type]` (stop coaching at 2) and `save.tacticsPerfect` (fade gold HUD hint at 3).
- `swapOffer.until` is in **`L.time` simulation seconds**, so the offer freezes while paused and follows slow motion. The core has a fallback swap chip, suppressed while juice's `.jt-swap` is visible; juice should derive its countdown from the simulation deadline.
- `bank` fires at boss death, before `bossDown`. Belt consumption closes at that instant. `win` includes `tactics`, `bankBonus`, `finaleMult`, and `mult` already includes banking. **Do not add bank again in meta.** `lose` includes `tactics` and empties the belt.
- Existing `powerup {type}` still fires on actual effect activation, not pickup or swap.

## Tuning

- 70 px belt buttons; keys 1/Q, 2/E. SURGE: centre button, meter tap, Space.
- SHIELD/GIANT: 6 simulation seconds. Full belt offer: 3 seconds, then +8 soldiers.
- PERFECT: `ctx.addScore(300 * level, {raw:true})`, +10 combo; slow-mo 0.4x for 0.35 s, subject to the existing cooldown/cap.
- SURGE holds at 100%; activation lasts 6 s, doubles fire rate and retains existing double damage/pierce. Existing cap: 2 activations/level.
- Road threats: 2 on levels 2–5; 3 from level 6. First is at z=-100; remaining threats spaced through the road, ending at least 65 units before the boss. Holo warning 2.5 s before live range (24 units).
- Threat corridors replace ordinary encounter segments; positive soldier halves on supply gates and existing jackpot pity preserve squad growth. Drops arrive 43 units before threats; one tool gate/level from level 3. Counter availability is visible; steering still decides the pickup. First teaching supplies have a missed-crate fallback.
- SWARM: 1.8 × (6 + 3 × level) normal enemies. BARRICADE: three 3.6-unit blocks, 1.2-unit side gap, HP 70 + 8 × level. MORTARS: one tower, two from level 6; HP 22 + 4 × level; shots every 1.6 s, 0.85 s warning rings, 2–4 losses/hit, encounter up to 6 s.
- Road threat loss budget: 24% of squad size at live start, capped at 12 for SWARM / 10 otherwise; these added hazards preserve the last 3 soldiers. Ordinary enemies/solids and the boss retain their normal lethal behavior.
- Boss: shield counters slam; AIRSTRIKE deals exactly 18% max HP and clears adds (bombs cannot add extra boss splash); GIANT doubles bullet damage. Effects carry into the boss fight.
- Bank: +0.5 final multiplier per held item (maximum +1.0), added once by `finishLevel`.

## Validation

`node --check` the two modules and tools; extract inline scripts from `index.html` and check those too.

Browser-free behavioral tests (real core, Powerups and Obj3D; stubbed DOM, textures and renderer):

```sh
THREE_LOCAL=/path/to/three-r128.min.js node tools/check-tactics.js
```

Checks swaps/expiry, held SURGE, PERFECT/WASTED/MISUSED, early teaching supplies, counter effects, exact boss damage, bank integration, encounter spacing, restart cleanup and per-level disposal. Includes a no-power-up simulation smoke run across levels 1–8. This is not visual/browser balance validation.

Orchestrator browser run:

```sh
THREE_LOCAL=/path/to/three-r128.min.js node tools/bot-tactics.js --runs 3 --steering casual
```

All three policies use the same casual steering (60% preferred gate choices and 50% slam dodges). `never` never presses any power-up or SURGE; `smart` uses live counters and SURGE on the boss; `random` activates at random intervals. Optional `--steering perfect`, `--levels 1-8`, `--policies never,smart,random`, `CHROMIUM_PATH`. Fresh browser contexts isolate saves. Renderer is stubbed after boot; both performance.now and RAF timestamps run at ×4 (the game's 50 ms step cap still applies). Prints per-run JSON and a win/attempt table, distinguishing errors/timeouts from losses. Chromium was not launched in the sandbox.
