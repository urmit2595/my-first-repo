/* SPIRELIGHT levels (design.md section 5). Designed by the level designer; see design/levels.md for intent,
 * solutions and glimmer locations. Check with: node tools/solve.js --all
 * The file is one IIFE so the small helpers below never leak.
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

  // strut / chain between two world points (the loader wants an integer `at`, so we give the start cell).
  function S(type, from, to, extra) {
    return Object.assign({ type: type, at: [Math.floor(from[0]), Math.floor(from[1]), Math.floor(from[2])], from: from, to: to }, extra || {});
  }

  // Decor helper: the same decor item at many cells.  D("lantern", [[x,y,z],...], "+z", { lit: true })
  function D(type, cells, face, extra) {
    return cells.map(function (c) { return Object.assign({ type: type, at: c, face: face }, extra || {}); });
  }

  // 1. Walking and stairs, no mechanisms. The glimmer teaches "look around the spire": it hides on a ledge behind the
  //    tower's back corner.
  LEVELS.push({
    id: "first-light",
    name: "First Light",
    chapter: 1,
    theme: "dusk",
    intro: "Every spire keeps one lamp.",
    hint: "Stone that is pale is stone you can stand on. The stairs lean away from you.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(0, 0, 4, 2, -1),
        [
          { box: [1, -1, 0, 4, -1, 2], style: "darkstone", walk: false },  // underside
          { box: [2, -2, 1, 3, -2, 1], style: "darkstone", walk: false },
          { box: [0, 0, 0, 4, 0, 2], style: "sandstone" },                 // lower terrace (tops at y=1)
          { box: [3, 0, 3, 4, 0, 3], style: "brick" },                     // front balcony
          { at: [4, 0, 3], style: "brick", id: "start" },
          { box: [0, 1, 0, 1, 2, 2], style: "sandstone" },                 // the tower (tops at y=3)
          { at: [2, 1, 1], style: "brick", walk: false },                  // landing under the upper stair
          { stair: [3, 1, 1], up: "-x", style: "sandstone", id: "stairLow" },
          { stair: [2, 2, 1], up: "-x", style: "sandstone", id: "stairHigh" },
          { at: [1, 2, 1], style: "sandstone", id: "goal" },
          { at: [0, 2, 0], style: "sandstone" },
          { box: [0, 0, -1, 0, 1, -1], style: "sandstone", walk: false },  // ledge behind the back corner
          { at: [0, 2, -1], style: "marble", id: "g1" },
          { at: [0, 3, 1], style: "marble", walk: false },                 // beacon plinth behind the goal
          { box: [-1, -1, 0, -1, 5, 1], style: "sandstone", walk: false }, // the spine
          { box: [-1, 3, 0, -1, 3, 1], style: "brick", walk: false },
          { at: [-1, 6, 1], style: "copper", walk: false },
        ]) },
    ],
    glimmers: ["g1"],
    decor: [].concat(
      [
        { type: "beacon", at: [0, 3, 1], face: "+y" },
        { type: "keel", at: [2, -2, 1], w: 4, d: 2, depth: 5 },
        { type: "dome", at: [-1, 5, 1], face: "+y", r: 1.0 },
        { type: "finial", at: [-1, 6, 1], face: "+y" },
        S("strut", [-0.6, 0.4, 0.5], [0.4, 0.9, 0.5]),
        S("strut", [-0.6, 2.0, 1.8], [0.4, 2.4, 2.1]),
        S("chain", [4.4, 0.0, 3.4], [3.5, -0.5, 2.5]),
        { type: "gear", at: [2, 1, 1], face: "+z", r: 0.4 },
        { type: "pipe", at: [2, 0, 2], face: "+y", dir: "-z", len: 2 },
        { type: "pipe", at: [3, 0, 0], face: "+y", dir: "-x", len: 2 },
        { type: "waterfall", at: [4, 0, 3], face: "+x", len: 6 },
        { type: "plant", at: [3, 0, 0], face: "+y", variant: "fern" },
        { type: "plant", at: [4, 0, 1], face: "+y", variant: "shrub" },
        { type: "banner", at: [0, 1, 2], face: "+z", color: "crimson" },
        { type: "banner", at: [-1, 3, 1], face: "+z", color: "gold" },
      ],
      D("lantern", [[4, 0, 0], [3, 0, 2], [3, 0, 3], [1, 2, 2], [-1, 1, 1]], "+z"),
      D("lantern", [[4, 0, 3], [4, 0, 1]], "+x", { lit: true }),
      D("window", [[1, 1, 2], [0, 2, 2], [2, 0, 2], [-1, 4, 1], [-1, 2, 1]], "+z"),
      D("window", [[-1, 4, 1], [-1, 5, 1], [1, 1, 0]], "+x", { lit: true }),
      D("ivy", [[1, 1, 2], [3, -1, 2], [0, 1, 2]], "+z"),
      D("ivy", [[4, 0, 2], [-1, 2, 1]], "+x"),
      D("vines", [[2, 0, 2], [3, 0, 3]], "+z", { len: 2, count: 3 }),
      D("flowers", [[3, 0, 3], [0, 2, 2], [4, 0, 2], [0, 2, -1]], "+y"),
      D("corbel", [[3, 0, 3], [4, 0, 3], [3, 0, 2], [0, 2, 2], [1, 2, 2]], "+z"),
      D("corbel", [[4, 0, 3], [4, 0, 1], [4, 0, 0]], "+x"),
      D("railing", [[3, 0, 3], [4, 0, 3]], "+y", { side: "+z" }),
      D("railing", [[4, 0, 3], [4, 0, 2]], "+y", { side: "+x" })
    ),
    solution: [["walk", "goal"]],
  });
  // 2. A y-rotor carries a stair, driven by a geared dial: turn it until the stair climbs away from the viewer.
  //    g1 and g2 sit on a ledge that only the turntable at 90 reaches.
  LEVELS.push({
    id: "turning-stair",
    name: "The Turning Stair",
    chapter: 1,
    theme: "dusk",
    intro: "Old stairs remember the way, if you turn them gently.",
    hint: "A stair is only a stair when it climbs away from you. Something here turns.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(3, 0, 5, 3, -1),
        [
          { box: [3, -1, 0, 5, -1, 3], style: "darkstone", walk: false },
          { box: [4, -2, 1, 5, -2, 2], style: "darkstone", walk: false },
          { box: [3, 0, 0, 5, 0, 3], style: "sandstone" },                 // lower court (tops at y=1)
          { box: [2, 0, 2, 2, 0, 3], style: "sandstone" },
          { at: [5, 0, 3], style: "sandstone", id: "start" },
          { at: [5, 1, 0], style: "brass", walk: false },                  // crank post
          { box: [0, 0, 1, 1, 1, 2], style: "brick" },                     // upper terrace (tops at y=2)
          { box: [0, -1, 1, 1, -1, 2], style: "darkstone", walk: false },
          { at: [0, 1, 2], style: "brick", id: "goal" },
          { at: [0, 2, 1], style: "marble", walk: false },                 // beacon plinth behind the goal
          { at: [2, 0, 0], style: "darkstone", walk: false },              // glimmer ledge
          { at: [2, 1, 0], style: "sandstone", id: "g1" },
          { at: [2, 0, -1], style: "darkstone", walk: false },             // and a second one behind it
          { at: [2, 1, -1], style: "marble", id: "g2" },
          { box: [-1, -1, 0, -1, 4, 1], style: "sandstone", walk: false }, // the spine
          { box: [-1, 2, 0, -1, 2, 1], style: "brick", walk: false },
          { at: [-1, 5, 1], style: "copper", walk: false },
        ]) },
      { id: "turntable",
        rotor: { axis: "y", pivot: [2.5, 0, 1.5], angles: [0, 90, 180, 270], start: 0 },
        handle: { type: "crank", at: [5, 1, 0], face: "+y", on: "base" },
        blocks: [
          { at: [2, 0, 1], style: "brass", walk: false },
          { stair: [2, 1, 1], up: "+x", style: "sandstone", id: "stair" },  // starts edge-on (rising +x)
        ] },
    ],
    glimmers: ["g1", "g2"],
    decor: [].concat(
      [
        { type: "beacon", at: [0, 2, 1], face: "+y" },
        { type: "keel", at: [4, -2, 1], w: 3, d: 4, depth: 5 },
        { type: "dial", at: [2, 0, 1], face: "+z", r: 0.46, group: "turntable" },
        { type: "gear", at: [2, 0, 1], face: "+x", r: 0.5, group: "turntable", tint: "patina" },
        { type: "gear", at: [5, 1, 0], face: "+z", r: 0.42, tint: "iron" },
        { type: "gear", at: [4, 0, 3], face: "+z", r: 0.5 },
        { type: "gear", at: [3, 0, 3], face: "+z", r: 0.34, tint: "patina" },
        S("chain", [5.5, 1.9, 0.5], [3.5, 1.0, 1.5]),
        { type: "pipe", at: [5, 0, 1], face: "+y", dir: "-z", len: 1 },
        { type: "pipe", at: [3, 0, 1], face: "+y", dir: "-x", len: 1 },
        S("strut", [-0.6, 0.2, 1.5], [0.5, 0.8, 1.5]),
        S("strut", [-0.6, 1.8, 0.8], [3.2, 0.2, 0.1]),
        { type: "dome", at: [-1, 4, 1], face: "+y", r: 1.0 },
        { type: "finial", at: [-1, 5, 1], face: "+y" },
        { type: "waterfall", at: [5, 0, 3], face: "+x", len: 6 },
        { type: "banner", at: [1, 0, 2], face: "+z", color: "plum" },
        { type: "banner", at: [-1, 2, 1], face: "+z", color: "gold" },
        { type: "plant", at: [4, 0, 0], face: "+y", variant: "shrub" },
        { type: "plant", at: [5, 0, 1], face: "+y", variant: "fern" },
      ],
      D("lantern", [[5, 0, 0], [1, 1, 2], [3, 0, 3], [-1, 1, 1]], "+z"),
      D("lantern", [[5, 0, 2]], "+x", { lit: true }),
      D("window", [[0, 0, 2], [0, 1, 2], [-1, 3, 1], [-1, 0, 1]], "+z", { lit: true }),
      D("window", [[1, 0, 2], [-1, 3, 1]], "+x"),
      D("ivy", [[1, 0, 2], [5, -1, 3]], "+z"),
      D("ivy", [[5, -1, 1], [1, -1, 1]], "+x"),
      D("vines", [[4, 0, 3], [2, 0, 3]], "+z", { len: 2, count: 3 }),
      D("flowers", [[2, 0, 3], [1, 1, 1], [5, 0, 2], [2, 1, -1]], "+y"),
      D("corbel", [[3, 0, 3], [4, 0, 3], [5, 0, 3], [2, 0, 3], [1, 1, 2]], "+z"),
      D("corbel", [[5, 0, 3], [5, 0, 2], [5, 0, 1]], "+x"),
      D("railing", [[3, 0, 3], [4, 0, 3], [5, 0, 3]], "+y", { side: "+z" }),
      D("railing", [[5, 0, 3], [5, 0, 2]], "+y", { side: "+x" })
    ),
    solution: [["mech", "turntable", 180], ["walk", "goal"]],
  });
  // 3. EMBERS III: a lighthouse. A slider lift: stand on it, drag the knob, ride it up (Wick rides sliders).
  LEVELS.push({
    id: "lamp-lift",
    name: "The Lamp Lift",
    chapter: 1,
    theme: "dusk",
    intro: "The keeper's stair was always a lift.",
    hint: "Brass on a rail wants company. Stand on it, then see what the knob beside it can do.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(0, 0, 3, 4, 0),
        [
          { box: [3, -1, 2, 4, -1, 2], style: "darkstone", walk: false },        // pit under the lift rail
          { box: [0, 0, 0, 3, 0, 4], style: "sandstone", walk: false },          // terrace
          { box: [0, 0, 4, 3, 0, 4], style: "sandstone" },                       // front walk (tops y=1)
          { box: [3, 0, 0, 3, 0, 3], style: "sandstone" },                       // right walk
          { at: [0, 0, 4], style: "brick", id: "start" },
          { box: [1, 1, 1, 2, 3, 3], style: "sandstone", walk: false },          // tower shaft
          { box: [1, 3, 1, 2, 3, 3], style: "brick", walk: false },              // corbel band
          // mid balcony (tops y=3): the lift's first stop
          { box: [3, 2, 1, 3, 2, 4], style: "sandstone" },
          { box: [1, 2, 4, 2, 2, 4], style: "sandstone" },
          { at: [1, 2, 4], style: "marble", id: "g1" },
          // gallery (tops y=5): second stop
          { box: [0, 4, 0, 3, 4, 4], style: "brick", walk: false },
          { box: [3, 4, 0, 3, 4, 4], style: "sandstone" },
          { at: [3, 4, 0], style: "marble", id: "g2" },                     // far end of the gallery
          { box: [0, 4, 4, 3, 4, 4], style: "sandstone" },
          { at: [1, 4, 4], style: "sandstone", id: "goal" },
          { box: [1, 5, 1, 2, 6, 3], style: "brick", walk: false },              // lamp room
          { box: [1, 7, 1, 2, 7, 3], style: "slate", walk: false },              // roof
          { at: [2, 7, 2], style: "copper", walk: false },
          { box: [-1, -1, 0, -1, 8, 2], style: "sandstone", walk: false },   // the spine pier
          { box: [-1, 4, 0, -1, 4, 2], style: "brick", walk: false },
          { box: [-1, 8, 0, -1, 8, 2], style: "slate", walk: false },
        ]) },
      { id: "lift",
        slider: { axis: "y", stops: [0, 2, 4], start: 0 },
        handle: { type: "knob", at: [3, 0, 3], face: "+x", on: "base" },
        blocks: [ { at: [4, 0, 2], style: "brass", id: "liftTop" } ] },
    ],
    glimmers: ["g1", "g2"],
    decor: [].concat(
      [
        { type: "beacon", at: [2, 7, 2], face: "+y" },
        { type: "dome", at: [2, 7, 2], face: "+y", r: 0.6 },
        { type: "keel", at: [2, -1, 2], w: 4, d: 5, depth: 6 },
        { type: "dome", at: [-1, 8, 1], face: "+y", r: 1.0 },
        { type: "finial", at: [-1, 8, 1], face: "+y" },
        { type: "finial", at: [1, 7, 1], face: "+y" },
        { type: "finial", at: [2, 7, 3], face: "+y" },
        S("strut", [-0.6, 4.2, 1.5], [0.6, 4.9, 1.5]),
        S("strut", [-0.6, 0.6, 1.5], [0.6, 0.8, 1.5]),
        S("strut", [0.4, 4.0, 0.4], [-0.5, 2.0, 0.8]),
        S("chain", [3.95, 4.2, 2.5], [3.95, 1.0, 2.5]),
        S("chain", [3.9, 4.0, 3.5], [3.9, 2.4, 3.5]),
        { type: "pipe", at: [3, 0, 3], face: "+y", dir: "+z", len: 1 },
        { type: "pipe", at: [2, 0, 4], face: "+y", dir: "-x", len: 2 },
        { type: "gear", at: [3, -1, 2], face: "+z", r: 0.45 },
        { type: "gear", at: [1, 0, 4], face: "+z", r: 0.4, tint: "patina" },
        { type: "banner", at: [1, 3, 3], face: "+z", color: "indigo" },
        { type: "banner", at: [2, 6, 3], face: "+z", color: "crimson" },
        { type: "waterfall", at: [0, 0, 4], face: "+z", len: 4 },
        { type: "plant", at: [3, 0, 0], face: "+y", variant: "fern" },
        { type: "plant", at: [3, 4, 0], face: "+y", variant: "shrub" },
        { type: "clock", at: [2, 6, 3], face: "+z", r: 0.4 },
      ],
      D("lantern", [[0, 0, 4], [3, 2, 4], [0, 4, 4], [2, 4, 4], [2, 2, 4]], "+z"),
      D("lantern", [[3, 0, 4], [3, 4, 4], [3, 2, 2]], "+x", { lit: true }),
      D("window", [[2, 1, 3], [2, 3, 3], [2, 5, 3], [1, 1, 3], [1, 5, 3], [2, 2, 3]], "+z"),
      D("window", [[2, 1, 2], [2, 3, 2], [2, 6, 2], [2, 5, 1]], "+x", { lit: true }),
      D("ivy", [[1, 1, 3], [0, 0, 3], [2, 3, 3]], "+z"),
      D("ivy", [[2, 2, 1], [3, 0, 2]], "+x"),
      D("vines", [[2, 2, 4], [1, 2, 4], [0, 4, 4]], "+z", { len: 2, count: 3 }),
      D("flowers", [[2, 0, 4], [2, 2, 4], [1, 4, 4], [3, 2, 3]], "+y"),
      D("corbel", [[1, 2, 4], [2, 2, 4], [2, 2, 4], [0, 4, 4], [2, 4, 4], [3, 4, 4]], "+z"),
      D("corbel", [[3, 2, 3], [3, 2, 2], [3, 4, 3], [3, 4, 1]], "+x"),
      D("railing", [[1, 2, 4], [2, 2, 4], [2, 2, 4], [0, 4, 4], [2, 4, 4]], "+y", { side: "+z" }),
      D("railing", [[3, 4, 4], [3, 4, 3], [3, 4, 1], [3, 2, 3]], "+y", { side: "+x" })
    ),
    solution: [["walk", "liftTop"], ["mech", "lift", 4], ["walk", "goal"]],
  });
  // 4. LANTERNS I (night): a rotating bridge that only *looks* connected to the far walkway at 90 degrees
  //    (impossible join, k = -1), then a plate raises a lift to the goal. The first illusion, after the lift lesson.
  LEVELS.push({
    id: "sky-bridge",
    name: "Sky Bridge",
    chapter: 2,
    theme: "night",
    intro: "What looks joined, is joined.",
    hint: "From where you stand, a gap is only a gap if there is something in it.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(3, 3, 5, 5, 0),
        taper(-2, -2, 3, -2, -1),
        [
          { box: [3, 0, 3, 5, 1, 5], style: "darkstone", walk: false },    // main tower body
          { box: [3, 2, 3, 5, 2, 5], style: "sandstone" },                 // main platform (tops at y=3)
          { at: [5, 2, 5], style: "sandstone", id: "start" },
          { at: [3, 3, 4], style: "brass", walk: false },                  // crank post (visible, on top)
          { box: [1, 0, -2, 3, 0, -2], style: "darkstone", walk: false },  // far walkway (tops at y=2)
          { box: [1, 1, -2, 3, 1, -2], style: "brick" },
          { at: [3, 1, -2], style: "brick", id: "farEnd" },
          { at: [1, 1, -2], style: "brass", id: "p1" },                     // pressure plate
          { box: [-2, 0, -2, -1, 0, -2], style: "darkstone", walk: false },
          { at: [-1, 1, -2], style: "brick", id: "goal" },
          { at: [-2, 1, -2], style: "marble", walk: false },               // beacon plinth behind the goal
          { at: [1, 1, 2], style: "darkstone", walk: false },              // glimmer perch
          { at: [1, 2, 2], style: "marble", id: "g1" },
          { box: [-3, -1, -3, -3, 6, -1], style: "sandstone", walk: false }, // the spine
          { box: [-3, 2, -3, -3, 2, -1], style: "brick", walk: false },
          { at: [-3, 7, -2], style: "copper", walk: false },
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
    ],
    plates: [ { tile: "p1", group: "lift", to: 1 } ],
    glimmers: ["g1"],
    decor: [].concat(
      [
        { type: "beacon", at: [-2, 1, -2], face: "+y" },
        { type: "keel", at: [4, 0, 4], w: 3, d: 3, depth: 6 },
        { type: "keel", at: [0, -1, -2], w: 5, d: 1, depth: 4 },
        { type: "dome", at: [-3, 6, -2], face: "+y", r: 1.0 },
        { type: "finial", at: [-3, 7, -2], face: "+y" },
        S("strut", [-2.6, 1.0, -1.5], [-1.4, 1.6, -1.5]),
        S("strut", [-2.6, 4.0, -1.0], [1.1, 1.8, 2.2]),
        S("strut", [-2.6, 2.4, -2.5], [1.0, 1.0, -2.0]),
        S("chain", [1.5, 1.0, -1.5], [0.5, 0.1, -1.5]),
        S("chain", [6.5, 2.1, 2.5], [5.1, 1.2, 3.1]),
        { type: "pipe", at: [2, 1, -2], face: "+y", dir: "-x", len: 1 },
        { type: "pipe", at: [5, 2, 3], face: "+y", dir: "-z", len: 1 },
        { type: "gear", at: [4, 2, 2], face: "+z", r: 0.4, group: "bridge" },
        { type: "gear", at: [3, 1, 5], face: "+z", r: 0.5, tint: "patina" },
        { type: "gear", at: [3, 3, 4], face: "+z", r: 0.3, tint: "iron" },
        { type: "banner", at: [4, 1, 5], face: "+z", color: "teal" },
        { type: "banner", at: [-3, 3, -1], face: "+z", color: "indigo" },
        { type: "waterfall", at: [5, 1, 5], face: "+x", len: 6 },
        { type: "plant", at: [2, 1, -2], face: "+y", variant: "tuft" },
        { type: "plant", at: [3, 2, 3], face: "+y", variant: "fern" },
        { type: "streetlamp", at: [4, 2, 4], face: "+y" },
      ],
      D("lantern", [[5, 2, 3], [3, 1, -2], [-1, 0, -2], [4, 1, 5], [1, 1, -2]], "+z"),
      D("lantern", [[5, 1, 4], [5, 2, 4]], "+x", { lit: true }),
      D("window", [[4, 0, 5], [3, 0, 5], [3, 1, 5], [-3, 4, -1], [-3, 1, -1]], "+z", { lit: true }),
      D("window", [[5, 0, 4], [-3, 3, -2], [-3, 5, -2]], "+x"),
      D("ivy", [[5, 1, 5], [2, 0, -2], [-3, 2, -1]], "+z"),
      D("ivy", [[5, 0, 3], [3, 0, -2]], "+x"),
      D("vines", [[3, 2, 5], [1, 1, -2]], "+z", { len: 2, count: 3 }),
      D("flowers", [[3, 2, 5], [1, 2, 2], [-1, 1, -2], [4, 2, 3]], "+y"),
      D("corbel", [[3, 2, 5], [4, 2, 5], [5, 2, 5], [1, 1, -2], [2, 1, -2], [3, 1, -2]], "+z"),
      D("corbel", [[5, 2, 4], [5, 2, 3], [3, 1, -2]], "+x"),
      D("railing", [[3, 2, 5], [4, 2, 5], [5, 2, 5]], "+y", { side: "+z" }),
      D("railing", [[5, 2, 5], [5, 2, 4], [5, 2, 3]], "+y", { side: "+x" })
    ),
    solution: [["mech", "bridge", 90], ["walk", "p1"], ["walk", "goal"]],
  });
  // 5. LANTERNS II: a bell tower built as a zig-zag climb. Two plates stand on the dock: one raises the hidden span,
  //    the other pulls it back (a decoy that costs a step). The upper plate is a counting plate: each step on it turns
  //    the chime arm one notch (180 > 0 > 90), so it must be stepped on twice.
  LEVELS.push({
    id: "chime-stair",
    name: "The Chime Stair",
    chapter: 2,
    theme: "night",
    intro: "Step softly. The old bells answer to the stones.",
    hint: "Two stones on the dock sound different notes. One bell needs to ring more than once.",
    start: "start",
    goal: "goal",
    groups: [
      { id: "base", blocks: [].concat(
        taper(0, 1, 2, 3, -1),
        taper(4, 1, 6, 3, -1),
        [
          { box: [0, -1, 1, 2, -1, 3], style: "darkstone", walk: false },
          { box: [4, -1, 1, 6, -1, 3], style: "darkstone", walk: false },
          // level 0: dock, hidden span, landing, lift
          { box: [0, 0, 1, 2, 0, 2], style: "sandstone" },                 // dock (tops y=1)
          { at: [0, 0, 2], style: "brick", id: "start" },
          { at: [0, 0, 1], style: "brass", id: "p1" },                      // raises the span
          { at: [2, 0, 1], style: "brass", id: "pd" },                      // decoy: pulls the span back
          { box: [4, 0, 2, 5, 0, 3], style: "sandstone" },                 // landing B
          { box: [4, 0, 1, 6, 0, 1], style: "brick", walk: false },
          { at: [5, 0, 2], style: "sandstone", id: "landing" },
          { at: [7, 1, 2], style: "marble", id: "g1" },                     // ledge off the lift's middle stop
          { box: [7, 0, 2, 7, 0, 2], style: "darkstone", walk: false },
          { at: [6, -1, 2], style: "darkstone", walk: false },
          // level 2: back walk along z=0, then the arm, then the last stair
          { box: [3, 0, 0, 6, 1, 0], style: "sandstone", walk: false },
          { at: [6, 1, 1], style: "sandstone", walk: false },
          { box: [4, 2, 0, 6, 2, 0], style: "sandstone" },                 // walk C (tops y=3)
          { at: [6, 2, 1], style: "sandstone" },
          { at: [5, 2, 0], style: "brass", id: "p2" },                      // counting plate
          { at: [4, 2, 0], style: "sandstone", id: "c5" },
          { at: [1, 2, 0], style: "sandstone" },
          { box: [-1, 0, 0, 2, 1, 0], style: "brick", walk: false },
          { box: [-1, 2, 0, 0, 2, 0], style: "brick", walk: false },
          { stair: [0, 3, 0], up: "-x", style: "sandstone" },
          { at: [-1, 3, 0], style: "sandstone", id: "goal" },
          { box: [-2, 0, 0, -2, 4, 0], style: "marble", walk: false },     // beacon plinth
          // the spine: the bell shaft behind it all
          { box: [-2, -1, -2, 0, 7, -1], style: "sandstone", walk: false },
          { box: [-2, 4, -2, 0, 4, -1], style: "brick", walk: false },
          { box: [-2, 8, -2, 0, 8, -1], style: "slate", walk: false },
        ]) },
      { id: "span",
        slider: { axis: "y", stops: [0, 1], start: 0 },
        blocks: [ { box: [3, -1, 2, 3, -1, 3], style: "wood" } ] },
      { id: "lift",
        slider: { axis: "y", stops: [0, 1, 2], start: 0 },
        handle: { type: "knob", at: [5, 0, 3], face: "+z", on: "base" },
        blocks: [ { at: [6, 0, 2], style: "brass", id: "liftTop" } ] },
      { id: "arm",
        rotor: { axis: "y", pivot: [2.5, 0, 0.5], angles: [0, 90, 180], start: 180 },
        blocks: [
          { at: [2, 2, 0], style: "brass", id: "hub" },
          { box: [2, 2, 1, 2, 2, 1], style: "brass" },
        ] },
    ],
    plates: [
      { tile: "p1", group: "span", to: 1 },
      { tile: "pd", group: "span", to: 0 },
      { tile: "p2", group: "arm", step: 1 },
    ],
    glimmers: ["g1"],
    decor: [].concat(
      [
        { type: "beacon", at: [-2, 4, 0], face: "+y" },
        { type: "keel", at: [3, -1, 2], w: 7, d: 3, depth: 6 },
        { type: "bell", at: [-1, 8, -1], face: "+y" },
        { type: "dome", at: [-2, 8, -2], face: "+y", r: 0.9 },
        { type: "finial", at: [0, 8, -1], face: "+y" },
        { type: "clock", at: [0, 6, -1], face: "+z", r: 0.4 },
        S("strut", [0.4, 0.4, 1.5], [-0.6, 0.8, 0.0]),
        S("strut", [3.0, 2.0, -0.2], [0.6, 3.6, -0.5]),
        S("strut", [6.6, 1.0, 2.4], [6.6, 2.6, 1.2]),
        S("chain", [0.5, 1.0, 1.5], [3.5, -0.2, 2.5]),
        S("chain", [6.5, 2.0, 1.5], [6.5, 0.6, 2.5]),
        S("chain", [2.5, 3.0, 0.6], [2.5, 1.1, 2.5]),
        { type: "pipe", at: [1, 0, 1], face: "+y", dir: "-z", len: 1 },
        { type: "pipe", at: [4, 0, 1], face: "+y", dir: "+z", len: 1 },
        { type: "pipe", at: [5, 2, 0], face: "+y", dir: "-z", len: 1 },
        { type: "gear", at: [2, 2, 0], face: "+z", r: 0.4, group: "arm" },
        { type: "gear", at: [2, 0, 3], face: "+z", r: 0.5, tint: "patina" },
        { type: "gear", at: [5, 0, 3], face: "+z", r: 0.35, tint: "iron" },
        { type: "streetlamp", at: [1, 0, 2], face: "+y" },
        { type: "banner", at: [3, 1, 0], face: "+z", color: "crimson" },
        { type: "banner", at: [-2, 5, -1], face: "+x", color: "gold" },
        { type: "waterfall", at: [0, 0, 3], face: "+z", len: 5 },
        { type: "plant", at: [3, 2, 0], face: "+y", variant: "fern" },
      ],
      D("lantern", [[0, 0, 3], [2, 0, 3], [4, 0, 3], [3, 2, 0], [-1, 3, 0]], "+z"),
      D("lantern", [[6, 2, 1], [5, 0, 3]], "+x", { lit: true }),
      D("window", [[1, 0, 1], [3, 1, 0], [3, 1, 0], [4, 1, 0], [-1, 1, 0], [-2, 6, -1]], "+z"),
      D("window", [[0, 6, -1], [6, 1, 1]], "+x", { lit: true }),
      D("ivy", [[6, 1, 1], [2, 0, 3], [-1, 1, 0]], "+z"),
      D("vines", [[1, 0, 3], [5, 0, 3]], "+z", { len: 2, count: 3 }),
      D("flowers", [[1, 0, 3], [5, 0, 3], [3, 2, 0], [7, 1, 2]], "+y"),
      D("corbel", [[0, 0, 3], [1, 0, 3], [2, 0, 3], [4, 0, 3], [5, 0, 3], [3, 2, 0], [3, 2, 0]], "+z"),
      D("corbel", [[6, 2, 1], [7, 1, 2], [2, 0, 2]], "+x"),
      D("railing", [[0, 0, 3], [1, 0, 3], [2, 0, 3], [4, 0, 3], [5, 0, 3]], "+y", { side: "+z" }),
      D("railing", [[3, 2, 0], [3, 2, 0], [4, 2, 0]], "+y", { side: "+z" })
    ),
    solution: [
      ["walk", "p1"], ["walk", "liftTop"], ["mech", "lift", 2],
      ["walk", "p2"], ["walk", "c5"], ["walk", "p2"], ["walk", "goal"],
    ],
  });
  // Title diorama: a small spire for the title screen. Wick waits on a balcony, the beacon crowns the top.
  // Decorative only: no solution is needed (a stair links the balcony to the top so it still behaves like a level).
  LEVELS.push({
    id: "title",
    name: "Spirelight",
    chapter: 1,
    theme: "dusk",
    intro: "Every spire keeps one lamp.",
    hint: "",
    start: "start",
    goal: "top",
    groups: [
      { id: "base", blocks: [].concat(
        taper(0, 0, 3, 4, 0),
        [
          { box: [0, 0, 0, 3, 0, 4], style: "darkstone", walk: false },
          { box: [1, 1, 1, 2, 4, 3], style: "sandstone", walk: false },    // tower shaft
          { box: [1, 3, 1, 2, 3, 3], style: "brick", walk: false },
          { box: [0, 4, 0, 3, 4, 4], style: "brick", walk: false },        // upper gallery floor
          { box: [3, 4, 0, 3, 4, 4], style: "sandstone" },
          { box: [0, 4, 4, 3, 4, 4], style: "sandstone" },
          { at: [0, 4, 4], style: "brick", id: "start" },                  // Wick's balcony corner
          { at: [3, 4, 4], style: "sandstone", id: "top" },
          { box: [1, 5, 1, 2, 6, 3], style: "brick", walk: false },        // lamp room
          { box: [1, 7, 1, 2, 7, 3], style: "slate", walk: false },
          { at: [2, 7, 2], style: "copper", walk: false },
          { box: [0, 1, 4, 3, 1, 4], style: "sandstone", walk: false },    // lower apron
          { box: [0, 2, 4, 0, 3, 4], style: "sandstone", walk: false },
          { box: [-1, -1, 0, -1, 9, 2], style: "sandstone", walk: false },    // spine pier behind the tower
          { box: [-1, 4, 0, -1, 4, 2], style: "brick", walk: false },
          { box: [-1, 10, 0, -1, 10, 2], style: "slate", walk: false },
        ]) },
    ],
    glimmers: [],
    decor: [].concat(
      [
        { type: "beacon", at: [2, 7, 2], face: "+y" },
        { type: "keel", at: [2, -1, 2], w: 4, d: 5, depth: 7 },
        { type: "dome", at: [2, 7, 2], face: "+y", r: 0.8 },
        { type: "dome", at: [-1, 10, 1], face: "+y", r: 1.0 },
        { type: "finial", at: [-1, 10, 1], face: "+y" },
        { type: "finial", at: [1, 7, 1], face: "+y" },
        { type: "finial", at: [2, 7, 3], face: "+y" },
        S("strut", [-0.6, 4.2, 1.5], [0.6, 4.9, 1.5]),
        S("strut", [-0.6, 1.0, 1.5], [1.1, 1.8, 1.5]),
        S("strut", [-0.6, 7.0, 0.8], [1.4, 7.6, 1.4]),
        S("chain", [3.5, 5.0, 4.5], [3.5, 1.2, 4.5]),
        { type: "pipe", at: [3, 0, 3], face: "+y", dir: "-z", len: 2 },
        { type: "pipe", at: [2, 0, 4], face: "+y", dir: "-x", len: 2 },
        { type: "clock", at: [2, 3, 3], face: "+z", r: 0.4 },
        { type: "clock", at: [-1, 8, 2], face: "+z", r: 0.35 },
        { type: "gear", at: [3, 2, 4], face: "+z", r: 0.5 },
        { type: "gear", at: [1, 1, 4], face: "+z", r: 0.4, tint: "patina" },
        { type: "banner", at: [1, 1, 3], face: "+z", color: "crimson" },
        { type: "banner", at: [2, 2, 3], face: "+z", color: "gold" },
        { type: "banner", at: [-1, 6, 2], face: "+z", color: "teal" },
        { type: "waterfall", at: [3, 0, 4], face: "+x", len: 7 },
        { type: "plant", at: [3, 4, 0], face: "+y", variant: "fern" },
        { type: "chimney", at: [2, 7, 1], face: "+y" },
        { type: "streetlamp", at: [2, 4, 4], face: "+y", lit: true },
      ],
      D("lantern", [[0, 4, 4], [2, 4, 4], [3, 4, 4]], "+z", { lit: true }),
      D("lantern", [[3, 4, 4], [3, 4, 1]], "+x", { lit: true }),
      D("window", [[2, 2, 3], [2, 5, 3], [1, 2, 3], [2, 5, 3], [-1, 3, 2], [-1, 5, 2], [-1, 7, 2]], "+z", { lit: true }),
      D("window", [[2, 1, 2], [2, 3, 2], [2, 6, 2], [-1, 6, 1]], "+x", { lit: true }),
      D("ivy", [[0, 3, 4], [2, 1, 4], [1, 3, 3], [-1, 2, 2]], "+z"),
      D("ivy", [[3, 3, 4], [3, 1, 3]], "+x"),
      D("vines", [[2, 0, 4], [0, 4, 4], [2, 4, 4]], "+z", { len: 2, count: 3 }),
      D("vines", [[3, 0, 2]], "+x", { len: 2, count: 3 }),
      D("flowers", [[1, 4, 4], [2, 4, 4], [3, 4, 2], [3, 4, 3]], "+y"),
      D("corbel", [[0, 4, 4], [1, 4, 4], [2, 4, 4], [2, 4, 4], [3, 4, 4], [2, 1, 4], [1, 5, 3]], "+z"),
      D("corbel", [[3, 4, 3], [3, 4, 2], [3, 4, 1], [3, 4, 0]], "+x"),
      D("railing", [[0, 4, 4], [1, 4, 4], [2, 4, 4], [2, 4, 4]], "+y", { side: "+z" }),
      D("railing", [[3, 4, 4], [3, 4, 3], [3, 4, 2], [3, 4, 1]], "+y", { side: "+x" })
    ),
  });
})();
