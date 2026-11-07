# Codex run I1: integration and tuning for the Squad Surge "Campaign Update"

Repo: /home/user/my-first-repo/squad-surge. Context: design/campaign.md, design/campaign-engine-notes.md,
design/campaign-script.md. Runs E1, E2, C and U are finished. You may now edit index.html, js/campaign.js, js/story.js,
js/meta.js, js/juice.js, js/enemies.js and tools/bot-campaign.js. Do not run git.

## Real-browser results (orchestrator; design/qa/campaign/bot-browser-run1.log; 72 games, 0 errors)

| tag | never | smart |
|---|---|---|
| normal (excluding c1m1–3) | 13/21 = 62% | 17/21 = 81% |
| hard | 1/6 | 4/6 |
| boss | 1/6 | 3/6 |

- By chapter (never / smart): c1 5/6 6/6, **c2 2/6 3/6**, c3 4/6 6/6, c4 3/6 5/6, **c5 2/6 3/6**, c6 2/6 4/6.
- Smart losses:
  - c2m2 (normal), c2m5, c2m6, c4m5, c5m2 (normal), c5m3 (normal), c5m6 and c6m2 (normal) were all caused by "swarm",
    meaning generic horde contact
  - c6m6 was caused by boss:charge
- Average stars: never 1.06, smart 1.58.
- The orchestrator's sprite fixes are already in js/enemies.js (SHEET_SPEC/SHEET_ASPECT) and index.html (def.aspect).
  Keep them.

## Fix
1. **Loss causes:** generic enemy-contact losses must report cause `horde`, not `swarm`. `threat:swarm` stays for the
   Tactics SWARM. Add a helpful `horde` hint in story.js, for example: "Big waves eat small squads. Grab + gates before
   them and steer around the densest pack." Make sure every cause the engine can emit has a hint.
2. **Smooth the spikes:**
   - c2m2, c5m2, c5m3 and c6m2 are NORMAL and should be about 85% for smart. Thin their generic hordes, or give the
     squad more pre-wave growth.
   - Chapter 2's and chapter 5's hard and boss missions can stay hard, but their losses should come from the chapter's
     mechanic, not from raw horde mass:
     - more shieldbearers and mortars on the bridge
     - more splitters and barricades in the ruins
     - fewer plain grunts
   Keep the tag targets in design/campaign.md section 2.
3. **Stars:** the ★2 "keep" threshold depends on the tag: normal 65%, hard 50%, boss 45%. Show the right % in the
   briefing and results.
4. **HUD in campaign:** the level pill must show `C4 · 2` plus the mission title (and the tag icon for HARD or BOSS),
   not the arcade level name or number. Restore the arcade behaviour in ARCADE.
5. **Flow check, by reading the code paths:**
   - map node → briefing card (2 radio lines, the 3 objectives, START)
   - START → mission
   - in-run radio toasts
   - results showing stars and the next mission
   - a loss showing the cause hint, same-seed retry, and an assist offer after 2 fails
   - chapter complete → vignette
   - Arcade and Daily still work
   Fix anything broken.
6. Run your CPU checks and the `node --check` suite, and update design/campaign-engine-notes.md with the final tuning.
   Print a short summary.
