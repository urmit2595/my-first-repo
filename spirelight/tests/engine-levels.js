// Inline test levels for the engine tests (NOT the game's levels). Defines window.LEVELS when levels/levels.js is empty.
(function () {
  var L = (typeof window !== "undefined" ? (window.LEVELS = window.LEVELS || []) : (module.exports = []));
  if (L.length) return;
  L.push({
    id: "t-join", name: "Test Join", chapter: 1, theme: "dusk", intro: "x", hint: "y",
    start: "start", goal: "goal", glimmers: ["g1"],
    groups: [{ id: "base", blocks: [
      { box: [-2, -4, -4, 3, -2, 1], style: "darkstone", walk: false, kind: "cube" },
    ] }],
    solution: []
  });
  L.pop();
  L.push({
    id: "t-join", name: "Test Join", chapter: 1, theme: "dusk", intro: "Seams.", hint: "Walk to the far stone.",
    start: "start", goal: "goal", glimmers: ["g1"],
    groups: [{ id: "base", blocks: [
      { at: [0, 0, 0], style: "sandstone", id: "start" },
      { box: [1, 0, 0, 2, 0, 0], style: "sandstone" },
      { at: [2, 0, 0], style: "sandstone", id: "g1" },
      { at: [0, -1, -1], style: "darkstone", walk: false },
      { at: [-1, -1, -2], style: "sandstone", id: "far" },
      { at: [-1, -1, -3], style: "sandstone", id: "goal" },
      { at: [-1, -2, -2], style: "darkstone", walk: false },
      { at: [-1, -2, -3], style: "darkstone", walk: false },
      { at: [0, -1, 0], style: "darkstone", walk: false },
      { at: [1, -1, 0], style: "darkstone", walk: false },
    ] }],
    decor: [{ type: "beacon", at: [-1, -1, -3], face: "+y" }, { type: "lantern", at: [0, 0, 0], face: "+x" }],
    solution: [["walk", "g1"], ["walk", "goal"]]
  });
  L.push({
    id: "t-mech", name: "Test Mech", chapter: 1, theme: "night", intro: "Turn it.", hint: "Step on the plate.",
    start: "start", goal: "goal", glimmers: [],
    groups: [
      { id: "base", blocks: [
        { box: [0, 0, 0, 2, 0, 0], style: "sandstone" },
        { at: [0, 0, 0], style: "sandstone", id: "start" },
        { at: [1, 0, 0], style: "sandstone", id: "p1" },
        { box: [3, 0, -3, 3, 0, -2], style: "marble" },
        { at: [3, 0, -3], style: "marble", id: "goal" },
        { box: [0, -2, -3, 3, -1, 0], style: "darkstone", walk: false },
      ], },
      { id: "bridge", rotor: { axis: "y", pivot: [3.5, 0, 0.5], angles: [0, 90], start: 0 },
        handle: { type: "crank", at: [2, 0, 0], face: "+y", on: "base" },
        blocks: [{ box: [3, 0, 0, 4, 0, 0], style: "brass" }] },
      { id: "lift", slider: { axis: "y", stops: [0, 1], start: 0 },
        handle: { type: "knob", at: [4, -1, 1], face: "+x", on: "base" },
        blocks: [{ at: [6, 0, 0], style: "wood" }] },
    ],
    plates: [{ tile: "p1", group: "bridge", to: 90 }],
    decor: [{ type: "beacon", at: [3, 0, -3], face: "+y" }],
    solution: [["walk", "p1"], ["walk", "goal"]]
  });
})();
