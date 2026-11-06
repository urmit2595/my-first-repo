// Draw-call / triangle breakdown per level. node tests/engine-perf.js [levelIdx1-based ...] [--w 390 --h 844] [--tier high|medium|low]
// Hides everything, then reveals one category at a time and measures renderer.info for a direct scene render. "calls" includes the
// shadow pass; "main" is the same with shadows off, so shadow = calls - main. Post-processing is measured through the composer.
const path = require("path"), fs = require("fs");
const { open, ROOT } = require("../tools/harness");
const args = process.argv.slice(2); const opt = {}; const lv = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith("--")) { opt[args[i].slice(2)] = args[i + 1]; i++; } else lv.push(+args[i]); }
{ let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace("<head>", '<head><base href="../">');
  const f = path.join(ROOT, "levels/levels.js");
  if (!fs.existsSync(f) || fs.statSync(f).size < 50) html = html.replace("levels/levels.js", "tests/engine-levels.js");
  fs.writeFileSync(path.join(ROOT, "tests/engine-index.html"), html); }
(async () => {
  const W = +(opt.w || 390), H = +(opt.h || 844), tier = opt.tier || "high";
  const h = await open(`tests/engine-index.html?test&quality=${tier}`, { w: W, h: H, mobile: W < H });
  const p = h.page;
  await p.waitForFunction(() => window.Game && Game.ready, null, { timeout: 120000 });
  for (const n of (lv.length ? lv : [10])) {
    const res = await p.evaluate(async idx => {
      Game.startLevel(idx); await new Promise(r => setTimeout(r, 600));
      const I = Game._internals(), R = I.renderer, sc = I.scene;
      const meas = shadows => { R.shadowMap.enabled = shadows && Game.quality !== "low"; R.info.reset(); R.renderer; R.render(sc, I.camera); return [R.info.render.calls, R.info.render.triangles]; };
      const cats = {}; const add = (k, o) => { (cats[k] = cats[k] || []).push(o); };
      Object.keys(Game.groups).forEach(id => {
        const g = Game.groups[id], dec = new Set(Game.decor.map(e => e.object3D));
        g.contentNode.children.forEach(c => { if (dec.has(c)) return; add(c.name === "decor-merged" ? "decor:(merged)" : c.name === "shadow-proxy" ? "shadow-proxy" : "blocks:" + id, c); });
      });
      Game.decor.forEach(e => add("decor:" + (e.handleOf ? "handle" : e.plate ? "plate" : e.glimmer ? "glimmer" : e.item.type), e.object3D));
      add("hero", I.heroPivot); add("fx", I.fxRoot);
      sc.children.forEach(c => { if (c !== I.levelRoot && c !== I.heroPivot && c !== I.fxRoot && !c.isLight && !(c.children.length === 0 && !c.isMesh)) add("world", c); });
      const all = [].concat(...Object.values(cats)), vis = new Map(all.map(o => [o, o.visible]));
      const lrVis = I.levelRoot.visible;
      all.forEach(o => o.visible = false);
      const rows = {};
      const base = meas(true);
      for (const k of Object.keys(cats)) {
        cats[k].forEach(o => o.visible = true);
        const a = meas(true), b = meas(false);
        rows[k] = { calls: a[0] - base[0], main: b[0] - base[0], tris: a[1] - base[1] };
        cats[k].forEach(o => o.visible = false);
      }
      all.forEach(o => o.visible = vis.get(o));
      const tot = meas(true), tot0 = meas(false);
      // post: full composer pass
      R.shadowMap.enabled = Game.quality !== "low"; R.info.reset(); I.composer.render(0.016);
      const comp = [R.info.render.calls, R.info.render.triangles];
      return { level: Game.level.id, total: tot, noShadow: tot0, composer: comp, rows, tier: Game.quality };
    }, n - 1);
    console.log(`\n=== level ${n} ${res.level} (${res.tier}, ${W}x${H}) ===`);
    console.log(`scene total calls ${res.total[0]} tris ${res.total[1]} | without shadows ${res.noShadow[0]} (shadow pass ${res.total[0] - res.noShadow[0]}) | full composer calls ${res.composer[0]} (post ${res.composer[0] - res.total[0]})`);
    const ks = Object.keys(res.rows).sort((a, b) => res.rows[b].calls - res.rows[a].calls);
    ks.forEach(k => console.log(k.padEnd(22), String(res.rows[k].calls).padStart(4), "calls (main", String(res.rows[k].main).padStart(3) + ")", String(res.rows[k].tris).padStart(7), "tris"));
  }
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].join("\n") : "errors: none");
  await h.close(); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
