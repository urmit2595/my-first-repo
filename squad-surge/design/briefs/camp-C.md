# Codex run C: campaign content for the Squad Surge "Campaign Update"

Repo: /home/user/my-first-repo/squad-surge. Read first: `design/campaign.md` (sections 2, 3, 4, 5, 6 and 7 are your
spec), `design/strategy.md` (threats and counters), and `index.html`'s generateLevel (current pacing, distances,
solid HP and rewards) for scale reference.

EDIT ONLY the new files `js/campaign.js` and `design/campaign-script.md`. Do not run git.

Write `window.Campaign` (format in section 4) with **all 36 missions**: 6 chapters × 6 missions, following
teach → practice → twist → recovery/rescue → HARD → BOSS.
- **Difficulty targets (section 2):** chapter 1, missions 1–3 are easy onboarding; then a real sawtooth. HARD missions
  combine two learned pressures. BOSS missions examine the chapter's lesson. Waves and gates must be authored for the
  squad sizes the player can have at that point (squad cap 300). Don't let gates snowball the squad: use −, x and
  trade-off halves wisely.
- **Fairness:** every threat has a reachable safe lane. No mandatory barricade under unavoidable mortars. Counters (drops
  or tool gates) appear before threats often, but not always from chapter 3 on, so planning matters.
- **Content:** introduce each new enemy alone first, then combine. Use rescue gates, recruit gates, crossfire choices,
  hazards (collapse lanes on the bridge, crushers and saws in the ruins and arena) and scenery events (fuel trucks,
  shortcut walls).
- **Story:** original "Operation Homeward" text in a warm, punchy voice. Every mission has two brief lines
  (rook/mira), 0–2 in-run radio lines and one win line. The Warlord taunts before the boss missions. Short lines only
  (≤ 90 characters).
- **Skill objective:** every mission gets one, from the section 7 ids, chosen to teach that mission's lesson.
- `seed` values are unique. `length` is 220–420 m, longer later.
- Write a small `node` validation snippet in `design/campaign-script.md` (and run it) that checks:
  - every field is present, ids are unique, and events are sorted
  - event types, enemy types, boss types and skill ids are valid
  - the total enemy budget per mission rises across the curve
Also put the full story outline in that file (chapter arcs and characters).
