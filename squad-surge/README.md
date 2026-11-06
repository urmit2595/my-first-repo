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
