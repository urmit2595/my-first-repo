// Unit tests for js/geom.js. Run: node tests/geom.test.js
"use strict";
const assert = require("assert");
const path = require("path");
const G = require(path.join(__dirname, "..", "js", "geom.js"));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n       ") : e)); }
}
// level helper: base blocks + extra groups
function lvl(blocks, extra) {
  return Object.assign({ id: "t", chapter: 1, theme: "dusk", start: blocks.startId || "a", goal: blocks.goalId || "b",
    groups: [{ id: "base", blocks: blocks }] }, extra || {});
}
const at = (x, y, z, id, more) => Object.assign({ at: [x, y, z] }, id ? { id } : {}, more || {});
const nb = (w, a) => w.neighbors(a).map(n => w.label(n.to) + "/" + n.k).sort();
const conn = (w, a, b) => w.neighbors(a).filter(n => n.to === w.resolve(b));

console.log("worked examples (4.5)");
test("plain neighbours: (0,0,0)-(1,0,0) connected with k=0", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b")]));
  const c = conn(w, "a", "b");
  assert.strictEqual(c.length, 1); assert.strictEqual(c[0].k, 0);
  assert.deepStrictEqual(c[0].from3, [1, 1, 0.5]); assert.deepStrictEqual(c[0].to3, [1, 1, 0.5]);
});
test("staircase illusion: W1 (0,0,0), W2 (1,1,0) NOT connected", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(1, 1, 0, "b")]));
  const A = w.walkable("a"), B = w.walkable("b");
  const pa = A.ports.find(p => p.edge === "-z"), pb = B.ports.find(p => p.edge === "+z");
  assert.deepStrictEqual(pa.p2, [-0.5, -1]); assert.deepStrictEqual(pb.p2, [-0.5, -1]);
  // W2's front face is in front of W1's top on W1's side
  const h = w.raycast(-0.5, -0.82);
  assert.strictEqual(h.block, "base:1,1,0"); assert.strictEqual(h.face, "+z");
  assert.strictEqual(conn(w, "a", "b").length, 0);
});
test("impossible bridge: W1 (0,0,0), W2 (-1,-1,-2) connected with k=-1", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(-1, -1, -2, "b")]));
  const c = conn(w, "a", "b");
  assert.strictEqual(c.length, 1); assert.strictEqual(c[0].k, -1);
  assert.deepStrictEqual(c[0].from3, [0.5, 1, 0]); assert.deepStrictEqual(c[0].to3, [-0.5, 0, -1]);
  assert.strictEqual(conn(w, "b", "a")[0].k, 1);
  const p = w.path("a", "b");
  assert.strictEqual(p.length, 2); assert.strictEqual(p[1].k, -1);
});
test("veil at (2,2,1) hides the staircase-illusion junction: connected, and hides W2's top", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(1, 1, 0, "b"), at(2, 2, 1, null, { kind: "veil", style: "column" })]));
  const c = conn(w, "a", "b");
  assert.strictEqual(c.length, 1); assert.strictEqual(c[0].k, 1);
  // the veil covers W2's whole top: picking W2's centre hits the veil
  const s = w.project(w.walkable("b").stand);
  assert.strictEqual(w.raycast(s[0], s[1]).kind, "veil");
  assert.strictEqual(w.walkable("b").standable, true); // still standable (Wick walks behind the pillar)
  assert.strictEqual(w.walkable("base:2,2,1"), null);  // veils are never walkable
});
test("stair at (0,1,0) rising -x: tile below low end and tile at high end both connect, k=0", () => {
  const w = G.load(lvl([{ stair: [0, 1, 0], up: "-x", id: "s" }, at(1, 0, 0, "a"), at(-1, 1, 0, "b")]));
  const s = w.walkable("s");
  assert.strictEqual(s.kind, "stair"); assert.strictEqual(s.standable, true);
  assert.deepStrictEqual(s.stand, [0.5, 1.5, 0.5]);
  assert.deepStrictEqual(nb(w, "s"), ["a/0", "b/0"]);
  assert.deepStrictEqual(w.path("a", "b").map(x => w.label(x.id)), ["a", "s", "b"]);
  const h = w.raycast(...w.project(s.stand)); assert.strictEqual(h.face, "ramp"); assert.strictEqual(h.walkableId, s.id);
});
test("edge-on stair: the same stair rising +x is not walkable", () => {
  const w = G.load(lvl([{ stair: [0, 1, 0], up: "+x", id: "s" }, at(1, 0, 0, "a"), at(-1, 1, 0, "b")]));
  assert.strictEqual(w.walkable("s").standable, false);
  assert.deepStrictEqual(nb(w, "s"), []); assert.strictEqual(w.path("a", "b"), null);
  const w2 = G.load(lvl([{ stair: [0, 1, 0], up: "+z", id: "s" }, at(0, 0, 1, "a"), at(0, 1, -1, "b")]));
  assert.strictEqual(w2.walkable("s").standable, false);
});
test("the same stair turned by a y-rotor to rise +x becomes unwalkable (and -z walkable)", () => {
  const def = lvl([at(5, 0, 5, "a"), at(5, 0, 6, "b")], {});
  def.groups.push({ id: "r", rotor: { axis: "y", pivot: [0.5, 0, 0.5], angles: [0, 90, 180, 270] }, blocks: [{ stair: [0, 1, 0], up: "-x", id: "s" }] });
  const w = G.load(def);
  const rise = v => { w.setValue("r", v); return [w.walkable("s").rise, w.walkable("s").standable]; };
  assert.deepStrictEqual(rise(0), ["-x", true]);
  assert.deepStrictEqual(rise(90), ["+z", false]);   // R_y(90) * (-1,0,0) = (0,0,1)
  assert.deepStrictEqual(rise(180), ["+x", false]);
  assert.deepStrictEqual(rise(270), ["-z", true]);
});

console.log("transforms");
test("rotor y/x/z with integer and half-integer pivots map cells exactly", () => {
  const base = [at(20, 0, 20, "a"), at(21, 0, 20, "b")];
  const mk = (axis, pivot) => { const d = lvl(base.slice()); d.groups.push({ id: "r", rotor: { axis, pivot, angles: [0, 90, 180, 270] }, blocks: [at(2, 1, 0, "x")] }); return G.load(d); };
  // pivot half-integer: rotate about the centre of the cell column (0.5, *, 0.5)
  let w = mk("y", [0.5, 0, 0.5]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 90), [0, 1, -2]);   // centre (2.5,1.5,.5)-> d=(2,0,0) -> (0,0,-2)
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 180), [-2, 1, 0]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 270), [0, 1, 2]);
  // pivot integer: rotate about a grid corner line (0, *, 0)
  w = mk("y", [0, 7, 0]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 90), [0, 1, -3]);   // d=(2.5,.5) -> (0.5,-2.5) -> cell (0,1,-3)
  w = mk("x", [3, 0.5, 0.5]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 90), [2, 0, 1]);    // d=(.,1,0) -> (.,0,1)
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 180), [2, -1, 0]);
  w = mk("x", [0, 1, 1]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 90), [2, 1, 1]);    // d=(.,.5,-.5)->(.,.5,.5)
  w = mk("z", [0.5, 0.5, 9]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 90), [-1, 2, 0]);   // d=(2,1)->(-1,2)
  w = mk("z", [0, 0, 0]);
  assert.deepStrictEqual(w.cellToWorld("r", [2, 1, 0], 270), [1, -3, 0]);  // d=(2.5,1.5)->(1.5,-2.5)
  const T = w.transform("r", 90);
  assert.deepStrictEqual(T.R, [0, -1, 0, 1, 0, 0, 0, 0, 1]); assert.strictEqual(T.angle, 90);
});
test("rotor matrices follow three.js (right-hand) convention", () => {
  // three.js: rotation.y = +90deg maps +x to -z; rotation.x = +90 maps +y to +z; rotation.z = +90 maps +x to +y
  const m = (axis, v) => { const R = G.rotMat(axis, 90); return [0, 1, 2].map(i => R[i * 3] * v[0] + R[i * 3 + 1] * v[1] + R[i * 3 + 2] * v[2]); };
  assert.deepStrictEqual(m("y", [1, 0, 0]), [0, 0, -1]);
  assert.deepStrictEqual(m("x", [0, 1, 0]), [0, 0, 1]);
  assert.deepStrictEqual(m("z", [1, 0, 0]), [0, 1, 0]);
});
test("invalid pivots are rejected with a clear message", () => {
  const d = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b")]);
  d.groups.push({ id: "r", rotor: { axis: "y", pivot: [0.5, 0, 1], angles: [0, 90] }, blocks: [at(5, 0, 5)] });
  assert.throws(() => G.load(d), /Level "t": groups\[1\] \("r"\)\.rotor\.pivot: invalid pivot/);
  d.groups[1].rotor.pivot = [0.5, 0.25, 1.5]; G.load(d); // along-axis coordinate is ignored
});
test("sliders on all axes move by value*axis", () => {
  for (const [axis, v, exp] of [["x", 2, [7, 0, 5]], ["y", -1, [5, -1, 5]], ["z", 3, [5, 0, 8]]]) {
    const d = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b")]);
    d.groups.push({ id: "s", slider: { axis, stops: [-1, 0, 1, 2, 3] }, blocks: [at(5, 0, 5)] });
    const w = G.load(d);
    w.setValue("s", v);
    assert.deepStrictEqual(w.solids().find(s => s.group === "s").cell, exp);
    assert.deepStrictEqual(w.transform("s").offset, [exp[0] - 5, exp[1], exp[2] - 5]);
  }
});
test("stairs on an x-rotor: rotated up no longer +y makes them unwalkable; ids stay reference ids", () => {
  const d = lvl([at(9, 0, 9, "a"), at(10, 0, 9, "b")]);
  d.groups.push({ id: "r", rotor: { axis: "x", pivot: [0, 1.5, 0.5], angles: [0, 90, 180] }, blocks: [{ stair: [0, 1, 0], up: "-z", id: "s" }] });
  const w = G.load(d);
  assert.strictEqual(w.walkable("s").standable, true);
  w.setValue("r", 90); assert.strictEqual(w.walkable("s").standable, false); assert.strictEqual(w.walkable("s").id, "r:0,1,0");
  w.setValue("r", 180); assert.strictEqual(w.walkable("s").standable, false);
});
test("z-rotor 180 turns a stair rising -x into one rising +x upside down (unwalkable)", () => {
  const d = lvl([at(9, 0, 9, "a"), at(10, 0, 9, "b")]);
  d.groups.push({ id: "r", rotor: { axis: "z", pivot: [0.5, 1.5, 0], angles: [0, 180] }, blocks: [{ stair: [0, 1, 0], up: "-x", id: "s" }] });
  const w = G.load(d); w.setValue("r", 180);
  const s = w.solids().find(x => x.group === "r");
  assert.deepStrictEqual(s.u, [1, 0, 0]); assert.deepStrictEqual(s.up, [0, -1, 0]);
  assert.strictEqual(w.walkable("s").standable, false);
});
test("occupancy: overlap in start state is an error naming both blocks", () => {
  const d = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b")]);
  d.groups.push({ id: "r", blocks: [at(1, 0, 0)] });
  assert.throws(() => G.load(d), /two blocks in one cell in the start state: base:1,0,0 and r:1,0,0/);
});
test("tile is not standable when the cell above is occupied", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b"), at(1, 1, 0, null, { walk: false })]));
  assert.strictEqual(w.walkable("b").standable, false); assert.strictEqual(conn(w, "a", "b").length, 0);
});

console.log("raycast and picking");
test("raycast faces: +y, +x, +z", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b")]));
  // top centre of (0,0,0) is (0.5,1,0.5) -> (p,q) = (-0.5,-0.5)
  assert.deepStrictEqual(w.project([0.5, 1, 0.5]), [-0.5, -0.5]);
  assert.strictEqual(w.raycast(-0.5, -0.5).face, "+y");
  assert.strictEqual(w.raycast(-0.5, -0.5).walkableId, "base:0,0,0");
  assert.strictEqual(w.raycast(1.5, 0).face, "+x");          // centre of +x face of (1,0,0): (2,.5,.5)
  assert.strictEqual(w.raycast(0, 0.5).face, "+z");          // centre of +z face of (0,0,0): (.5,.5,1)
  assert.strictEqual(w.raycast(0, 0.5).walkableId, null);
  assert.strictEqual(w.raycast(5, 5), null);
});
test("pick: direct hit, tolerance ring (0.35), and miss", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(3, 0, 0, "b")]));
  assert.strictEqual(w.pick(-0.5, -0.5), "base:0,0,0");
  // a point on the +z face 0.2 screen units below the front top corner region: ring reaches the top
  const front = w.project([0.5, 1, 1]);             // front (+z) top edge midpoint
  const d = w.screenToPQ(0, -0.2);                   // 0.2 below on screen
  const p = front[0] + d[0], q = front[1] + d[1];
  assert.strictEqual(w.raycast(p, q).face, "+z");
  assert.strictEqual(w.pick(p, q), "base:0,0,0");
  const d2 = w.screenToPQ(0, -0.6);                  // too far below the edge
  assert.strictEqual(w.pick(front[0] + d2[0], front[1] + d2[1]), null);
  assert.strictEqual(w.pick(10, 10), null);
});
test("pick ignores a hidden tile (frontmost hit wins) and veils", () => {
  const w = G.load(lvl([at(0, 0, 0, "a"), at(1, 1, 0, "b"), at(2, 2, 1, null, { kind: "veil" })]));
  const s = w.project(w.walkable("b").stand);
  assert.strictEqual(w.pick(s[0], s[1]), null);
  assert.strictEqual(w.pick(-0.5, -0.5), "base:0,0,0");
});

console.log("paths");
test("BFS picks fewest tiles, then the straighter route", () => {
  // 3x3 square: from (0,0,0) to (2,0,2): 5 tiles any monotone path; straightest has 1 turn
  const blocks = [{ box: [0, 0, 0, 2, 0, 2] }, at(0, 0, 0, "a"), at(2, 0, 2, "b")];
  const w = G.load(lvl(blocks));
  const p = w.path("a", "b");
  assert.strictEqual(p.length, 5);
  const ids = p.map(x => x.id);
  const turns = ids.slice(2).filter((id, i) => { const a = ids[i].split(":")[1].split(",").map(Number), b = ids[i + 1].split(":")[1].split(",").map(Number), c = id.split(":")[1].split(",").map(Number); return (b[0] - a[0]) !== (c[0] - b[0]); }).length;
  assert.strictEqual(turns, 1);
  assert.strictEqual(p[0].from3, null);
});
test("path across an impossible join reports k and port points", () => {
  const w = G.load(lvl([at(0, 0, 1, "s0"), at(0, 0, 0, "a"), at(-1, -1, -2, "b"), at(-1, -1, -3, "c")], { start: "s0", goal: "c" }));
  const p = w.path("s0", "c");
  assert.deepStrictEqual(p.map(x => w.label(x.id)), ["s0", "a", "b", "c"]);
  assert.deepStrictEqual(p.map(x => x.k), [0, 0, -1, 0]);
  assert.deepStrictEqual(p[2].from3, [0.5, 1, 0]); assert.deepStrictEqual(p[2].to3, [-0.5, 0, -1]);
  assert.ok(w.reachable("s0").has(w.resolve("c")));
});
test("rotor turns a bridge into an impossible join only at one angle (k != 0)", () => {
  // a far walkway at (-3,-2,-1)..: bridge rotates about y
  const d = lvl([at(0, 0, 0, "a"), at(-2, -1, -2, "b")]);
  // with a bridge tile at (0,0,-1) the pair a-(0,0,-1) is k=0; check that a k != 0 pair appears/disappears with a rotor
  d.groups.push({ id: "r", rotor: { axis: "y", pivot: [0.5, 0, -0.5], angles: [0, 90] }, blocks: [at(1, 0, -1, "m")] });
  const w = G.load(d);
  // value 0: m at (1,0,-1) is not adjacent to a (diagonal)
  assert.strictEqual(conn(w, "a", "m").length, 0);
  w.setValue("r", 90); // m -> (0,0,-2)... centre (1.5,.5,-.5)-(0.5,*,-0.5)=(1,0) -> (0,-1) -> (0.5,.5,-1.5) -> cell (0,0,-2)
  assert.deepStrictEqual(w.walkable("m").cell, [0, 0, -2]);
  assert.strictEqual(conn(w, "m", "b").length, 0);
});
test("compute() is cached by state key and fast", () => {
  const blocks = [{ box: [0, 0, 0, 9, 3, 9], walk: true }, at(0, 3, 0, "a"), at(9, 3, 9, "b")];
  const w = G.load(lvl(blocks));
  const t0 = Date.now(); for (let i = 0; i < 20; i++) { w._cache.clear(); w._state = null; w.compute(); }
  const ms = (Date.now() - t0) / 20;
  console.log("       compute of " + w.solids().length + " cells: " + ms.toFixed(2) + " ms");
  assert.ok(ms < 30);
  assert.strictEqual(w.path("a", "b").length, 19);
  const st = w._state; w.compute(); assert.strictEqual(w._state, st);
});

console.log("solver");
test("plates: walking stops at a plate and the plate moves its group; bridge then completes", () => {
  // a(0) - p(1) - [gap 2] - g(3). Bridge slider (2,-1,0) -> lifts to (2,0,0) by plate.
  const def = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "p"), at(3, 0, 0, "g"), at(1, 0, 1, "side")], { start: "a", goal: "g" });
  def.groups.push({ id: "lift", slider: { axis: "y", stops: [-1, 0], start: -1 }, blocks: [at(2, 0, 0)] });
  def.plates = [{ tile: "p", group: "lift", to: 0 }];
  def.solution = [["walk", "p"], ["walk", "g"]];
  const r = G.solve(def);
  assert.ok(r.ok, JSON.stringify(r.errors)); assert.strictEqual(r.solutionOk, true);
  assert.deepStrictEqual(r.actions, [["walk", "p"], ["walk", "g"]]);
  assert.strictEqual(r.trivial, false);
});
test("plates truncate walks that pass over them (solution must account for it)", () => {
  const def = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "p"), at(2, 0, 0, "x"), at(4, 0, 0, "g")], { start: "a", goal: "g" });
  def.groups.push({ id: "lift", slider: { axis: "y", stops: [-1, 0], start: -1 }, blocks: [at(3, 0, 0)] });
  def.plates = [{ tile: "p", group: "lift", to: 0, once: true }];
  def.solution = [["walk", "x"], ["walk", "g"]];  // first walk stops on p and raises the lift; second continues
  const r = G.solve(def);
  assert.ok(r.ok, JSON.stringify(r.errors)); assert.deepStrictEqual(r.actions, [["walk", "p"], ["walk", "g"]]);
});
test("solver: riding a y-rotor, locking on an x rotor, glimmers, dead ends", () => {
  // a turntable (y rotor, 3 cells along x, pivot at the middle cell) must be turned to reach the goal; Wick rides it
  const def = lvl([at(0, 0, 1, "a"), at(2, 0, 3, "g"), at(4, 0, 1, "gl")], { start: "a", goal: "g", glimmers: ["gl"] });
  def.groups.push({ id: "t", rotor: { axis: "y", pivot: [2.5, 0, 1.5], angles: [0, 90] }, handle: { type: "crank", at: [2, 0, 1], face: "+y", on: "self" },
    blocks: [at(1, 0, 1, "t0"), at(2, 0, 1, "tm"), at(3, 0, 1)] });
  def.solution = [["walk", "t0"], ["mech", "t", 90], ["walk", "g"]];  // ride the end cell round to (2,0,2)
  const w = G.load(def);
  w.setValue("t", 90); assert.deepStrictEqual(w.walkable("t0").cell, [2, 0, 2]); w.reset();
  const r = G.solve(def);
  assert.ok(r.ok, JSON.stringify(r.errors)); assert.strictEqual(r.solutionOk, true);
  assert.deepStrictEqual(r.reachableGlimmers, ["gl"]);
  assert.strictEqual(r.actions.length, 3); assert.ok(r.actions.some(a => a[0] === "mech"));
  // x-rotor lock
  const d2 = lvl([at(0, 0, 0, "a"), at(5, 0, 0, "g")], { start: "a", goal: "g" });
  d2.groups.push({ id: "x", rotor: { axis: "x", pivot: [0, 0.5, 0.5], angles: [0, 180] }, handle: { type: "wheel", at: [1, 0, 0], face: "+y", on: "base" }, blocks: [at(1, 0, 0, "x0"), at(2, 0, 0)] });
  d2.solution = [["walk", "x0"], ["mech", "x", 180]];
  const r2 = G.solve(d2);
  assert.ok(!r2.ok); assert.ok(r2.errors.some(e => /locked/.test(e)), JSON.stringify(r2.errors));
  assert.ok(w);
});
test("solver warnings: trivial, unreachable glimmer, handle inside block, unwalkable stair", () => {
  const def = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "g"), at(9, 0, 9, "far"), at(5, 0, 5), at(5, 1, 5), { stair: [7, 1, 7], up: "+x" }], { start: "a", goal: "g", glimmers: ["far"] });
  def.groups.push({ id: "m", slider: { axis: "x", stops: [0, 1] }, handle: { type: "knob", at: [5, 0, 5], face: "+y", on: "base" }, blocks: [at(20, 0, 20)] });
  def.solution = [["walk", "g"]];
  const r = G.solve(def);
  assert.ok(r.ok); assert.ok(r.trivial);
  const all = r.warnings.join("\n");
  assert.ok(/trivial/.test(all)); assert.ok(/glimmer far is unreachable/.test(all));
  assert.ok(/handle of "m".*inside block base:5,1,5/.test(all), all);
  assert.ok(/stair base:7,1,7 is never walkable/.test(all), all);
});
test("validation errors name the level and entry", () => {
  const bad = [
    [d => { d.groups[0].blocks.push({ at: [0, 0, 0], style: "cheese" }); }, /groups\[0\] \("base"\)\.blocks\[2\]\.style: unknown style "cheese"/],
    [d => { d.start = "nope"; }, /Level "t": start: unknown tile "nope"/],
    [d => { d.groups[0].id = "foo"; }, /a group with id "base" is required/],
    [d => { d.groups[0].blocks.push({ stair: [4, 0, 0], up: "y" }); }, /blocks\[2\]\.up: stair rise direction/],
    [d => { d.groups[0].blocks.push({ box: [0, 0, 0, 1, 1, 1], id: "x" }); }, /alias is only allowed on at\/stair/],
    [d => { d.plates = [{ tile: "a", group: "base", to: 1 }]; }, /plates\[0\]\.group: group "base" is static/],
    [d => { d.solution = [["fly", "a"]]; }, /solution\[0\]: action must be/],
  ];
  for (const [mut, re] of bad) { const d = lvl([at(0, 0, 0, "a"), at(1, 0, 0, "b")]); mut(d); assert.throws(() => G.load(d), re); }
});

// seed levels
console.log("seed levels");
test("every level in levels/levels.js loads and its solution verifies", () => {
  global.window = global; global.LEVELS = [];
  delete require.cache[require.resolve("../levels/levels.js")];
  require("../levels/levels.js");
  assert.ok(LEVELS.length >= 3);
  for (const L of LEVELS) {
    if (L.id === "title") continue;
    const r = G.solve(L);
    assert.ok(r.ok, L.id + ": " + r.errors.join("; "));
    assert.strictEqual(r.solutionOk, true, L.id);
    const cells = G.load(L).solids().length;
    assert.ok(cells <= 120, L.id + " has " + cells + " cells");
  }
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
