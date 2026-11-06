# Spirelight: level design notes (levels 1-5 and the title; levels 6-10 are in design/levels2.md)

All in `levels/levels.js`, verified by `node tools/solve.js --all`. Play order is array order.

Rules learned (for reviewers and the other designer):
- A non-veil impossible join works only at the NEARER tile's back edge (-x or -z side): a farther tile (k < 0) beyond a back
  edge is visible. A nearer tile in front of a back edge hides the junction, so it needs a veil.
- x/z rotors are walkable only at angle 0, so they act as drawbridges.
- Handles are hit-tested on screen, so a crank can always be turned from anywhere. Never put a handle on a -x, -z or -y
  face (invisible); give it a visible post and use +y/+x/+z.
- Portrait (spans now 5.7-6.4 for levels 1-4 and the title, 7.8 for chime-stair): aim for a screen-x span (x - z)/sqrt2 of at most about 6.5 world units, stack upward instead of sideways.
- Every level has a spine (a tall non-walkable shaft at the minimum-x/z side, behind the beacon, so it never occludes a
  tile), one `keel`, struts/chains/pipes/corbels/railings as decor (about 40-60 items; helpers `D()` and `S()` in the file).

| # | id | chapter / theme | idea | solution | glimmers |
|---|---|---|---|---|---|
| 1 | first-light | 1 dusk | walk and climb stairs (trivial by design; the glimmer teaches "look around the spire") | walk goal | g1 on a ledge behind the tower's back corner |
| 2 | turning-stair | 1 dusk | a gear-driven turntable (clock dial, gears, crank) turns a stair; stairs only climb away from you | mech turntable 180; walk goal | g1, g2 on a ledge only the turntable at 90 reaches |
| 3 | lamp-lift | 1 dusk | slider lift in a lighthouse, Wick rides it | walk liftTop; mech lift 4; walk goal | g1 mid balcony end (lift at 2), g2 far end of the gallery (4,4,0) |
| 4 | sky-bridge | 2 night | first impossible join (k=-1) and a plate-driven lift | mech bridge 90; walk p1; walk goal | g1 needs the bridge at 180 |
| 5 | chime-stair | 2 night | zig-zag bell tower: real decision (raise-plate vs decoy plate), lift, counting plate | walk p1; walk liftTop; mech lift 2; walk p2; walk c5; walk p2; walk goal | g1 on the lift's middle stop |
| - | title | dusk | decorative spire with balcony, spine, keel and beacon | - | - |

Notes
- Level 3 and 4 swapped content (lift lesson first); the bridge crank now has its own visible post on +y.
- Level 5: p1 (0,0,1) raises the hidden span, pd (2,0,1) is a decoy that pulls it back (recoverable). The arm starts at 180 and the
  plate steps 180 > 0 > 90, so p2 must be pressed twice (step off to c5 and back). Screen span is about 6.4 units.
- Level 1 intentionally leaves the solver's "trivial" warning.
- Decor using new types (`keel`, `strut`, `chain`, `corbel`, `dial`) is ignored until decor.js implements them. `strut` and `chain`
  carry an integer `at` (their start cell) because the loader requires it.
