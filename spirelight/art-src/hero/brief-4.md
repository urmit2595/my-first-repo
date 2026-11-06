# Brief 4: final polish of Wick (js/hero.js; tests/hero.html only if needed). Continue from existing files; keep API.
View art-src/hero/hero-sheet.png and design/qa/hero/r3-walk.png, r3-lineup.png, r3-small.png. Contract in brief-1.md.
Very close now. Remaining fixes, in priority order:
1. FLAME TOO SMALL, GLASS TOO EMPTY. In the sheet the flame is a tall teardrop filling ~70% of the globe height (tip curling
   up near the cap, wide body at the bottom with the face). Currently it is a small blob at the bottom with a big empty
   glass above. Make the flame ~2x taller (about 0.85 of the globe interior height, width ~60% of interior width), tip
   curling with flicker, wide round base resting on the collar; eyes stay in the lower-middle of the flame. The globe
   should be wide and round like the sheet (width about 1.3x torso width), glass clearly bulbous: use lathe
   profile with max radius at ~40% height.
2. CAP: still too big. Reduce cap radius to ~0.78 of the globe's max radius (it sits on the top of the glass, ribs converge
   under it), dome height lower, and make the ring slightly larger (outer radius ~0.06) so it reads at small scale.
3. SCARF TAILS: they currently look like flat wide paper strips sticking out sideways (see r3-walk). Make them narrower
   (0.06 wide), hanging from the knot placed on the character's front-left (screen-visible) side, falling mostly DOWN along the
   torso in idle (gravity dominant, length ~0.28), swinging back/outward only with motion (clamp the max angle from vertical
   to ~70 deg; stronger gravity + damping so idle settles within 1 s). Slight curl twist along length, fringe at ends.
   Keep the front of the torso/gauge clear: tails hang to the side of the gauge.
4. Shading: the torso lower half is still quite dark; lift ambient on brass (envMapIntensity 1.6) and add a faint
   warm uplight so the boots/legs don't vanish at small scale. Legs a touch thicker (+15%).
5. Verify in a screenshot at view=large t=0.6 walk, view=lineup, view=small. Keep draw calls <= 40.
Finish with a 4-line summary.
