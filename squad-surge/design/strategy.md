# Squad Surge "Tactics Update": player-activated power-ups and strategic choices

## 1. Goal

Squad Surge plays itself too much. Today a power-up fires the moment its crate is shot open, so the player only steers.
This update makes the player **decide**:
- **What to take:** fork drops and power-up gates.
- **When to use it:** activation buttons and telegraphed threats with a matching counter.
- **Whether to save it:** unused power-ups pay off at the end, so saving is a gamble.

Players are **conditioned** to make these choices through a clear loop:
1. A cue: a telegraphed threat with the counter icon.
2. An action: tap the matching power-up.
3. An immediate, juicy reward: PERFECT callout, bonus score and combo.
4. Mild loss feedback for waste or misuse.
5. A long-term reward for planning: banked power-ups multiply the finale.

Hard constraint (from the user): **no upgrades, no shop, no currency.** Everything here is in-run.

## 2. Mechanics (acceptance criteria)

### T1. The belt (2 slots), and activation
- Power-ups from crates and gates go into a 2-slot **belt** instead of firing instantly. JACKPOT stays instant (+soldiers).
- HUD: two large round buttons at the bottom corners, 64–72 px and thumb-reachable, with safe-area insets. Each shows its
  icon from `assets/ui/icons/pu-*.webp`, or a faint empty socket. Keys **1** and **2**, and **Q** and **E**, also activate.
- Button taps never steer the squad: stop propagation, and exclude the button rects from the drag area.
- Activation applies the existing effect (SHIELD 6 s, AIRSTRIKE on the road ahead, GIANT 6 s) and empties the slot.
  The button pulses while an effect is active.
- **Full belt:** a new pickup shows a "SWAP?" chip with its icon above the belt for 3 s. Tapping a slot (or pressing its
  key) swaps it in. Otherwise the new one turns into **+8 soldiers**. This is a micro keep-or-swap choice and is never
  forced.
- The buttons are visible in the `play` and `boss` states, and hidden elsewhere.

### T2. Fork drops (choose what to take)
- From level 2, about half of the airdrops land as a **pair**: two crates side by side (x ≈ −3.3 and +3.3), each showing
  its power-up icon on a billboard. The squad shoots what is in front of it, so steering picks one. The other crate
  stays shootable if the player can manage both, which is a skill reward.
- From level 3, about one gate pair per level is a **tool gate**: one half is a power-up (big icon, no number), the other
  is a good soldier gain (+N). The player chooses numbers or a tool.

### T3. Telegraphed threats with a counter (when to use it)
Each threat is announced about 2.5 s ahead. A tall holo sign stands on the road ("⚠ SWARM" plus the counter's icon),
and a `threat` event fires.

| Threat | From level | What it is | Without the counter | Counter |
|---|---|---|---|---|
| **SWARM** | 2 | a very dense horde (1.8× a normal horde, packed) | costly but survivable | **AIRSTRIKE** clears most of it |
| **BARRICADE** | 3 | a reinforced wall across the road: 3 tall blocks with a gap of about 1.2 units at one random side; touching the wall kills soldiers | shoot it down (high HP) or squeeze through the gap | **GIANT** smashes straight through, no losses |
| **MORTARS** | 4 | 1–2 mortar towers at the road edge that lob shells with red target rings onto the squad every ~1.6 s for ~6 s; each hit kills 2–4 soldiers | lose soldiers, or shoot the towers (moderate HP) | **SHIELD** nullifies the hits |

- Spawn about 2–3 threats per level, scaled with level, and never two at once. The generator ensures that the level's
  drops and tool gates make at least one counter likely to be available before each threat (not guaranteed: planning
  matters).
- **Boss uses:**
  - the boss slam is a threat (counter SHIELD: no losses)
  - AIRSTRIKE deals 18% of boss max HP and clears adds
  - GIANT doubles squad damage to the boss for its duration

### T4. PERFECT, WASTED, MISUSED (conditioning feedback)
- **PERFECT:** activating a threat's counter while that threat is live (in range or active). Rewards:
  - callout "PERFECT AIRSTRIKE!"
  - +300 × level score, raw (not multiplied)
  - +10 combo and a short slow-mo (respect the existing slow-mo limit)
  - counts toward `tactics.perfect`
- **WASTED:** activating with no target, meaning no enemies or solids in the effect range (for SHIELD: no threat within
  4 s). A small grey "WASTED" chip appears; it counts toward `tactics.wasted`.
- **MISUSED:** using a non-counter on a live threat. Allowed, but no bonus.

### T5. SURGE becomes player-activated
- When the meter fills, it holds at 100% (no drain) and shows **SURGE READY**. A third button sits bottom-centre, or the
  player can tap the surge bar, or press Space.
- Activation behaves as today (6 s of double fire rate and more).
- Using it during a threat or the boss fight counts as PERFECT SURGE: score bonus, no extra slow-mo.

### T6. Banking (save versus use)
- When the boss falls, each power-up still on the belt is **banked**: +0.5× on the final multiplier (finale multiplier
  plus bank).
- Show it with a "BANKED ×2 → +1.0×" toast before the finale.
- Dying loses the belt. Saving is a gamble against loss aversion.

### T7. Teaching (early levels condition the habit)
- **Level 2:** the first SWARM comes with a guaranteed AIRSTRIKE drop just before it. A coach mark points at the
  AIRSTRIKE slot ("Tap to call an airstrike!"), with a pulsing ring.
- **Level 3:** the first BARRICADE, with a GIANT drop before it.
- **Level 4:** the first MORTARS, with a SHIELD drop before it.
- After a counter has been used PERFECT twice, its coach mark stops showing. Never show more than one coach mark at a
  time.
- The slot whose power-up counters the live threat glows: a gold ring, always on as a gentle hint, which fades after 3
  PERFECT uses overall.

## 3. Contracts

### ctx additions (index.html provides)
- `ctx.belt`: `[type|null, type|null]`
- `ctx.usePowerup(slot)`
- `ctx.tactics`: `{perfect, used, wasted, misused, banked, surgePerfect}`
- `ctx.threat`: the live threat, or null
- `ctx.surgeReady`: boolean

### Events
- `belt {slots}`: on every change.
- `powerupGot {type, slot}`
- `swapOffer {type, until}`
- `swapDone {type, slot}`
- `swapExpired {type}`
- `powerupUse {type, slot, perfect, misused, wasted, threatKind}`
- `threat {id, kind, counter, z}`: when the sign appears.
- `threatLive {id, kind}`: in range.
- `threatEnd {id, kind, countered, lost}`
- `surgeReady {}`
- `bank {count, bonus}`
- `tacticsCoach {kind, slot}`: when a coach mark should show.

## 4. Ownership and process

| Owner | Files |
|---|---|
| Codex run A (mechanics) | index.html, js/powerups.js, js/objects3d.js, tools/* (bots) |
| Codex run B (feedback, meta) | js/juice.js (callouts, PERFECT/WASTED/SWAP visuals, coach marks), js/meta.js (results "Tactics" line, 6+ new missions and 3+ trophies about tactics, stats) |

- Never edit a file outside your column.
- Do not commit; the orchestrator does.
- Keep the game's style, performance (no per-frame allocation), and the existing balance targets: a player who never
  presses the buttons can still clear levels 1–5, and level 7 stays winnable for a casual player.
