# Codex run E2: enemies and bosses for the Squad Surge "Campaign Update"

Repo: /home/user/my-first-repo/squad-surge. Read first: `design/campaign.md` (sections 5 and 9 are your spec),
`design/engine-audit.md`, and `index.html`, enough to understand enemies, the boss, sprite layers, the bus and ctx.

Another run (E1) is implementing the ctx registry API in index.html RIGHT NOW. Code against the section 9 contract,
defensively: check every function exists, and never throw.

EDIT ONLY the new file `js/enemies.js`. Do not run git.

Implement:
- the six archetypes in section 5: shieldbearer, charger, bomber, rifleman, medic and splitter (with its mini)
- every telegraph and readable visual, drawn with your own meshes in `ctx.telegraphGroup`:
  - rifleman: a lane laser
  - charger: a crouch plus a red lane arrow
  - bomber: a fuse ring
  - medic: a tether beam
  - shieldbearer: a shield quad facing the squad
  - boss weak point: a glowing marker
- the six bosses from section 3, with the data-driven phases and the attacks named in section 5:
  - Ogre Warlord (ogre)
  - Iron Bulwark (bulwark)
  - Dune Ravager (ravager)
  - Harbor Gunner (gunner)
  - Scrap Colossus (colossus): splits into two halves at 50%
  - The Warlord, Reborn (warlord): 3 phases
  Telegraph every attack for ≥ 0.9 s. Every boss must always leave a dodge lane.
- Sprite sheets come from `assets/units2/<type>.webp`:
  - 4×2 frames for enemies (same layout as assets/grunt.webp: look at how index.html picks frames)
  - 3×2 for bosses (like assets/boss.webp)
  An art run is generating them now. If one is missing, register the type with the fallback sheet (grunt or brute,
  tinted) so it still renders.
- Tuning constants at the top of the file, commented.
- No per-frame allocation. Pool the telegraph meshes.
- `node --check js/enemies.js`.

Finish with a short summary.
