# Operation Homeward — campaign script

`js/campaign.js` contains the complete playable script: 36 missions, 72 briefing lines,
36 win lines, and up to two in-run radio lines per mission. All spoken lines are at most
90 characters. This file is the story outline, encounter rationale, and validation recipe.
No shop, currency, permanent stat rewards, or borrowed characters are involved.

## Characters and through-line

**Captain Rook** leads the Surge squad. Practical, kind, occasionally dry. Rook measures
success in people brought back, not enemies defeated. The journey starts at the barracks
and ends within sight of Rook's old roof. Rook never scolds a player for choosing the
safe route. A rescue costs an escort now; it does not imply the rescued settlers become
soldiers or that escorts have died.

**Mira** is the radio scout. Her directions are short and concrete: which lane, which
warning, which tool. She notices the things worth saving: biscuits, a passenger's cat,
water bottles, ferry families. Her growing network of answering radios makes the valley's
recovery audible. The final kettle joke pays off the first tower's supper bell.

**The Warlord** divided the valley into six isolated districts and took their signal
towers. He taunts over the radio at distance zero in every boss mission, before any
combat. Early taunts boast about his guards; his last betrays his fear of people reuniting.
The Ogre Warlord is his first lieutenant, not the same encounter as The Warlord, Reborn.

**The neighbours** are the collective supporting cast: shelter families, the baker,
bridge workers, bus passengers, pump crew, dockhands, builders, and prisoners. Each rescue
leads to a visible recovery beat. Nobody needs a new named character or a long cutscene.

The squad reconnects the districts by relighting their towers. Each new signal enables
the next leg: town streets → bridge crossing → water convoy → ferry landing → rebuilt
neighbourhood → the arena's holding yard. The final mission returns the signal to every
district at once. The ending is homecoming, not conquest.

## Chapter arcs and all 36 beats

Mission order always means **teach → practice → twist → recovery/rescue → HARD → BOSS**.
The chapter-one twist is still onboarding; real combinations begin at c1m5. Each row's
skill is an optional third-star objective, not a condition for basic completion.

### 1. Old Town — a street becomes a community again

| Mission | Story and playable lesson | Skill |
|---|---|---|
| c1m1 Out of the Barracks | Rook leaves the barracks; modest +/- choices and a rifle case teach steering. | noAssist |
| c1m2 One Big Problem | One isolated brute blocks the route; GIANT and open flanks make it readable. | noWaste |
| c1m3 Hold That Button | Reclaim the square; a guaranteed AIRSTRIKE teaches waiting for the swarm. | noWaste |
| c1m4 Chalk Arrows | Follow shelter chalk marks and escort two groups; the baker kept biscuits. | rescueAll |
| c1m5 Market Squeeze | Reopen the market; learned brute pressure joins the learned swarm. | noWaste |
| c1m6 The First Light | Defeat the Ogre: dodge slams, then clear summons. The supper tower lights. | bossClean |

Recovery vignette: shutters open, market stalls return, and the tower's warm beacon
reaches the bridge. Rook's “Five more” makes the whole journey legible.

### 2. Red Bridge — both banks belong together

| Mission | Story and playable lesson | Skill |
|---|---|---|
| c2m1 Side Door | Release the bridge crew; one shieldbearer teaches flanking or a piercer. | noWaste |
| c2m2 Rain Check | Escort workers under the first mortars; supplied SHIELD or open-road dodges. | noWaste |
| c2m3 Missing Planks | Mortars finish before the left lane collapses; read the new floor warning. | noWaste |
| c2m4 Last Bus | Two safe-deck rescues unload the bus, including a passenger's cat. | rescueAll |
| c2m5 Steel and Rain | Shieldbearers and mortars combine; the later collapse leaves the right lane. | noWaste |
| c2m6 A Crack in Iron | Iron Bulwark examines shield positioning and the post-slam core window. | bossClean |

Recovery vignette: bridge workers lay fresh decking, the bus crosses, and the second
beacon shows the water convoy its route. The boss approach has no collapsed lanes.

### 3. Dust Road — patience carries the water

| Mission | Story and playable lesson | Skill |
|---|---|---|
| c3m1 Read the Dust | One charger introduces the crouch and arrow; sidestep before repetition. | noCharge |
| c3m2 Short Fuse | One bomber introduces the fuse ring; later a fuel truck rewards early fire. | noWaste |
| c3m3 Keep One Back | Chargers and bombers share a lane; save the early tool for a later swarm. | noCharge |
| c3m4 Water for Everyone | Return for the pump crews at two shelters; refill bottles and confidence. | rescueAll |
| c3m5 Fuse Run | Charger rushes and bomber fuses combine twice, with empty lanes beside them. | noCharge |
| c3m6 The Long Sidestep | Dune Ravager tests the rush cue, then consecutive lane decisions. | noCharge |

Recovery vignette: the pump restarts, water trucks roll, and the third signal clears
the route to the pier. From this chapter onward a fresh counter is no longer assured
just before each danger. Movement remains a valid answer.

### 4. The Pier — break their support, protect ours

| Mission | Story and playable lesson | Skill |
|---|---|---|
| c4m1 Red Lines | One rifleman paints the landing; defenders are offered before later shooters. | noWaste |
| c4m2 Cut the Thread | Identify a lone medic first; then target medics before tethered brutes. | medicsFirst |
| c4m3 Double or Duck | Left x2 lies under rifle fire; safe right +20 competes with the risky gain. | noWaste |
| c4m4 Ferry Tickets | Escort two gangways of dockhands and families; no ticket required. | rescueAll |
| c4m5 Covering Fire | Riflemen cover medics and patients; target priority competes with dodging. | medicsFirst |
| c4m6 Harbor Lights | Harbor Gunner tests marked barrage lanes and rifleman add priority. | bossClean |

Recovery vignette: the fourth tower becomes a harbour light again. Every boat in the
bay answers; the ferry unloads onto a safe shore. A solitary debut medic has no patient;
the objective's real test comes in the later tethered encounter.

### 5. Broken Blocks — leave space for a neighbour

| Mission | Story and playable lesson | Skill |
|---|---|---|
| c5m1 Room to Breathe | One splitter teaches the three minis; splash and empty lanes handle them. | noWaste |
| c5m2 Through the Rubble | Counter a swarm, then learn a separately supplied barricade and its gap. | perfect2 |
| c5m3 A Better Way | Shoot a shortcut wall before the first crusher; later dodge the first saw. | fast |
| c5m4 Names on the Wall | Two shelter rescues turn missing-person names into returning neighbours. | rescueAll |
| c5m5 Moving Parts | Splitters plus machinery test space management; save splash for the minis. | noWaste |
| c5m6 Two Halves, One Plan | Scrap Colossus splits at half HP; carry the spacing lesson into the boss. | bossClean |

Recovery vignette: builders open the new passage, neighbours cross names off the wall,
and the fifth beacon reveals Rook's old roof. In c5m3, `fast` asks the player to choose
the direct gate instead of the optional rescue; it is a route medal, not a moral verdict.

### 6. The Arena — every lesson brings someone home

| Mission | Story and playable lesson | Skill |
|---|---|---|
| c6m1 Bring What We Know | Rehearse two supplied counters, with shields and chargers between them. | perfect2 |
| c6m2 Pick Your Ground | Practice shortcut, crusher, splitter, rush, fuse, and rifle cues in stages. | noCharge |
| c6m3 The Price of Plenty | Revisit the crossfire gamble; medics and a fuel-truck cluster test planning. | medicsFirst |
| c6m4 Leave Nobody | A quieter three-stop holding-yard rescue resolves the missing-neighbour arc. | rescueAll |
| c6m5 All the Way Through | Rifle/medic support and machinery/lane pressure form the final HARD exam. | medicsFirst |
| c6m6 Operation Homeward | The Warlord's three phases combine slams, shields, rushes, and barrages. | bossClean |

Recovery vignette: the arena gates stay open, all six map districts recover, and the
towers answer one another. Rook asks Mira to put the kettle on. End on people walking
home; no new threat or monetisation hook interrupts the payoff.

## Interpreter contract and encounter safety

Every event uses **`event` as its discriminator**, for example
`{at: 82, event: "wave", type: "shieldbearer", count: 1, lane: 0, ...}`.
This avoids colliding with the spec's wave `type` or threat/solid/hazard `kind`.
`at` is an authored world distance, not a delay between events. Equal-distance events
retain array order. Missions export ordinary data; helpers neither randomise nor sort it.
Seeds are unique (`730000 + chapter * 100 + n`); there is no carry-over squad or free
procedural opening boost. Only mission 6 has a `boss` object. Boss identifiers are
`ogre`, `bulwark`, `ravager`, `gunner`, `colossus`, and `warlord`.

The engine owns telegraphs, enemy AI, gate interactions, compression, and boss phases.
These scripts require at least 0.8 s threat/hazard warnings and 0.9 s boss warnings from
that engine. At the current 8.5 m/s, 40 m supply/shortcut approaches allow about 4.7 s
of travel; threats are spaced at least 76 m apart, beyond a six-second threat lifetime
plus room to recover. There is no mission containing both barricades and mortars.
There is no hazard within 70 m of a scripted Tactics threat.

Waves have explicit lanes and narrow 0.8 m spreads. A single introduced archetype gets
one enemy and at least 40 m separation from other waves. Combined waves leave a lane
empty. Crusher/splitter groups occupy left/centre or right/centre, leaving the other
edge open. Rifle/medic groups leave the centre open. These are squad-centre routes;
formation compression must keep soldiers within the available corridor.

Bridge collapses only occupy the left lane, once per applicable mission, near the end.
Subsequent enemies occupy the centre, reserving the right lane even if collapse persists.
No rescue or tool gate forces a return to the fallen lane. Other machinery is separated
by at least 70 m and always has a bypass; the shortcut is a bonus bypass, never the only
survival route. Fuel trucks sit with upcoming enemy packs, with other lanes clear.

For c4m3 and c6m3, riflemen are 6 m before the x2/+20 fork and in the x2 lane. Their
standoff lock is intended to overlap the gate approach. The safe +20 half is always right.
Boss approaches leave at least 34 m after the final wave and do not carry road hazards
into boss space. Runtime testing must verify threat actors clear, rifle locks overlap the
fork as intended, side lanes remain reachable under movement AI, and no boss phase
covers every exit. Static lane checks cannot establish those timing facts.

## Difficulty and squad budgets

Starts rise from 8 to 50 soldiers. Authored arithmetic gains are small, recruits cost
an alternative half, rescues spend 2–7 escorts, and the only x2 gates are the two exposed
crossfire gambles. There are no jackpots, neutral x1 halves, or successive multipliers.
All missions after c1m1 have at most one gate with numeric halves; other choices use
bounded recruits, tools, or rescues. A player taking every rescue can afford it from
the starting squad alone.
Weapon cases range from 24 to 92 HP, with early rifles and later specialist weapons;
reward blocks grant only 2–3 soldiers. This uses the existing generator's scale without
its +40 jackpots, long reward strips, or free opening boost.

The validator calculates a deliberately generous **authored no-loss squad bound**:
take the numerically best half, collect every reward, and let every tool overflow a full
belt for +8 (including both fork drops). It remains below 150, well under the engine's
300 cap. A second bound includes the interpreter's Arcade-style gate inflation: every
additive or subtractive half shot up to +99, every multiplier up to x3. Even this extreme
stays at or below 176 after c1m1 (206 for the deliberately easy first mission's two gates).
No arithmetic gain can feed the later crossfire multiplier. These are conservative
bounds, not simulations of collectible gains. Enemy encounters are budgeted around the
8–50 starting squads and modest authored gains, not around a full 300 squad.

Budget units are a **static pressure proxy**, not measured DPS or literal enemy totals:
grunt/zombie 1, brute 11 (22 base HP versus 2), shieldbearer 4, charger/bomber 3,
rifleman 4, medic 5, splitter 8 (including allowance for three spawned minis).
Swarm/mortar/barricade encounters reserve 40/24/16 units; bosses add HP/10.
Threat populations and boss summons are runtime-dependent, so their exact spawned
counts cannot be recovered from the mission data alone. The proxy includes allowances
for those threats, and boss pressure is represented by its HP rather than inventing a
fixed number of summons. The validator also reports literal authored wave counts.

| Chapter | Mission budgets, in order | Starting squads, in order |
|---|---|---|
| Old Town | 10, 25, 58, **11**, 107, 150 | 8, 10, 14, 18, 18, 20 |
| Red Bridge | 48, 78, 88, **36**, 130, 275 | 20, 22, 24, 26, 26, 28 |
| Dust Road | 77, 84, 133, **51**, 158, 355 | 28, 30, 30, 34, 32, 34 |
| The Pier | 109, 157, 180, **70**, 292, 526 | 34, 36, 36, 40, 38, 40 |
| Broken Blocks | 168, 210, 215, **100**, 356, 727 | 40, 42, 42, 46, 44, 46 |
| The Arena | 210, 278, 392, **142**, 454, 920 | 46, 46, 48, 50, 48, 50 |

The bold recovery troughs are intentional. Validate rising teach/practice/twist budgets,
a distinct recovery reduction, HARD above all normals, and BOSS above HARD. Each slot
also rises from the previous chapter, as does the chapter mean. Requiring all 36 budgets
to increase strictly would contradict the requested recovery missions and sawtooth.
HARD combines two learned pressures; BOSS examines the chapter's lesson, rather than
simply appending an unrelated enemy pile.

Targets remain: chapter 1 missions 1–3 onboarding for both policies; later normal smart
80–90% / never 45–65%, HARD 55–70% / 15–35%, BOSS 45–60% / 5–25%.
These are tuning targets, **not measured results**. Content validation cannot establish
first-attempt win rates, safe-lane timing, Assist scaling, or third-star tracking. Run the
engine owner's campaign bot against these seeds when the interpreter is available.
Adjust wave counts, starting squads, and boss HP together if the measured curve misses;
do not fill the recovery troughs or introduce simultaneous whole-road hazards.

## Runnable validation

Run from the repository root. This uses only Node built-ins, reads the delivered module,
and does not boot the game or write files. It checks required fields, IDs and seeds,
enums, text lengths, event ordering, arithmetic bounds, basic lane reservations,
first introductions, objective witnesses, and the rising sawtooth budget curve.

```sh
node <<'NODE'
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const box = { window: {} };
vm.runInNewContext(fs.readFileSync('js/campaign.js', 'utf8'), box);
const C = box.window.Campaign;
const has = (o, fields) => fields.split(' ').forEach(k => assert(Object.hasOwn(o, k), `Missing ${k}`));
const one = (v, values) => assert(values.split(' ').includes(v), `Invalid value: ${v}`);
const int = (v, lo = 1, hi = Infinity) => assert(Number.isInteger(v) && v >= lo && v <= hi, `Bad integer ${v}`);
const text = s => assert(typeof s === 'string' && s.length > 0 && s.length <= 90, `Bad text: ${s}`);
const line = p => { assert(Array.isArray(p) && p.length === 2); one(p[0], 'rook mira warlord'); text(p[1]); };
const lane = v => int(v, -1, 1);
const powers = 'shield airstrike giant', bosses = ['ogre', 'bulwark', 'ravager', 'gunner', 'colossus', 'warlord'];
const themes = ['town', 'bridge', 'desert', 'pier', 'ruins', 'arena'];
const weights = { zombie: 1, grunt: 1, brute: 11, shieldbearer: 4, charger: 3, bomber: 3, rifleman: 4, medic: 5, splitter: 8 };
const threatUnits = { swarm: 40, mortars: 24, barricade: 16 };
const shape = { gate: 'left right', wave: 'type count', solid: 'kind hp', threat: 'kind', drop: '', hazard: 'kind lane', scenery: 'kind lane', radio: 'who text' };
function half(h, squad, inflated = false) {
  if (Array.isArray(h)) {
    assert(h.length === 2); one(h[0], '+ - x'); int(h[1], 1, h[0] === 'x' ? 2 : 20);
    if (inflated) return h[0] === 'x' ? squad * 3 : squad + 99;
    return h[0] === '+' ? squad + h[1] : h[0] === '-' ? squad - h[1] : squad * h[1];
  }
  assert(h && typeof h === 'object');
  assert(['powerup', 'recruit', 'rescue'].filter(k => Object.hasOwn(h, k)).length === 1);
  if (h.powerup) { one(h.powerup, powers); return squad + 8; }
  if (h.recruit) { has(h, 'n'); one(h.recruit, 'piercer grenadier defender'); int(h.n); return squad + h.n; }
  has(h, 'rescue cost'); int(h.rescue); int(h.cost); return squad - h.cost;
}
has(C, 'version chapters missions'); assert.equal(C.version, 1); assert.equal(C.chapters.length, 6);
assert.equal(Object.keys(C.missions).length, 36);
const ids = new Set(), seeds = new Set(), first = new Set(); let previous, previousMean = 0, totalEvents = 0;
for (const [ci, ch] of C.chapters.entries()) {
  has(ch, 'id name theme blurb boss missions'); assert.equal(ch.id, ci + 1); text(ch.name); text(ch.blurb);
  assert.equal(ch.theme, themes[ci]); assert.equal(ch.boss, bosses[ci]); assert.equal(ch.missions.length, 6);
  const budgets = [], counts = [], caps = [], inflatedCaps = [];
  for (const [mi, id] of ch.missions.entries()) {
    const m = C.missions[id]; assert(m, `Missing mission ${id}`); assert(!ids.has(id)); ids.add(id);
    has(m, 'id chapter n tag theme title seed length start brief win skill events');
    assert.equal(id, `c${ci + 1}m${mi + 1}`); assert.equal(m.id, id); assert.equal(m.chapter, ch.id);
    assert.equal(m.n, mi + 1); assert.equal(m.theme, ch.theme); text(m.title);
    assert.equal(m.tag, mi === 5 ? 'boss' : mi === 4 ? 'hard' : 'normal');
    int(m.seed); assert(!seeds.has(m.seed)); seeds.add(m.seed); int(m.length, 220, 420); int(m.start, 1, 300);
    assert.equal(m.brief.length, 2); m.brief.forEach(line); assert.equal(m.brief[0][0], 'rook'); assert.equal(m.brief[1][0], 'mira'); line(m.win);
    has(m.skill, 'id text'); text(m.skill.text); one(m.skill.id, 'noWaste rescueAll perfect2 medicsFirst noCharge bossClean fast noAssist');
    assert(Array.isArray(m.events) && m.events.length > 0);
    let at = -1, budget = 0, count = 0, bound = m.start, inflated = m.start, radios = 0, rescues = 0, rescueCost = 0;
    const waves = m.events.filter(e => e.event === 'wave'), threats = m.events.filter(e => e.event === 'threat');
    const hazards = m.events.filter(e => e.event === 'hazard');
    for (const e of m.events) {
      has(e, 'at event'); assert(Object.hasOwn(shape, e.event)); if (shape[e.event]) has(e, shape[e.event]);
      assert(Number.isFinite(e.at) && e.at >= at && e.at >= 0 && e.at < m.length, `${id}: unsorted/outside road`); at = e.at;
      if (e.event === 'gate') {
        const halves = [e.left, e.right]; bound = Math.max(...halves.map(h => half(h, bound)));
        inflated = Math.max(...halves.map(h => half(h, inflated, true)));
        if ('moving' in e) assert.equal(typeof e.moving, 'boolean');
        for (const h of halves) if (h.rescue) { rescues++; rescueCost += h.cost; }
      }
      if (e.event === 'drop') {
        assert(Boolean(e.powerup) !== Boolean(e.pair));
        if (e.pair) { assert.equal(e.pair.length, 2); e.pair.forEach(p => one(p, powers)); bound += 16; }
        else { one(e.powerup, powers); bound += 8; }
        inflated += e.pair ? 16 : 8;
      }
      if (e.event === 'wave') {
        assert(Object.hasOwn(weights, e.type)); int(e.count); lane(e.lane);
        assert(e.spread > 0 && e.spread <= 0.8); int(e.depth, 1); one(e.formation, 'block line wedge');
        count += e.count; budget += e.count * weights[e.type];
        if (!first.has(e.type)) {
          assert.equal(e.count, e.type === 'grunt' ? 4 : 1, `${id}: isolated introduction`);
          assert(!waves.some(w => w !== e && Math.abs(w.at - e.at) < 40)); first.add(e.type);
        }
      }
      if (e.event === 'solid') {
        one(e.kind, 'blockBlue blockYellow crate tyres weaponCase ammo barrel'); int(e.hp);
        if ('x' in e) assert(Number.isFinite(e.x) && Math.abs(e.x) <= 5);
        if ('n' in e) int(e.n); if ('reward' in e) { int(e.reward); bound += e.reward * (e.n || 1); inflated += e.reward * (e.n || 1); }
        if (e.kind === 'weaponCase') int(e.weapon, 1, 4);
      }
      if (e.event === 'threat') { assert(Object.hasOwn(threatUnits, e.kind)); budget += threatUnits[e.kind]; }
      if (e.event === 'hazard') { one(e.kind, 'crusher saw collapse'); lane(e.lane); assert(e.period >= 0.8); }
      if (e.event === 'scenery') { one(e.kind, 'fuelTruck shortcut'); lane(e.lane); }
      if (e.event === 'radio') { line([e.who, e.text]); radios++; }
      assert(bound > 0 && bound < 150, `${id}: authored squad snowball`);
      assert(inflated <= (id === 'c1m1' ? 210 : 180) && inflated < 300, `${id}: inflated squad snowball`);
    }
    assert(radios <= 2); assert(rescueCost < m.start);
    if (m.skill.id === 'rescueAll') assert(rescues >= 2);
    if (m.skill.id === 'fast') assert(rescues > 0);
    if (m.skill.id === 'perfect2') assert(threats.length >= 2);
    if (m.skill.id === 'medicsFirst') assert(waves.some(e => e.type === 'medic') && waves.some(e => e.type === 'brute'));
    if (m.skill.id === 'noCharge') assert(waves.some(e => e.type === 'charger'));
    if (m.skill.id === 'bossClean') assert(m.boss);
    for (let i = 1; i < threats.length; i++) assert(threats[i].at - threats[i - 1].at >= 76);
    assert(!(threats.some(e => e.kind === 'barricade') && threats.some(e => e.kind === 'mortars')));
    for (let i = 1; i < hazards.length; i++) assert(hazards[i].at - hazards[i - 1].at >= 70);
    for (const h of hazards) assert(threats.every(t => Math.abs(h.at - t.at) >= 70));
    for (const e of [...waves, ...hazards]) {
      const occupied = new Set(waves.filter(w => Math.abs(w.at - e.at) <= 24).map(w => w.lane));
      hazards.filter(h => Math.abs(h.at - e.at) <= 24 || h.kind === 'collapse' && h.at <= e.at).forEach(h => occupied.add(h.lane));
      assert(occupied.size < 3, `${id}@${e.at}: no reserved lane`);
    }
    for (const s of m.events.filter(e => e.event === 'scenery' && e.kind === 'shortcut')) {
      const next = hazards.find(h => h.at > s.at); assert(next && next.at - s.at >= 32 && next.lane === s.lane);
    }
    assert.equal(Boolean(m.boss), mi === 5);
    if (m.boss) {
      has(m.boss, 'type hp'); assert.equal(m.boss.type, ch.boss); int(m.boss.hp); budget += m.boss.hp / 10;
      assert(m.events.some(e => e.event === 'radio' && e.who === 'warlord' && e.at === 0));
      assert(waves.every(w => m.length - w.at >= 34));
    }
    budgets.push(budget); counts.push(count); caps.push(bound); inflatedCaps.push(inflated); totalEvents += m.events.length;
  }
  const [teach, practice, twist, recovery, hard, boss] = budgets;
  assert(teach < practice && practice < twist && recovery < practice && hard > twist && boss > hard);
  if (previous) budgets.forEach((v, i) => assert(v > previous[i], `${ch.name}: slot ${i + 1} did not rise`));
  const mean = budgets.reduce((a, b) => a + b, 0) / 6; assert(mean > previousMean);
  console.log(`${ch.name}: budget [${budgets}]; waves [${counts}]; squad bounds [${caps}]; inflated [${inflatedCaps}]`);
  previous = budgets; previousMean = mean;
}
assert.equal(ids.size, 36); assert.equal(seeds.size, 36);
assert.equal(first.size, 8); // grunt + brute + the six new archetypes; zombie is valid but unused.
console.log(`PASS: 36 missions, 6 chapters, ${totalEvents} events; rising sawtooth and authored bounds verified.`);
NODE
```
