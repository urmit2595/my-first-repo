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


## I1 integration and final tuning

This section supersedes the E1 balance values and samples above. Sprite atlas fixes (`SHEET_SPEC`, `SHEET_ASPECT`, and `def.aspect`) are preserved. No git commands were used.

### Causes, stars, and flow

- Ordinary grunt/brute contact now records `horde`; Tactics SWARM still records `threat:swarm`. Shieldbearer, splitter, mini, and medic contacts retain their archetype names instead of being flattened into swarm. Colossus-half contact maps to `boss:split`. Story has specific hints for these, every emitted boss attack, and collapse/crusher/saw hazards. `attrition` remains the fallback for non-enemy obstacles.
- `Campaign.keepPct(mission)` supplies the shared second-star threshold: **normal 65%, hard 50%, boss 45%**. Engine scoring, briefing objectives, results objectives, and fallback result scoring all use it. Assisted wins still cannot earn the skill star.
- The level pill uses the mission title and `C4 · 2`-style numbering, with `☠ HARD` / `♛ BOSS` where applicable. Campaign intro banners also use chapter/mission numbering. Arcade restores its level name/number; Daily restores its modifier name and Daily Challenge label.
- Code-path review: unlocked map nodes open two briefing radio lines, three objectives and START; START calls `goMission`; distance-triggered radio events reach the in-run toast; results reveal the three star objectives and name the next mission. Losses display the cause hint, retry the authored seed, and offer Assist after two consecutive failures (Assist+ after four). Advancing from completed-chapter results presents the one-time restoration vignette and cosmetic before the next district map.
- Fixed selected Assist being silently cleared when retrying an already assisted attempt. Unassisted retry still uses `restartSame`; selected Assist explicitly calls `goMission` with the same mission seed.
- Results/map now offer HOME. Quitting a campaign prepares an Arcade home run instead of leaving a campaign behind the home screen. Arcade and Daily launch through their existing procedural paths. Meta counts a campaign boss win only when the mission actually has a boss.

### Encounter changes

Starts and boss HP are unchanged. The four normal missions lose excess generic pressure and receive growth before the difficult wave where needed:

| Mission | Final authored changes |
|---|---|
| C2M2 | Grunts **24/18 → 14/6**. Move the gate from 72 m to **20 m**, before the opening wave; offer **3 piercers / +8**. |
| C5M2 | Grunts **48/34 → 28/20**; retain the two supplied Tactics counters and splitters. |
| C5M3 | Grunts **48/38 → 28/10**, final brutes **3 → 1**. Move recruitment/+12 to **20 m**; offer **+10** opposite the rescue at 244 m. |
| C6M2 | Grunts **54/48 → 40/34**; keep the crusher, splitters, chargers, bombers and rifles. |
| C2M5 | Grunts **60 → 20** total; shieldbearers **6 → 29**, including a central opening shield group. Replace brutes with shields. Add a second mortar encounter at **282 m**, supplied with SHIELD at 246 m. Move collapse to 200 m to preserve hazard/mortar separation. |
| C2M6 | Grunts **52 → 20**, shieldbearers **5 → 11**; replace brutes with shields and add mortars at **196 m**, supplied at 156 m. |
| C5M5 | Grunts **102 → 18**; splitter groups **4/12/32/14**. Replace the bomber/brute finish with splitters and a **322 m barricade**, supplied with GIANT at 282 m. The 250 m pack has an open left lane and AIRSTRIKE available at 202 m. |
| C5M6 | Grunts **92 → 16**; splitters **12 → 28** in two central groups. Replace shieldbearers with a **184 m barricade**, supplied with GIANT at 144 m; replace the final brute/grunt wave with splitters. Move the bazooka case to the centre at 54 m and lower its HP **84 → 36**, so the reduced horde/SURGE supply does not leave a prolonged pistol-only boss fight. |

Simply thinning the hordes overshot the tag targets in the first CPU sweep (smart 100% normal excluding onboarding, 83% hard, 67% boss). Final ordinary-fire multipliers are **normal 0.28, hard 0.35, boss 0.40**, with **first boss 2.5** unchanged. C1M1–3 still bypass the campaign damage reduction. The global normal/boss adjustments retain the aggregate difficulty bands after the local spikes are smoothed; Arcade/Daily damage is unchanged. Gate charging remains 0.015 with +6 maximum growth and no multiplier inflation.

All event lists remain sorted. Warning durations and safe-lane geometry are unchanged. Content schema, text lengths, supplied counters, threat/hazard spacing, reserved lanes, unique seeds, rescue/skill requirements and squad bounds pass an in-memory adaptation of the script's validator: omit its two old per-slot pressure-order assertions and use the engine's +6 gate-charge bound instead of the legacy +99 inflation model. Those old assumptions no longer describe the final engine and deliberately softened normal missions. `design/campaign-script.md` remains the original content-run record.

### I1 verification

Reproduction (Three r128 available locally):

```sh
THREE_LOCAL=/path/to/three.min.js node tools/bot-engine-check.js
THREE_LOCAL=/path/to/three.min.js node tools/bot-campaign.js --checks only
THREE_LOCAL=/path/to/three.min.js node tools/bot-campaign.js --engine simulation --missions c1m1-c6m6 --policies never,smart --runs 2
THREE_LOCAL=/path/to/three.min.js node tools/bot-tactics.js --engine simulation --levels 1-8 --policies never,smart --runs 1
```

The campaign bot now reports per-mission rates, normal rates excluding onboarding, casualty totals and boss losses, and captures event-bus errors in addition to thrown exceptions. `--checks only` verifies star boundaries at 64/65, 49/50 and 44/45, mission/Arcade/Daily HUD labels, same-seed reset hashes, every cause hint, assisted skill-star exclusion, and briefing/event data.

The engine contract suite passes, including replay/render independence, catch-up/pause behavior, collision order, defender armor, Assist/reset/offers, all 36 mission starts, missing assets/modules and split-boss damage. Arcade's separate CPU sweep wins **16/16** games. All **18** repository JavaScript and extracted HTML inline scripts pass `node --check`.

Known pre-existing test issue: unmodified `tools/check-tactics.js:40` expects the older 2/3-threat schedule, while the generator uses 2/3/4 at levels <4 / 4–6 / 7+. The same assertion fails against the pre-I1 engine snapshot. Running that suite with only this expectation corrected in memory passes its remaining assertions and eight Arcade smoke runs; the out-of-scope file was not edited.

Final CPU sample, assembled from the final normal, hard and boss/onboarding sweeps with the last C5M5/C5M6 reruns replacing their earlier rows: **144 completed attempts, zero errors**, two fresh-save steering seeds per mission/policy.

| Tag | Never | Smart |
|---|---:|---:|
| normal, excluding C1M1–3 | **25/42 (59.5%)** | **37/42 (88.1%)** |
| normal, including onboarding | 31/48 (64.6%) | 43/48 (89.6%) |
| hard | **4/12 (33.3%)** | **8/12 (66.7%)** |
| boss | **2/12 (16.7%)** | **6/12 (50.0%)** |

All tag/policy aggregates fit section 2's targets. C1M1–3 win all 12 onboarding attempts. The four flagged normals win **8/8 smart attempts**; this small sample verifies the spikes are cleared, not an individual-mission 85% probability. Average stars per attempt: **never 1.07, smart 1.69**.

C2/C5 hard/boss losses in the final sample are **shieldbearer, splitter, boss:slam, boss:shieldWall, or boss:barrage**; none end in `horde`. The final C5M6 approach case resolves the earlier >300-second pistol-only fight without raising the bot timeout or altering boss HP/telegraphs. Final rows are retained in `/tmp/i1-campaign-final.log` for this workspace session.

These are CPU fixture measurements and code-path UI review, not a new browser acceptance run. The orchestrator's 72-game browser run remains the pre-I1 baseline; rerun the browser bot on this tuning to validate browser rates and presentation.

### Orchestrator pass after I1 (browser verification, audit fixes, final tuning)

**Browser equals CPU.** Browser runs of the same mission, policy and seed end with the same `stateHash` as the CPU fixture: 17/17 games before the fixes and 2/2 after (`design/qa/campaign/bot-browser-run2-partial.log`, `browser-spot.log`). The fast simulation is therefore the balance measurement; the browser is used for flows and visuals.

**Audit fixes.** Two read-only audits (core diff since v9; new enemies/campaign/story modules) both returned "safe to publish". Fixed from their findings:
- Arcade levels are generated **unseeded** again, so the published layouts, the guaranteed level-2 jackpot and the "never three dry levels" rule are restored.
  - The replay records the jackpot counter from *before* generation (`initial.jackDry`) and a `seeded` flag, and playback rebuilds arcade levels unseeded. `bot-engine-check.js` passes all suites.
- The squad is visible on the home screen again. A presentation-only `homeClock` drives pop-in and the idle march. It is not on `L` and not in the replay or hash.
- The pause menu's "RESTART LEVEL" button actually quit to home; it is now labelled **QUIT TO HOME**.
- After an assisted loss, the results sheet keeps Assist ticked, so RETRY stays assisted.
- story.js:
  - tolerates a malformed `storyUI` and clamps star counts;
  - `.at(-1)` is replaced for older Safari.
- Two rifleman radio lines promised a safe lane, but lasers track the squad's lane. They now say "The laser follows your lane. Step off the red line." and "Riflemen guard the doubler."
- **`line` waves** used to stack every unit inside 1.6 m at one z, which read as a single blob (32 splitters in C5M5). They now form a readable column down the lane, using the authored `depth`, in three sub-files 0.64 m apart.
  - Columns fire and arrive in sequence, and splash hits fewer of them at once. Counts were therefore re-tuned, as listed below.

**Re-tuned counts.**

| Mission | Change |
|---|---|
| C2M3 | grunts 24/24 → 14/16, plus a piercer/+6 gate at 176 m |
| C3M1 | grunts 32/30 → 20/20, plus a piercer/+6 gate at 236 m. The chapter opener teaches the charger telegraph, not horde mass. |
| C4M3 | rifleman column 8 → 6 |
| C5M3 | splitter column 12 → 9 |
| C6M2 | grunts 40/34 → 32/28; splitters 12 → 9; chargers 9 → 6; bombers 7 → 6; riflemen 8 → 6 |
| C6M3 | grunts 58/48 → 46/38; riflemen 10 → 7; splitters 14 → 10 |
| C6M5 | riflemen 12 → 9; splitters 18 → 14; chargers 10 → 8; final grunts 90 → 66 |

**Final CPU sample** (`design/qa/campaign/sim-final-144.log`): 144 attempts, 0 errors.

| Tag | Never | Smart |
|---|---:|---:|
| normal, excluding C1M1–3 | 29/42 (69%) | 42/42 (100%) |
| hard | 4/12 (33%) | 7/12 (58%) |
| boss | 2/12 (17%) | 6/12 (50%) |

- Average stars: never 1.14, smart 1.82.
- Normal missions now sit slightly above the section 2 band on purpose, so a careful player is never walled on a normal mission. The pressure is in the ★2 keep threshold, the skill star, and the hard/boss missions.
- The smart bot loses both seeds on C2M6, C4M6, C5M5, C6M5 and C6M6.
  - With **Assist 1** (offered after 2 losses) it wins C4M5, C4M6, C5M5 and C6M5.
  - With **Assist 2** (after 4) it also wins C2M6 and C6M6.
  - No mission is a permanent wall: `node tools/bot-campaign.js --assist 1|2`.

**UI flows** (`node tools/flow-campaign.js`; screens in `design/qa/campaign/flow/`): 26/26 checks pass.
- Fresh player: home → map (36 nodes, 1 open) → briefing → START → HUD `C1 · 1` → radio → loss sheet with hint → RETRY → Assist offer → assisted retry, which stays assisted → pause QUIT TO HOME → ARCADE starts a normal level → Daily.
- Returning player: CONTINUE → chapter 1 boss won through the UI → NEXT → district vignette → chapter 2 map.
- No page errors and no failed requests.

**Arcade check** (`bot-tactics.js --engine simulation --levels 1-8 --runs 2`): never, smart and random each win 16/16; average stars 2.9 / 3.0 / 3.0; squad kept 80% / 95% / 85%.
