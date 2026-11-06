// Review-lead probe: per level at 390x844 portrait, measure Wick's on-screen height, px per world unit,
// level screen bbox fill, draw calls/tris. Usage: node design/qa/review-lead/probe-sizes.js [w h]
const { open } = require("../../../tools/harness");
(async () => {
  const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
  const h = await open("index.html?test&level=1", { w: W, h: H, dpr: 1 });
  await h.page.waitForFunction(() => window.Game && Game.ready && Game.state === "play", null, { timeout: 90000 });
  const n = await h.page.evaluate(() => Game.levels.length);
  for (let i = 0; i < n; i++) {
    const r = await h.page.evaluate(async (i) => {
      Game.startLevel(i);
      await new Promise(r => setTimeout(r, 1800));
      const hp = Game.hero.object3D.position || Game._internals().heroPivot.position;
      const piv = Game._internals().heroPivot.position;
      const a = Game.worldToScreen([piv.x, piv.y, piv.z]), b = Game.worldToScreen([piv.x, piv.y + 0.85, piv.z]);
      const u0 = Game.worldToScreen([0, 0, 0]), u1 = Game.worldToScreen([1, 0, 0]);
      // screen bbox of all walkable stand points
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      Game.geom.walkables.forEach(w => { const s = Game.worldToScreen(w.stand); x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
      const hs = {}; Object.keys(Game.groups).forEach(id => { const s = Game.handleScreen(id); if (s) hs[id] = [Math.round(s.x), Math.round(s.y)]; });
      const d = Game.debug();
      return { i: i + 1, id: Game.level.id, wickPx: Math.round(Math.abs(b.y - a.y)), tilePx: Math.round(Math.hypot(u1.x - u0.x, u1.y - u0.y)),
        walkBBox: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)], handles: hs, calls: d.calls, tris: d.tris };
    }, i);
    console.log(JSON.stringify(r));
  }
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].slice(0, 20).join("\n") : "errors: none");
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
