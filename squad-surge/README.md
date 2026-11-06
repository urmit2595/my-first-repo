# Squad Surge

The game's own repo, with its brief and art pipeline, is `urmit2595/squad-surge`. This folder is the current playable build.

Army runner-shooter played in the browser (three.js r128). Drag or use the arrow keys to steer a blue squad. Shoot gates and blocks to grow the squad, survive the hordes, and beat the boss.

Live build: https://claude.ai/artifact/SEBMEHUprzu5sKRYzyigLA (private until shared)

Run locally: `python3 -m http.server` in this folder, then open `index.html`.

## How it plays
- Free and plain: no shop, no currency, no upgrades.
- Grow the squad with blue gates and +blocks; avoid red gates and unbroken obstacles.
- Weapon crates switch your gun for the rest of the level: Rifle, Shotgun, Minigun, and from level 4 the Bazooka (splash damage).
- Shoot **ammo boxes** for a fire-rate boost that lasts the rest of the level (stacks up to x2.2).
- **Boss slam:** a red ring marks where the boss will strike, and it stops aiming once the ring appears, so steer out of it.
- Beat the boss to unlock the next level. The **level map** (grid button, top-left) replays any unlocked level and shows your best stars.

## Surge Update (engagement)
Plan and contracts: `design/engagement.md` (research by two agents, reviewed by an Opus design pass).
- **In a run:** live score with BEST, kill combo with NICE / GREAT / SURGE! / UNSTOPPABLE tiers (x1.5 to x4), SURGE fever (double damage and pierce, twice per level), hit-stop and slow-mo on big moments, supply drops from a cargo plane (SHIELD, AIRSTRIKE, GIANT, rare JACKPOT), explosive barrels with chain reactions, golden jackpot gates, an enraged boss at half health.
- **Climax:** the SURGE FINALE, where the squad smashes walls x1.5 to x10 after the boss and the last wall broken multiplies the score.
- **Between runs (after level 2):** three rotating missions that earn medals, a daily challenge with a twist and a streak (with freezes), the Armory (squad colours and tracers unlocked by medals, stars and streaks; nothing is bought), 25 trophies, personal bests on the level map, a results tally with "next goal" hints, and sharing.
- Modules: `js/powerups.js` (supply drops, power-ups, barrels), `js/finale.js` (finale walls), `js/meta.js` (missions, daily, Armory, trophies, results).

## How it is built
- `index.html` holds the game: rules, level generation, squad, enemies, boss, HUD and menus. It emits events on a small bus (`bus.emit("gatePass", …)` and so on).
- The look lives in three modules that only listen and draw (see `design/overhaul.md` for the contracts):
  - `js/scenery.js`: colour pipeline, lights and shadows, sky and backdrop, road, curbs, sidewalks, buildings and roadside props per theme.
  - `js/objects3d.js`: the 3D gates, blocks, crates, tyres, weapon cases and ammo boxes.
  - `js/juice.js`: camera moves, banners, HUD pops, modal and star animations, confetti (written by Codex).
- Characters are pre-rendered sprite sheets (`assets/*.webp`), drawn as instanced billboards.
- Images ship as WebP (`python3 tools/webpify.py FILE...` converts PNGs). Fonts (Lilita One, Nunito; SIL Open Font License) are self-hosted in `assets/fonts/`.
- Adaptive quality: if play stays under ~45 fps, the game turns shadows off, then lowers resolution, and remembers it per device. Add `?hq` to the URL to keep full quality.

## Art pipeline
- Target look: `art-src/style/style-a.png`, generated from the game's own character sprites.
- New art is generated with Codex's image tool through `tools/codex_image.py`, then keyed, cut and packed with `tools/kit_tools.py` (`uv run tools/kit_tools.py --help`).
- Each theme's art is in `assets/env/<theme>/` with a `kit.json` manifest (textures, facades, prop atlas) and a `backdrop.json`. Check them with `python3 tools/check_kits.py`.
- Raw generations and their prompts are kept in `art-src/` as source art.

## Testing
`node tools/shot.js --levels 1,2,3,4,5,6 --out <dir>` serves the game, plays each level headless, saves screenshots and prints fps, draw calls and any console errors.
