# Squad Surge "Surge Update": dopamine and stickiness plan

Owner feedback: the game is basic, has no high-dopamine moments and is not sticky.
Constraint kept from the owner: free and plain, so NO shop, NO currency, NO purchasable or permanent stat upgrades,
no ads, no energy timers. Temporary in-run power-ups are fine (the game already has weapon crates and ammo boxes).
Everything below is original; genre conventions only, no other game's names, art or levels.

## 1. Diagnosis
| Missing | Effect | Fix in this update |
|---|---|---|
| A number to chase | no "one more try" | live score with BEST marker, combo multiplier, per-level and daily bests |
| Escalation inside a run | flat middle of each level | kill combo with tiered callouts, SURGE fever mode, explosive barrels, airdrop power-ups |
| Variable rewards | every run feels the same | airdrops with random power-ups, rare jackpot gates, golden crates |
| A climax after the boss | level just stops | SURGE FINALE: the squad smashes multiplier walls x1.5 → x10 |
| Satisfying results | stars only | score tally count-up, NEW BEST burst, next-star hint, missions ticking |
| Reasons to return | none | daily challenge with streak, 3 rotating missions, trophies, Armory cosmetics unlocked by play |

Research basis (design/research notes in the session): juice stacking within ~100 ms, hit-stop 50-100 ms, slow-mo
0.2-0.4x for 0.3-0.6 s only on rare peaks, combo decay 2-3 s with tiered callouts, fever 5-8 s, variable rewards at
5-10% (minor) and 1-2% (rare), goal gradient and endowed progress, streaks with mercy, personal bests, instant retry,
results screen under 3 s and skippable.

## 2. Features (acceptance criteria)
### In-run (owner: index.html unless noted)
- **F1 Score**: points for kills (zombie/grunt 10, brute 60, boss 400 + 100 × level), soldiers gained (5 each), blocks
  (reward × 10), crates 50, tyres 30, weapon case 100, ammo 50, airdrop 100, barrel 25, all × combo multiplier.
  HUD chip top-right with count-up and "BEST n" under it; "NEW BEST!" once beaten.
- **F2 Combo**: a kill within 2.5 s of the previous one raises the combo; the multiplier is 1 + 0.25 per 10 combo, capped
  at x3. Tier callouts at 10 NICE, 25 GREAT, 50 SURGE!, 100 UNSTOPPABLE (Juice draws them). The HUD shows "xN COMBO"
  with a decay bar.
- **F3 SURGE mode** (fever): each kill fills a meter 1/40 and soldiers gained fill n/200. It drains slowly after 3 s
  without kills. When full: 6 s of double fire rate, golden tracers and screen glow (Juice), and the combo cannot decay.
- **F4 Time feel**: `ctx.hitStop(s)` and `ctx.slowMo(scale, s)`. Hit-stop 0.05 on yellow block/crate/airdrop break and
  0.07 on a gate gain of 10 or more. Slow-mo 0.35x for 0.5 s on the boss's final hit and on x3+/jackpot gates. Max one
  slow-mo per 4 s.
- **F5 Airdrops and power-ups** (owner: js/powerups.js): 1-2 per level. A cargo plane crosses and a parachute crate
  lands on the road ahead. Shoot it open for a random power-up:
  - SHIELD (6 s, no soldier losses, bubble)
  - AIRSTRIKE (jets bomb the road ahead and clear hordes)
  - GIANT (6 s, soldiers 1.7× size, trample enemies and smash blocks without losses)
  - JACKPOT (rare golden crate, +40 soldiers)
- **F6 Explosive barrels** (js/powerups.js): 1-3 red barrels per level placed near hordes. Shooting one makes an area
  explosion, and chain reactions are possible.
- **F7 Jackpot gates**: about 6% of gate pairs get a golden half (x4, or +40+8×level). It is visually golden (Obj3D) and
  triggers a slow-mo pass.
- **F8 Boss**: enrages at 50% HP (slams 40% faster, red pulse). Final hit: slow-mo, zoom punch, mega explosion.

### Climax (owner: js/finale.js)
- **F9 SURGE FINALE**: after the boss falls, the squad charges a short runway of 7 walls labelled x1.5, x2, x3, x4, x5,
  x7, x10. Each wall costs soldiers to break, and the squad stops where it runs out. The last broken wall multiplies the
  level score. It lasts ≤ 6 s, with hit-stop on each wall, slow-mo and a huge multiplier banner on the last.
  Stars are still decided by soldiers alive when the boss died (balance unchanged).

### Results and meta (owner: js/meta.js)
- **F10 Results**: tally count-up (kills, best combo, squad, finale multiplier → total), stars one by one, NEW BEST
  burst, "N more soldiers for ★★★" hint, missions ticking, share button, big NEXT plus quick RETRY. Tap to skip; ≤ 3 s.
- **F11 Near-miss fail**: "Boss at 8%!" or "92% of the way", plus the best for the level and a one-tap retry.
- **F12 Missions**: 3 active from a pool of about 30. Progress bars on home and results; endowed start where natural.
  Completing one gives MEDALS (a progress count, not spendable) and draws a new mission. Toast on completion.
- **F13 Daily Challenge**: a date-seeded level plus one modifier per day. Its best score is kept per day. Streak flame on
  home, with mercy: one freeze earned per 7 streak days. Results get a share text ("Squad Surge Daily #N ★★★ 12,340 🔥5").
- **F14 Armory**: 8 squad colours and 5 tracer styles, unlocked by medals, stars and streak milestones (never bought).
  Locked items show their requirement, with "n/13 collected". The pick is applied with `ctx.setSkin`.
- **F15 Trophies**: about 20 permanent achievements with unlock toasts and a trophy wall.
- **F16 Personal bests**: best score per level on the level-map tiles; best daily score.
- **F17 Share**: Web Share API with a clipboard fallback (text card).

Deferred to a later round: gauntlet/endless mode, a shared leaderboard (artifact `db` capability), per-level mastery
medals, weekly featured level.

## 3. Contracts (index.html provides; modules use)
### ctx additions
`ctx.slowMo(scale, seconds)`, `ctx.hitStop(seconds)`, `ctx.addScore(points, {x, z, reason})` (multiplied by combo
unless `raw: true`), `ctx.spawnSolid(kind, x, z, hp, extra)` → solid (bullets, collisions and Obj3D visuals handled by
the game), `ctx.damageArea(x, z, radius, dmg)` (enemies, solids, boss; emits `explosion`), `ctx.addSoldiers(n)`,
`ctx.killSoldiers(n, nearX)`, `ctx.setShield(seconds)`, `ctx.setGiant(seconds)`, `ctx.finishLevel(multiplier)`,
`ctx.goMode({mode: "normal"|"daily", level, modifier, seed, next})`, `ctx.MODIFIERS` (id → {name, desc, scoreMult}),
`ctx.SKINS`, `ctx.TRACERS` (id → {name}), `ctx.setSkin(skinId, tracerId)`, `ctx.squadRadius(n)`, `ctx.SPEED`.

### Level state (ctx.L) additions
`score, kills, combo, bestCombo, surge (0..1), surgeT, shieldT, giantT, mode, modifier, bossSoldiers, mult`.

### New solid kinds
`airdrop` (hw 1.2; `extra.powerup` = "shield"|"airstrike"|"giant"|"jackpot") and `barrel` (hw 0.8; `extra.explosive`).
Their visuals come from Obj3D (js/objects3d.js), like the other kinds. Gate halves may carry `jackpot: true`.

### New bus events
- `tick {dt, L, state}`: after every simulation step, including the `bonus` state.
- `generate {L, level, rng, length, theme, mode, modifier}`: after the game laid out a level. Modules may add
  solids via `ctx.spawnSolid` and keep their own schedules.
- `score {delta, total, reason, x, z}`, `combo {count, tier}` (on reaching 10/25/50/100), `comboEnd {count}`.
- `surge {on}`, `shield {on}`, `giant {on}`, `explosion {x, z, radius}`, `bossEnrage {boss}`.
- `kill {e, points, combo}`: every enemy death (alongside `enemyDie`).
- From modules: `airdrop {x, z}`, `powerup {type}` (js/powerups.js); `bonusStart`, `bonusWall {index, mult, cost}`,
  `bonusEnd {mult}` (js/finale.js).
- `win` data gains `{score, kills, bestCombo, mult, total, bestScore, newBestScore, mode, modifier}`; `lose` gains
  `{bossPct, score, mode}`.

### States
`home | play | boss | bonus | win | lose | paused | levels`. `bonus` is the finale. Main moves the squad forward and
keeps formation; js/finale.js handles walls and calls `ctx.finishLevel(mult)`.

### Saves
Main keeps `save` (`squad-surge-v1`, adding `bestScore[level]` and `skin`, `tracer`). js/meta.js keeps its own key
`squad-surge-meta-v1` (missions, medals, trophies, unlocks, daily, streak, stats). Wrap storage in try/catch.

## 4. Ownership (never edit another owner's file; never run git)
| owner | files |
|---|---|
| orchestrator | index.html, design/*.md, tools/* |
| gameplay modules agent | js/powerups.js (new), js/objects3d.js (new kinds `airdrop`, `barrel`, golden jackpot gate style) |
| finale agent | js/finale.js (new) |
| meta agent | js/meta.js (new; injects its own DOM and CSS) |
| art agent (Codex images) | art-src/surge/, assets/ui/icons/, assets/fx-extra/ |
| juice (Codex) | js/juice.js |
