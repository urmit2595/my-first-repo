# Brief 3: polish Wick (js/hero.js, tests/hero.html). Continue from the existing files; keep API and budgets.
Read art-src/hero/brief-1.md (contract) and view art-src/hero/hero-sheet.png. Screenshots of the current state:
design/qa/hero/r2-walk.png, r2-lineup.png, r2-small.png (view them). Big improvement already; fix these remaining problems.
Test with `node tools/shot.js "tests/hero.html?anim=walk&t=1.2&view=large" design/qa/hero/x.png --w 800 --h 800` (if the sandbox
blocks Chromium, try again with the same command; it works from the orchestrator shell) and view=lineup / view=small.

1. CAP: the dome cap is a huge flat disc floating above the head like a frisbee, wider than the glass. In the sheet it
   is a modest raised DOME (height ~45% of its radius*1.3), only slightly wider than the glass equator-top, with a
   rolled rim, a rivet row, a short neck and a ring (torus radius ~0.05, thickness 0.012) standing up. Make the cap
   dome-shaped (lathe profile, convex), radius ~0.17, and the ring clearly visible from the iso camera. Ribs must run
   from cap rim to collar following the globe's curve (bulge outward with the glass; 4 ribs at 45/135/225/315 deg so
   none blocks the face).
2. FLAME/FACE: the flame's lower half is hidden inside the collar/body, so only the top shows. Raise the head so the
   whole globe is above the collar and the neck: flame base sits just above the collar, the full teardrop is visible,
   with the two eye slits in the lower-middle of the front of the flame (clearly dark and about 0.035 tall). The scarf
   must sit around the neck under the collar, not cover the face/glass. Flame colours: white-yellow core, orange body,
   red-orange tip; brightness slightly lower in the face area so the dark eyes read.
3. BODY too dark/murky: torso reads near-black on the shadow side. Add stronger ambient/hemisphere contribution to its
   materials (raise envMapIntensity ~1.4, lower metalness to 0.75, lighter base colour #c79540, roughness 0.45) and a
   warm rim: hero.light must also light the torso (distance ~4, intensity ~1.4). Verdigris patches should be subtle but
   visible in seams/rivets.
4. GLASS: should read as a clear bulbous globe with a bright specular rim on one side and faint warm tint inside; it
   currently only shows a faint outline.
5. IN-GAME SCALE (view=small): make Wick 0.85 -> look ~70px: his head glow must dominate. Make the halo sprite larger
   (about 0.9 units diameter, additive, subtle warm) and slightly brighter; scarf teal brighter (#2f9a98). Also keep the
   tails readable and a bit longer (0.30-0.34). Check small view, and make the test page's small view crop/zoom a 3x
   nearest-neighbour blow-up as a second inset in the corner (CSS canvas copy via drawImage of the main canvas, needs
   preserveDrawingBuffer or draw right after render) so we can judge the pixels.
6. Boots: round, slightly larger (toe forward +z), visible sole rim; hands slightly bigger. Legs in the walk cycle should show
   knee bend and visible foot lift (verify at t=0.3, 0.6, 0.9 of walk in large view).
7. Keep climb/celebrate/bump/ride/wave distinct as in the lineup (they already are); celebrate must lift the whole head 
   and flare the flame.

Finish with a 5-line summary.
