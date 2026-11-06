/* Spirelight levels (design.md section 5). Seed levels by the geometry agent; the level designer owns this file next.
 * Check every level with: node tools/solve.js --all   and look at it with:
 *   node tools/solve.js --level ID --svg design/qa/geom/ID.svg && node tools/svgshot.js design/qa/geom/ID.svg
 */
window.LEVELS = window.LEVELS || [];

// 1. Walking and stairs, no mechanisms.
LEVELS.push({
  id: "first-light",
  name: "First Light",
  chapter: 1,
  theme: "dusk",
  intro: "Every spire keeps one lamp.",
  hint: "Tap a pale stone to walk there. Stairs climb away from you.",
  start: "start",
  goal: "goal",
  groups: [
    { id: "base", blocks: [
      { box: [1, -1, 0, 4, -1, 2], style: "darkstone", walk: false },  // underside
      { box: [2, -2, 1, 3, -2, 1], style: "darkstone", walk: false },
      { box: [0, 0, 0, 5, 0, 2], style: "sandstone" },                 // lower terrace (tops at y=1)
      { box: [4, 0, 3, 5, 0, 3], style: "brick" },                     // front balcony
      { at: [5, 0, 3], style: "brick", id: "start" },
      { box: [0, 1, 0, 1, 2, 2], style: "sandstone" },                 // the tower (tops at y=3)
      { at: [2, 1, 1], style: "brick", walk: false },                  // landing under the upper stair
      { stair: [3, 1, 1], up: "-x", style: "sandstone", id: "stairLow" },
      { stair: [2, 2, 1], up: "-x", style: "sandstone", id: "stairHigh" },
      { at: [1, 2, 1], style: "sandstone", id: "goal" },
      { at: [0, 2, 0], style: "sandstone", id: "g1" },
      { at: [0, 3, 1], style: "marble", walk: false },                 // beacon plinth behind the goal
    ]},
  ],
  glimmers: ["g1"],
  decor: [
    { type: "beacon", at: [0, 3, 1], face: "+y" },
    { type: "lantern", at: [5, 0, 0], face: "+x" },
    { type: "lantern", at: [1, 2, 2], face: "+z" },
    { type: "lantern", at: [3, 0, 2], face: "+z" },
    { type: "ivy", at: [1, 1, 2], face: "+z" },
    { type: "ivy", at: [4, -1, 2], face: "+z" },
    { type: "flowers", at: [4, 0, 3], face: "+z" },
    { type: "flowers", at: [0, 2, 2], face: "+y" },
    { type: "window", at: [1, 1, 0], face: "+x" },
  ],
  solution: [["walk", "goal"]],
});

// 2. A y-rotor carries a stair: turn the crank until the stair climbs away from the viewer.
LEVELS.push({
  id: "turning-stair",
  name: "The Turning Stair",
  chapter: 1,
  theme: "dusk",
  intro: "Old stairs remember the way, if you turn them gently.",
  hint: "Drag the brass crank. A stair only works when it climbs away from you.",
  start: "start",
  goal: "goal",
  groups: [
    { id: "base", blocks: [
      { box: [3, -1, 0, 6, -1, 3], style: "darkstone", walk: false },
      { box: [4, -2, 1, 5, -2, 2], style: "darkstone", walk: false },
      { box: [3, 0, 0, 6, 0, 3], style: "sandstone" },                 // lower court (tops at y=1)
      { box: [2, 0, 2, 2, 0, 3], style: "sandstone" },
      { at: [6, 0, 3], style: "sandstone", id: "start" },
      { at: [5, 1, 0], style: "brass", walk: false },                  // crank post
      { box: [0, 0, 1, 1, 1, 2], style: "brick" },                     // upper terrace (tops at y=2)
      { box: [0, -1, 1, 1, -1, 2], style: "darkstone", walk: false },
      { at: [0, 1, 2], style: "brick", id: "goal" },
      { at: [0, 2, 1], style: "marble", walk: false },                 // beacon plinth behind the goal
      { at: [2, 0, 0], style: "darkstone", walk: false },              // glimmer ledge
      { at: [2, 1, 0], style: "sandstone", id: "g1" },
    ]},
    { id: "turntable",
      rotor: { axis: "y", pivot: [2.5, 0, 1.5], angles: [0, 90, 180, 270], start: 0 },
      handle: { type: "crank", at: [5, 1, 0], face: "+y", on: "base" },
      blocks: [
        { at: [2, 0, 1], style: "brass", walk: false },
        { stair: [2, 1, 1], up: "+x", style: "sandstone", id: "stair" },  // starts edge-on (rising +x)
      ] },
  ],
  glimmers: ["g1"],
  decor: [
    { type: "beacon", at: [0, 2, 1], face: "+y" },
    { type: "gear", at: [2, 0, 1], face: "+z", group: "turntable" },
    { type: "lantern", at: [6, 0, 0], face: "+x" },
    { type: "lantern", at: [1, 1, 2], face: "+z" },
    { type: "ivy", at: [1, 0, 2], face: "+x" },
    { type: "ivy", at: [6, -1, 3], face: "+z" },
    { type: "flowers", at: [2, 0, 3], face: "+z" },
    { type: "flowers", at: [1, 1, 1], face: "+y" },
  ],
  solution: [["mech", "turntable", 180], ["walk", "goal"]],
});

// 3. A rotating bridge that only *looks* connected to the far walkway at 90 degrees (impossible join, k = -1),
//    then a plate raises a lift to the goal.
LEVELS.push({
  id: "sky-bridge",
  name: "Sky Bridge",
  chapter: 1,
  theme: "dusk",
  intro: "What looks joined, is joined.",
  hint: "Turn the bridge until its end seems to touch the far walkway, then cross.",
  start: "start",
  goal: "goal",
  groups: [
    { id: "base", blocks: [
      { box: [3, 0, 3, 5, 1, 5], style: "darkstone", walk: false },    // main tower body
      { box: [4, -1, 4, 4, -1, 4], style: "darkstone", walk: false },
      { box: [3, 2, 3, 5, 2, 5], style: "sandstone" },                 // main platform (tops at y=3)
      { at: [5, 2, 5], style: "sandstone", id: "start" },
      { box: [1, 0, -2, 3, 0, -2], style: "darkstone", walk: false },  // far walkway (tops at y=2)
      { box: [1, 1, -2, 3, 1, -2], style: "brick" },
      { at: [3, 1, -2], style: "brick", id: "farEnd" },
      { at: [1, 1, -2], style: "brass", id: "p1" },                     // pressure plate
      { box: [-2, 0, -2, -1, 0, -2], style: "darkstone", walk: false },
      { at: [-1, 1, -2], style: "brick", id: "goal" },
      { at: [-2, 1, -2], style: "marble", walk: false },               // beacon plinth behind the goal
      { at: [1, 1, 2], style: "darkstone", walk: false },              // glimmer perch
      { at: [1, 2, 2], style: "marble", id: "g1" },
    ]},
    { id: "bridge",
      rotor: { axis: "y", pivot: [4.5, 0, 2.5], angles: [0, 90, 180], start: 0 },
      handle: { type: "crank", at: [3, 2, 4], face: "-x", on: "base" },
      blocks: [
        { at: [4, 2, 2], style: "brass", id: "hub" },
        { box: [5, 2, 2, 6, 2, 2], style: "wood" },
      ] },
    { id: "lift",
      slider: { axis: "y", stops: [0, 1], start: 0 },
      blocks: [ { at: [0, 0, -2], style: "brass", id: "lift" } ] },
  ],
  plates: [ { tile: "p1", group: "lift", to: 1 } ],
  glimmers: ["g1"],
  decor: [
    { type: "beacon", at: [-2, 1, -2], face: "+y" },
    { type: "lantern", at: [5, 2, 3], face: "+x" },
    { type: "lantern", at: [3, 1, -2], face: "+z" },
    { type: "lantern", at: [-1, 0, -2], face: "+z" },
    { type: "ivy", at: [5, 1, 5], face: "+z" },
    { type: "ivy", at: [2, 0, -2], face: "+z" },
    { type: "flowers", at: [3, 2, 5], face: "+z" },
    { type: "flowers", at: [1, 1, 2], face: "+x" },
    { type: "rail", at: [0, -1, -2], face: "+y", group: "base" },
  ],
  solution: [["mech", "bridge", 90], ["walk", "p1"], ["walk", "goal"]],
});
