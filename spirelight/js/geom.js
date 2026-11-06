/* SpireGeom: pure geometry for Spirelight (design.md sections 4 and 7.1). No dependencies, no three.js.
 * UMD: window.SpireGeom in the browser, module.exports in Node.
 *
 *   const w = SpireGeom.load(levelDef);   // validates, throws Error("Level \"id\": where: what")
 *   w.setValue("bridge", 90); w.compute(); w.path("start", "goal"); w.pick(p, q); ...
 *   SpireGeom.solve(levelDef, { maxStates })
 *
 * Conventions:
 *   - cells are integer [x,y,z]; a cell is the cube [x,x+1]x[y,y+1]x[z,z+1]
 *   - projection p = x - y, q = z - y; view ray X(t) = (p+t, t, q+t), larger t is nearer the camera
 *   - walkable ids are "group:x,y,z" with the block's REFERENCE cell (they never change when a group moves)
 *   - bounds() returns world-space corners: every block of every mechanism value lies inside [min, max]
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SpireGeom = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : null), function () {
  "use strict";

  var EPS = 1e-6;
  var STYLES = ["sandstone", "brick", "marble", "darkstone", "brass", "copper", "slate", "wood", "column", "hedge"];
  var THEMES = ["dusk", "night", "aurora", "dawn"];
  var DIRS = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
  var AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  var HANDLE_TYPES = ["crank", "wheel", "lever", "knob"];
  var SQ2 = Math.SQRT2, SQ6 = Math.sqrt(6);

  // ---------------------------------------------------------------- small math helpers
  function dirName(v) {
    for (var k in DIRS) { var d = DIRS[k]; if (d[0] === v[0] && d[1] === v[1] && d[2] === v[2]) return k; }
    return null;
  }
  function rotMat(axis, deg) {
    var a = ((Math.round(deg) % 360) + 360) % 360;
    var c = a === 0 ? 1 : a === 180 ? -1 : 0, s = a === 90 ? 1 : a === 270 ? -1 : 0;
    if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c];
    if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
    if (axis === "z") return [c, -s, 0, s, c, 0, 0, 0, 1];
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  function mulRv(R, v) {
    return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  }
  function z0(n) { return n === 0 ? 0 : n; } // normalise -0
  function ckey(x, y, z) { return ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024); }
  function isInt(n) { return typeof n === "number" && isFinite(n) && Math.floor(n) === n; }
  function isNum(n) { return typeof n === "number" && isFinite(n); }
  function isHalf(n) { return isNum(n) && isInt(n * 2); }
  function project(v) { return [v[0] - v[1], v[2] - v[1]]; }
  function screen(v) { var p = v[0] - v[1], q = v[2] - v[1]; return [(p - q) / SQ2, -(p + q) / SQ6]; } // sy is UP-positive
  function cellStr(c) { return c[0] + "," + c[1] + "," + c[2]; }

  // ---------------------------------------------------------------- level loading and validation
  function load(def) {
    var lid = def && typeof def.id === "string" ? def.id : "?";
    function fail(where, msg) { throw new Error('Level "' + lid + '": ' + (where ? where + ": " : "") + msg); }
    if (!def || typeof def !== "object") fail("", "level definition must be an object");
    if (typeof def.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(def.id)) fail("id", "must be a kebab-case string, got " + JSON.stringify(def.id));
    if (def.id !== "title") {
      if (!isInt(def.chapter) || def.chapter < 1 || def.chapter > 4) fail("chapter", "must be an integer 1..4, got " + JSON.stringify(def.chapter));
      if (THEMES.indexOf(def.theme) < 0) fail("theme", "must be one of " + THEMES.join("|") + ", got " + JSON.stringify(def.theme));
    } else if (def.theme !== undefined && THEMES.indexOf(def.theme) < 0) fail("theme", "unknown theme " + JSON.stringify(def.theme));
    if (!Array.isArray(def.groups) || !def.groups.length) fail("groups", "must be a non-empty array");
    function vec3(v, where, test) {
      if (!Array.isArray(v) || v.length !== 3 || !v.every(test || isInt)) fail(where, "must be [x,y,z] " + (test === isNum ? "numbers" : test === isHalf ? "multiples of 0.5" : "integers") + ", got " + JSON.stringify(v));
      if (v.some(function (n) { return Math.abs(n) > 900; })) fail(where, "coordinates must stay within +-900");
      return v.slice();
    }

    var groups = [], gById = {}, aliases = {}, aliasWhere = {};
    def.groups.forEach(function (gd, gi) {
      var gw = "groups[" + gi + "]" + (gd && gd.id ? ' ("' + gd.id + '")' : "");
      if (!gd || typeof gd !== "object") fail(gw, "must be an object");
      if (typeof gd.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(gd.id)) fail(gw + ".id", "must be a string of letters, digits, - or _");
      if (gById[gd.id]) fail(gw + ".id", 'duplicate group id "' + gd.id + '"');
      if (gd.rotor && gd.slider) fail(gw, "a group has at most one of rotor or slider");
      var g = { id: gd.id, kind: "static", axis: null, pivot: [0, 0, 0], values: [0], value: 0, start: 0, hasHandle: !!gd.handle, handle: null, def: gd, blocks: [], index: gi };
      if (gd.rotor) {
        var r = gd.rotor;
        g.kind = "rotor";
        if (!AXES[r.axis]) fail(gw + ".rotor.axis", 'must be "x", "y" or "z", got ' + JSON.stringify(r.axis));
        g.axis = r.axis;
        g.pivot = vec3(r.pivot, gw + ".rotor.pivot", isNum);
        var perp = [0, 1, 2].filter(function (i) { return i !== "xyz".indexOf(r.axis); });
        var a = g.pivot[perp[0]], b = g.pivot[perp[1]];
        if (!isHalf(a) || !isHalf(b) || (isInt(a) !== isInt(b)))
          fail(gw + ".rotor.pivot", "invalid pivot " + JSON.stringify(r.pivot) + ": the two coordinates perpendicular to axis " + r.axis + " must both be integers or both be half-integers");
        if (!Array.isArray(r.angles) || !r.angles.length) fail(gw + ".rotor.angles", "must be a non-empty array");
        r.angles.forEach(function (v) { if ([0, 90, 180, 270].indexOf(v) < 0) fail(gw + ".rotor.angles", "angle " + JSON.stringify(v) + " is not one of 0, 90, 180, 270"); });
        g.values = r.angles.slice().sort(function (x, y) { return x - y; }).filter(function (v, i, arr) { return i === 0 || arr[i - 1] !== v; });
        g.start = r.start === undefined ? (g.values.indexOf(0) >= 0 ? 0 : g.values[0]) : r.start;
        if (g.values.indexOf(g.start) < 0) fail(gw + ".rotor.start", JSON.stringify(r.start) + " is not in angles " + JSON.stringify(g.values));
      } else if (gd.slider) {
        var s = gd.slider;
        g.kind = "slider";
        if (!AXES[s.axis]) fail(gw + ".slider.axis", 'must be "x", "y" or "z", got ' + JSON.stringify(s.axis));
        g.axis = s.axis;
        if (!Array.isArray(s.stops) || !s.stops.length || !s.stops.every(isInt)) fail(gw + ".slider.stops", "must be a non-empty array of integers, got " + JSON.stringify(s.stops));
        g.values = s.stops.slice().sort(function (x, y) { return x - y; }).filter(function (v, i, arr) { return i === 0 || arr[i - 1] !== v; });
        g.start = s.start === undefined ? (g.values.indexOf(0) >= 0 ? 0 : g.values[0]) : s.start;
        if (g.values.indexOf(g.start) < 0) fail(gw + ".slider.start", JSON.stringify(s.start) + " is not in stops " + JSON.stringify(g.values));
      }
      g.value = g.start;
      if (gd.handle) {
        var h = gd.handle, hw = gw + ".handle";
        if (g.kind === "static") fail(hw, "a static group cannot have a handle (add a rotor or slider)");
        if (HANDLE_TYPES.indexOf(h.type) < 0) fail(hw + ".type", "must be one of " + HANDLE_TYPES.join("|") + ", got " + JSON.stringify(h.type));
        vec3(h.at, hw + ".at");
        if (h.face !== undefined && !DIRS[h.face]) fail(hw + ".face", "must be one of +x -x +y -y +z -z, got " + JSON.stringify(h.face));
        if (h.on !== undefined && h.on !== "self" && h.on !== "base") fail(hw + ".on", 'must be "self" or "base", got ' + JSON.stringify(h.on));
        g.handle = { type: h.type, at: h.at.slice(), face: h.face || "+y", on: h.on || "self" };
      }
      if (!Array.isArray(gd.blocks)) fail(gw + ".blocks", "must be an array");
      var cells = new Map();
      gd.blocks.forEach(function (bd, bi) {
        var bw = gw + ".blocks[" + bi + "]";
        if (!bd || typeof bd !== "object") fail(bw, "must be an object");
        var n = (bd.box ? 1 : 0) + (bd.at ? 1 : 0) + (bd.stair ? 1 : 0);
        if (n !== 1) fail(bw, "needs exactly one of box, at or stair");
        var style = bd.style === undefined ? "sandstone" : bd.style;
        if (STYLES.indexOf(style) < 0) fail(bw + ".style", "unknown style " + JSON.stringify(style) + " (use " + STYLES.join(", ") + ")");
        if (bd.walk !== undefined && typeof bd.walk !== "boolean") fail(bw + ".walk", "must be a boolean");
        if (bd.kind !== undefined && bd.kind !== "cube" && bd.kind !== "veil") fail(bw + ".kind", 'must be "cube" or "veil", got ' + JSON.stringify(bd.kind));
        if (bd.id !== undefined) {
          if (bd.box) fail(bw + ".id", "an alias is only allowed on at/stair entries, not on box");
          if (typeof bd.id !== "string" || !bd.id || /[:,]/.test(bd.id)) fail(bw + ".id", "alias must be a non-empty string without ':' or ','");
          if (aliases[bd.id]) fail(bw + ".id", 'duplicate alias "' + bd.id + '" (also used at ' + aliasWhere[bd.id] + ")");
        }
        var kind = bd.kind === "veil" ? "veil" : "cube", up = null, list = [];
        if (bd.stair) {
          if (bd.kind === "veil") fail(bw, "a stair cannot be a veil");
          if (["+x", "-x", "+z", "-z"].indexOf(bd.up) < 0) fail(bw + ".up", 'stair rise direction must be "-x", "-z", "+x" or "+z", got ' + JSON.stringify(bd.up));
          kind = "stair"; up = bd.up;
          list.push(vec3(bd.stair, bw + ".stair"));
        } else if (bd.at) {
          list.push(vec3(bd.at, bw + ".at"));
        } else {
          var bx = bd.box;
          if (!Array.isArray(bx) || bx.length !== 6 || !bx.every(isInt)) fail(bw + ".box", "must be [x0,y0,z0,x1,y1,z1] integers, got " + JSON.stringify(bx));
          vec3(bx.slice(0, 3), bw + ".box"); vec3(bx.slice(3), bw + ".box");
          if (bx[3] < bx[0] || bx[4] < bx[1] || bx[5] < bx[2]) fail(bw + ".box", "max corner must be >= min corner, got " + JSON.stringify(bx));
          var vol = (bx[3] - bx[0] + 1) * (bx[4] - bx[1] + 1) * (bx[5] - bx[2] + 1);
          if (vol > 20000) fail(bw + ".box", "box of " + vol + " cells is too large");
          for (var x = bx[0]; x <= bx[3]; x++) for (var y = bx[1]; y <= bx[4]; y++) for (var z = bx[2]; z <= bx[5]; z++) list.push([x, y, z]);
        }
        var walk = kind === "veil" ? false : (bd.walk === undefined ? true : bd.walk);
        list.forEach(function (c) {
          var blk = { cell: c, ref: c, style: style, kind: kind, walk: walk, up: up, alias: bd.id || null, group: g.id, id: g.id + ":" + cellStr(c) };
          var prev = cells.get(ckey(c[0], c[1], c[2]));
          if (prev && prev.alias && prev.alias !== blk.alias) { delete aliases[prev.alias]; }
          cells.set(ckey(c[0], c[1], c[2]), blk);
        });
        if (bd.id) { aliases[bd.id] = g.id + ":" + cellStr(list[0]); aliasWhere[bd.id] = bw; }
      });
      g.blocks = Array.from(cells.values());
      g.cellMap = cells;
      groups.push(g); gById[g.id] = g;
    });
    if (!gById.base) fail("groups", 'a group with id "base" is required');
    if (gById.base.kind !== "static") fail('groups ("base")', "the base group must be static");

    var blockById = {};
    groups.forEach(function (g) { g.blocks.forEach(function (b) { blockById[b.id] = b; }); });
    function resolve(name) {
      if (typeof name !== "string") return null;
      if (aliases[name]) return aliases[name];
      if (blockById[name]) return name;
      return null;
    }
    function resolveTile(name, where) {
      var id = resolve(name);
      if (!id) fail(where, "unknown tile " + JSON.stringify(name) + " (not an alias or a group:x,y,z block id)");
      var b = blockById[id];
      if (!b.walk || b.kind === "veil") fail(where, "tile " + JSON.stringify(name) + " is on a block with walk:false or a veil");
      return id;
    }

    var w = new World(def, groups, gById, aliases, blockById);
    w.startId = def.start !== undefined ? resolveTile(def.start, "start") : fail("start", "is required");
    w.goalId = def.goal !== undefined ? resolveTile(def.goal, "goal") : fail("goal", "is required");
    w.plates = [];
    (def.plates || []).forEach(function (pd, i) {
      var pw = "plates[" + i + "]";
      if (!pd || typeof pd !== "object") fail(pw, "must be an object");
      var tile = resolveTile(pd.tile, pw + ".tile");
      var g = gById[pd.group];
      if (!g) fail(pw + ".group", "unknown group " + JSON.stringify(pd.group));
      if (g.kind === "static") fail(pw + ".group", 'group "' + g.id + '" is static: a plate needs a rotor or slider');
      if ((pd.to === undefined) === (pd.step === undefined)) fail(pw, "needs exactly one of to or step");
      if (pd.to !== undefined && g.values.indexOf(pd.to) < 0) fail(pw + ".to", JSON.stringify(pd.to) + " is not an allowed value of " + g.id + " " + JSON.stringify(g.values));
      if (pd.step !== undefined && (!isInt(pd.step) || pd.step === 0)) fail(pw + ".step", "must be a non-zero integer");
      if (w.plates.some(function (o) { return o.tile === tile; })) fail(pw + ".tile", "two plates on the same tile");
      w.plates.push({ index: i, tile: tile, group: g.id, to: pd.to, step: pd.step, once: !!pd.once });
    });
    if (def.glimmers !== undefined && !Array.isArray(def.glimmers)) fail("glimmers", "must be an array");
    w.glimmers = (def.glimmers || []).map(function (gname, i) { return resolveTile(gname, "glimmers[" + i + "]"); });
    if (w.glimmers.length > 3) fail("glimmers", "at most 3 glimmers per level");
    (def.decor || []).forEach(function (d, i) {
      var dw = "decor[" + i + "]";
      if (!d || typeof d.type !== "string") fail(dw + ".type", "must be a string");
      vec3(d.at, dw + ".at");
      if (d.face !== undefined && !DIRS[d.face]) fail(dw + ".face", "must be one of +x -x +y -y +z -z");
      if (d.group !== undefined && !gById[d.group]) fail(dw + ".group", "unknown group " + JSON.stringify(d.group));
    });
    if (def.view !== undefined) {
      if (!def.view || !Array.isArray(def.view.center) || def.view.center.length !== 3 || !def.view.center.every(isNum)) fail("view.center", "must be [x,y,z]");
      if (def.view.height !== undefined && !(isNum(def.view.height) && def.view.height > 0)) fail("view.height", "must be a positive number");
    }
    if (def.solution !== undefined) {
      if (!Array.isArray(def.solution)) fail("solution", "must be an array of actions");
      def.solution.forEach(function (a, i) {
        var sw = "solution[" + i + "]";
        if (!Array.isArray(a)) fail(sw, "must be an array");
        if (a[0] === "walk") resolveTile(a[1], sw);
        else if (a[0] === "mech") {
          var g = gById[a[1]];
          if (!g || g.kind === "static") fail(sw, "unknown mechanism group " + JSON.stringify(a[1]));
          if (g.values.indexOf(a[2]) < 0) fail(sw, JSON.stringify(a[2]) + " is not an allowed value of " + g.id + " " + JSON.stringify(g.values));
        } else fail(sw, 'action must be ["walk", tile] or ["mech", group, value]');
      });
    }
    // start-state overlaps are an error
    w.compute();
    var st = w._state;
    if (st.overlaps.length) {
      var o = st.overlaps[0];
      fail("groups", "two blocks in one cell in the start state: " + o.a + " and " + o.b + " both at world cell " + cellStr(o.cell) + (st.overlaps.length > 1 ? " (+" + (st.overlaps.length - 1) + " more)" : ""));
    }
    return w;
  }

  // ---------------------------------------------------------------- the world
  function World(def, groups, gById, aliases, blockById) {
    this.level = def;
    this.id = def.id;
    this.groups = groups;
    this._g = gById;
    this.aliases = aliases;
    this._blocks = blockById;
    this._aliasOf = {};
    for (var a in aliases) this._aliasOf[aliases[a]] = a;
    this._cache = new Map();
    this._state = null;
  }
  var W = World.prototype;

  Object.defineProperty(W, "walkables", { get: function () { return this._ensure().walkables; } });

  W.group = function (id) { return this._g[id] || null; };
  W.resolve = function (name) {
    if (typeof name !== "string") return null;
    if (this.aliases[name]) return this.aliases[name];
    return this._blocks[name] ? name : null;
  };
  W.aliasOf = function (id) { return this._aliasOf[id] || null; };
  W.label = function (id) { return this._aliasOf[id] || id; };
  W.getValue = function (gid) { var g = this._need(gid); return g.value; };
  W._need = function (gid) { var g = this._g[gid]; if (!g) throw new Error('Level "' + this.id + '": unknown group "' + gid + '"'); return g; };
  W.setValue = function (gid, v) {
    var g = this._need(gid);
    if (g.kind === "static") { if (v !== 0) throw new Error('Level "' + this.id + '": group "' + gid + '" is static'); return; }
    if (g.kind === "rotor") {
      if (!isInt(v) || v % 90 !== 0) throw new Error('Level "' + this.id + '": rotor "' + gid + '" value must be a multiple of 90, got ' + v);
      v = ((v % 360) + 360) % 360;
    } else if (!isInt(v)) throw new Error('Level "' + this.id + '": slider "' + gid + '" value must be an integer, got ' + v);
    if (g.value !== v) { g.value = v; this._state = null; }
  };
  W.setValues = function (obj) { for (var k in obj) this.setValue(k, obj[k]); };
  W.values = function () { var o = {}; this.groups.forEach(function (g) { if (g.kind !== "static") o[g.id] = g.value; }); return o; };
  W.reset = function () { var self = this; this.groups.forEach(function (g) { self.setValue(g.id, g.start); }); };
  W.stateKey = function () {
    return this.groups.filter(function (g) { return g.kind !== "static"; }).map(function (g) { return g.id + "=" + g.value; }).join("|");
  };
  W.transform = function (gid, v) {
    var g = this._need(gid);
    if (v === undefined) v = g.value;
    if (g.kind === "rotor") return { R: rotMat(g.axis, v), pivot: g.pivot.slice(), offset: [0, 0, 0], angle: v, axis: g.axis };
    if (g.kind === "slider") { var a = AXES[g.axis]; return { R: rotMat(null, 0), pivot: [0, 0, 0], offset: [a[0] * v, a[1] * v, a[2] * v], angle: 0, axis: g.axis }; }
    return { R: rotMat(null, 0), pivot: [0, 0, 0], offset: [0, 0, 0], angle: 0, axis: null };
  };
  // map a reference-pose POINT of a group to world space at value v (default current)
  W.toWorld = function (gid, pt, v) {
    var T = this.transform(gid, v);
    var d = mulRv(T.R, [pt[0] - T.pivot[0], pt[1] - T.pivot[1], pt[2] - T.pivot[2]]);
    return [z0(d[0] + T.pivot[0] + T.offset[0]), z0(d[1] + T.pivot[1] + T.offset[1]), z0(d[2] + T.pivot[2] + T.offset[2])];
  };
  W.cellToWorld = function (gid, c, v) {
    var m = this.toWorld(gid, [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5], v);
    return [Math.round(m[0] - 0.5), Math.round(m[1] - 0.5), Math.round(m[2] - 0.5)];
  };
  W.dirToWorld = function (gid, d, v) { var r = mulRv(this.transform(gid, v).R, d); return [z0(r[0]), z0(r[1]), z0(r[2])]; };
  // same-group occupancy in REFERENCE coordinates (for Blocks.build ctx.occupied)
  W.refOccupied = function (gid, x, y, z) { var g = this._need(gid); return g.cellMap.has(ckey(x, y, z)); };
  W.project = project;

  W.compute = function () { this._ensure(); return this; };
  W._ensure = function () {
    if (this._state) return this._state;
    var key = this.stateKey();
    var st = this._cache.get(key);
    if (!st) {
      st = this._build(key);
      if (this._cache.size > 400) this._cache.clear();
      this._cache.set(key, st);
    }
    this._state = st;
    return st;
  };

  W._build = function (key) {
    var self = this, occ = new Map(), overlaps = [], solids = [];
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    this.groups.forEach(function (g) {
      var T = self.transform(g.id);
      var R = T.R, P = T.pivot, O = T.offset;
      var wUp = mulRv(R, [0, 1, 0]);
      g.blocks.forEach(function (b) {
        var c = b.ref;
        var d = mulRv(R, [c[0] + 0.5 - P[0], c[1] + 0.5 - P[1], c[2] + 0.5 - P[2]]);
        var cell = [Math.round(d[0] + P[0] + O[0] - 0.5), Math.round(d[1] + P[1] + O[1] - 0.5), Math.round(d[2] + P[2] + O[2] - 0.5)];
        var s = { block: b, group: g.id, cell: cell, kind: b.kind, up: wUp, u: null, ramp: null };
        if (b.kind === "stair") {
          var u = mulRv(R, DIRS[b.up]);
          s.u = [z0(u[0]), z0(u[1]), z0(u[2])];
          // ramp half-space: (X - centre).(up - u) <= 0
          var a = [wUp[0] - u[0], wUp[1] - u[1], wUp[2] - u[2]];
          s.ramp = { a: a, b: a[0] * (cell[0] + 0.5) + a[1] * (cell[1] + 0.5) + a[2] * (cell[2] + 0.5) };
        }
        var k = ckey(cell[0], cell[1], cell[2]);
        var prev = occ.get(k);
        if (prev) overlaps.push({ a: prev.block.id, b: b.id, cell: cell });
        else occ.set(k, s);
        solids.push(s);
        for (var i = 0; i < 3; i++) { if (cell[i] < mn[i]) mn[i] = cell[i]; if (cell[i] + 1 > mx[i]) mx[i] = cell[i] + 1; }
      });
    });
    var st = { key: key, occ: occ, overlaps: overlaps, solids: solids, min: mn, max: mx, walkables: [], byId: new Map(), adj: new Map() };

    // walkables
    solids.forEach(function (s) {
      var b = s.block;
      if (!b.walk || (b.kind !== "cube" && b.kind !== "stair")) return;
      var c = s.cell, x = c[0], y = c[1], z = c[2];
      var above = occ.has(ckey(x, y + 1, z));
      var upOk = s.up[0] === 0 && s.up[1] === 1 && s.up[2] === 0;
      var wk = { id: b.id, alias: self._aliasOf[b.id] || null, group: s.group, kind: b.kind === "stair" ? "stair" : "tile", ref: b.ref.slice(), cell: c.slice(),
        stand: null, standable: false, ports: [], style: b.style, rise: null };
      if (occ.get(ckey(x, y, z)) !== s) { wk.standable = false; wk.stand = [x + 0.5, y + 1, z + 0.5]; st.walkables.push(wk); st.byId.set(wk.id, wk); return; }
      if (wk.kind === "tile") {
        wk.stand = [x + 0.5, y + 1, z + 0.5];
        wk.standable = upOk && !above;
        var h = y + 1;
        wk.ports = [
          { edge: "+x", p3: [x + 1, h, z + 0.5], e: [1, 0] },
          { edge: "-x", p3: [x, h, z + 0.5], e: [-1, 0] },
          { edge: "+z", p3: [x + 0.5, h, z + 1], e: [0, 1] },
          { edge: "-z", p3: [x + 0.5, h, z], e: [0, -1] }];
      } else {
        var u = s.u;
        wk.rise = dirName(u);
        wk.stand = [x + 0.5, y + 0.5, z + 0.5];
        var uOk = (u[0] === -1 && u[2] === 0) || (u[0] === 0 && u[2] === -1);
        wk.standable = upOk && uOk && u[1] === 0 && !above;
        if (upOk && u[1] === 0) {
          var cx = x + 0.5, cz = z + 0.5;
          wk.ports = [
            { edge: "high", p3: [cx + 0.5 * u[0], y + 1, cz + 0.5 * u[2]], e: [u[0], u[2]] },
            { edge: "low", p3: [cx - 0.5 * u[0], y, cz - 0.5 * u[2]], e: [z0(-u[0]), z0(-u[2])] }];
        }
      }
      wk.ports.forEach(function (pt) { pt.p2 = [pt.p3[0] - pt.p3[1], pt.p3[2] - pt.p3[1]]; });
      st.walkables.push(wk); st.byId.set(wk.id, wk);
    });

    // connections
    this._state = st; // raycast needs occupancy
    var buckets = new Map();
    st.walkables.forEach(function (wk) {
      if (!wk.standable) return;
      st.adj.set(wk.id, []);
      wk.ports.forEach(function (pt) {
        var k = Math.round(pt.p2[0] * 2) * 8192 + Math.round(pt.p2[1] * 2);
        var l = buckets.get(k); if (!l) buckets.set(k, l = []);
        l.push({ w: wk, pt: pt });
      });
    });
    buckets.forEach(function (list) {
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        var A = list[i], B = list[j];
        if (A.w === B.w) continue;
        if (A.pt.e[0] !== -B.pt.e[0] || A.pt.e[1] !== -B.pt.e[1]) continue;
        var k = B.pt.p3[0] - A.pt.p3[0];
        if (k !== 0 && !self._joinVisible(A, B)) continue;
        st.adj.get(A.w.id).push({ to: B.w.id, from3: A.pt.p3.slice(), to3: B.pt.p3.slice(), k: k, e: A.pt.e.slice(), port: A.pt.edge, toPort: B.pt.edge });
        st.adj.get(B.w.id).push({ to: A.w.id, from3: B.pt.p3.slice(), to3: A.pt.p3.slice(), k: -k, e: B.pt.e.slice(), port: B.pt.edge, toPort: A.pt.edge });
      }
    });
    st.adj.forEach(function (l) { l.sort(function (a, b) { return a.to < b.to ? -1 : a.to > b.to ? 1 : a.k - b.k; }); });
    return st;
  };

  // visibility test of section 4.5 (A on W1, B on W2)
  W._joinVisible = function (A, B) {
    var c = A.pt.p2, e = A.pt.e, n = [-e[1], e[0]];
    for (var side = 0; side < 2; side++) {
      var sgn = side === 0 ? -1 : 1, want = side === 0 ? A.w.id : B.w.id;
      for (var j = -1; j <= 1; j++) {
        var p = c[0] + sgn * 0.18 * e[0] + j * 0.3 * n[0], q = c[1] + sgn * 0.18 * e[1] + j * 0.3 * n[1];
        var h = this.raycast(p, q);
        if (!h) return false;
        if (h.kind === "veil") continue;
        if (h.walkableId !== want) return false;
      }
    }
    return true;
  };
  W.joinSamples = function (fromId, port) { // for debugging / svg: the 6 sample points of a port
    var wk = this.walkable(fromId); if (!wk) return [];
    var pt = wk.ports.filter(function (x) { return x.edge === port; })[0]; if (!pt) return [];
    var c = pt.p2, e = pt.e, n = [-e[1], e[0]], out = [];
    [-1, 1].forEach(function (sgn) { for (var j = -1; j <= 1; j++) out.push([c[0] + sgn * 0.18 * e[0] + j * 0.3 * n[0], c[1] + sgn * 0.18 * e[1] + j * 0.3 * n[1]]); });
    return out;
  };

  // clip the view ray at (p,q) against one solid; returns {tmin,tmax,face} or null
  function clipSolid(s, p, q) {
    var c = s.cell, tmin = -Infinity, tmax = Infinity, face = null, lo, hi;
    // x: p+t in [c0, c0+1]
    lo = c[0] - p; hi = c[0] + 1 - p;
    if (lo > tmin) tmin = lo; if (hi < tmax) { tmax = hi; face = "+x"; }
    lo = c[1]; hi = c[1] + 1;
    if (lo > tmin) tmin = lo; if (hi < tmax - 1e-9) { tmax = hi; face = "+y"; } else if (hi <= tmax + 1e-9) { tmax = Math.min(tmax, hi); face = "+y"; }
    lo = c[2] - q; hi = c[2] + 1 - q;
    if (lo > tmin) tmin = lo; if (hi < tmax - 1e-9) { tmax = hi; face = "+z"; }
    if (s.ramp) {
      var a = s.ramp.a, sum = a[0] + a[1] + a[2], r = s.ramp.b - a[0] * p - a[2] * q;
      if (sum > 0) { var t = r / sum; if (t < tmax - 1e-9) { tmax = t; face = "ramp"; } else if (t <= tmax + 1e-9) { tmax = Math.min(t, tmax); face = "ramp"; } }
      else if (sum < 0) { var t2 = r / sum; if (t2 > tmin) tmin = t2; }
      else if (r < 0) return null;
    }
    if (!(tmin < tmax - EPS)) return null;
    return { tmin: tmin, tmax: tmax, face: face };
  }

  W.raycast = function (p, q) {
    var st = this._ensure();
    if (!st.solids.length) return null;
    var mn = st.min, mx = st.max;
    var tlo = Math.max(mn[1], mn[0] - p, mn[2] - q), thi = Math.min(mx[1], mx[0] - p, mx[2] - q);
    if (!(tlo < thi)) return null;
    // breakpoints where t, p+t or q+t is an integer, walked from near (large t) to far
    var bps = [thi, tlo], bases = [0, -p, -q];
    for (var i = 0; i < 3; i++) {
      var b = bases[i], n0 = Math.ceil(tlo - b), n1 = Math.floor(thi - b);
      for (var n = n0; n <= n1; n++) bps.push(b + n);
    }
    bps.sort(function (a, b) { return b - a; });
    for (var k = 0; k + 1 < bps.length; k++) {
      var a1 = bps[k], a0 = bps[k + 1];
      if (a1 - a0 < 1e-9) continue;
      var m = (a1 + a0) / 2;
      var s = st.occ.get(ckey(Math.floor(p + m), Math.floor(m), Math.floor(q + m)));
      if (!s) continue;
      var h = clipSolid(s, p, q);
      if (!h) continue;
      var wid = null;
      var wk = st.byId.get(s.block.id);
      if (wk && wk.standable && ((wk.kind === "tile" && h.face === "+y") || (wk.kind === "stair" && h.face === "ramp"))) wid = wk.id;
      return { t: h.tmax, group: s.group, cell: s.cell.slice(), face: h.face, kind: s.kind, block: s.block.id, walkableId: wid };
    }
    return null;
  };

  W.pick = function (p, q) {
    var h = this.raycast(p, q);
    if (h && h.walkableId) return h.walkableId;
    var rings = [[0.12, 8], [0.24, 12], [0.35, 16]];
    for (var r = 0; r < rings.length; r++) {
      var rad = rings[r][0], n = rings[r][1];
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        // ring in SCREEN space (round on screen), converted back to (p,q)
        var sx = Math.cos(a) * rad, sy = Math.sin(a) * rad;
        var pp = p + (sx * SQ2 - sy * SQ6) / 2, qq = q + (-sx * SQ2 - sy * SQ6) / 2;
        var hh = this.raycast(pp, qq);
        if (hh && hh.walkableId) return hh.walkableId;
      }
    }
    return null;
  };
  // screen offset (world units, sy UP-positive) -> (p,q)
  W.screenToPQ = function (sx, sy) { return [(sx * SQ2 - sy * SQ6) / 2, (-sx * SQ2 - sy * SQ6) / 2]; };

  W.walkable = function (idOrAlias) {
    var id = this.resolve(idOrAlias); if (!id) return null;
    return this._ensure().byId.get(id) || null;
  };
  W.neighbors = function (idOrAlias) {
    var id = this.resolve(idOrAlias); if (!id) return [];
    var l = this._ensure().adj.get(id);
    return l ? l.map(function (n) { return { to: n.to, from3: n.from3.slice(), to3: n.to3.slice(), k: n.k }; }) : [];
  };
  W.edges = function () { // unique connections of the current state (for drawing)
    var st = this._ensure(), out = [];
    st.adj.forEach(function (l, id) { l.forEach(function (n) { if (id < n.to) out.push({ a: id, b: n.to, from3: n.from3, to3: n.to3, k: n.k }); }); });
    return out;
  };
  W.reachable = function (fromId) {
    var st = this._ensure(), id = this.resolve(fromId), seen = new Set();
    if (!id) return seen;
    seen.add(id);
    var queue = [id];
    while (queue.length) {
      var cur = queue.shift(), l = st.adj.get(cur);
      if (l) for (var i = 0; i < l.length; i++) if (!seen.has(l[i].to)) { seen.add(l[i].to); queue.push(l[i].to); }
    }
    return seen;
  };
  // Fewest tiles first, then fewest turns (direction = outward e of the exit port). Deterministic.
  W.path = function (fromId, toId) {
    var st = this._ensure(), a = this.resolve(fromId), b = this.resolve(toId);
    if (!a || !b || !st.byId.has(a) || !st.byId.has(b)) return null;
    if (a === b) return [{ id: a, from3: null, to3: null, k: 0 }];
    if (!st.adj.has(a)) return null;
    // Dijkstra over (tile, incoming dir); cost = steps*4096 + turns
    var best = new Map(), prev = new Map(), heap = [];
    function dkey(id, d) { return id + "|" + d; }
    function push(item) { heap.push(item); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (cmp(heap[p], heap[i]) <= 0) break; var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && cmp(heap[l], heap[m]) < 0) m = l; if (r < heap.length && cmp(heap[r], heap[m]) < 0) m = r; if (m === i) break; var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } } return top; }
    function cmp(x, y) { return x.c - y.c || (x.k < y.k ? -1 : x.k > y.k ? 1 : 0); }
    var sk = dkey(a, "");
    best.set(sk, 0); push({ c: 0, k: sk, id: a, d: "" });
    var endKey = null;
    while (heap.length) {
      var cur = pop();
      if (cur.c !== best.get(cur.k)) continue;
      if (cur.id === b) { endKey = cur.k; break; }
      var l = st.adj.get(cur.id) || [];
      for (var i = 0; i < l.length; i++) {
        var n = l[i], d = n.e[0] + "," + n.e[1];
        var c = cur.c + 4096 + (cur.d && cur.d !== d ? 1 : 0);
        var nk = dkey(n.to, d);
        if (!best.has(nk) || c < best.get(nk)) { best.set(nk, c); prev.set(nk, { k: cur.k, edge: n }); push({ c: c, k: nk, id: n.to, d: d }); }
      }
    }
    if (!endKey) return null;
    var steps = [], k2 = endKey;
    while (prev.has(k2)) { var pr = prev.get(k2); steps.push({ id: pr.edge.to, from3: pr.edge.from3.slice(), to3: pr.edge.to3.slice(), k: pr.edge.k }); k2 = pr.k; }
    steps.push({ id: a, from3: null, to3: null, k: 0 });
    return steps.reverse();
  };

  W.bounds = function () {
    var self = this, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    this.groups.forEach(function (g) {
      g.values.forEach(function (v) {
        g.blocks.forEach(function (b) {
          var c = self.cellToWorld(g.id, b.ref, v);
          for (var i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] + 1 > mx[i]) mx[i] = c[i] + 1; }
        });
      });
    });
    return { min: mn, max: mx };
  };
  W.occupied = function (x, y, z) {
    var s = this._ensure().occ.get(ckey(x, y, z));
    return s ? { group: s.group, block: s.block.id, kind: s.kind, style: s.block.style } : null;
  };
  W.solids = function () { // world solids of the current state (for drawing tools)
    return this._ensure().solids.map(function (s) { return { id: s.block.id, group: s.group, cell: s.cell.slice(), kind: s.kind, style: s.block.style, walk: s.block.walk, u: s.u, up: s.up }; });
  };
  W.overlaps = function () { return this._ensure().overlaps.slice(); };
  // world position of a handle: centre of its face of cell `at` (reference coords, moving with the group if on:"self")
  W.handlePos = function (gid, v) {
    var g = this._need(gid); if (!g.handle) return null;
    var h = g.handle, f = DIRS[h.face];
    var pt = [h.at[0] + 0.5 + f[0] * 0.5, h.at[1] + 0.5 + f[1] * 0.5, h.at[2] + 0.5 + f[2] * 0.5];
    return h.on === "base" ? pt : this.toWorld(gid, pt, v);
  };

  // ---------------------------------------------------------------- solver
  function nextValue(g, cur, step) {
    var i = g.values.indexOf(cur), n = g.values.length;
    if (i < 0) i = 0;
    return g.values[(((i + step) % n) + n) % n];
  }

  function solve(def, opts) {
    opts = opts || {};
    var maxStates = opts.maxStates || 200000;
    var res = { ok: false, actions: null, states: 0, reachableGlimmers: [], trivial: false, warnings: [], errors: [], deadEnds: 0, solutionOk: null };
    var w;
    try { w = load(def); } catch (e) { res.errors.push(e.message); return res; }
    var warn = function (m) { if (res.warnings.indexOf(m) < 0) res.warnings.push(m); };
    var mechs = w.groups.filter(function (g) { return g.kind !== "static"; });
    var plateAt = {}; w.plates.forEach(function (p) { plateAt[p.tile] = p; });

    function setCfg(vals) { for (var i = 0; i < mechs.length; i++) w.setValue(mechs[i].id, vals[i]); w.compute(); }
    function lockedBy(g, hero) { // x/z rotor with Wick on it cannot move
      return g.kind === "rotor" && g.axis !== "y" && hero && w._blocks[hero] && w._blocks[hero].group === g.id;
    }
    var seenCfg = new Set(), stairStandable = new Set();
    function noteCfg() {
      var key = w.stateKey(); if (seenCfg.has(key)) return; seenCfg.add(key);
      w.overlaps().forEach(function (o) { warn("overlapping blocks in state {" + key + "}: " + o.a + " and " + o.b + " at " + cellStr(o.cell)); });
      w.walkables.forEach(function (wk) { if (wk.kind === "stair" && wk.standable) stairStandable.add(wk.id); });
    }
    // simulate one walk; returns {hero, vals, used, plate} or null
    function doWalk(vals, hero, used, target) {
      setCfg(vals);
      var path = w.path(hero, target);
      if (!path) return null;
      var end = path[path.length - 1].id, plate = null;
      for (var i = 1; i < path.length; i++) {
        var p = plateAt[path[i].id];
        if (p && !(p.once && used.indexOf(p.index) >= 0)) { end = path[i].id; plate = p; break; }
      }
      var nv = vals.slice(), nu = used.slice();
      if (plate) {
        var gi = mechs.indexOf(w._g[plate.group]), g = mechs[gi];
        if (lockedBy(g, end)) warn("plate " + w.label(plate.tile) + " moves x/z rotor \"" + g.id + "\" while Wick stands on it: the move is locked");
        else nv[gi] = plate.to !== undefined ? plate.to : nextValue(g, nv[gi], plate.step);
        if (plate.once) { nu.push(plate.index); nu.sort(function (a, b) { return a - b; }); }
      }
      return { hero: end, vals: nv, used: nu, plate: plate };
    }
    function skey(vals, hero, used) { return vals.join(",") + "|" + hero + "|" + used.join(","); }

    // handle sanity
    w.reset();
    w.groups.forEach(function (g) {
      if (!g.handle) return;
      var vs = g.handle.on === "base" ? [g.start] : g.values;
      vs.forEach(function (v) {
        w.reset(); if (g.handle.on === "self") w.setValue(g.id, v);
        var at = g.handle.on === "base" ? g.handle.at : w.cellToWorld(g.id, g.handle.at, v);
        var f = DIRS[g.handle.face], out = [at[0] + f[0], at[1] + f[1], at[2] + f[2]];
        var o = w.occupied(out[0], out[1], out[2]);
        if (o) warn("handle of \"" + g.id + "\" (at " + cellStr(g.handle.at) + " face " + g.handle.face + ") is inside block " + o.block + (g.kind !== "static" && g.handle.on === "self" ? " at value " + v : ""));
        var m = w.occupied(at[0], at[1], at[2]);
        if (!m) warn("handle of \"" + g.id + "\" is not mounted on a block (cell " + cellStr(g.handle.at) + " is empty)" + (g.handle.on === "self" ? " at value " + v : ""));
      });
    });
    w.reset();

    // BFS over states
    var startVals = mechs.map(function (g) { return g.start; });
    var start = { vals: startVals, hero: w.startId, used: [] };
    var sk0 = skey(start.vals, start.hero, start.used);
    var nodes = new Map(); nodes.set(sk0, { s: start, prev: null, act: null, out: [] });
    var queue = [sk0], goalKey = null, glim = new Set(), truncated = false, goalKeys = [];
    while (queue.length) {
      var key = queue.shift(), node = nodes.get(key), s = node.s;
      if (s.hero === w.goalId) { goalKeys.push(key); if (!goalKey) goalKey = key; continue; }
      if (nodes.size > maxStates) { truncated = true; break; }
      setCfg(s.vals); noteCfg();
      var reach = w.reachable(s.hero);
      w.glimmers.forEach(function (gm) { if (reach.has(gm)) glim.add(gm); });
      var moves = [];
      // walks: plates first, then goal/glimmers, then the rest (so recorded targets are the meaningful ones)
      var targets = Array.from(reach).filter(function (t) { return t !== s.hero; });
      var rank = function (t) { return plateAt[t] ? 0 : t === w.goalId ? 1 : w.glimmers.indexOf(t) >= 0 ? 2 : w.aliasOf(t) ? 3 : 4; };
      targets.sort(function (a, b) { return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0); });
      targets.forEach(function (t) {
        var r = doWalk(s.vals, s.hero, s.used, t);
        if (r) moves.push({ act: ["walk", w.label(t)], s: { vals: r.vals, hero: r.hero, used: r.used } });
      });
      // mechanisms with a handle
      mechs.forEach(function (g, gi) {
        if (!g.hasHandle) return;
        g.values.forEach(function (v) {
          if (v === s.vals[gi]) return;
          if (lockedBy(g, s.hero)) return;
          var nv = s.vals.slice(); nv[gi] = v;
          moves.push({ act: ["mech", g.id, v], s: { vals: nv, hero: s.hero, used: s.used } });
        });
      });
      moves.forEach(function (m) {
        var k = skey(m.s.vals, m.s.hero, m.s.used);
        node.out.push(k);
        if (!nodes.has(k)) { nodes.set(k, { s: m.s, prev: key, act: m.act, out: [] }); queue.push(k); }
      });
    }
    res.states = nodes.size;
    if (truncated) warn("state search stopped at maxStates=" + maxStates + "; results may be incomplete");
    res.reachableGlimmers = w.glimmers.filter(function (g) { return glim.has(g); }).map(function (g) { return w.label(g); });
    w.glimmers.forEach(function (g) { if (!glim.has(g)) warn("glimmer " + w.label(g) + " is unreachable"); });
    if (goalKey) {
      var acts = [], k3 = goalKey;
      while (nodes.get(k3).prev !== null) { acts.push(nodes.get(k3).act); k3 = nodes.get(k3).prev; }
      res.actions = acts.reverse();
      res.ok = true;
      res.trivial = res.actions.length === 1 && res.actions[0][0] === "walk";
      if (res.trivial) warn("trivial: the goal is reachable without touching anything");
    } else res.errors.push(truncated ? "no solution found within maxStates" : "the goal is unreachable");
    // dead ends: states from which the goal cannot be reached
    if (!truncated && goalKey) {
      var rev = new Map();
      nodes.forEach(function (n, k) { n.out.forEach(function (o) { var l = rev.get(o); if (!l) rev.set(o, l = []); l.push(k); }); });
      var good = new Set(goalKeys), q2 = goalKeys.slice();
      while (q2.length) { var c = q2.shift(); (rev.get(c) || []).forEach(function (p) { if (!good.has(p)) { good.add(p); q2.push(p); } }); }
      var dead = []; nodes.forEach(function (n, k) { if (!good.has(k)) dead.push(n); });
      res.deadEnds = dead.length;
      if (dead.length) {
        var ex = dead[0].s;
        warn(dead.length + " dead-end state(s) (goal no longer reachable), e.g. Wick on " + w.label(ex.hero) + " with " + mechs.map(function (g, i) { return g.id + "=" + ex.vals[i]; }).join(",") + (ex.used.length ? " used plates " + ex.used.join(",") : ""));
      }
    }
    // stairs that can never be climbed
    w.groups.forEach(function (g) { g.blocks.forEach(function (b) { if (b.kind === "stair" && b.walk && !stairStandable.has(b.id)) warn("stair " + w.label(b.id) + " is never walkable in any reachable state"); }); });

    // replay the level's own solution
    if (def.solution) {
      var cur = { vals: startVals.slice(), hero: w.startId, used: [] }, err = null;
      for (var i = 0; i < def.solution.length && !err; i++) {
        var a = def.solution[i];
        if (cur.hero === w.goalId) { err = "solution[" + i + "]: the goal was already reached"; break; }
        if (a[0] === "walk") {
          var t = w.resolve(a[1]);
          setCfg(cur.vals);
          if (!w.reachable(cur.hero).has(t)) { err = "solution[" + i + "]: " + a[1] + " is not reachable from " + w.label(cur.hero) + " in state {" + w.stateKey() + "}"; break; }
          var r = doWalk(cur.vals, cur.hero, cur.used, t);
          cur = { vals: r.vals, hero: r.hero, used: r.used };
        } else {
          var gi = mechs.indexOf(w._g[a[1]]), g = mechs[gi];
          if (!g.hasHandle) { err = "solution[" + i + "]: group " + a[1] + " has no handle"; break; }
          if (lockedBy(g, cur.hero)) { err = "solution[" + i + "]: " + a[1] + " is locked (Wick stands on it)"; break; }
          cur.vals = cur.vals.slice(); cur.vals[gi] = a[2];
        }
      }
      if (!err && cur.hero !== w.goalId) err = "solution ends with Wick on " + w.label(cur.hero) + ", not on the goal";
      res.solutionOk = !err;
      if (err) { res.errors.push(err); res.ok = false; }
    } else if (def.id !== "title") warn("level has no solution field");
    w.reset();
    return res;
  }

  return {
    load: load, solve: solve, project: project, screen: screen, rotMat: rotMat,
    STYLES: STYLES, THEMES: THEMES, DIRS: DIRS, version: 1
  };
});
