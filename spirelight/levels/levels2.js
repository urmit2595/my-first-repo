/* SPIRELIGHT levels 6-10 (design.md section 5), loaded after levels/levels.js. Same format; see design/levels.md.
 * Check with: node tools/solve.js --all
 */
(function () {
  "use strict";
  window.LEVELS = window.LEVELS || [];

  // Hanging foundation: layers of darkstone that shrink by one cell on each side per layer below row `y`
  // (the lowest row of the platform), ending in a copper tip. Returns block entries.
  function taper(x0, z0, x1, z1, y, style) {
    var out = [], i = 1;
    for (;;) {
      var a = x0 + i, b = x1 - i, c = z0 + i, d = z1 - i;
      if (a > b || c > d) {
        out.push({ at: [Math.floor((x0 + x1) / 2), y - i, Math.floor((z0 + z1) / 2)], style: "copper", walk: false });
        return out;
      }
      out.push({ box: [a, y - i, c, b, y - i, d], style: style || "darkstone", walk: false });
      i++;
    }
  }

  // 6. LANTERNS III, "Two Crossings": a harbour clock tower. ONE z-rotor drawbridge does two jobs. Lowered, it spans
  //    dock -> isle. Raised again, it uncovers the quay that was lying behind its deck all along: that quay sits one
  //    lower and one further back, so on screen it fills the deck's place and joins the isle by looks (k = 1).
  //    The bridge cannot be raised while Wick stands on it (lock wiggle teaches the rule): cross, step off, raise.
  LEVELS.push({
    id: "two-crossings",
    name: "Two Crossings",
    chapter: 2,
    theme: "night",
    intro: "One bridge, crossed twice.",
    hint: "A lowered bridge can hide what lies beneath it.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [
        // dock pier and its gatehouse (the winch lives on the gatehouse wall)
        { box: [0, -2, 2, 1, -1, 2], style: "darkstone", walk: false },
        { box: [0, 0, 2, 1, 0, 2], style: "sandstone" },
        { at: [0, 0, 2], style: "sandstone", id: "start" },
        { box: [0, -2, 0, 1, 0, 1], style: "brick", walk: false },
        { at: [1, 1, 1], style: "brass", walk: false },
        { box: [0, -3, 0, 1, -3, 2], style: "darkstone", walk: false },
        { box: [-1, -4, 0, 1, -4, 3], style: "darkstone", walk: false },
        { box: [-3, -5, -6, -1, -4, -5], style: "darkstone", walk: false },
        { box: [-1, -3, -4, -1, 0, -4], style: "brick", walk: false },
        // the isle (lamp post and bench on it)
        { box: [4, 0, 1, 4, 0, 2], style: "sandstone" },
        { at: [4, 0, 2], style: "sandstone", id: "isle" },
        { box: [4, -2, 1, 4, -1, 2], style: "darkstone", walk: false },
        // the hidden quay, one lower and one back: screen-identical with the deck's isle-side plank
        { box: [2, -1, 1, 2, -1, 3], style: "brick" },
        { at: [2, -1, 1], style: "brick", id: "quay" },
        { box: [2, -3, 1, 2, -2, 3], style: "darkstone", walk: false },
        // two stairs hug the dock's front, then the climb up the tower's flank
        { stair: [1, 0, 3], up: "-x", style: "sandstone" },
        { at: [1, -1, 3], style: "darkstone", walk: false },
        { stair: [0, 1, 3], up: "-x", style: "sandstone" },
        { box: [0, -1, 3, 0, 0, 3], style: "darkstone", walk: false },
        { box: [-1, 1, 1, -1, 1, 3], style: "sandstone" },
        { box: [-1, -1, 1, -1, 0, 3], style: "brick", walk: false },
        { stair: [-1, 2, 0], up: "-z", style: "sandstone" },
        { box: [-1, 0, 0, -1, 1, 0], style: "brick", walk: false },
        { at: [-1, 2, -1], style: "sandstone" },
        { box: [-1, 0, -1, -1, 1, -1], style: "brick", walk: false },
        { stair: [-1, 3, -2], up: "-z", style: "sandstone" },
        { box: [-1, 1, -2, -1, 2, -2], style: "brick", walk: false },
        { at: [-1, 3, -3], style: "marble", id: "goal" },
        { box: [-1, 1, -3, -1, 2, -3], style: "brick", walk: false },
        { box: [-1, 3, -4, -1, 4, -4], style: "marble", walk: false },  // beacon plinth
        // the clock tower spine behind the beacon
        { box: [-3, -2, -6, -2, 7, -5], style: "sandstone", walk: false },
        { box: [-3, 3, -6, -2, 3, -5], style: "brick", walk: false },
        { box: [-3, 8, -6, -2, 8, -5], style: "slate", walk: false },
        { box: [-1, -1, -6, -1, 5, -5], style: "sandstone", walk: false },
        { box: [-1, 6, -6, -1, 6, -5], style: "brick", walk: false },
        { box: [-3, -3, -6, -1, -3, -5], style: "darkstone", walk: false },
        // two glimmer perches: one hangs behind the isle, one floats in front of the bridge
        { at: [1, -2, -1], style: "marble", id: "g1" },
        { at: [1, -3, -1], style: "darkstone", walk: false },
        { at: [3, 1, 4], style: "marble", id: "g2" },
      ] },
      { id: "draw",
        rotor: { axis: "z", pivot: [2, 1, 0], angles: [0, 90], start: 90 },
        handle: { type: "crank", at: [1, 1, 1], face: "+x", on: "base" },
        blocks: [ { box: [2, 0, 2, 3, 0, 2], style: "wood" } ] },
    ],
    glimmers: ["g1", "g2"],
    decor: [
      { type: "beacon", at: [-1, 4, -4], face: "+y" },
      { type: "keel", at: [0, -3, 0], face: "-y", w: 2, d: 3, depth: 3 },
      { type: "clock", at: [-1, 4, -5], face: "+z", r: 0.42 },
      { type: "clock", at: [-1, 5, -5], face: "+x", r: 0.34 },
      { type: "dome", at: [-3, 8, -6], face: "+y", r: 1.4 },
      { type: "finial", at: [-2, 8, -5], face: "+y" },
      { type: "plant", at: [0, 0, 1], face: "+y", variant: "shrub" },
      { type: "gear", at: [1, 1, 1], face: "+z", r: 0.42, tint: "patina" },
      { type: "gear", at: [1, 0, 0], face: "+x", r: 0.3 },
      { type: "chain", at: [1, 1, 1], from: [1.8, 1.9, 1.5], to: [3.9, 1.05, 2.15] },
      { type: "chain", at: [1, 1, 1], from: [1.8, 1.9, 1.5], to: [3.9, 1.05, 2.85] },
      { type: "pipe", at: [1, 0, 1], face: "+z", len: 2, dir: "-y" },
      // lanterns along the walks (unlit: the beacon cascade lights them)
      { type: "lantern", at: [1, 0, 2], face: "+z" },
      { type: "lantern", at: [4, 0, 2], face: "+x" },
      { type: "lantern", at: [2, -1, 3], face: "+z" },
      { type: "lantern", at: [-1, 1, 3], face: "+z" },
      { type: "lantern", at: [-1, 2, -1], face: "+x" },
      { type: "lantern", at: [-1, 3, -3], face: "+x" },
      { type: "lantern", at: [-1, 6, -5], face: "+x" },
      { type: "streetlamp", at: [4, 0, 1], face: "+y" },
      { type: "window", lit: true, at: [0, -1, 1], face: "+x" },
      { type: "window", at: [-2, 2, -5], face: "+z" },
      { type: "window", at: [-1, 2, -5], face: "+x" },
      { type: "window", at: [-2, 5, -5], face: "+z" },
      { type: "window", at: [-1, 3, -6], face: "+x" },
      { type: "window", at: [-2, 7, -5], face: "+z" },
      { type: "banner", at: [-3, 5, -5], face: "+z", color: "indigo" },
      { type: "banner", at: [0, 0, 1], face: "+z", color: "teal" },
      { type: "railing", at: [2, -1, 3], face: "+y", side: "+x" },
      { type: "railing", at: [2, -1, 3], face: "+y", side: "+z" },
      { type: "railing", at: [-1, 1, 3], face: "+y", side: "+z" },
      { type: "railing", at: [-1, 1, 3], face: "+y", side: "-x" },
      { type: "railing", at: [4, 0, 1], face: "+y", side: "+x" },
      { type: "railing", at: [-1, 3, -3], face: "+y", side: "-x" },
      // struts tie the floating bits to the tower and the pier
      { type: "strut", at: [4, -1, 1], from: [4.5, -1.5, 1.0], to: [2.5, -2.5, 1.0] },
      { type: "strut", at: [2, -2, 1], from: [2.0, -2.5, 1.5], to: [1.0, -2.5, 1.5] },
      { type: "strut", at: [1, -2, -1], from: [1.5, -2.5, -1.0], to: [-1.0, -2.0, -5.0], style: "arch" },
      { type: "strut", at: [3, 1, 4], from: [3.5, 1.0, 4.0], to: [2.6, -0.6, 3.8] },
      { type: "finial", at: [3, 1, 4], face: "-y", s: 0.7 },
      { type: "strut", at: [-1, 1, 0], from: [-1.0, 1.5, 0.5], to: [-2.0, 2.5, -4.9], style: "arch" },
      { type: "corbel", at: [-1, 0, 3], face: "+z" },
      { type: "corbel", at: [2, -2, 3], face: "+z" },
      { type: "corbel", at: [0, -2, 2], face: "+z" },
      { type: "corbel", at: [4, -2, 2], face: "+z" },
      { type: "ivy", at: [1, -1, 1], face: "+x" },
      { type: "ivy", at: [-1, 0, 2], face: "+z" },
      { type: "ivy", at: [-3, 1, -5], face: "+z" },
      { type: "vines", at: [2, -2, 3], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [-1, 0, 3], face: "+z", len: 2, count: 2 },
      { type: "flowers", at: [1, 0, 2], face: "+y" },
      { type: "flowers", at: [-1, 1, 1], face: "+y" },
      { type: "flowers", at: [3, 1, 4], face: "+y" },
      { type: "plant", at: [-1, 1, 2], face: "+y", variant: "fern" },
      { type: "waterfall", at: [1, -1, 2], face: "+z", len: 4 },
    ],
    solution: [["mech", "draw", 0], ["walk", "isle"], ["mech", "draw", 90], ["walk", "goal"]],
  });
  // 7. VEILS I, "The Veiled Steps": an observatory. A floating pillar (a veil) rides the arm of a turntable dial.
  //    Every broken step (a block one higher and nearer, whose front face hangs over the step below) becomes whole
  //    while the pillar stands in front of it. Four dial positions, four hiding places: the start dais (0), the
  //    ledge (90), the upper walk (180) and, for a glimmer, the alcove in the observatory wall (270).
  LEVELS.push({
    id: "veiled-steps",
    name: "The Veiled Steps",
    chapter: 3,
    theme: "aurora",
    intro: "What the pillar hides, the path remembers.",
    hint: "Behind the pillar, a broken step is whole again.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [
        // courtyard around the dais (tops y=1)
        { box: [1, -1, 4, 3, -1, 5], style: "darkstone", walk: false },
        { box: [2, -2, 4, 3, -2, 5], style: "darkstone", walk: false },
        { box: [1, 0, 4, 3, 0, 5], style: "sandstone" },
        { at: [1, 0, 4], style: "sandstone", id: "court" },
        { at: [2, 1, 4], style: "marble", id: "start" },               // the observer's dais
        // observatory body with a stepped alcove in its front wall
        { box: [0, -2, 0, 3, 4, 2], style: "sandstone", walk: false },
        { box: [0, -1, 3, 1, 4, 3], style: "sandstone", walk: false },
        { at: [2, 0, 3], style: "sandstone", walk: false },
        { at: [2, 1, 3], style: "sandstone", id: "niche" },
        { box: [2, 3, 3, 2, 4, 3], style: "sandstone", walk: false },
        { box: [3, 0, 3, 3, 1, 3], style: "sandstone", walk: false },
        { at: [3, 2, 3], style: "marble", id: "g2" },
        { at: [3, 4, 3], style: "sandstone", walk: false },
        { box: [0, 3, 0, 3, 3, 2], style: "brick", walk: false },
        { box: [0, 3, 3, 1, 3, 3], style: "brick", walk: false },
        { at: [2, 3, 3], style: "brick", walk: false },
        { box: [0, 5, 0, 3, 5, 3], style: "slate", walk: false },
        { box: [1, 6, 1, 2, 6, 2], style: "copper", walk: false },
        { box: [0, -3, 0, 3, -3, 2], style: "darkstone", walk: false },
        // the ledge (tops y=2) and the upper walk (tops y=3)
        { at: [4, 0, 3], style: "darkstone", walk: false },
        { box: [4, 1, 3, 4, 1, 4], style: "sandstone" },
        { at: [4, 1, 3], style: "sandstone", id: "ledge" },
        { box: [5, -1, 0, 5, 1, 3], style: "brick", walk: false },
        { box: [5, 2, 0, 5, 2, 3], style: "sandstone" },
        { at: [5, 2, 0], style: "sandstone", id: "goal" },
        { box: [5, 2, -1, 5, 3, -1], style: "marble", walk: false },      // beacon plinth
        { box: [5, -2, -1, 5, 1, -1], style: "brick", walk: false },
        { box: [6, 0, 1, 6, 1, 1], style: "darkstone", walk: false },
        { at: [6, 2, 1], style: "marble", id: "g1" },                      // balcony off the upper walk
      ] },
      { id: "dial",
        rotor: { axis: "y", pivot: [5.5, 0, 5.5], angles: [0, 90, 180, 270], start: 0 },
        handle: { type: "wheel", at: [5, 3, 5], face: "+y", on: "self" },
        blocks: [
          { box: [4, 0, 4, 6, 0, 6], style: "brass", walk: false },         // turntable
          { at: [5, -1, 5], style: "brass", walk: false },
          { box: [5, 1, 5, 5, 3, 5], style: "brass", walk: false },         // spindle
          { at: [4, 3, 6], style: "column", kind: "veil" },                 // the pillar on its arm
        ] },
    ],
    glimmers: ["g1", "g2"],
    decor: [
      { type: "beacon", at: [5, 3, -1], face: "+y" },
      { type: "keel", at: [1, -3, 0], face: "-y", w: 3, d: 3, depth: 3 },
      { type: "dome", at: [1, 6, 1], face: "+y", r: 1.6 },
      { type: "finial", at: [2, 6, 2], face: "+y" },
      { type: "clock", at: [1, 4, 3], face: "+z", r: 0.4 },
      // the dial: hands on the turntable, an arm out to the pillar, gears below
      { type: "dial", at: [5, 0, 5], face: "+y", r: 1.35, group: "dial" },
      { type: "strut", at: [5, 3, 5], from: [5.5, 3.6, 5.5], to: [4.6, 3.5, 6.4], group: "dial" },
      { type: "strut", at: [5, 3, 5], from: [5.5, 3.2, 5.5], to: [4.6, 3.1, 6.4], group: "dial" },
      { type: "gear", at: [4, 0, 6], face: "+z", r: 0.5, group: "dial" },
      { type: "gear", at: [6, 0, 5], face: "+x", r: 0.4, group: "dial", tint: "patina" },
      { type: "gear", at: [5, -1, 5], face: "+x", r: 0.35, tint: "iron", group: "dial" },
      { type: "gear", at: [3, 0, 2], face: "+x", r: 0.45, tint: "patina" },
      { type: "pipe", at: [3, 1, 2], face: "+x", len: 2, dir: "+z" },
      { type: "pipe", at: [5, -1, 3], face: "+z", len: 2, dir: "-y" },
      // lanterns along the walks, mostly unlit for the cascade
      { type: "lantern", at: [3, 0, 5], face: "+z" },
      { type: "lantern", at: [1, 0, 5], face: "+z" },
      { type: "lantern", at: [4, 1, 4], face: "+z" },
      { type: "lantern", at: [5, 2, 3], face: "+z" },
      { type: "lantern", at: [5, 2, 1], face: "+x" },
      { type: "lantern", at: [3, 2, 2], face: "+x" },
      { type: "streetlamp", at: [3, 0, 4], face: "+y" },
      { type: "window", lit: true, at: [3, 1, 2], face: "+x" },
      { type: "window", at: [1, 1, 3], face: "+z" },
      { type: "window", at: [0, 1, 3], face: "+z" },
      { type: "window", at: [3, 4, 2], face: "+x" },
      { type: "window", at: [1, 2, 3], face: "+z" },
      { type: "window", at: [3, 4, 1], face: "+x" },
      { type: "window", at: [5, 0, 3], face: "+z" },
      { type: "banner", at: [0, 2, 3], face: "+z", color: "plum" },
      { type: "banner", at: [3, 2, 1], face: "+x", color: "gold" },
      { type: "railing", at: [5, 2, 3], face: "+y", side: "+x" },
      { type: "railing", at: [5, 2, 2], face: "+y", side: "+x" },
      { type: "railing", at: [4, 1, 4], face: "+y", side: "+x" },
      { type: "railing", at: [6, 2, 1], face: "+y", side: "+x" },
      { type: "railing", at: [3, 0, 5], face: "+y", side: "+z" },
      { type: "corbel", at: [4, 0, 3], face: "+z" },
      { type: "corbel", at: [6, 1, 1], face: "+x" },
      { type: "corbel", at: [3, 3, 3], face: "+z" },
      { type: "corbel", at: [5, 1, 3], face: "+z" },
      { type: "strut", at: [6, 0, 1], from: [6.5, 0.0, 1.5], to: [5.6, -1.0, 1.5] },
      { type: "strut", at: [3, -1, 5], from: [3.6, -1.0, 5.0], to: [4.5, -0.6, 5.0] },
      { type: "ivy", at: [0, 0, 3], face: "+z" },
      { type: "ivy", at: [5, 1, 3], face: "+x" },
      { type: "ivy", at: [5, 0, 2], face: "+x" },
      { type: "ivy", at: [3, 2, 0], face: "+x" },
      { type: "vines", at: [2, -1, 5], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [5, -1, 3], face: "+x", len: 2, count: 2 },
      { type: "flowers", at: [1, 0, 5], face: "+y" },
      { type: "flowers", at: [3, 0, 5], face: "+y" },
      { type: "flowers", at: [6, 2, 1], face: "+y" },
      { type: "plant", at: [5, 2, 2], face: "+y", variant: "fern" },
      { type: "plant", at: [2, 1, 3], face: "+y", variant: "succ" },
      { type: "waterfall", at: [4, 1, 4], face: "+z", len: 4 },
      { type: "finial", at: [5, -2, 5], face: "-y", group: "dial" },
    ],
    solution: [["walk", "court"], ["mech", "dial", 90], ["walk", "ledge"], ["mech", "dial", 180], ["walk", "goal"]],
  });
  // 8. VEILS II, "Greenhouse Spire": a turning planter (y-rotor) carries a plank arm and a clipped topiary whose crown
  //    is a hedge veil, so one mechanism plays three parts. Ride it to 90: the arm meets the far walk by looks (k = -1),
  //    where a plate lifts a stone step. Come back aboard and ride to 180: now the arm meets that step by looks AND the
  //    topiary stands in front of the broken step beyond it, so Wick walks behind the hedge and up to the glasshouse.
  LEVELS.push({
    id: "greenhouse-spire",
    name: "Greenhouse Spire",
    chapter: 3,
    theme: "aurora",
    intro: "The garden turns, and the hedges remember the way.",
    hint: "The planter is a bridge, a carousel and a curtain. Ride it.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [
        // potting terrace where Wick starts (tops y=3)
        { box: [6, 0, 3, 7, 1, 4], style: "sandstone", walk: false },
        { box: [6, -1, 3, 7, -1, 4], style: "darkstone", walk: false },
        { box: [6, 2, 3, 7, 2, 4], style: "sandstone" },
        { at: [7, 2, 4], style: "sandstone", id: "start" },
        { at: [7, 3, 3], style: "hedge", walk: false },
        // the planter's pot, the turntable stands on it
        { box: [3, -2, 3, 3, 1, 3], style: "brick", walk: false },
        // far walk with the plate (tops y=2), under the glasshouse's shadow
        { box: [2, -1, -3, 2, 0, -1], style: "darkstone", walk: false },
        { box: [2, 1, -3, 2, 1, -1], style: "brick" },
        { at: [2, 1, -3], style: "brass", id: "p1" },
        { at: [2, 1, -1], style: "brick", id: "farWalk" },
        // left terrace: behind the hedge, up to the glasshouse (tops y=3, y=4)
        { box: [0, 0, 0, 0, 1, 2], style: "brick", walk: false },
        { box: [0, 2, 0, 0, 2, 2], style: "sandstone" },
        { at: [0, 2, 2], style: "sandstone", id: "terrace" },
        { stair: [0, 3, -1], up: "-z", style: "sandstone" },
        { box: [0, 1, -1, 0, 2, -1], style: "brick", walk: false },
        { box: [0, 3, -3, 0, 3, -2], style: "sandstone" },
        { at: [0, 3, -3], style: "marble", id: "goal" },
        { box: [0, 0, -3, 0, 2, -2], style: "brick", walk: false },
        { box: [0, 3, -4, 0, 4, -4], style: "marble", walk: false },     // beacon plinth
        // the glasshouse spine: hedge walls inside a copper frame, rising behind the beacon
        { box: [-2, -2, -5, -1, 2, -3], style: "sandstone", walk: false },
        { box: [-2, 3, -5, -1, 6, -3], style: "hedge", walk: false },
        { box: [-2, 7, -5, -1, 7, -3], style: "copper", walk: false },
        { box: [0, -1, -5, 0, 5, -5], style: "sandstone", walk: false },
        { box: [-2, -3, -5, 0, -3, -4], style: "darkstone", walk: false },
        { box: [-2, -4, -5, -1, -4, -3], style: "darkstone", walk: false },
        { box: [6, -2, 3, 7, -2, 4], style: "darkstone", walk: false },
        { box: [0, -2, -3, 0, -1, 2], style: "darkstone", walk: false },
        { box: [2, -3, -3, 2, -2, -1], style: "darkstone", walk: false },
        // glimmer perch, reached only from the planter at 270
        { at: [1, 1, 4], style: "marble", id: "g1" },
        { at: [1, 0, 4], style: "hedge", walk: false },
        // second glimmer: a hanging perch that only the arm's flank meets (by looks) while it points back
        { at: [1, 1, 0], style: "marble", id: "g2" },
      ] },
      { id: "planter",
        rotor: { axis: "y", pivot: [3.5, 0, 3.5], angles: [0, 90, 180, 270], start: 0 },
        handle: { type: "wheel", at: [3, 1, 3], face: "+z", on: "base" },
        blocks: [
          { at: [3, 2, 3], style: "wood", id: "hub" },
          { box: [4, 2, 3, 5, 2, 3], style: "wood" },
          { box: [4, 2, 2, 4, 3, 2], style: "hedge", walk: false },          // the topiary's trunk box
          { at: [4, 4, 2], style: "hedge", kind: "veil" },                   // its clipped crown hides junctions
        ] },
      { id: "step",
        slider: { axis: "y", stops: [0, 1], start: 0 },
        blocks: [ { at: [-1, 0, 2], style: "marble", id: "stepStone" } ] },
    ],
    plates: [ { tile: "p1", group: "step", to: 1 } ],
    glimmers: ["g1", "g2"],
    decor: [
      { type: "beacon", at: [0, 4, -4], face: "+y" },
      { type: "keel", at: [6, -1, 3], face: "-y", w: 2, d: 2, depth: 3 },
      { type: "keel", at: [-2, -3, -5], face: "-y", w: 3, d: 2, depth: 4 },
      { type: "dome", at: [-2, 7, -5], face: "+y", r: 1.5 },
      { type: "finial", at: [-1, 7, -3], face: "+y" },
      { type: "arch", at: [0, 5, -5], face: "+y", w: 1 },
      // the planter: a gear under the turntable and a pipe from the plate to the step it raises
      { type: "gear", at: [3, 1, 3], face: "+x", r: 0.45, tint: "patina" },
      { type: "gear", at: [3, 0, 3], face: "+z", r: 0.32 },
      { type: "flowers", at: [4, 3, 2], face: "+x", group: "planter" },
      { type: "pipe", at: [2, 0, -3], face: "-x", len: 5, dir: "+z" },
      { type: "pipe", at: [0, 0, 2], face: "+z", len: 1, dir: "-x" },
      { type: "chain", at: [-1, 0, 2], from: [-0.5, 3.0, 2.5], to: [-0.5, 1.0, 2.5] },
      { type: "rail", at: [-1, -1, 2], face: "+z", len: 2, dir: "+y" },
      // lanterns, mostly unlit
      { type: "lantern", at: [7, 2, 4], face: "+z" },
      { type: "lantern", at: [7, 2, 3], face: "+x" },
      { type: "lantern", at: [2, 1, -1], face: "+z" },
      { type: "lantern", at: [0, 2, 2], face: "+z" },
      { type: "lantern", at: [0, 3, -2], face: "+x" },
      { type: "lantern", at: [0, 4, -5], face: "+x" },
      { type: "streetlamp", at: [6, 2, 4], face: "+y" },
      { type: "window", lit: true, at: [7, 1, 4], face: "+z" },
      { type: "window", at: [7, 1, 3], face: "+x" },
      { type: "window", at: [0, 2, -5], face: "+x" },
      { type: "window", at: [-1, 1, -3], face: "+z" },
      { type: "window", at: [-2, 1, -3], face: "+z" },
      { type: "banner", at: [0, 1, 2], face: "+z", color: "teal" },
      { type: "banner", at: [7, 0, 4], face: "+x", color: "gold" },
      { type: "railing", at: [6, 2, 4], face: "+y", side: "+z" },
      { type: "railing", at: [7, 2, 3], face: "+y", side: "+x" },
      { type: "railing", at: [0, 2, 1], face: "+y", side: "-x" },
      { type: "railing", at: [0, 3, -3], face: "+y", side: "+x" },
      { type: "railing", at: [2, 1, -2], face: "+y", side: "-x" },
      { type: "corbel", at: [0, 1, 2], face: "+z" },
      { type: "corbel", at: [2, 0, -1], face: "+z" },
      { type: "corbel", at: [6, 1, 4], face: "+z" },
      { type: "corbel", at: [1, 1, 0], face: "+x" },
      { type: "strut", at: [1, 0, 4], from: [1.5, 0.0, 4.5], to: [0.6, 0.8, 2.6] },
      { type: "strut", at: [2, -1, -1], from: [2.5, -0.5, -0.5], to: [3.5, 0.5, 2.6], style: "arch" },
      { type: "strut", at: [6, 0, 3], from: [6.0, 0.5, 3.5], to: [3.9, 0.5, 3.5] },
      { type: "strut", at: [0, 0, 0], from: [0.5, 0.5, 0.0], to: [0.5, 1.0, -2.9] },
      { type: "ivy", at: [7, 0, 4], face: "+z" },
      { type: "ivy", at: [0, 0, 2], face: "+x" },
      { type: "ivy", at: [-1, 0, -3], face: "+z" },
      { type: "ivy", at: [3, 0, 3], face: "+z" },
      { type: "vines", at: [2, 0, -1], face: "+x", len: 2, count: 3 },
      { type: "vines", at: [6, 1, 4], face: "+z", len: 2, count: 3 },
      { type: "flowers", at: [6, 2, 3], face: "+y" },
      { type: "flowers", at: [0, 2, 0], face: "+y" },
      { type: "flowers", at: [1, 1, 4], face: "+y" },
      { type: "plant", at: [2, 1, -2], face: "+y", variant: "shrub" },
      { type: "tree", at: [7, 3, 3], face: "+y", h: 1.4 },
      { type: "finial", at: [1, 1, 0], face: "-y", s: 0.7 },
      { type: "waterfall", at: [7, 1, 4], face: "+x", len: 5 },
    ],
    solution: [["walk", "hub"], ["mech", "planter", 90], ["walk", "p1"], ["walk", "hub"], ["mech", "planter", 180], ["walk", "goal"]],
  });
  // 9. DAYBREAK I, "The Clockwork Stair": a clock-tower ring stair that climbs two floors and seems to meet its own
  //    foot. Wick starts at the ring's front corner; its front flight is broken (edge-on), so the only way up is to walk
  //    the ring's foot round into its top by looks (k = 2): the Penrose loop is the required aha. On top, the clock's
  //    great minute hand (a y-rotor) must first be swung against the platform's stair, boarded, then swung again so
  //    its far tip touches the beacon ledge.
  LEVELS.push({
    id: "clock-spiral",
    name: "The Clockwork Stair",
    chapter: 4,
    theme: "dawn",
    intro: "Climb long enough and the stair climbs back.",
    hint: "Where the stair begins, it also ends.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [
        { box: [0, -1, 0, 5, -1, 6], style: "darkstone", walk: false },
        { box: [1, -2, 1, 4, -2, 5], style: "darkstone", walk: false },
        // the ring, wound inwards: along the back and down the right side (level), then the broken front flight,
        // then west and north, climbing two floors to its top
        { box: [0, 0, 0, 5, 0, 0], style: "sandstone" },
        { box: [5, 0, 1, 5, 0, 6], style: "sandstone" },
        { at: [5, 0, 6], style: "brick", id: "start" },
        { at: [4, 0, 6], style: "sandstone" },
        { at: [3, 0, 6], style: "darkstone", walk: false },
        { stair: [3, 1, 6], up: "+x", style: "sandstone" },            // the broken flight: edge-on, never walkable
        { at: [2, 1, 6], style: "marble", id: "g3" },                   // reached only by walking DOWN from the top
        { at: [2, 1, 5], style: "sandstone" },
        { box: [2, 0, 3, 2, 0, 6], style: "darkstone", walk: false },
        { box: [2, 1, 3, 2, 1, 4], style: "darkstone", walk: false },
        { stair: [2, 2, 4], up: "-z", style: "sandstone" },
        { at: [2, 2, 3], style: "brick", id: "top" },
        { at: [4, 0, 7], style: "marble", id: "g1" },                   // front spur off the ring
        { at: [4, -1, 7], style: "darkstone", walk: false },
        // the clock well and the dial platform (tops y=3)
        { box: [3, 0, 1, 4, 1, 5], style: "brick", walk: false },
        { box: [3, 0, 3, 4, 0, 5], style: "sandstone", walk: false },
        { box: [3, 2, 3, 4, 2, 5], style: "sandstone" },
        { at: [3, 2, 5], style: "sandstone", id: "platform" },
        { stair: [4, 3, 3], up: "-z", style: "sandstone" },              // up to the minute hand when it points here
        { box: [4, 2, 1, 4, 2, 2], style: "brass", walk: false },        // the hand's spindle
        { at: [4, 2, 0], style: "brass", walk: false },
        // the beacon ledge, hanging in the air behind the clock (tops y=4), and the tower behind it
        { box: [1, 3, 1, 2, 3, 1], style: "sandstone" },
        { at: [1, 3, 1], style: "sandstone", id: "goal" },
        { box: [1, 3, 0, 1, 4, 0], style: "marble", walk: false },      // beacon plinth
        { box: [0, 1, -2, 1, 8, -1], style: "sandstone", walk: false }, // the clock tower spine
        { box: [0, 5, -2, 1, 5, -1], style: "brick", walk: false },
        { box: [0, 9, -2, 1, 9, -1], style: "slate", walk: false },
        { at: [4, 2, -1], style: "marble", id: "g2" },                   // a perch only the hand's tip can reach
      ] },
      { id: "hand",
        rotor: { axis: "y", pivot: [4.5, 0, 1.5], angles: [0, 90], start: 90 },
        handle: { type: "crank", at: [4, 2, 5], face: "+x", on: "base" },
        blocks: [
          { box: [4, 3, 0, 4, 3, 2], style: "wood" },
          { at: [4, 3, 1], style: "brass", id: "hub" },
        ] },
    ],
    glimmers: ["g1", "g2", "g3"],
    decor: [
      { type: "beacon", at: [1, 4, 0], face: "+y" },
      { type: "keel", at: [1, -2, 1], face: "-y", w: 4, d: 5, depth: 4 },
      { type: "keel", at: [0, 1, -2], face: "-y", w: 2, d: 2, depth: 2 },
      { type: "clock", at: [4, 1, 5], face: "+z", r: 0.42 },
      { type: "clock", at: [1, 7, -1], face: "+z", r: 0.45 },
      { type: "clock", at: [1, 6, -2], face: "+x", r: 0.38 },
      { type: "dome", at: [0, 9, -2], face: "+y", r: 1.4 },
      { type: "finial", at: [1, 9, -1], face: "+y" },
      { type: "dial", at: [4, 3, 1], face: "+y", r: 0.6, group: "hand" },
      { type: "gear", at: [4, 2, 2], face: "+x", r: 0.4, group: "base" },
      { type: "gear", at: [3, 0, 5], face: "+z", r: 0.5 },
      { type: "gear", at: [4, 0, 3], face: "+x", r: 0.45, tint: "patina" },
      { type: "gear", at: [2, 0, 6], face: "+z", r: 0.4, tint: "patina" },
      { type: "gear", at: [4, 1, 2], face: "+x", r: 0.3, tint: "iron" },
      { type: "pipe", at: [4, 1, 4], face: "+x", len: 3, dir: "-z" },
      { type: "chain", at: [4, 3, 0], from: [4.5, 3.9, 0.1], to: [4.5, 3.9, 2.9], group: "hand", sag: 0.12 },
      // the broken flight: weeds and creepers where the steps fell away
      { type: "plant", at: [3, 1, 6], face: "+z", variant: "tuft" },
      { type: "vines", at: [3, 1, 6], face: "+z", len: 1.5, count: 4 },
      { type: "ivy", at: [3, 0, 6], face: "+z", density: 1.4 },
      { type: "plant", at: [3, 0, 6], face: "+y", variant: "tuft" },
      { type: "rubble", at: [3, 1, 6], face: "+y" },
      // lanterns, mostly unlit
      { type: "lantern", at: [0, 0, 0], face: "+z" },
      { type: "lantern", at: [5, 0, 3], face: "+x" },
      { type: "lantern", at: [4, 0, 6], face: "+z" },
      { type: "lantern", at: [2, 1, 5], face: "+x" },
      { type: "lantern", at: [4, 2, 5], face: "+z" },
      { type: "lantern", at: [2, 3, 1], face: "+z" },
      { type: "lantern", at: [1, 4, -1], face: "+z" },
      { type: "streetlamp", at: [3, 2, 5], face: "+y" },
      { type: "window", at: [4, 0, 2], face: "+x" },
      { type: "window", at: [4, 1, 4], face: "+x" },
      { type: "window", at: [2, 0, 5], face: "+x" },
      { type: "window", lit: true, at: [3, 1, 5], face: "+z" },
      { type: "window", at: [1, 3, -1], face: "+z" },
      { type: "window", at: [1, 4, -2], face: "+x" },
      { type: "banner", at: [0, 6, -1], face: "+z", color: "gold" },
      { type: "banner", at: [5, -1, 5], face: "+x", color: "crimson" },
      { type: "railing", at: [5, 0, 4], face: "+y", side: "+x" },
      { type: "railing", at: [5, 0, 2], face: "+y", side: "+x" },
      { type: "railing", at: [2, 3, 1], face: "+y", side: "+z" },
      { type: "railing", at: [4, 2, 5], face: "+y", side: "+z" },
      { type: "corbel", at: [2, 2, 1], face: "+z" },
      { type: "corbel", at: [4, -1, 6], face: "+z" },
      { type: "corbel", at: [0, 0, 1], face: "+z" },
      { type: "strut", at: [2, 3, 1], from: [2.0, 3.0, 1.5], to: [3.0, 2.0, 1.6] },
      { type: "strut", at: [1, 3, 1], from: [1.0, 3.0, 1.5], to: [0.5, 1.1, -1.0], style: "arch" },
      { type: "strut", at: [4, 2, -1], from: [4.5, 2.0, -0.5], to: [4.5, 2.0, 0.0] },
      { type: "ivy", at: [5, -1, 2], face: "+x" },
      { type: "ivy", at: [0, 2, -1], face: "+z" },
      { type: "vines", at: [3, 1, 3], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [5, -1, 6], face: "+z", len: 2, count: 2 },
      { type: "flowers", at: [4, 0, 7], face: "+y" },
      { type: "flowers", at: [2, 3, 1], face: "+y" },
      { type: "plant", at: [0, 0, 0], face: "+y", variant: "fern" },
      { type: "waterfall", at: [5, -1, 6], face: "+x", len: 5 },
    ],
    solution: [["mech", "hand", 0], ["walk", "hub"], ["mech", "hand", 90], ["walk", "goal"]],
  });
  // 10. DAYBREAK II, the finale: "Beacon Spire". Wick climbs from the bottom dock round the central shaft to the summit.
  //     Three mechanisms interact, and the lift plays three parts:
  //       - the ferry (y-rotor) swings from the dock to the lift when Wick steps on its bell-stone (a plate);
  //       - the lift's MIDDLE stop is the route: its car joins the back balcony only by looks (k = -1);
  //       - the lift's glass canopy is a veil: sent up EMPTY to the top stop, it hides the broken step from the
  //         crown up to the turret;
  //       - the turret (y-rotor) turns the last stair so it climbs away from you.
  LEVELS.push({
    id: "beacon-spire",
    name: "Beacon Spire",
    chapter: 4,
    theme: "dawn",
    intro: "The last lamp is the highest. Wake the whole spire to reach it.",
    hint: "The lift need not carry you all the way. What rides it when you don't?",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [
        // the central shaft and its crown (crown tiles y=4 on the left, a brick parapet on the right)
        { box: [1, -4, 1, 2, -4, 2], style: "darkstone", walk: false },
        { box: [0, -3, 0, 3, -2, 3], style: "darkstone", walk: false },  // foundation ring around the shaft foot
        { box: [3, -3, 4, 5, -2, 5], style: "darkstone", walk: false },
        { box: [2, -5, -4, 2, -4, -1], style: "darkstone", walk: false },
        { box: [-1, -3, -4, 1, -2, -4], style: "darkstone", walk: false },
        { box: [-1, 0, -3, -1, 2, -1], style: "brick", walk: false },
        { box: [-1, -1, -3, -1, -1, -1], style: "darkstone", walk: false },
        { box: [1, -3, 1, 2, 2, 2], style: "sandstone", walk: false },
        { box: [1, 0, 1, 2, 0, 2], style: "brick", walk: false },
        { box: [1, 3, 0, 1, 3, 2], style: "sandstone" },
        { at: [1, 3, 2], style: "sandstone", id: "crown" },
        { box: [2, 3, 0, 2, 3, 2], style: "brick", walk: false },
        // the bottom dock
        { box: [3, -1, 5, 5, -1, 5], style: "darkstone", walk: false },
        { box: [3, 0, 5, 5, 0, 5], style: "sandstone" },
        { at: [5, 0, 5], style: "brick", id: "start" },
        // the back balcony the lift's middle stop meets by looks, and the stair climb behind the shaft
        { at: [2, 1, -1], style: "brick", id: "balcony" },
        { box: [2, -3, -1, 2, 0, -1], style: "darkstone", walk: false },
        { at: [2, 1, -2], style: "brick" },
        { box: [2, -1, -2, 2, 0, -2], style: "darkstone", walk: false },
        { stair: [2, 2, -3], up: "-z", style: "sandstone" },
        { at: [2, 2, -4], style: "sandstone" },
        { box: [2, 0, -4, 2, 1, -3], style: "brick", walk: false },
        { stair: [1, 3, -4], up: "-x", style: "sandstone" },
        { at: [0, 3, -4], style: "sandstone" },
        { box: [-1, 3, -4, -1, 3, 0], style: "sandstone" },
        { at: [0, 3, 0], style: "sandstone" },
        { box: [-1, 0, -4, 1, 2, -4], style: "brick", walk: false },
        { box: [-1, -1, -4, 1, -1, -4], style: "darkstone", walk: false },
        // the summit: goal and beacon, and a glimmer ledge the turned stair can reach
        { at: [0, 5, 0], style: "marble", id: "goal" },
        { box: [0, 5, -1, 0, 6, -1], style: "marble", walk: false },     // beacon plinth
        { at: [-1, 5, 0], style: "sandstone" },
        { at: [-1, 5, -1], style: "marble", id: "g2" },                   // tucked behind the beacon
        { box: [-1, 6, -2, -1, 9, -2], style: "sandstone", walk: false }, // the slender spire behind the beacon
        { at: [-1, 10, -2], style: "copper", walk: false },
        // a balcony off the lift's top stop: reached only by riding all the way up
        { at: [3, 3, 2], style: "marble", id: "g1" },
      ] },
      { id: "lift",
        slider: { axis: "y", stops: [0, 2, 3], start: 3 },
        handle: { type: "knob", at: [1, 0, 2], face: "+z", on: "base" },
        blocks: [
          { at: [3, 0, 1], style: "brass", id: "car" },
          { at: [3, 2, 1], style: "column", kind: "veil" },                // the car's glass canopy
        ] },
      { id: "ferry",
        rotor: { axis: "y", pivot: [4.5, 0, 2.5], angles: [0, 180], start: 0 },
        blocks: [
          { at: [4, -1, 2], style: "brass", walk: false },
          { at: [4, 0, 2], style: "brass", id: "bell" },
          { box: [4, 0, 3, 4, 0, 4], style: "wood" },
        ] },
      { id: "turret",
        rotor: { axis: "y", pivot: [2.5, 0, 0.5], angles: [0, 90, 180, 270], start: 180 },
        handle: { type: "crank", at: [2, 3, 2], face: "+z", on: "base" },
        blocks: [
          { at: [2, 4, 0], style: "marble", id: "turretTop" },
          { stair: [1, 5, 0], up: "-x", style: "sandstone" },
        ] },
    ],
    plates: [ { tile: "bell", group: "ferry", step: 1 } ],
    glimmers: ["g1", "g2"],
    decor: [
      { type: "beacon", at: [0, 6, -1], face: "+y" },
      { type: "keel", at: [1, -4, 1], face: "-y", w: 2, d: 2, depth: 4 },
      { type: "keel", at: [3, -1, 5], face: "-y", w: 3, d: 1, depth: 2 },
      { type: "finial", at: [-1, 10, -2], face: "+y", s: 1.2 },
      { type: "clock", at: [2, 1, 2], face: "+z", r: 0.42 },
      { type: "clock", at: [-1, 8, -2], face: "+z", r: 0.3 },
      { type: "clock", at: [-1, 8, -2], face: "+x", r: 0.3 },
      // the lift: rail up the shaft, chains to the canopy, gears at the winding drum
      { type: "rail", at: [3, -1, 1], face: "+x", len: 6, dir: "+y" },
      { type: "chain", at: [3, 0, 1], from: [3.2, 1.0, 1.5], to: [3.2, 2.0, 1.5], group: "lift" },
      { type: "chain", at: [3, 0, 1], from: [3.8, 1.0, 1.5], to: [3.8, 2.0, 1.5], group: "lift" },
      { type: "gear", at: [2, -1, 2], face: "+x", r: 0.5, tint: "patina" },
      { type: "gear", at: [2, -2, 2], face: "+z", r: 0.35 },
      { type: "gear", at: [4, -1, 2], face: "+x", r: 0.4, group: "ferry" },
      { type: "pipe", at: [5, -1, 5], face: "+x", len: 3, dir: "-z" },
      { type: "pipe", at: [2, 0, 2], face: "+x", len: 3, dir: "+y" },
      // the turret: a dial on its top, a gear under it
      { type: "gear", at: [2, 3, 1], face: "+x", r: 0.35, tint: "patina" },
      // lanterns along the climb, mostly unlit
      { type: "lantern", at: [5, 0, 5], face: "+x" },
      { type: "lantern", at: [3, 0, 5], face: "+z" },
      { type: "lantern", at: [2, 1, -2], face: "+x" },
      { type: "lantern", at: [2, 2, -4], face: "+x" },
      { type: "lantern", at: [-1, 3, -1], face: "+z" },
      { type: "lantern", at: [1, 3, 2], face: "+z" },
      { type: "lantern", at: [0, 5, 0], face: "+z" },
      { type: "lantern", at: [2, 2, 2], face: "+x" },
      { type: "streetlamp", at: [4, 0, 5], face: "+y" },
      { type: "window", lit: true, at: [2, -1, 2], face: "+z" },
      { type: "window", at: [1, -1, 2], face: "+z" },
      { type: "window", at: [1, 1, 2], face: "+z" },
      { type: "window", at: [2, 1, 1], face: "+x" },
      { type: "window", at: [1, -2, 2], face: "+z" },
      { type: "window", at: [-1, 7, -2], face: "+x" },
      { type: "banner", at: [2, 0, 2], face: "+z", color: "crimson" },
      { type: "banner", at: [1, 2, -4], face: "+x", color: "gold" },
      { type: "railing", at: [-1, 3, -2], face: "+y", side: "-x" },
      { type: "railing", at: [-1, 3, -1], face: "+y", side: "-x" },
      { type: "railing", at: [2, 1, -2], face: "+y", side: "+x" },
      { type: "railing", at: [4, 0, 5], face: "+y", side: "+z" },
      { type: "railing", at: [1, 3, 2], face: "+y", side: "+z" },
      { type: "corbel", at: [2, 0, -1], face: "+x" },
      { type: "corbel", at: [1, 2, 2], face: "+z" },
      { type: "corbel", at: [1, 1, -4], face: "+z" },
      { type: "corbel", at: [4, -1, 5], face: "+z" },
      { type: "strut", at: [3, 3, 2], from: [3.5, 3.0, 2.5], to: [2.9, 2.0, 2.5] },
      { type: "strut", at: [0, 5, 0], from: [0.5, 5.0, 0.5], to: [1.0, 4.0, 0.5] },
      { type: "strut", at: [-1, 5, 0], from: [-0.5, 5.0, 0.0], to: [-0.5, 4.0, -1.5] },
      { type: "corbel", at: [-1, 5, 0], face: "+z" },
      { type: "strut", at: [-1, 6, -2], from: [-0.5, 6.0, -1.5], to: [0.0, 6.0, -1.0] },
      { type: "strut", at: [3, -1, 5], from: [3.0, -0.5, 5.0], to: [2.9, -0.5, 2.9], style: "arch" },
      { type: "ivy", at: [2, -2, 2], face: "+x" },
      { type: "ivy", at: [1, 2, -4], face: "+z" },
      { type: "ivy", at: [-1, 2, -4], face: "+z" },
      { type: "vines", at: [2, 0, -1], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [5, -1, 5], face: "+z", len: 2, count: 3 },
      { type: "flowers", at: [3, 0, 5], face: "+y" },
      { type: "flowers", at: [1, 3, 0], face: "+y" },
      { type: "flowers", at: [3, 3, 2], face: "+y" },
      { type: "plant", at: [-1, 3, -4], face: "+y", variant: "fern" },
      { type: "waterfall", at: [5, 0, 5], face: "+z", len: 5 },
    ],
    solution: [["walk", "bell"], ["mech", "lift", 0], ["walk", "car"], ["mech", "lift", 2], ["walk", "balcony"],
      ["mech", "lift", 3], ["mech", "turret", 0], ["walk", "goal"]],
  });
})();
