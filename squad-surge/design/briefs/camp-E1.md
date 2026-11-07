# Codex run E1: engine and systems for the Squad Surge "Campaign Update"

Repo: /home/user/my-first-repo/squad-surge. Read fully first: `design/campaign.md` (THE spec, sections 2, 6, 7, 8,
9 and 10), `design/engine-audit.md` (the audit with line numbers), `design/strategy.md` (the Tactics systems you keep),
`index.html`, and `js/objects3d.js`.

EDIT ONLY: `index.html`, `js/objects3d.js`, `js/powerups.js`, and `tools/bot-*.js` (add `tools/bot-campaign.js`).
Four other runs are writing `js/enemies.js`, `js/campaign.js`, `js/story.js`, `js/meta.js`, `js/juice.js` and art
right now. Never touch their files. Do not run git.

Implement:
1. **Engine upgrade (section 8, items 1–5):**
   - a fixed 60 Hz timestep with an accumulator, ≤ 5 catch-up steps, and separate sim/real/slow-mo clocks
   - seeded gameplay RNG streams (no Math.random in the simulation)
   - a replay/test mode recording tick-indexed inputs, plus `__game.stateHash()`
   - a spatial hash (2 m cells) for bullet hits with nearest-hit resolution
   - dead-enemy compaction and swap-pop soldier removal
   - crowd cohesion and separation, with the formation compressing through gaps and springing back
   - per-soldier contacts for hazards and blasts, plus pooled death knockback visuals
   - bullet and FX pools, cached formation slots, and a HUD that updates only on change
   Measure before and after with `renderer.info` and a simple sim-time counter; report the numbers.
2. **Campaign interpreter (section 4):**
   - `ctx.goMission(id, {assist})` builds a level from `Campaign.missions[id]` (js/campaign.js, loaded by index.html)
   - every event type, including hazards (crusher, saw, collapse lanes with telegraphs) and scenery (fuel truck,
     shortcut wall)
   - gates with `-` halves, `powerup` halves, `recruit` halves and `rescue` halves
   - moving gates
   - the finish arch when there is no boss
   - Keep the procedural generator for ARCADE (`ctx.goArcade(level)`) and the daily challenge.
3. **Contracts (section 9):**
   - every ctx function listed: registerEnemy, registerBoss, spawnEnemy, squad, killSoldiersInRect/Circle,
     damageEnemiesInCircle, rng, telegraphGroup, restartSame, mission and missionState
   - sheets registered by js/enemies.js become SpriteLayers. If a sheet fails to load, fall back to a tinted grunt
     sheet.
   - a boss registry with phase/attack data, and a weak-point damage multiplier
   - every listed event
4. **Specialists (section 6):** piercer, grenadier and defender, run-only, as tinted soldiers plus an icon in the
   count chip.
5. **Difficulty systems (sections 2 and 6):**
   - campaign mode: squad cap 300, no automatic opening boost, and no 60% loss cap (keep it only in chapter 1,
     missions 1–3, and in ARCADE)
   - Assist (offered through the `assistOffer` event after 2 and after 4 consecutive fails; applied only to the next
     attempt)
   - failure-cause tracking, and `missionEnd` with stars, keptPct, skillOk (evaluate the skill ids in section 7) and
     cause
   - same-seed restart
   - persist mission progress (best stars per mission, attempts, consecutive fails) in the main save, wrapped in
     try/catch
6. Load `js/enemies.js`, `js/campaign.js` and `js/story.js` (in that order, after the existing modules). Everything
   must still run if any of them is missing.
7. **`tools/bot-campaign.js`**, modelled on tools/bot-tactics.js:
   - plays mission ids (for example `--missions c1m1-c6m6`) with the policies `never` and `smart`
   - `smart` uses counters, dodges telegraphed lanes (riflemen, chargers, bombers, hazards), prefers safe gates when
     the squad is small, and kills medics first
   - `--runs N`
   - prints first-attempt win rates per tag (normal, hard, boss) and per chapter, plus stars and causes of loss
   You cannot launch Chromium in your sandbox, so write it carefully. The orchestrator runs it.

Finish: `node --check` on every file, including the extracted inline scripts. Write a short summary of the APIs,
events and tuning knobs to `design/campaign-engine-notes.md`, and print it.
