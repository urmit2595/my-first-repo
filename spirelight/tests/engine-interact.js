// Interaction tests on level 3 (sky-bridge): drag, tap-step, snap, refused tap, impossible-join crossing sequence.
// node tests/engine-interact.js [W H] ; shots in design/qa/engine/
const path = require("path"), fs = require("fs");
const { open, ROOT } = require("../tools/harness");
{ // regenerate tests/engine-index.html from index.html (base href so relative paths work)
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace("<head>", '<head><base href="../">');
  const lv = path.join(ROOT, "levels/levels.js");
  if (!fs.existsSync(lv) || fs.statSync(lv).size < 50) html = html.replace("levels/levels.js", "tests/engine-levels.js");
  fs.writeFileSync(path.join(ROOT, "tests/engine-index.html"), html);
}
const out = path.join(ROOT, "design/qa/engine"); fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = +(process.argv[2] || 960), H = +(process.argv[3] || 540), tag = W < H ? "portrait" : "landscape";
(async () => {
  const h = await open("tests/engine-index.html?test&level=3&debug", { w: W, h: H, mobile: W < H });
  const p = h.page, ev = (f, a) => p.evaluate(f, a);
  await p.waitForFunction(() => window.Game && Game.ready && Game.state === "play", null, { timeout: 90000 });
  await ev(() => { window.__ev = []; ["tap","heroStep","heroStop","mechGrab","mechSnap","mechLocked","plate"].forEach(n => Game.bus.on(n, d => __ev.push(n + " " + JSON.stringify(d).slice(0, 110)))); });
  await sleep(1500);
  await p.screenshot({ path: path.join(out, `interact-${tag}-debug.png`) });
  const val = () => ev(() => Game.debug().groups);
  const idle = async () => { for (let i = 0; i < 100; i++) { const b = await ev(() => Game.groups.bridge.state); if (b === "idle") return; await sleep(100); } };
  console.log("start values", JSON.stringify(await val()));
  // tap step
  let hs = await ev(() => Game.handleScreen("bridge"));
  console.log("handle at", JSON.stringify(hs));
  await p.mouse.click(hs.x, hs.y); await sleep(300); await idle();
  console.log("after tap step", JSON.stringify(await val()));
  // drag back: try both directions
  hs = await ev(() => Game.handleScreen("bridge"));
  for (const dir of [1, -1]) {
    const before = (await val()).bridge;
    await p.mouse.move(hs.x, hs.y); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move(hs.x + dir * i * 9, hs.y + dir * i * 5); await sleep(40); }
    const mid = await ev(() => Math.round(Game.groups.bridge.cur));
    await p.mouse.up(); await sleep(300); await idle();
    console.log("drag dir", dir, "before", before, "mid-drag angle", mid, "after snap", JSON.stringify(await val()));
    hs = await ev(() => Game.handleScreen("bridge"));
  }
  // refused tap on empty sky
  await p.mouse.click(30, H - 40); await sleep(300);
  console.log("events", JSON.stringify((await ev(() => __ev.splice(0))).slice(-12)));
  // make sure bridge is at 90 for the crossing
  await ev(() => Game.setMech("bridge", 90)); await idle();
  console.log("values", JSON.stringify(await val()));
  // crossing sequence in slow motion
  await ev(() => { Game.timeScale = 0.12; Game.tapTile("base:1,1,-2"); });
  let k = 0, crossed = false, shots = 0;
  for (let i = 0; i < 160 && shots < 14; i++) {
    const info = await ev(() => ({ s: Game.heroScreen(), ev: __ev.splice(0) }));
    if (info.ev.some(e => /heroStep.*"k":-1/.test(e))) crossed = true;
    const near = info.ev.some(e => /heroStep.*bridge:6,2,2/.test(e)) || crossed;
    if (near) {
      const x = Math.max(0, Math.min(W - 200, info.s.x - 100)), y = Math.max(0, Math.min(H - 200, info.s.y - 130));
      await p.screenshot({ path: path.join(out, `cross-${tag}-${String(shots).padStart(2, "0")}.png`), clip: { x, y, width: 200, height: 200 } });
      shots++;
    } else await sleep(150);
    if (crossed && shots > 12) break;
  }
  console.log("crossing shots", shots, "crossed", crossed);
  await ev(() => { Game.timeScale = 3; });
  for (let i = 0; i < 60; i++) { if (!(await ev(() => Game.hero.walking))) break; await sleep(200); }
  console.log("hero tile", (await ev(() => Game.debug())).heroTile);
  const d = await ev(() => Game.debug()); console.log("draws", d.calls, "tris", d.tris);
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].join("\n") : "errors: none");
  await h.close(); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
