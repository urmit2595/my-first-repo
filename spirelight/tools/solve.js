#!/usr/bin/env node
// Spirelight level solver and schematic renderer (design.md 7.1).
//
//   node tools/solve.js [--level id|N] [--all] [--svg out.svg] [--graph] [--states SPEC] [--max-states N] [--json]
//
//   --level id|N   one level by id, or by 1-based index among playable levels (title excluded). Default: --all
//   --all          every level (title diorama included, only validated)
//   --svg FILE     write a schematic SVG (with --all: FILE gets "-<id>" inserted before .svg). 1200 px wide.
//   --states SPEC  which mechanism states to draw side by side:
//                    solution (default)  start state, then the state after each step of the solver's solution
//                    start               only the start state
//                    all                 every combination of mechanism values (max 12 panels)
//                    "a=90,b=1;a=0"      explicit states separated by ';' (unlisted groups keep their start value)
//   --graph        print the walkable graph of the start state (or of each --states state)
//   --samples      draw the six visibility samples of every impossible join (debug)
//   --json         print the solver result as JSON
//
// SVG legend: pale cream tops/ramps = walkable (standable) surfaces, labelled with their alias or cell.
// Thin blue lines = real neighbours (k = 0). Dashed magenta = impossible joins (k != 0, label shows k).
// S = start, G = goal (gold star), orange ring = plate (with its action), cyan diamond = glimmer,
// brass disc = handle, violet translucent blocks = veils, W = where Wick stands in that panel.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const G = require(path.join(ROOT, "js", "geom.js"));

function loadLevels() {
  global.window = global; global.LEVELS = [];
  const f = path.join(ROOT, "levels", "levels.js");
  delete require.cache[require.resolve(f)];
  require(f);
  return global.LEVELS;
}

// ------------------------------------------------------------------ svg rendering
const STYLE_COL = {
  sandstone: "#d9a46a", brick: "#b5653f", marble: "#e6e0d6", darkstone: "#6e5c70", brass: "#c8963e",
  copper: "#4fa597", slate: "#4a4d72", wood: "#94603a", column: "#d2bf9e", hedge: "#55803a",
};
const PAVER = "#efe2c6";
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}
function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = n => (Math.round(n * 10) / 10).toString();

// faces of a convex solid (cube, optionally cut by the stair ramp), front-facing only
function solidFaces(s) {
  const [x, y, z] = s.cell;
  const planes = [
    { n: [1, 0, 0], b: x + 1, face: "+x" }, { n: [-1, 0, 0], b: -x, face: "-x" },
    { n: [0, 1, 0], b: y + 1, face: "+y" }, { n: [0, -1, 0], b: -y, face: "-y" },
    { n: [0, 0, 1], b: z + 1, face: "+z" }, { n: [0, 0, -1], b: -z, face: "-z" }];
  if (s.kind === "stair") {
    const a = [s.up[0] - s.u[0], s.up[1] - s.u[1], s.up[2] - s.u[2]];
    planes.push({ n: a, b: a[0] * (x + .5) + a[1] * (y + .5) + a[2] * (z + .5), face: "ramp" });
  }
  // vertices: cube corners inside all planes, plus corners are enough for a wedge (its vertices are cube corners)
  const verts = [];
  for (let i = 0; i < 8; i++) {
    const v = [x + (i & 1), y + ((i >> 1) & 1), z + ((i >> 2) & 1)];
    if (planes.every(p => p.n[0] * v[0] + p.n[1] * v[1] + p.n[2] * v[2] <= p.b + 1e-9)) verts.push(v);
  }
  const out = [];
  for (const p of planes) {
    const facing = p.n[0] + p.n[1] + p.n[2];
    if (facing <= 1e-9) continue;
    const on = verts.filter(v => Math.abs(p.n[0] * v[0] + p.n[1] * v[1] + p.n[2] * v[2] - p.b) < 1e-9);
    if (on.length < 3) continue;
    const pts = on.map(v => G.screen(v));
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    out.push({ face: p.face, n: p.n, pts });
  }
  return out;
}

function decorPoint(w, d) {
  const f = G.DIRS[d.face || "+y"], c = d.at;
  const pt = [c[0] + .5 + f[0] * .5, c[1] + .5 + f[1] * .5, c[2] + .5 + f[2] * .5];
  return w.toWorld(d.group || "base", pt);
}

function renderPanel(w, L, panel, S, ox, oy, opts) {
  w.reset(); w.setValues(panel.values); w.compute();
  const X = v => { const s = G.screen(v); return ox + s[0] * S; }, Y = v => { const s = G.screen(v); return oy - s[1] * S; };
  const P = v => f1(X(v)) + "," + f1(Y(v));
  const out = [];
  const solids = w.solids().map(s => Object.assign(s, { d: s.cell[0] + s.cell[1] + s.cell[2] }));
  solids.sort((a, b) => a.d - b.d || a.cell[1] - b.cell[1]);
  const occ = new Set(solids.filter(s => s.kind !== "stair").map(s => s.cell.join(",")));
  const wk = new Map(w.walkables.map(x => [x.id, x]));
  for (const s of solids) {
    const base = STYLE_COL[s.style] || "#999";
    const isVeil = s.kind === "veil", W = wk.get(s.id), stand = W && W.standable;
    for (const f of solidFaces(s)) {
      if (f.face !== "ramp") { // cull faces against full neighbours
        const nn = [s.cell[0] + f.n[0], s.cell[1] + f.n[1], s.cell[2] + f.n[2]].join(",");
        if (occ.has(nn) && !isVeil) continue;
      }
      let col;
      if (f.face === "+y") col = stand ? PAVER : shade(base, 1.0);
      else if (f.face === "ramp") col = stand ? shade(PAVER, 0.93) : shade(base, 0.9);
      else if (f.face === "+x") col = shade(base, 0.74);
      else if (f.face === "+z") col = shade(base, 0.56);
      else col = shade(base, 0.5);
      if (isVeil) col = mix(col, "#8a4fd8", 0.45);
      const stroke = stand && (f.face === "+y" || f.face === "ramp") ? "#b08a3e" : shade(base, 0.35);
      out.push(`<polygon points="${f.pts.map(q => f1(ox + q[0] * S) + "," + f1(oy - q[1] * S)).join(" ")}" fill="${col}" stroke="${isVeil ? "#5b2ea0" : stroke}" stroke-width="${isVeil ? 1.2 : 0.7}" stroke-linejoin="round"${isVeil ? ' fill-opacity="0.72"' : ""}/>`);
    }
    if (s.kind === "stair") { // step lines on the ramp so stairs read as stairs
      const sf = solidFaces(s).find(f => f.face === "ramp");
      if (sf) {
        const u = s.u, c = s.cell;
        for (let i = 1; i < 4; i++) {
          const t = i / 4; // along u from the low end
          const lo = [c[0] + .5 - u[0] * .5 + u[0] * t, c[1] + t, c[2] + .5 - u[2] * .5 + u[2] * t];
          const side = [u[2] !== 0 ? .5 : 0, 0, u[0] !== 0 ? .5 : 0];
          const a = [lo[0] - side[0], lo[1], lo[2] - side[2]], b = [lo[0] + side[0], lo[1], lo[2] + side[2]];
          if (s.up[1] === 1) out.push(`<line x1="${f1(X(a))}" y1="${f1(Y(a))}" x2="${f1(X(b))}" y2="${f1(Y(b))}" stroke="#9c7a4a" stroke-width="0.8"/>`);
        }
      }
    }
  }
  // decor (small glyphs)
  for (const d of L.decor || []) {
    let p; try { p = decorPoint(w, d); } catch (e) { continue; }
    const x = X(p), y = Y(p);
    if (d.type === "beacon") out.push(`<g><polygon points="${f1(x)},${f1(y - 16)} ${f1(x - 7)},${f1(y)} ${f1(x + 7)},${f1(y)}" fill="#ffd27a" stroke="#7a4b10"/><title>beacon</title></g>`);
    else out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="2.4" fill="${d.type === "lantern" || d.type === "streetlamp" ? "#ffb35a" : /ivy|flowers|vines|plant|tree/.test(d.type) ? "#6fbf4a" : "#8a7fa0"}" stroke="#222" stroke-width="0.4"><title>${esc(d.type)}</title></circle>`);
  }
  // connections
  for (const e of w.edges()) {
    const A = wk.get(e.a), B = wk.get(e.b), j = e.from3;
    const pts = `${P(A.stand)} ${P(j)} ${P(B.stand)}`;
    if (e.k === 0) out.push(`<polyline points="${pts}" fill="none" stroke="#1f5fa8" stroke-width="1.6" stroke-opacity="0.75"/>`);
    else {
      out.push(`<polyline points="${pts}" fill="none" stroke="#e0218a" stroke-width="2.6" stroke-dasharray="6,4"/>`);
      out.push(`<text x="${f1(X(j) + 4)}" y="${f1(Y(j) - 4)}" font-size="10" font-weight="bold" fill="#b0106a" stroke="#fff" stroke-width="2.5" paint-order="stroke">k=${e.k}</text>`);
      if (opts.samples) for (const sp of w.joinSamples(e.a, A.ports.find(p => p.p3.join() === e.from3.join()).edge)) {
        const sx = (sp[0] - sp[1]) / Math.SQRT2, sy = -(sp[0] + sp[1]) / Math.sqrt(6);
        out.push(`<circle cx="${f1(ox + sx * S)}" cy="${f1(oy - sy * S)}" r="1.6" fill="#e0218a"/>`);
      }
    }
  }
  // tile labels and markers
  const plates = new Map(w.plates.map(p => [p.tile, p]));
  for (const t of w.walkables) {
    if (!t.standable) continue;
    const x = X(t.stand), y = Y(t.stand);
    const pq = G.project(t.stand), h = w.raycast(pq[0], pq[1]);
    const hidden = !h || h.walkableId !== t.id;
    const lab = t.alias || (t.group === "base" ? t.ref.join(",") : t.group + ":" + t.ref.join(","));
    out.push(`<text x="${f1(x)}" y="${f1(y + 3)}" font-size="${t.alias ? 9 : 7}" text-anchor="middle" fill="${hidden ? "#7a6f8a" : "#3a2a14"}"${hidden ? ' font-style="italic"' : ""}${t.alias ? ' font-weight="bold"' : ""}>${esc(lab)}${hidden ? " (hidden)" : ""}</text>`);
  }
  const mark = (id, fn) => { const t = w.walkable(id); if (t) fn(X(t.stand), Y(t.stand), t); };
  plates.forEach(p => mark(p.tile, (x, y) => {
    out.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(S * .42)}" ry="${f1(S * .24)}" fill="none" stroke="#ff7a1a" stroke-width="2.4"/>`);
    out.push(`<text x="${f1(x)}" y="${f1(y + S * .24 + 10)}" font-size="9" text-anchor="middle" fill="#c04a00" stroke="#fff" stroke-width="2.5" paint-order="stroke">plate: ${esc(p.group)} ${p.to !== undefined ? "→" + p.to : "step " + p.step}${p.once ? " (once)" : ""}</text>`);
  }));
  w.glimmers.forEach(g => mark(g, (x, y) => out.push(`<polygon points="${f1(x)},${f1(y - 17)} ${f1(x + 5)},${f1(y - 10)} ${f1(x)},${f1(y - 3)} ${f1(x - 5)},${f1(y - 10)}" fill="#6ff3ff" stroke="#08707a"/>`)));
  mark(w.startId, (x, y) => out.push(`<circle cx="${f1(x - S * .28)}" cy="${f1(y - 7)}" r="7" fill="#2f9e44" stroke="#fff"/><text x="${f1(x - S * .28)}" y="${f1(y - 4)}" font-size="9" font-weight="bold" text-anchor="middle" fill="#fff">S</text>`));
  mark(w.goalId, (x, y) => {
    const r1 = 9, r2 = 4, pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1; pts.push(f1(x + S * .28 + Math.cos(a) * r) + "," + f1(y - 8 + Math.sin(a) * r)); }
    out.push(`<polygon points="${pts.join(" ")}" fill="#ffc21a" stroke="#7a4b10"/>`);
  });
  if (panel.hero) mark(panel.hero, (x, y) => out.push(`<circle cx="${f1(x)}" cy="${f1(y - 12)}" r="6.5" fill="#ffb35a" stroke="#5a2a00" stroke-width="1.5"/><text x="${f1(x)}" y="${f1(y - 9)}" font-size="8" font-weight="bold" text-anchor="middle" fill="#3a1a00">W</text>`));
  for (const g of w.groups) {
    if (!g.handle) continue;
    const p = w.handlePos(g.id), x = X(p), y = Y(p);
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="#c8963e" stroke="#5a3a10" stroke-width="1.5"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2" fill="#ffd27a"/>`);
    out.push(`<text x="${f1(x + 9)}" y="${f1(y + 3)}" font-size="9" fill="#5a3a10" stroke="#fff" stroke-width="2.5" paint-order="stroke">${esc(g.id)}=${g.value}</text>`);
  }
  return out.join("\n");
}

function renderSVG(L, panels, result, opts) {
  const w = G.load(L);
  const b = w.bounds();
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < 8; i++) {
    const s = G.screen([i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]]);
    mnx = Math.min(mnx, s[0]); mxx = Math.max(mxx, s[0]); mny = Math.min(mny, s[1]); mxy = Math.max(mxy, s[1]);
  }
  const WIDTH = 1200, cols = panels.length === 1 ? 1 : panels.length <= 4 ? 2 : 3;
  const pw = WIDTH / cols;
  const S = Math.min(80, (pw - 40) / (mxx - mnx));
  const ph = (mxy - mny) * S + 70, head = 64;
  const rows = Math.ceil(panels.length / cols);
  const H = Math.ceil(head + rows * ph + 20);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="100%" height="100%" fill="#2a2846"/>`,
    `<text x="16" y="26" font-size="18" font-weight="bold" fill="#ffd27a">${esc(L.id)}: ${esc(L.name || "")}</text>`,
    `<text x="16" y="46" font-size="12" fill="#e8dcc8">${esc(result.ok ? "solvable in " + result.actions.length + " actions: " + result.actions.map(a => a.join(" ")).join(" · ") : "NOT SOLVABLE: " + result.errors.join("; "))}</text>`,
    `<text x="16" y="60" font-size="10" fill="#b8acd0">blue = neighbours (k=0) · dashed magenta = impossible join · S start · ★ goal · orange ring plate · ◆ glimmer · brass disc handle · violet = veil · italic = hidden tile</text>`];
  panels.forEach((pn, i) => {
    const cx = (i % cols) * pw, cy = head + Math.floor(i / cols) * ph;
    const ox = cx + 20 - mnx * S, oy = cy + 34 + mxy * S;
    parts.push(`<rect x="${cx + 4}" y="${cy + 4}" width="${pw - 8}" height="${ph - 8}" rx="8" fill="#3a3760" stroke="#55508a"/>`);
    parts.push(`<text x="${cx + 14}" y="${cy + 22}" font-size="12" fill="#ffffff">${esc(pn.caption)}</text>`);
    parts.push(`<g>${renderPanel(w, L, pn, S, ox, oy, opts)}</g>`);
  });
  parts.push("</svg>");
  return parts.join("\n");
}

// ------------------------------------------------------------------ panels
function panelsFor(L, result, spec) {
  const w = G.load(L);
  const mechs = w.groups.filter(g => g.kind !== "static");
  const startVals = Object.fromEntries(mechs.map(g => [g.id, g.start]));
  const fmt = v => Object.entries(v).map(([k, x]) => k + "=" + x).join(", ") || "no mechanisms";
  if (spec === "start" || (spec === "solution" && !result.ok)) return [{ values: startVals, hero: w.startId, caption: "start: " + fmt(startVals) }];
  if (spec === "all") {
    let combos = [{}];
    for (const g of mechs) combos = combos.flatMap(c => g.values.map(v => Object.assign({}, c, { [g.id]: v })));
    return combos.slice(0, 12).map(v => ({ values: v, hero: null, caption: fmt(v) }));
  }
  if (spec !== "solution") {
    return spec.split(";").map(s => {
      const v = Object.assign({}, startVals);
      s.split(",").filter(Boolean).forEach(kv => { const [k, x] = kv.split("="); v[k.trim()] = Number(x); });
      return { values: v, hero: null, caption: fmt(v) };
    });
  }
  // replay the solver's solution, one panel per configuration change (plus the final position)
  const plateAt = new Map(w.plates.map(p => [p.tile, p]));
  const vals = Object.assign({}, startVals), used = new Set();
  let hero = w.startId;
  const panels = [{ values: Object.assign({}, vals), hero, caption: "1. start: " + fmt(vals) }];
  result.actions.forEach((a, i) => {
    let note = a.join(" ");
    if (a[0] === "mech") vals[a[1]] = a[2];
    else {
      w.reset(); w.setValues(vals);
      const p = w.path(hero, a[1]);
      hero = p[p.length - 1].id;
      for (let j = 1; j < p.length; j++) {
        const pl = plateAt.get(p[j].id);
        if (pl && !(pl.once && used.has(pl.index))) {
          hero = p[j].id; if (pl.once) used.add(pl.index);
          const g = w.group(pl.group);
          vals[pl.group] = pl.to !== undefined ? pl.to : g.values[(g.values.indexOf(vals[pl.group]) + pl.step + g.values.length * 4) % g.values.length];
          note += " (plate → " + pl.group + "=" + vals[pl.group] + ")";
          break;
        }
      }
    }
    const last = panels[panels.length - 1];
    if (a[0] === "mech" || note.includes("plate") || i === result.actions.length - 1)
      panels.push({ values: Object.assign({}, vals), hero, caption: (panels.length + 1) + ". after " + note + ": " + fmt(vals) });
    else { last.hero = hero; last.caption += " · then " + a.join(" "); }
  });
  return panels;
}

function printGraph(L, panels) {
  const w = G.load(L);
  for (const pn of panels) {
    w.reset(); w.setValues(pn.values); w.compute();
    console.log("  graph for {" + w.stateKey() + "}:");
    for (const t of w.walkables) {
      if (!t.standable) continue;
      const n = w.neighbors(t.id).map(x => w.label(x.to) + (x.k ? "(k=" + x.k + ")" : ""));
      console.log("    " + (w.label(t.id) + " [" + t.kind + " @" + t.cell.join(",") + "]").padEnd(34) + " -> " + (n.join(", ") || "(isolated)"));
    }
  }
}

// ------------------------------------------------------------------ main
function main() {
  const argv = process.argv.slice(2), opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2), v = argv[i + 1];
    if (["level", "svg", "states", "max-states"].includes(k)) { opt[k] = v; i++; } else opt[k] = true;
  }
  let levels;
  try { levels = loadLevels(); } catch (e) { console.error("cannot load levels/levels.js: " + e.message); process.exit(2); }
  let list = levels;
  if (opt.level !== undefined) {
    const playable = levels.filter(L => L.id !== "title");
    const L = /^\d+$/.test(opt.level) ? playable[+opt.level - 1] : levels.find(x => x.id === opt.level);
    if (!L) { console.error("no level " + opt.level + " (have: " + levels.map(x => x.id).join(", ") + ")"); process.exit(2); }
    list = [L];
  }
  let bad = 0;
  const ids = new Set();
  for (const L of list) {
    if (ids.has(L.id)) { console.log("✗ duplicate level id " + L.id); bad++; }
    ids.add(L.id);
    const t0 = Date.now();
    const r = G.solve(L, { maxStates: opt["max-states"] ? +opt["max-states"] : undefined });
    const ms = Date.now() - t0;
    const isTitle = L.id === "title";
    const ok = isTitle ? !r.errors.some(e => /^Level/.test(e)) : r.ok;
    if (!ok) bad++;
    if (opt.json) console.log(JSON.stringify(Object.assign({ id: L.id }, r)));
    else {
      console.log((ok ? "✓ " : "✗ ") + L.id + (isTitle ? " (title diorama, validated only)" : "") + "  states=" + r.states + " " + ms + "ms" +
        (r.ok ? "  actions=" + r.actions.length + "  glimmers=" + r.reachableGlimmers.length + "/" + (L.glimmers || []).length : ""));
      if (r.ok && !isTitle) console.log("    shortest: " + r.actions.map(a => a.join(" ")).join(" · "));
      if (!isTitle) for (const e of r.errors) console.log("    ERROR " + e);
      if (isTitle) for (const e of r.errors.filter(e => /^Level/.test(e))) console.log("    ERROR " + e);
      for (const wn of r.warnings) if (!(isTitle && /goal|solution|trivial|dead-end/.test(wn))) console.log("    warn  " + wn);
    }
    if (r.errors.some(e => /^Level/.test(e))) continue; // load failed: nothing to draw
    const panels = panelsFor(L, r, opt.states || "solution");
    if (opt.graph) printGraph(L, opt.states ? panels : panels.slice(0, 1));
    if (opt.svg) {
      const file = list.length > 1 ? opt.svg.replace(/(\.svg)?$/, "-" + L.id + ".svg") : opt.svg;
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.writeFileSync(file, renderSVG(L, panels, r, { samples: !!opt.samples }));
      console.log("    svg → " + file);
    }
  }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();
module.exports = { renderSVG, panelsFor, loadLevels };
