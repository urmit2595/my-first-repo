# Squad Surge "Campaign Update": story mode, real difficulty, engine upgrade

Inputs: `design/engine-audit.md` (the code audit) and the genre research summarised below.

**Owner's request:** "This game is super easy right now. Check the similar games and story mode, copy their best
features, and improve our gaming engine as well."

**Standing constraints:**
- No shop, no currency and no purchasable upgrades. Stars, medals and cosmetics are progress records only.
- Original work only: borrow genre mechanics, never another game's names, art, characters or levels.

## 1. Why it is easy today (from the audit)

- Enemies only walk forward. None shoot, shield, charge or split.
- Difficulty is mostly HP and count scaling.
- The squad snowballs to 500+.
- Several safety nets protect the squad:
  - the guaranteed opening boost
  - supplied counters
  - the threat loss cap (never below 60% of the squad)
  - no real attrition

## 2. Targets (first-attempt win rates, measured by bot)

| Mission tag | "smart" bot (uses counters, dodges) | "never" bot (steers to gates only) |
|---|---|---|
| normal | 80–90% | 45–65% |
| hard | 55–70% | 15–35% |
| boss | 45–60% | 5–25% |

- Chapter 1, missions 1–3 are onboarding: everyone wins.
- Losing must feel fair:
  - every threat is telegraphed for ≥ 0.8 s
  - there is always a reachable safe lane
  - no mandatory barricade under unavoidable mortars
- After a loss: instant restart on the same seed, plus a specific hint about the decisive mistake.
- After 2 consecutive fails, offer **Assist**: 20% fewer and weaker enemies plus one extra drop. After 4 fails, offer
  Assist+ (−35%).
- Assist is offered between attempts, never applied mid-run. An assisted win is marked and cannot earn the third star.

## 3. Story: "Operation Homeward" (original)

The Warlord's horde has cut the valley into six isolated districts. Captain **Rook** leads the Surge squad home
district by district, rescuing settlers and relighting each district's signal tower. **Mira**, the radio scout,
calls out what's ahead. Each chapter ends with a boss guarding the tower. Cleared districts visibly recover on the
map.

| Chapter | District (theme) | New enemy | New mechanic | Boss |
|---|---|---|---|---|
| 1 | Old Town (town) | the brute | trade-off gates and weapon cases | **Ogre Warlord**: slam, then summons when enraged |
| 2 | Red Bridge (bridge) | **shieldbearer** | mortars; collapsing bridge lanes | **Iron Bulwark**: a shield wall that exposes a weak core after each slam |
| 3 | Dust Road (desert) | **charger** and **bomber** | lane rushes; fuse explosions | **Dune Ravager**: telegraphed lane charges, then double charges |
| 4 | The Pier (pier) | **rifleman** and **medic** | crossfire gates; healer tethers | **Harbor Gunner**: lane barrages plus rifleman summons |
| 5 | Broken Blocks (ruins) | **splitter** | barricades; interactive collapses (shoot to open a shortcut) | **Scrap Colossus**: splits into two halves at 50% |
| 6 | The Arena (arena) | everything combined | everything | **The Warlord, Reborn**: 3 phases combining all patterns |

Each chapter has 6 missions:
1. teach
2. practice
3. twist
4. recovery or rescue
5. **HARD** combination
6. **BOSS**

That is 36 missions in total. Every mission has two radio lines before it starts, optional in-run radio lines, and
one line after a win.

## 4. Mission data format (`js/campaign.js` exports `window.Campaign`)

```js
Campaign = {
  version: 1,
  chapters: [{ id: 1, name: "Old Town", theme: "town", blurb: "...", boss: "ogre", missions: ["c1m1", ...] }],
  missions: { "c1m1": {
    id: "c1m1", chapter: 1, n: 1, tag: "normal" | "hard" | "boss", theme: "town", title: "Out of the Barracks",
    seed: 101, length: 260, start: 5,                     // start = initial squad; length in metres
    brief: [["rook", "..."], ["mira", "..."]], win: ["rook", "..."],
    skill: { id: "noWaste", text: "Win without wasting a power-up" },  // the third-star objective (see 7)
    events: [ /* sorted by `at` (metres from the start); see below */ ],
    boss: { type: "ogre", hp: 900 }                       // omitted means no boss: the mission ends at the finish arch
  } } }
```

Event types (`at` is in metres; lanes are −1, 0, +1, which map to x = −3.4, 0, +3.4):

| Event | Shape | Notes |
|---|---|---|
| `gate` | `{left: Half, right: Half, moving?: true}` | `Half` is one of: `["+", n]`, `["x", n]`, `["-", n]`, `{powerup: "shield"\|"airstrike"\|"giant"}`, `{recruit: "piercer"\|"grenadier"\|"defender", n}`, `{rescue: n, cost: m}` (lose m soldiers now, rescue n settlers for the story tally and score). Add `jackpot: true` for a golden half. |
| `wave` | `{type, count, lane?: -1\|0\|1, spread?: 3, depth?: 6, formation?: "block"\|"line"\|"wedge"}` | `type` is any enemy type, including the new ones in 5 |
| `solid` | `{kind, x?, n?, hp, reward?, weapon?}` | `kind` is blockBlue, blockYellow, crate, tyres, weaponCase, ammo or barrel |
| `threat` | `{kind: "swarm"\|"barricade"\|"mortars"}` | The existing Tactics threats |
| `drop` | `{powerup}` or `{pair: [a, b]}` | Airdrops |
| `hazard` | `{kind: "crusher"\|"saw"\|"collapse", lane, period?}` | `collapse`: a bridge lane falls away and is telegraphed |
| `scenery` | `{kind: "fuelTruck"\|"shortcut", lane}` | Shoot a fuel truck to explode nearby enemies. Shoot a shortcut wall to skip the next hazard. |
| `radio` | `{who: "rook"\|"mira"\|"warlord", text}` | |

## 5. Enemy archetypes and bosses (`js/enemies.js`)

Each archetype is readable, telegraphed and has a counter.

| Type | Behaviour | Counter |
|---|---|---|
| shieldbearer | A frontal shield blocks bullets from within ±25° in front, so it takes damage only when the squad centre is more than 2.2 to its side. | splash (grenadier), AIRSTRIKE, GIANT, piercer |
| charger | Stops, crouches for 0.9 s with a red lane arrow, then rushes down its lane at 3× speed, killing the soldiers it touches (cap 8 per charge). | sidestep |
| bomber | Within 9 m it lights a 2.2 s fuse with a visible ring; the blast (radius 2.4) kills soldiers. Killed early, it explodes where it stands and damages enemies. | kill it early, or step out |
| rifleman | Stops about 20 m ahead and paints a lane laser for 1.0 s, then fires a burst that kills up to max(2, 3%) soldiers in that lane. Killing it during the lock cancels the shot. | change lane, or kill it fast |
| medic | Tethers to the nearest brute or boss (a visible beam) and heals it 6% of max HP per second. | kill the medic first |
| splitter | On death, splits into 3 small fast minis. | space, splash, AIRSTRIKE |

**Bosses** (data-driven phases):

```js
{ hp, phases: [{ at: 1.0, attacks: ["slam"], cadence: 2.6 }, { at: 0.5, attacks: ["slam", "summon"], cadence: 1.9 }],
  weak: { after: "slam", dur: 1.4, mult: 2.5 } }
```

- Attacks: slam, summon(type, n), charge(lanes), barrage(lanes), shieldWall, split.
- Every attack is telegraphed for ≥ 0.9 s.
- The weak window is shown with a glowing marker and takes multiplied damage.

## 6. Squad depth without upgrades (run-only)

- **Specialists**, recruited at gates for the current run only, each with fixed stats and a tinted sprite plus a small
  icon:
  - **piercer**: bullets pass through shields
  - **grenadier**: splash
  - **defender**: soaks one ranged hit per defender, protecting the lane-side soldiers
- **Trade-off gates:**
  - a rescue costs soldiers now
  - x2 through a rifleman crossfire versus +20 in a safe lane
  - a power-up versus soldiers (already in place)
- **Anti-snowball:**
  - campaign squad cap 300
  - waves are authored for the squad sizes expected at that point
  - no automatic opening boost in campaign missions

## 7. Stars and meta (no currency)

- ★1 for the win.
- ★2 for keeping ≥ 65% of the peak squad (this already exists).
- ★3 for the mission's skill objective. The ids are:
  - `noWaste`: no wasted power-up
  - `rescueAll`: take every rescue gate
  - `perfect2`: 2 PERFECT counters
  - `medicsFirst`: every medic dies before its patient
  - `noCharge`: no soldiers lost to chargers
  - `bossClean`: lose < 20 soldiers during the boss
  - `fast`: finish without a slowdown from a rescue
  - `noAssist`: an assisted win never earns ★3
- **Elite** versions of a chapter's missions unlock at 15/18 stars in that chapter. They use the same layouts with:
  - enemies ×1.3
  - no drops
  - one extra threat
- Chapter completion awards an armory cosmetic (existing) and shows a vignette.
- The existing daily challenge stays.
- The old procedural levels remain as **ARCADE** mode.

## 8. Engine upgrade (from the audit, prioritised)

1. **Fixed 60 Hz timestep:**
   - an accumulator, with at most 5 catch-up steps
   - separate clocks for sim time, real time and slow-mo
   - nothing authoritative inside presentation callbacks
2. **Determinism:**
   - every gameplay random number comes from seeded streams (no Math.random in the simulation)
   - a replay/test mode that records tick-indexed inputs
   - state hashing for bot regression tests
3. **Spatial hash** (cell 2 m) for bullets against enemies, solids and gates:
   - nearest-hit resolution
   - compact dead enemies each step
   - O(K) soldier removal (swap-pop, no splice)
4. **Crowd:**
   - soldiers get velocity-based cohesion toward their slot plus local separation (spatial grid)
   - the formation compresses through gaps (walls, barricade gaps, hazard lanes) and springs back out afterwards
   - per-soldier contacts for hazards, chargers and blasts
   - pooled death knockback visuals
5. **Allocation and rendering:**
   - pool bullets and FX
   - cache formation slots
   - update the HUD only when values change
   - batch repeated gate and solid parts where cheap
   - keep the instanced sprite layers
6. **Campaign interpreter** for the format in 4. The procedural generator stays for ARCADE and daily.
7. **Difficulty systems:**
   - Assist offers
   - failure-cause tracking (`cause`: `threat:<kind>`, `rifleman`, `charger`, `bomber`, `boss:<attack>`, `gate`,
     `swarm`, `attrition`)
   - same-seed instant restart

## 9. Contracts

### ctx additions, provided by index.html

| Function | Purpose |
|---|---|
| `ctx.registerEnemy(type, def)` | `def = {sheet: url, cols: 4, rows: 2, hp, r, h, sp, dmg, scale, init(e), update(e, dt), onBullet(e, b) → false to block, onDeath(e)}`. Sheets load into new SpriteLayers. |
| `ctx.registerBoss(type, def)` | Same idea, plus `phases`, `weak`, `attacks: {name: fn}` |
| `ctx.spawnEnemy(type, x, z, opts)` | |
| `ctx.squad` | `{x, z, count, radius, soldiers}` (read-only use) |
| `ctx.killSoldiersInRect(x0, x1, z0, z1, max, cause)` | Returns the number killed |
| `ctx.killSoldiersInCircle(x, z, r, max, cause)` | |
| `ctx.damageEnemiesInCircle(x, z, r, dmg)` | |
| `ctx.rng(stream)` | A seeded gameplay random number |
| `ctx.telegraphGroup` | A THREE.Group for telegraph meshes. Modules own their own meshes. |
| `ctx.goMission(id, {assist})` | |
| `ctx.goArcade(level)` | |
| `ctx.restartSame()` | Restart on the same seed |
| `ctx.mission` | The current mission def |
| `ctx.missionState` | `{rescued, recruits, causes, assisted}` |

### Events

| Event | Payload |
|---|---|
| `missionStart` | `{id, assist}` |
| `missionEnd` | `{id, result, stars: [b1, b2, b3], keptPct, skillOk, cause, rescued, assisted}` |
| `radio` | `{who, text}` |
| `recruit` | `{kind, n}` |
| `rescue` | `{n, cost}` |
| `bossPhase` | `{type, phase}` |
| `bossWeak` | `{on}` |
| `enemyTelegraph` | `{type, kind, x, z}` |
| `hazard` | `{kind, lane}` |
| `assistOffer` | `{id, level: 1\|2}` |

## 10. Ownership (parallel Codex runs; never edit outside your column; never run git)

| Run | Files |
|---|---|
| E1 engine and systems | index.html, js/objects3d.js, js/powerups.js, tools/bot-*.js |
| E2 enemies and bosses | js/enemies.js (new) |
| C campaign content | js/campaign.js (new), design/campaign-script.md |
| U story UI | js/story.js (new), js/meta.js, js/juice.js |
| A art | assets/units2/*, assets/story/*, art-src/units2/*, art-src/story/* |

- index.html (E1) loads js/enemies.js, js/campaign.js and js/story.js after the existing modules.
- Every module must work when another is missing:
  - campaign absent: no Story button
  - an enemies sheet absent: fall back to a tinted grunt sheet
