// Review-lead visual + interaction probe (portrait 390x844 @2x). Writes PNGs next to this file.
const path = require("path");
const { open } = require("../../../tools/harness");
const OUT = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const h = await open("index.html", { w: 390, h: 844, dpr: 2, mobile: false });
  const P = h.page;
  const shot = async n => { await P.screenshot({ path: path.join(OUT, n) }); console.log("saved", n); };
  await P.waitForFunction(() => window.Game && Game.ready && Game.state === "title", null, { timeout: 90000 });
  await sleep(3500); await shot("title-p.png");
  // intro card
  await P.evaluate(() => { Game.startLevel(0); });
  await sleep(1600); await shot("l1-intro-p.png");
  await sleep(4500); await shot("l1-play-p.png");
  // tap-to-walk feel: tap an unreachable spot (sky) and a far tile
  const tapInfo = await P.evaluate(() => { const out = []; Game.bus.on("tap", d => out.push({ tile: d.tile, reach: d.reachable })); window.__taps = out; return true; });
  await P.mouse.click(30, 780); await sleep(400);
  const g = await P.evaluate(() => { const s = Game.worldToScreen(Game.geom.walkable("goal").stand); return s; });
  await P.mouse.click(g.x, g.y); await sleep(300);
  console.log("taps", JSON.stringify(await P.evaluate(() => window.__taps)));
  // level 2 crank drag probe
  await P.evaluate(() => { Game.startLevel(1); });
  await sleep(6000);
  const hs = await P.evaluate(() => Game.handleScreen("turntable"));
  console.log("handle", JSON.stringify(hs));
  const probe = async (dx, dy) => {
    await P.mouse.move(hs.x, hs.y); await P.mouse.down();
    for (let k = 1; k <= 10; k++) { await P.mouse.move(hs.x + dx * k / 10, hs.y + dy * k / 10); await sleep(30); }
    await sleep(150);
    const cur = await P.evaluate(() => Game.groups.turntable.cur);
    return cur;
  };
  const results = {};
  for (const [name, dx, dy] of [["right", 60, 0], ["left", -60, 0], ["down", 0, 60], ["up", 0, -60]]) {
    const c = await probe(dx, dy);
    results[name] = Math.round(c);
    if (name === "up") { await shot("l2-drag-mid-p.png"); }
    await P.mouse.up(); await sleep(1200);
    results[name + "_snap"] = await P.evaluate(() => Game.groups.turntable.value);
  }
  console.log("drag", JSON.stringify(results));
  // big drag to reach 180
  await P.evaluate(() => Game.setMech("turntable", 0)); await sleep(1500);
  const before = await P.evaluate(() => Game.groups.turntable.value);
  await P.mouse.move(hs.x, hs.y); await P.mouse.down();
  for (let k = 1; k <= 20; k++) { await P.mouse.move(hs.x - 160 * k / 20, hs.y + 0 * k / 20); await sleep(30); }
  await P.mouse.up(); await sleep(1500);
  console.log("bigdrag left 160px: from", before, "to", await P.evaluate(() => Game.groups.turntable.value));
  // tap near (not on) the handle: does it steal a walk tap? tap 30px left of handle
  const v0 = await P.evaluate(() => Game.groups.turntable.value);
  await P.mouse.click(hs.x - 30, hs.y + 8); await sleep(1500);
  console.log("tap 30px from handle: value", v0, "->", await P.evaluate(() => Game.groups.turntable.value), "tile under that point:",
    await P.evaluate(([x, y]) => { return null; }, [hs.x - 30, hs.y + 8]));
  await shot("l2-after-p.png");
  // complete card (level 7)
  await P.evaluate(() => { Game.timeScale = 3; });
  const r = await P.evaluate(() => Game.runSolution(6));
  console.log("run7", JSON.stringify(r));
  await sleep(1200); await shot("l7-complete-p.png");
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].slice(0, 20).join("\n") : "errors: none");
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
