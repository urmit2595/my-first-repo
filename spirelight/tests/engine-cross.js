// Impossible-join crossing sequence on sky-bridge (level 3), deterministic frame stepping (Game.manual).
// node tests/engine-cross.js [W H]  -> design/qa/engine/cross-<tag>-NN.png (clips around Wick)
const path = require("path"), fs = require("fs");
const { open, ROOT } = require("../tools/harness");
{ let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace("<head>", '<head><base href="../">');
  const lv = path.join(ROOT, "levels/levels.js");
  if (!fs.existsSync(lv) || fs.statSync(lv).size < 50) html = html.replace("levels/levels.js", "tests/engine-levels.js");
  fs.writeFileSync(path.join(ROOT, "tests/engine-index.html"), html); }
const out = path.join(ROOT, "design/qa/engine");
const W = +(process.argv[2] || 960), H = +(process.argv[3] || 540), tag = W < H ? "portrait" : "landscape";
(async () => {
  const h = await open("tests/engine-index.html?test&level=3", { w: W, h: H, mobile: W < H });
  const p = h.page, ev = (f, a) => p.evaluate(f, a);
  await p.waitForFunction(() => window.Game && Game.ready && Game.state === "play", null, { timeout: 90000 });
  await ev(() => { window.__ev = []; Game.bus.on("heroStep", d => __ev.push(d)); Game.manual = true; Game.timeScale = 1; });
  const frames = async (n, dt) => { await ev(([n, dt]) => { Game.manualDt = dt; Game.manualFrames = n; }, [n, dt]); await p.waitForFunction(() => Game.manualFrames === 0, null, { timeout: 60000 }); await ev(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  await ev(() => { Game.setMech("bridge", 90); }); await frames(60, 0.04);
  console.log("bridge", JSON.stringify((await ev(() => Game.debug())).groups));
  await ev(() => { Game.tapTile("base:1,1,-2"); }); await frames(1, 0.02);
  let shots = 0, crossed = false, since = 0;
  for (let i = 0; i < 200 && shots < 16; i++) {
    await frames(1, 0.04);
    const e = await ev(() => __ev.splice(0));
    if (e.some(x => x.k !== 0)) crossed = true;
    const near = e.some(x => x.to === "bridge:6,2,2") || crossed || since > 0;
    if (near || shots > 0) {
      if (crossed) since++;
      const s = await ev(() => Game.heroScreen());
      const x = Math.max(0, Math.min(W - 160, s.x - 80)), y = Math.max(0, Math.min(H - 160, s.y - 110));
      await p.screenshot({ path: path.join(out, `cross-${tag}-${String(shots).padStart(2, "0")}.png`), clip: { x, y, width: 160, height: 160 } });
      shots++;
    }
    const st = await ev(() => Game.hero.walking); if (!st && shots) break;
  }
  console.log("shots", shots, "crossed", crossed, "tile", (await ev(() => Game.debug())).heroTile);
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].join("\n") : "errors: none");
  await h.close(); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
