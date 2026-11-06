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

  // 6. LANTERNS III: a clock-tower dock with two drawbridges, one hinged on the z axis, one on the x axis.
  //    The second one only looks joined to the far ledge (k = -1). A rotor on x or z cannot turn while Wick stands on it.
  LEVELS.push({
    id: "twin-drawbridges",
    name: "Twin Drawbridges",
    chapter: 2,
    theme: "night",
    intro: "Raised bridges sleep. Wake them one at a time.",
    hint: "Crank a bridge down and cross. A bridge will not budge while Wick is standing on it.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(0, 2, 3, 3, -1),
        taper(7, 2, 9, 3, -1),
        taper(7, -4, 9, -1, -2),
        [
          { box: [0, -1, 2, 3, -1, 3], style: "darkstone", walk: false },
          { box: [7, -1, 2, 9, -1, 3], style: "darkstone", walk: false },
          { box: [7, -2, -4, 9, -2, -1], style: "darkstone", walk: false },
          { box: [0, 0, 2, 3, 0, 3], style: "sandstone" },                // start dock (tops y=1)
          { at: [0, 0, 3], style: "brick", id: "start" },
          { at: [0, 1, 2], style: "brass", walk: false },                  // crank post A
          { box: [0, 0, 0, 2, 3, 1], style: "sandstone", walk: false },   // clock tower behind the dock
          { box: [0, 4, 0, 2, 4, 1], style: "slate", walk: false },
          { box: [7, 0, 2, 9, 0, 3], style: "sandstone" },                // island (tops y=1)
          { at: [9, 1, 3], style: "brass", walk: false },                  // crank post B
          { at: [8, 0, 2], style: "sandstone", id: "isle" },
          { box: [8, 0, 4, 9, 0, 4], style: "sandstone", walk: false },
          // far ledge, one lower and one cell back: joined to bridge B only by looks (k = -1)
          { box: [7, -1, -4, 7, -1, -2], style: "sandstone" },
          { at: [7, -1, -4], style: "sandstone", id: "goal" },
          { box: [8, -1, -3, 9, -1, -3], style: "sandstone" },
          { at: [9, -1, -3], style: "marble", id: "g1" },
          { box: [7, -1, -5, 7, 0, -5], style: "marble", walk: false },   // beacon plinth
          { box: [6, -1, -5, 6, 1, -3], style: "brick", walk: false },    // wall at the back
        ]) },
      { id: "drawA",
        rotor: { axis: "z", pivot: [4, 1, 0], angles: [0, 90], start: 90 },
        handle: { type: "crank", at: [0, 1, 2], face: "+y", on: "base" },
        blocks: [ { box: [4, 0, 2, 6, 0, 3], style: "wood" } ] },
      { id: "drawB",
        rotor: { axis: "x", pivot: [0, 1, 2], angles: [0, 90], start: 90 },
        handle: { type: "crank", at: [9, 1, 3], face: "+y", on: "base" },
        blocks: [ { box: [8, 0, 0, 8, 0, 1], style: "wood" } ] },
    ],
    glimmers: ["g1"],
    decor: [
      { type: "beacon", at: [7, 0, -5], face: "+y" },
      { type: "clock", at: [1, 3, 1], face: "+z", r: 0.42 },
      { type: "clock", at: [2, 2, 1], face: "+x", r: 0.3 },
      { type: "gear", at: [3, 0, 2], face: "+x", r: 0.5, tint: "patina" },
      { type: "gear", at: [4, 0, 3], face: "+z", r: 0.35, group: "drawA" },
      { type: "pipe", at: [3, 1, 1], face: "+x", len: 2, dir: "+z" },
      { type: "chimney", at: [2, 4, 1], face: "+y" },
      { type: "lantern", at: [3, 0, 3], face: "+z" },
      { type: "lantern", at: [0, 0, 3], face: "+z" },
      { type: "lantern", at: [9, 0, 3], face: "+z" },
      { type: "lantern", at: [7, 0, 3], face: "+z" },
      { type: "lantern", at: [7, -1, -2], face: "+z" },
      { type: "streetlamp", at: [2, 0, 3], face: "+y" },
      { type: "window", lit: true, at: [1, 1, 1], face: "+z" },
      { type: "window", at: [2, 1, 1], face: "+x" },
      { type: "window", at: [0, 2, 1], face: "+z" },
      { type: "window", at: [6, 0, -3], face: "+x" },
      { type: "banner", at: [9, 0, 4], face: "+z", color: "teal" },
      { type: "ivy", at: [2, 1, 1], face: "+z" },
      { type: "ivy", at: [3, -1, 3], face: "+x" },
      { type: "ivy", at: [9, -1, 3], face: "+x" },
      { type: "vines", at: [1, -1, 3], face: "+z", len: 2, count: 3 },
      { type: "flowers", at: [1, 0, 3], face: "+y" },
      { type: "flowers", at: [8, 0, 3], face: "+y" },
      { type: "flowers", at: [8, -1, -3], face: "+y" },
      { type: "plant", at: [9, -1, -3], face: "+y", variant: "tuft" },
      { type: "waterfall", at: [9, 0, 4], face: "+x", len: 5 },
      { type: "finial", at: [0, 4, 0], face: "+y" },
      { type: "finial", at: [8, -3, -2], face: "-y" },
    ],
    solution: [["mech", "drawA", 0], ["walk", "isle"], ["mech", "drawB", 0], ["walk", "goal"]],
  });
  // 7. VEILS I: an observatory. A floating pillar (a veil) rides a turntable. Stairs that climb TOWARD the viewer
  //    look broken, but behind the pillar the join is hidden and Wick walks straight through.
  LEVELS.push({
    id: "veiled-steps",
    name: "The Veiled Steps",
    chapter: 3,
    theme: "aurora",
    intro: "What the pillar hides, the path remembers.",
    hint: "Turn the dial until the pillar stands in front of the broken stair. Wick walks behind it.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(1, 4, 3, 6, -1),
        taper(4, 4, 6, 6, 0),
        taper(5, 0, 5, 3, 0),
        [
          { box: [1, -1, 4, 3, -1, 6], style: "darkstone", walk: false },
          { box: [1, 0, 4, 3, 0, 6], style: "sandstone" },                  // courtyard (tops y=1)
          { at: [1, 0, 6], style: "brick", id: "start" },
          { box: [0, 0, 0, 3, 4, 3], style: "sandstone", walk: false },     // observatory body
          { box: [0, 3, 0, 3, 3, 3], style: "brick", walk: false },
          { box: [0, 5, 0, 3, 5, 3], style: "slate", walk: false },
          { box: [1, 6, 1, 2, 6, 2], style: "copper", walk: false },        // dome seat
          { at: [4, 0, 3], style: "darkstone", walk: false },               // under the ledge
          { box: [4, 1, 3, 4, 1, 4], style: "sandstone" },                  // ledge (tops y=2)
          { at: [4, 1, 3], style: "sandstone", id: "ledge" },
          { box: [6, 0, 1, 6, 1, 1], style: "darkstone", walk: false },
          { at: [6, 2, 1], style: "marble", id: "g1" },                     // glimmer balcony off the upper walk
                    { box: [5, 0, 0, 5, 1, 3], style: "brick", walk: false },         // pier under the upper walk
          { box: [5, 2, 0, 5, 2, 3], style: "sandstone" },                  // upper walk (tops y=3)
          { at: [5, 2, 0], style: "sandstone", id: "goal" },
          { box: [5, 2, -1, 5, 3, -1], style: "marble", walk: false },      // beacon plinth
        ]) },
      { id: "dial",
        rotor: { axis: "y", pivot: [5.5, 0, 5.5], angles: [0, 90, 180, 270], start: 180 },
        handle: { type: "wheel", at: [5, 3, 5], face: "+y", on: "self" },
        blocks: [
          { box: [4, 0, 4, 6, 0, 6], style: "brass", walk: false },         // turntable
          { box: [5, 1, 5, 5, 3, 5], style: "brass", walk: false },         // spindle
          { at: [6, 3, 6], style: "column", kind: "veil" },                 // the pillar
        ] },
    ],
    glimmers: ["g1"],
    decor: [
      { type: "beacon", at: [5, 3, -1], face: "+y" },
      { type: "dome", at: [1, 6, 1], face: "+y", r: 1.6 },
      { type: "finial", at: [2, 6, 2], face: "+y" },
      { type: "gear", at: [4, 0, 6], face: "+z", r: 0.5, group: "dial" },
      { type: "gear", at: [6, 0, 5], face: "+x", r: 0.4, group: "dial", tint: "patina" },
      { type: "lantern", at: [3, 0, 6], face: "+z" },
      { type: "lantern", at: [1, 0, 6], face: "+z" },
      { type: "lantern", at: [4, 1, 4], face: "+z" },
      { type: "lantern", at: [5, 2, 3], face: "+z" },
      { type: "streetlamp", at: [2, 0, 5], face: "+y" },
      { type: "window", lit: true, at: [3, 1, 3], face: "+z" },
      { type: "window", at: [2, 1, 3], face: "+z" },
      { type: "window", at: [1, 1, 3], face: "+z" },
      { type: "window", at: [3, 3, 3], face: "+x" },
      { type: "window", at: [2, 3, 3], face: "+z" },
      { type: "window", at: [3, 4, 3], face: "+x" },
      { type: "clock", at: [1, 4, 3], face: "+z", r: 0.4 },
      { type: "banner", at: [0, 2, 3], face: "+z", color: "plum" },
      { type: "banner", at: [3, 2, 2], face: "+x", color: "gold" },
      { type: "ivy", at: [0, 0, 3], face: "+z" },
      { type: "ivy", at: [5, 1, 3], face: "+z" },
      { type: "ivy", at: [5, 0, 2], face: "+x" },
      { type: "vines", at: [2, -1, 6], face: "+z", len: 2, count: 3 },
      { type: "flowers", at: [2, 0, 4], face: "+y" },
      { type: "flowers", at: [3, 0, 5], face: "+y" },
      { type: "flowers", at: [6, 2, 1], face: "+y" },
      { type: "plant", at: [5, 2, 1], face: "+y", variant: "fern" },
      { type: "railing", at: [4, 1, 4], face: "+y", side: "+x" },
      { type: "waterfall", at: [4, 1, 4], face: "+z", len: 4 },
      { type: "finial", at: [5, -2, 5], face: "-y" },
    ],
    solution: [["mech", "dial", 0], ["walk", "ledge"], ["mech", "dial", 90], ["walk", "goal"]],
  });
  // 8. VEILS II: a greenhouse spire. Combines a rotating bridge (impossible join, k = -1), a pressure plate that
  //    raises the missing floor, and a sliding pillar (a veil) that must be pushed in front of a broken stair.
  LEVELS.push({
    id: "greenhouse-spire",
    name: "Greenhouse Spire",
    chapter: 3,
    theme: "aurora",
    intro: "The garden grew where the stair gave up.",
    hint: "Three small ideas, one after the other: the bridge, the stone that moves the floor, and the pillar.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(3, 3, 5, 5, 0),
        taper(-5, -2, 3, -1, -1),
        [
          { box: [3, 0, 3, 5, 1, 5], style: "darkstone", walk: false },    // main tower body
          { box: [3, 2, 3, 5, 2, 5], style: "sandstone" },                 // main platform (tops y=3)
          { at: [5, 2, 5], style: "sandstone", id: "start" },
          { at: [3, 3, 4], style: "brass", walk: false },                  // crank post
          { box: [3, 3, 3, 3, 4, 3], style: "brick", walk: false },       // little chimney stack
          { box: [1, 0, 2, 1, 1, 2], style: "darkstone", walk: false },    // glimmer perch
          { at: [1, 2, 2], style: "marble", id: "g1" },
          { box: [1, 0, -2, 3, 0, -2], style: "darkstone", walk: false },  // far walkway (tops y=2)
          { box: [1, 1, -2, 3, 1, -2], style: "brick" },
          { at: [3, 1, -2], style: "brick", id: "farEnd" },
          { at: [1, 1, -2], style: "brass", id: "p1" },                     // plate
          { box: [-2, 0, -2, -1, 0, -2], style: "darkstone", walk: false },
          { box: [-2, 1, -2, -1, 1, -2], style: "brick" },
          { box: [-4, 0, -1, -2, 1, -1], style: "sandstone", walk: false }, // greenhouse floor block
          { box: [-4, 2, -1, -2, 2, -1], style: "sandstone" },              // upper walk (tops y=3), the far side of the veiled stair
          { at: [-4, 2, -1], style: "sandstone", id: "goal" },
          { box: [-3, 0, 0, -3, 1, 0], style: "darkstone", walk: false },
          { at: [-3, 2, 0], style: "marble", id: "g2" },                    // glimmer balcony
          { box: [-5, 2, -1, -5, 3, -1], style: "marble", walk: false },    // beacon plinth
          { box: [-5, 0, -2, -5, 1, -2], style: "hedge", walk: false },
          { box: [-4, 3, -2, -2, 5, -2], style: "hedge", walk: false },     // glasshouse hedge wall
          { box: [-4, 6, -2, -2, 6, -2], style: "copper", walk: false },
        ]) },
      { id: "bridge",
        rotor: { axis: "y", pivot: [4.5, 0, 2.5], angles: [0, 90, 180], start: 0 },
        handle: { type: "crank", at: [3, 3, 4], face: "+y", on: "base" },
        blocks: [
          { at: [4, 2, 2], style: "brass", id: "hub" },
          { box: [5, 2, 2, 6, 2, 2], style: "wood" },
        ] },
      { id: "lift",
        slider: { axis: "y", stops: [0, 1], start: 0 },
        blocks: [ { at: [0, 0, -2], style: "brass", id: "lift" } ] },
      { id: "pillar",
        slider: { axis: "x", stops: [0, 2], start: 2 },
        handle: { type: "knob", at: [3, 1, 5], face: "+z", on: "base" },
        blocks: [ { at: [-1, 3, 0], style: "column", kind: "veil" } ] },
    ],
    plates: [ { tile: "p1", group: "lift", to: 1 } ],
    glimmers: ["g1", "g2"],
    decor: [
      { type: "beacon", at: [-5, 3, -1], face: "+y" },
      { type: "dome", at: [-3, 6, -2], face: "+y", r: 1.6 },
      { type: "lantern", at: [5, 2, 3], face: "+x" },
      { type: "lantern", at: [3, 1, -2], face: "+z" },
      { type: "lantern", at: [-1, 1, -2], face: "+z" },
      { type: "lantern", at: [-4, 2, -1], face: "+z" },
      { type: "streetlamp", at: [4, 2, 5], face: "+y" },
      { type: "gear", at: [4, 2, 2], face: "+z", r: 0.4, group: "bridge" },
      { type: "gear", at: [3, 1, 3], face: "+z", r: 0.5, tint: "patina" },
      { type: "window", lit: true, at: [3, 2, 4], face: "+x" },
      { type: "window", at: [4, 1, 5], face: "+z" },
      { type: "window", at: [-3, 1, -1], face: "+z" },
      { type: "window", at: [-4, 1, -1], face: "+z" },
      { type: "banner", at: [5, 1, 5], face: "+x", color: "teal" },
      { type: "banner", at: [-2, 1, -1], face: "+z", color: "gold" },
      { type: "chimney", at: [3, 4, 3], face: "+y" },
      { type: "ivy", at: [4, 0, 5], face: "+z" },
      { type: "ivy", at: [5, 0, 4], face: "+x" },
      { type: "ivy", at: [-1, 0, -2], face: "+z" },
      { type: "vines", at: [2, 0, -2], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [1, 0, 2], face: "+z", len: 2, count: 2 },
      { type: "flowers", at: [1, 2, 2], face: "+y" },
      { type: "flowers", at: [-3, 2, 0], face: "+y" },
      { type: "flowers", at: [4, 2, 4], face: "+y" },
      { type: "plant", at: [2, 1, -2], face: "+y", variant: "shrub" },
      { type: "tree", at: [-2, 2, -1], face: "+y", h: 1.6 },
      { type: "waterfall", at: [5, 1, 5], face: "+z", len: 5 },
      { type: "finial", at: [4, -2, 4], face: "-y" },
    ],
    solution: [["mech", "bridge", 90], ["walk", "p1"], ["mech", "pillar", 0], ["walk", "goal"]],
  });
  // 9. DAYBREAK I: a clock-tower spiral. The ring stair climbs two floors and seems to meet its own foot
  //    (an impossible loop, k = -2: the infinite stair, joined at a back edge). The way on leaves the top of the
  //    ring: a rotating bridge (k = -1), a plate-driven lift, and a drawbridge hinged on the z axis.
  LEVELS.push({
    id: "clock-spiral",
    name: "The Clockwork Stair",
    chapter: 4,
    theme: "dawn",
    intro: "Climb long enough and the stair climbs back.",
    hint: "The ring stair has no top that you can see. Follow it round and keep going.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(0, 0, 5, 6, -1),
        taper(-6, -2, -4, -2, 0),
        [
          { box: [0, -1, 0, 5, -1, 6], style: "darkstone", walk: false },
          // the ring, wound inwards: east along the back, south along the right side (both level),
          // then west and north, climbing two floors to its top
          { box: [0, 0, 0, 5, 0, 0], style: "sandstone" },
          { at: [0, 0, 0], style: "brick", id: "start" },
          { box: [5, 0, 1, 5, 0, 6], style: "sandstone" },
          { at: [4, 0, 6], style: "sandstone" },
          { box: [3, 0, 6, 3, 0, 6], style: "darkstone", walk: false },
          { stair: [3, 1, 6], up: "-x", style: "sandstone" },
          { at: [2, 1, 6], style: "sandstone" },
          { at: [2, 1, 5], style: "sandstone" },
          { box: [2, 0, 3, 2, 0, 6], style: "darkstone", walk: false },
          { box: [2, 1, 3, 2, 1, 4], style: "darkstone", walk: false },
          { stair: [2, 2, 4], up: "-z", style: "sandstone" },
          { at: [2, 2, 3], style: "brick", id: "top" },
          { at: [4, 0, 7], style: "marble", id: "g1" },                     // front spur off the ring
          { box: [4, -1, 7, 4, -1, 7], style: "darkstone", walk: false },
          // the well and the upper platform
          { box: [3, 0, 1, 4, 1, 5], style: "sandstone", walk: false },
          { box: [3, 1, 3, 4, 1, 5], style: "brick", walk: false },
          { box: [3, 2, 3, 4, 2, 5], style: "sandstone" },                 // platform (tops y=3)
          { at: [4, 3, 5], style: "brass", walk: false },                  // crank post for the bridge
          { at: [5, 2, 4], style: "marble", id: "g2" },                    // balcony off the platform
          // far walkway (tops y=2), one lower and two cells back: the bridge meets it by looks only
          { box: [1, 0, -2, 3, 0, -2], style: "darkstone", walk: false },
          { box: [1, 1, -2, 3, 1, -2], style: "brick" },
          { at: [3, 1, -2], style: "brick", id: "farEnd" },
          { at: [1, 1, -2], style: "brass", id: "p1" },
          { at: [-1, 1, -2], style: "sandstone" },
          { box: [-1, 0, -2, -1, 0, -2], style: "darkstone", walk: false },
          { at: [0, -1, -2], style: "darkstone", walk: false },
          { at: [-1, 1, -3], style: "brass", walk: false },                // crank post for the drawbridge
          { at: [-1, 0, -3], style: "darkstone", walk: false },
          // the far island with the beacon
          { box: [-5, 0, -2, -4, 0, -2], style: "darkstone", walk: false },
          { box: [-5, 1, -2, -4, 1, -2], style: "sandstone" },
          { at: [-5, 1, -2], style: "sandstone", id: "goal" },
          { box: [-6, 1, -2, -6, 2, -2], style: "marble", walk: false },
        ]) },
      { id: "bridge",
        rotor: { axis: "y", pivot: [4.5, 0, 2.5], angles: [0, 90], start: 0 },
        handle: { type: "crank", at: [4, 3, 5], face: "+y", on: "base" },
        blocks: [
          { at: [4, 2, 2], style: "brass", id: "hub" },
          { box: [5, 2, 2, 6, 2, 2], style: "wood" },
        ] },
      { id: "lift",
        slider: { axis: "y", stops: [0, 1], start: 0 },
        blocks: [ { at: [0, 0, -2], style: "brass", id: "lift" } ] },
      { id: "draw",
        rotor: { axis: "z", pivot: [-1, 2, 0], angles: [0, 270], start: 270 },
        handle: { type: "crank", at: [-1, 1, -3], face: "+y", on: "base" },
        blocks: [ { box: [-3, 1, -2, -2, 1, -2], style: "wood" } ] },
    ],
    plates: [ { tile: "p1", group: "lift", to: 1 } ],
    glimmers: ["g1", "g2"],
    decor: [
      { type: "beacon", at: [-6, 2, -2], face: "+y" },
      { type: "clock", at: [4, 1, 5], face: "+z", r: 0.42 },
      { type: "gear", at: [3, 0, 5], face: "+z", r: 0.5 },
      { type: "gear", at: [4, 0, 3], face: "+x", r: 0.45, tint: "patina" },
      { type: "gear", at: [2, 0, 6], face: "+z", r: 0.4, tint: "patina" },
      { type: "lantern", at: [0, 0, 0], face: "+z" },
      { type: "lantern", at: [5, 0, 3], face: "+x" },
      { type: "lantern", at: [4, 0, 6], face: "+z" },
      { type: "lantern", at: [2, 1, 6], face: "+z" },
      { type: "lantern", at: [4, 2, 5], face: "+z" },
      { type: "lantern", at: [1, 1, -2], face: "+z" },
      { type: "lantern", at: [-4, 1, -2], face: "+z" },
      { type: "streetlamp", at: [3, 2, 5], face: "+y" },
      { type: "window", at: [4, 0, 2], face: "+x" },
      { type: "window", at: [4, 1, 4], face: "+x" },
      { type: "window", at: [2, 0, 5], face: "+x" },
      { type: "window", lit: true, at: [4, 1, 5], face: "+z" },
      { type: "window", at: [3, 1, -2], face: "+z" },
      { type: "banner", at: [3, 1, 5], face: "+z", color: "gold" },
      { type: "banner", at: [5, 0, 5], face: "+x", color: "crimson" },
      { type: "ivy", at: [5, 0, 2], face: "+x" },
      { type: "ivy", at: [2, 0, 4], face: "+z" },
      { type: "ivy", at: [-4, 0, -2], face: "+z" },
      { type: "vines", at: [3, 1, 3], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [5, 0, 5], face: "+z", len: 2, count: 2 },
      { type: "flowers", at: [5, 2, 4], face: "+y" },
      { type: "flowers", at: [4, 0, 7], face: "+y" },
      { type: "flowers", at: [-4, 1, -2], face: "+y" },
      { type: "plant", at: [0, 0, 0], face: "+y", variant: "fern" },
      { type: "chimney", at: [4, 1, 1], face: "+y" },
      { type: "waterfall", at: [5, 0, 6], face: "+x", len: 6 },
      { type: "finial", at: [2, -2, 3], face: "-y" },
    ],
    solution: [["mech", "bridge", 90], ["walk", "p1"], ["mech", "draw", 0], ["walk", "goal"]],
  });
  // 10. DAYBREAK II, the finale: Beacon Spire. Everything in one climb: a drawbridge, a lift, a rotating bridge
  //     (k = -1), a plate that raises the missing floor, a sliding pillar (veil) hiding a broken stair, and a last real stair.
  LEVELS.push({
    id: "beacon-spire",
    name: "Beacon Spire",
    chapter: 4,
    theme: "dawn",
    intro: "The last lamp is the highest. Wake the whole spire to reach it.",
    hint: "Work upward: drawbridge, lift, bridge, plate, pillar. Each part is one you have met before.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(3, 3, 5, 5, 0),
        taper(-5, -2, 3, -1, -1),
        taper(9, 3, 11, 5, -1),
        [
          { box: [3, 0, 3, 5, 1, 5], style: "darkstone", walk: false },    // main tower body
          { box: [3, 2, 3, 5, 2, 5], style: "sandstone" },                 // main platform (tops y=3)
          { at: [5, 2, 5], style: "sandstone", id: "deck" },
          { at: [3, 3, 4], style: "brass", walk: false },                  // crank post
          { box: [3, 3, 3, 3, 4, 3], style: "brick", walk: false },       // little chimney stack
          { box: [1, 0, 2, 1, 1, 2], style: "darkstone", walk: false },    // glimmer perch
          { at: [1, 2, 2], style: "marble", id: "g1" },
          { box: [1, 0, -2, 3, 0, -2], style: "darkstone", walk: false },  // far walkway (tops y=2)
          { box: [1, 1, -2, 3, 1, -2], style: "brick" },
          { at: [3, 1, -2], style: "brick", id: "farEnd" },
          { at: [1, 1, -2], style: "brass", id: "p1" },                     // plate
          { box: [-2, 0, -2, -1, 0, -2], style: "darkstone", walk: false },
          { box: [-2, 1, -2, -1, 1, -2], style: "brick" },
          { box: [-4, 0, -1, -2, 1, -1], style: "sandstone", walk: false }, // greenhouse floor block
          { box: [-4, 2, -1, -2, 2, -1], style: "sandstone" },              // upper walk (tops y=3), the far side of the veiled stair
          { stair: [-5, 3, -1], up: "-x", style: "sandstone" },
          { box: [-7, 3, -1, -6, 3, -1], style: "sandstone" },
          { at: [-7, 3, -1], style: "sandstone", id: "goal" },
          { box: [-8, 3, -1, -8, 4, -1], style: "marble", walk: false },    // beacon plinth
          { box: [-8, 0, -1, -5, 2, -1], style: "brick", walk: false },
          // dock, drawbridge and lift at the foot of the spire
          { box: [9, -1, 3, 11, -1, 5], style: "darkstone", walk: false },
          { box: [9, 0, 3, 11, 0, 5], style: "sandstone" },
          { at: [11, 0, 5], style: "brick", id: "start" },
          { at: [10, 1, 3], style: "brass", walk: false },                   // crank post for the drawbridge
          { box: [6, 0, 6, 6, 0, 6], style: "darkstone", walk: false },
          { at: [6, 1, 6], style: "marble", id: "g3" },                      // ledge off the lift's middle stop
          { box: [6, -1, 5, 6, -1, 5], style: "darkstone", walk: false },
          { box: [-3, 0, 0, -3, 1, 0], style: "darkstone", walk: false },
          { at: [-3, 2, 0], style: "marble", id: "g2" },                    // glimmer balcony
                    { box: [-5, 0, -2, -5, 1, -2], style: "hedge", walk: false },
          { box: [-4, 3, -2, -2, 5, -2], style: "hedge", walk: false },     // glasshouse hedge wall
          { box: [-4, 6, -2, -2, 6, -2], style: "copper", walk: false },
        ]) },
      { id: "bridge",
        rotor: { axis: "y", pivot: [4.5, 0, 2.5], angles: [0, 90, 180], start: 0 },
        handle: { type: "crank", at: [3, 3, 4], face: "+y", on: "base" },
        blocks: [
          { at: [4, 2, 2], style: "brass", id: "hub" },
          { box: [5, 2, 2, 6, 2, 2], style: "wood" },
        ] },
      { id: "lift",
        slider: { axis: "y", stops: [0, 1], start: 0 },
        blocks: [ { at: [0, 0, -2], style: "brass", id: "lift" } ] },
      { id: "draw",
        rotor: { axis: "z", pivot: [9, 1, 0], angles: [0, 270], start: 270 },
        handle: { type: "crank", at: [10, 1, 3], face: "+y", on: "base" },
        blocks: [ { box: [7, 0, 5, 8, 0, 5], style: "wood" } ] },
      { id: "elevator",
        slider: { axis: "y", stops: [0, 1, 2], start: 0 },
        handle: { type: "knob", at: [9, 0, 4], face: "-x", on: "base" },
        blocks: [ { at: [6, 0, 5], style: "brass", id: "elevTop" } ] },
      { id: "pillar",
        slider: { axis: "x", stops: [0, 2], start: 2 },
        handle: { type: "knob", at: [3, 1, 5], face: "+z", on: "base" },
        blocks: [ { at: [-1, 3, 0], style: "column", kind: "veil" } ] },
    ],
    plates: [ { tile: "p1", group: "lift", to: 1 } ],
    glimmers: ["g1", "g2", "g3"],
    decor: [
      { type: "beacon", at: [-8, 4, -1], face: "+y" },
      { type: "dome", at: [-3, 6, -2], face: "+y", r: 1.6 },
            { type: "lantern", at: [5, 2, 3], face: "+x" },
      { type: "lantern", at: [3, 1, -2], face: "+z" },
      { type: "lantern", at: [-1, 1, -2], face: "+z" },
      { type: "lantern", at: [-4, 2, -1], face: "+z" },
      { type: "streetlamp", at: [4, 2, 5], face: "+y" },
      { type: "gear", at: [4, 2, 2], face: "+z", r: 0.4, group: "bridge" },
      { type: "gear", at: [3, 1, 3], face: "+z", r: 0.5, tint: "patina" },
      { type: "window", lit: true, at: [3, 2, 4], face: "+x" },
      { type: "window", at: [4, 1, 5], face: "+z" },
      { type: "window", at: [-3, 1, -1], face: "+z" },
      { type: "window", at: [-4, 1, -1], face: "+z" },
      { type: "banner", at: [5, 1, 5], face: "+x", color: "teal" },
      { type: "banner", at: [-2, 1, -1], face: "+z", color: "gold" },
      { type: "chimney", at: [3, 4, 3], face: "+y" },
      { type: "ivy", at: [4, 0, 5], face: "+z" },
      { type: "ivy", at: [5, 0, 4], face: "+x" },
      { type: "ivy", at: [-1, 0, -2], face: "+z" },
      { type: "vines", at: [2, 0, -2], face: "+z", len: 2, count: 3 },
      { type: "vines", at: [1, 0, 2], face: "+z", len: 2, count: 2 },
      { type: "flowers", at: [1, 2, 2], face: "+y" },
      { type: "flowers", at: [-3, 2, 0], face: "+y" },
      { type: "lantern", at: [11, 0, 5], face: "+z" },
      { type: "lantern", at: [9, 0, 5], face: "+z" },
      { type: "lantern", at: [-7, 3, -1], face: "+z" },
      { type: "finial", at: [-8, 4, -1], face: "+y" },
      { type: "flowers", at: [10, 0, 5], face: "+y" },
      { type: "ivy", at: [11, -1, 5], face: "+x" },
      { type: "gear", at: [9, 0, 5], face: "+z", r: 0.45, tint: "patina" },
      { type: "flowers", at: [4, 2, 4], face: "+y" },
      { type: "plant", at: [2, 1, -2], face: "+y", variant: "shrub" },
      { type: "tree", at: [-2, 2, -1], face: "+y", h: 1.6 },
      { type: "waterfall", at: [5, 1, 5], face: "+z", len: 5 },
      { type: "finial", at: [4, -2, 4], face: "-y" },
    ],
    solution: [["mech", "draw", 0], ["walk", "elevTop"], ["mech", "elevator", 2], ["mech", "bridge", 90], ["walk", "p1"], ["mech", "pillar", 0], ["walk", "goal"]],
  });
})();
