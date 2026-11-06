# Task for Codex: write js/juice.js (animation and game feel) for Squad Surge

You are working in /home/user/my-first-repo/squad-surge, a browser runner-shooter built on three.js r128.
WRITE ONLY `js/juice.js`. Do not modify any other file (other people are editing them right now).

## Read first
- `design/overhaul.md`, section 6: the module architecture, the `ctx` object and the bus events with their data.
- `index.html`: the game. Read `render()`, `step()`, `setState()`, `win()`, `lose()`, the HUD/modal HTML and the CSS
  at the top so your animations target the real elements (#game, #view canvas, #hud, #count, #levelPill,
  #progress, #weaponTag, #bossbar, #home .logo, #winModal, #loseModal, #pauseModal, #levelsModal, .panel, .btn,
  #stars, #flash, .float).
- `js/juice.js` (current stub): keep the shape `window.Juice = (() => { ...; return { setup }; })();`.

## Goal
The game works but feels static. Add polish and motion that makes it feel like a premium mobile game, using the
bus events (`ctx.bus.on(name, fn)`), the `frame` event for camera work, and CSS/DOM for the UI.
The look is bright, chunky and toy-like; motion should be snappy and bouncy (ease-out-back, short durations).

## Must have
1. **Camera** (in the `frame` handler; the game resets position, aim (`look`) and fov every frame, so apply
   offsets every frame, then re-aim with `camera.lookAt(look)`):
   - Level intro: when the state goes from `home` to `play`, fly in from higher and further back to the chase
     position over about 1.1 s (ease-in-out).
   - Home screen idle: slow gentle sway/dolly so the scene behind the title feels alive.
   - FOV kick +5 degrees easing back over 0.35 s on a good `gatePass` (after > before); short jolt on a bad one.
   - Boss: on `bossStart` pull back and up slightly over 0.8 s and hold while the boss fight lasts; on
     `bossWarn` a low rumble; on `bossSlam` a strong shake (decaying over 0.4 s); on `bossDown` a quick zoom punch.
   - Small shake on `solidBreak` with `earned` true for big objects (blockYellow, crate, weaponCase).
   - Respect `prefers-reduced-motion: reduce`: no shakes, no fly-ins, no fov kicks (fades are fine).
2. **HUD**:
   - `#count` badge: scale pop (green tint) on `soldiersAdded`, quick shake (red tint) on `soldiersLost`.
   - Progress bar: subtle moving shine over the fill.
   - Weapon tag: pop when `weapon` changes (ignore the reset to index 0 at `levelStart`), glow pulse on `rateUp`.
   - Level banner: when play starts, a big centred banner "LEVEL n" with the level name under it slides in,
     holds about 1 s and slides out. Use the `levelStart` data and show it on the `home` → `play` transition.
   - Boss banner: on `bossStart` a red "BOSS!" banner slams in with a short red vignette pulse.
   - `bossWarn`: red vignette pulse (CSS radial gradient overlay you create; keep it below the HUD and modals).
3. **Modals and screens**:
   - Every `.modal .panel` pops in (scale 0.85 → 1.04 → 1, with fade) whenever its modal becomes visible
     (they are shown and hidden with the `hidden` attribute; watch with a MutationObserver or on `state` events).
   - Win: the three stars in `#stars` appear one after another (about 0.18 s apart) with a bounce and a glow
     burst. Celebrate with a short confetti burst behind the panel (DOM or canvas overlay, ≤ 120 particles,
     removed after 2.5 s).
   - Lose: desaturate and slightly darken the game canvas (`#view`) over 0.6 s while the lose modal shows;
     restore when it hides.
   - Buttons (`.btn`, `.round`, level tiles `.lvtile`): press-down squash and release bounce.
   - Home title `.logo`: gentle floating bob.
   - `.float` texts (floating "+5" numbers): make them punchier (pop scale with overshoot); they already have a
     CSS animation called `rise` that you may override.
4. **Robustness**: never throw (wrap handlers in try/catch), no external libraries or network, no timers left
   running after their effect ends, nothing that changes game rules, positions, numbers or timing (visual
   only; `ctx.L.shake` is visual and you may raise it). Inject all CSS from JS in one `<style id="juice-css">`.
   Keep it lightweight: no per-frame DOM layout thrash, no more than a few DOM writes per frame.

## Check your work
- `node --check js/juice.js` must pass.
- Another agent will run the game headless and send you any console errors.

When finished, reply with a short summary of what you implemented and anything you could not do.
