# Campaign engine notes (E1)

The engine loads `enemies.js`, `campaign.js`, then `story.js` after the existing modules. Missing optional modules do not prevent ARCADE from booting. Missing registered sheets use tinted grunt atlases. E1 did not edit sibling-owned modules or run git.

## APIs and events

- `ctx.goMission(id, {assist: 0|1|2, elite: boolean})` uses `Campaign.missions[id]`; events use `event` as the discriminator, with wave `type` naming the enemy. `ctx.goArcade(level)` and daily `ctx.goMode(...)` retain procedural generation. `ctx.restartSame()` reuses the layout seed and clears Assist for the next attempt.
- `registerEnemy`, `registerBoss`, `spawnEnemy`, `squad`, `killSoldiersInRect`, `killSoldiersInCircle`, `damageEnemiesInCircle`, `rng(stream)`, `telegraphGroup`, `mission`, and `missionState` implement section 9. Registry `update` callbacks own movement/contact when supplied; data-only boss definitions use the engine phase scheduler. `onBullet === false` blocks. Weak damage is applied once, including compatibility with the enemy module's bullet callbacks. Split-boss area damage reaches its halves.
- Campaign events: `missionStart`, `missionEnd`, `radio`, `recruit`, `rescue`, `bossPhase`, `bossWeak`, `enemyTelegraph`, `hazard`, `assistOffer`. Existing Tactics events remain; registered boss warnings also activate PERFECT counters. `missionEnd.stars` is a three-boolean array, `keptPct` is 0–100, and `assisted` is 0/1/2. Failures report the last casualty cause; `missionState.causes` retains totals.
- The main save stores `save.campaign[id] = {bestStars, attempts, consecutiveFails, assistedWin, lastCause}` plus a `campaign.stars` lookup for Story. Storage reads/writes are guarded. Assist offers occur at exactly 2 and 4 consecutive failures and never change an active attempt.

## Simulation and tuning

Fixed steps are 1/60 second, with at most five catch-up steps. Excess wall time is counted in `profile().droppedSeconds`. `__game.clocks` separates real elapsed time, unscaled fixed wall time, scaled time, and executed simulation time. Pausing freezes simulation. Cosmetic callbacks do not advance combat.

`__game.setTestMode(true)`, `input("steer", x)`, `input("powerup", slot)`, `input("surge")`, and `advance(n)` support controlled tests. `__game.replay` records tick inputs and run configuration; `await playReplay(record)` restores the run, then `advance(n)` executes it. `stateHash()` hashes authoritative state, RNG streams and pending power-up effects. Replays reject mismatched tuning. `ctx.rng("stream-name")` returns a seeded number; numeric arguments retain the legacy generator factory.

`CAMPAIGN_TUNING` / `__game.tuning` controls ordinary bullet damage: normal **0.34**, hard **0.35**, boss missions **0.43**, first boss mission **2.5**. C1M1–3 retain full damage; the first boss gets a separate damage allowance so its lesson remains approachable without restoring a squad-loss floor. Campaign gate gain is **0.015 per damage point**, growth limited to **+6**, and shooting does not increase multipliers. ARCADE keeps its existing gate growth. These bounds prevent authored small rewards inflating to +99.

Other knobs: campaign cap **300**, ARCADE cap **600**; Assist enemy factors **0.8 / 0.65** plus a shield drop; elite count factor **1.3**, no authored drops, one extra swarm. The 60% threat retention floor applies only to ARCADE/daily and C1M1–3. All eight skill IDs are evaluated. Specialists are run-only, tinted, and counted with icons; each defender absorbs one ranged contact. Bullet cells are **2 m**; crowd cells **0.65 m**. Formation compresses into free intervals and springs back. Gates share an instanced post batch; bullets, FX, hash buckets and slots are reused.

## Verification and measurements

All **17** repository JavaScript and extracted inline files pass `node --check`. CPU checks cover replay equality, 30/60/120 Hz equivalence, the catch-up limit, pause, rendering invariance, nearest-hit order, geometric casualties, defender armor, Assist/offers, weak damage, missing sheets/modules, procedural/daily seeds, and all 36 mission starts:

```sh
THREE_LOCAL=/path/to/three.min.js node tools/bot-engine-check.js
node tools/bot-campaign.js --missions c1m1-c6m6 --policies never,smart --runs 2
```

The campaign bot also accepts `--engine simulation` for the existing DOM/graphics fixture. It reports first-attempt rates by tag/chapter, stars, causes, hashes and profiling counters; timeouts are errors.

CPU stress fixture: **300 soldiers, 400 enemies, 480 bullets per volley, four runs of 600 ticks**. Mean time per tick: baseline **5.98 ms**, updated **4.89 ms**, approximately **18% lower**. This is CPU fixture timing, not phone FPS or GPU timing.

`__game.profile()` reports simulation timings and `renderer.info` draw calls, triangles and memory. Actual before/after renderer numbers are **unmeasured**: Chromium cannot run in this sandbox. The orchestrator can measure them with:

```sh
node tools/bot-engine-profile.js --before /tmp/e1-baseline --after . --three /path/to/three.min.js
```

The baseline snapshot contains the original three engine files; unchanged resources fall back to the current repo. The profiler leaves rendering enabled.

Final CPU sample, assembled from the latest normal/hard/boss verification passes: two fresh-save runs per mission/policy, **144 completed attempts, zero errors**.

| Tag | Never | Smart |
|---|---:|---:|
| normal | 32/48 (66.7%) | 40/48 (83.3%) |
| hard | 2/12 (16.7%) | 8/12 (66.7%) |
| boss | 2/12 (16.7%) | 7/12 (58.3%) |

Normal includes the six onboarding attempts per policy, all wins. Excluding C1M1–3, normal rates are **61.9% never / 81.0% smart**. The full normal-tag never rate is 1.7 percentage points above the target; all other tag/policy samples fit the specified ranges. ARCADE levels 1–8 pass for both policies (**16/16 wins**). These are small CPU policy samples, not browser acceptance or human win-rate estimates.

