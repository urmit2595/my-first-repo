# Spirelight: level design notes

Ten levels in four chapters plus a decorative `title` diorama, all in `levels/levels.js`, verified by
`node tools/solve.js --all`. Geometry rules learned while building (useful for reviewers):

- A non-veil impossible join works only at the NEARER tile's back edge (-x or -z side). A farther tile (k < 0) beyond
  a back edge is visible (Sky Bridge, Twin Drawbridges B). A nearer tile in front of a back edge hides the junction, so
  a veil is needed (the staircase illusion).
- x/z rotors only have walkable tiles at angle 0 (a tile must still face +y), so they act as drawbridges: raised =
  standing vertical, lowered = a bridge. Wick cannot be on one while it turns (lock).
- Handles are screen-space, so a crank can be turned from anywhere: puzzles gate on geometry and plates, not on walking
  to the crank.

| # | id | chapter / theme | place | idea | solution |
|---|---|---|---|---|---|
| 1 | first-light | Embers / dusk | terrace + stairs | walk, climb stairs (trivial by design; solver warns "trivial") | walk goal |
| 2 | turning-stair | Embers | stair court | y-rotor turns a stair; stairs only climb away from you | mech turntable 180; walk goal |
| 3 | sky-bridge | Embers | bridge tower | first impossible join (k = -1) and a plate | mech bridge 90; walk p1; walk goal |
| 4 | lamp-lift | Lanterns / night | lighthouse | y-slider lift, Wick rides it | walk liftTop; mech lift 4; walk goal |
| 5 | chime-stair | Lanterns | bell tower | plate chain: plate, lift, plate | walk p1; walk liftTop; mech lift 2; walk p2; walk goal |
| 6 | twin-drawbridges | Lanterns | clock dock | z- and x-rotor drawbridges; the second meets the far ledge by looks (k = -1) | mech drawA 0; walk isle; mech drawB 0; walk goal |
| 7 | veiled-steps | Veils / aurora | observatory | a pillar (veil) on a turntable hides a stair that climbs toward the viewer | mech dial 0; walk ledge; mech dial 90; walk goal |
| 8 | greenhouse-spire | Veils | greenhouse | bridge (k = -1) + plate lift + sliding veil pillar | mech bridge 90; walk p1; mech pillar 0; walk goal |
| 9 | clock-spiral | Daybreak / dawn | clockwork stair | impossible loop (k = 2), bridge, plate lift, z-drawbridge | mech bridge 90; walk p1; mech draw 0; walk goal |
| 10 | beacon-spire | Daybreak | tall diagonal spire | finale: drawbridge, 3-stop lift, bridge, plate, veil pillar, stair | mech draw 0; walk elevTop; mech elevator 2; mech bridge 90; walk p1; mech pillar 0; walk goal (7 actions) |
| - | title | dusk | small spire | decorative, no solution | - |

## Glimmers and notes

- **1**: g1 on the tower's back-left tile (0,2,0). **2**: g1 on the far ledge (2,1,0); the stair starts edge-on.
- **3**: g1 (1,2,2) needs the bridge at 180, then back to 90.
- **4**: g1 on the mid balcony end (1,2,4): ride to stop 2, walk the L balcony, back to the lift, then stop 4.
- **5**: g1 (11,1,2) via the lift's middle stop. p2's arm is a y-rotor.
- **6**: g1 (9,-1,-3). Both cranks are on the base, so the solver's shortest is 3 actions (drawA, drawB, walk); the intended order is A, cross, B.
- **7**: dial starts at 180; 0 hides the first stair, 90 the second. g1 balcony (6,2,1).
- **8**: g1 (1,2,2) needs bridge 180; g2 (-3,2,0) balcony. Pillar starts away (slider 2), pull to 0.
- **9 (intentional shortcut)**: the start tile is the foot of the ring stair, and it looks joined to the stair's top (k = 2 loop), so the long ring lap is optional scenery. The solver lists k=2 joins start-top, (1,0,0)-platform, (1,0,0)-hub: one illusion. g1 (4,0,7) spur on the ring, g2 (5,2,4) balcony.
- **10**: g1 (1,2,2), g2 (-3,2,0), g3 (6,1,6) on the lift's middle stop.
- Only warning anywhere: the intentional "trivial" on level 1. Windows and lanterns are mostly unlit so the beacon cascade pays off.
