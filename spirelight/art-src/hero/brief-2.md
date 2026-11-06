# Brief 2: continue Wick (js/hero.js, tests/hero.html) from the existing files

A previous Codex run was killed mid-way by a network drop. js/hero.js (432 lines) and tests/hero.html exist and run with
no console errors. CONTINUE FROM THEM (read them first; refactor freely, but keep the API). The full contract is in
`art-src/hero/brief-1.md` (READ IT: model, animations, API, test page URL params, budgets). You may write only
js/hero.js and tests/hero.html. Reference image: `art-src/hero/hero-sheet.png` (view it; match it).
Test: `node tools/shot.js "tests/hero.html?anim=walk&t=1.2&view=large" design/qa/hero/x.png --w 800 --h 800`,
`view=lineup` (--w 1600 --h 600), `view=small`, `yaw=` etc. LOOK at your PNGs and iterate.

## Review of the current state (screenshots design/qa/hero/r0-walk.png, r0-lineup.png). Fix ALL of these:
1. HEAD: in the sheet the glass lantern is a big, wide, bulbous globe (about 1.25x the body width) with 4 curved brass
   ribs bulging with the glass, a wide flat brass collar, a low wide domed cap with a rivet ring, and a ring on top.
   Currently the head is narrow/egg-tall and the cap crushes the flame: the flame top is cut off and the glass is
   barely visible. Make the globe clearly visible glass (subtle rim/fresnel, faint warm tint), wider than tall-ish,
   and make the cap sit ABOVE the flame with clear space. Head ~ 38-40% of height.
2. FLAME-FACE: the flame must be the hero of the image: a vivid teardrop (white-yellow core, orange body, red-orange
   tip curling), clearly brighter than the brass, with the two dark eye slits sharply readable on the lower front of
   the flame and facing the iso camera at default yaw. Currently it is washed-out pale peach: use stronger saturation,
   additive glow shell, emissive intensity > 1 so bloom/tonemapping makes it glow; eyes must be dark and crisp.
3. BRASS: currently flat saturated yellow with blotchy noise. Make it warm aged brass: base ~#b9852f with darker
   crevices, subtle verdigris (#4fa597) in seams/under rivets/near joints, metalness 0.85, roughness 0.4-0.55, and add
   an env-like look: since there is no env map, build a tiny procedural equirect/cube env (canvas gradient: warm
   horizon, cool sky, dark ground) assigned to material.envMap (generate once, PMREM-free; use a CubeTexture from
   canvases or a scene-independent gradient) so the metal has reflections instead of looking flat. Keep envMapIntensity ~1.
4. BODY: make the torso bigger and rounder (egg ~0.30 wide) with visible rivet rows, 2-3 horizontal seam bands, the
   chest gauge larger (cream dial with ticks and a needle), and visible limbs with ball joints like the sheet.
   Legs a bit thicker, boots bigger and rounder with a visible sole rim (the boots currently look pale/white: fix
   their material, no shadow-acne/light-bleed). Hands: three fingers + thumb, brass.
5. SCARF: it must be a rich teal (#2f7f86 to #3a9a96, knit ribbing visible via canvas texture with both colour variation
   and bumpMap), thick (a chunky torus wrap ~0.05 tube radius with a knot on the side), NOT pale cyan and NOT a flat
   rectangle. The two tails are currently a flat sheet hanging straight down on the +x side: make them hang from the knot
   at the front-side, each a narrow (0.07-0.09) tapered ribbon with fringe-ish end, slightly twisted, verlet-driven in
   world space so they swing and trail behind when walking (check by `view=large&anim=walk&t=1.2` and a live
   `walkto=1` path), and settle in idle. Tails must not intersect the torso/arms/gauge (push out of a torso capsule).
6. PROPORTIONS/SILHOUETTE: overall height 0.85 units, origin at feet. Total silhouette at view=small must read: big
   glowing head with ring, teal scarf, small body, boots. Check `view=small` and make it better if needed.
7. Anim poses: in lineup walk/climb look nearly identical to idle at t=1.0. Make the gait amplitude obvious (hip swing
   ~0.6 rad, knee bend, foot lift, arm swing 0.5 rad, body bob 0.03). Celebrate: arms clearly up, lantern lifted, flame
   flares. Bump: head tilt + visible hand-up. Ride: arms out. Wave: arm up waving. Verify each in lineup at t=0.5/1.0/1.6.
8. Floor in the test page is blown-out white: make the paver a warm cream (#e8d8b8) with a subtle texture so the
   brass/scarf read against it. Labels under tiles are hidden behind the tiles: move them below.
9. Light: hero.light warm, flicker matched; also a soft additive halo sprite around the head scaled by setGlow().

Keep draw calls <= ~40 and no per-frame allocation. Finish with a 5-line summary of what you changed and known issues.
