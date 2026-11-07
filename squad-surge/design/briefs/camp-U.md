# Codex run U: story UI for the Squad Surge "Campaign Update"

Repo: /home/user/my-first-repo/squad-surge. Read first: `design/campaign.md` (sections 3, 7, 9 and 10), `js/meta.js`
(home, results, missions, trophies, armory, DOM and CSS style), `js/juice.js` (callouts), and `index.html` (HUD, home,
modals, bus, ctx).

EDIT ONLY: `js/story.js` (new), `js/meta.js` and `js/juice.js`. Run E1 is editing index.html and adds the events and
ctx functions in section 9, and loads js/story.js. Code defensively: if `window.Campaign` or a ctx function is
missing, the old flow keeps working. Do not run git.

Build, matching the game's existing UI style (Lilita One/Nunito fonts, chunky buttons, stroke text):
1. **Home:** a primary **STORY** button, labelled "CONTINUE · Chapter N" once started, plus **ARCADE** (the existing
   procedural levels) and **DAILY**.
2. **Chapter map** (`js/story.js`):
   - a vertical scrolling district map with 6 chapters
   - mission nodes show tag icons (HARD skull, BOSS crown), stars and locks
   - the next node pulses
   - cleared districts warm up (colour restored)
   - the chapter header shows the rescued-settlers count and the boss name
   - use `assets/story/map.webp` if present, otherwise a CSS-drawn map
3. **Mission briefing card:**
   - title and tag
   - 2 radio lines with portraits (`assets/story/rook.webp`, `mira.webp`, `warlord.webp`; draw a fallback initial
     badge if one is missing)
   - the 3 star objectives (win, keep 65%, and the skill text)
   - a START button
   - an Assist toggle when an `assistOffer` is pending
4. **In run:** `radio` events show as compact radio toasts with a portrait. `bossPhase` and `bossWeak` get callouts
   ("WEAK POINT!").
5. **Results:**
   - the 3 star objectives tick one by one
   - "SETTLERS RESCUED +N"
   - NEXT MISSION / RETRY / MAP buttons
   - on a loss: the decisive-cause hint (map every `cause` value in section 8 to a helpful one-line tip) and an
     instant RETRY (same seed)
   - the assist offer appears after 2 fails
6. **Chapter complete vignette:** the district lights up, the win line plays, the cosmetic unlock is shown (reuse the
   armory unlock flow), and a preview of the next district's new enemy appears.
7. **Elite unlock:** at 15/18 chapter stars, an "ELITE" toggle appears on that chapter's map.
8. Progress is read from and written to the main save via the ctx and events, and per-mission stars are shown.
   Medals and trophies hook into missions as today. No currency, no shop.

Finish with `node --check` on all three files and a short summary.
