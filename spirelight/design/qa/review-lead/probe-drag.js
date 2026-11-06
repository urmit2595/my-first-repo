// Review-lead drag probe: fresh page, level N (1-based), group id; drags the handle in 4 directions and reports value.
// node design/qa/review-lead/probe-drag.js [test|notest] [level] [group]
const path = require("path");
const { open } = require("../../../tools/harness");
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mode = process.argv[2] || "test", lvl = +(process.argv[3] || 2), gid = process.argv[4] || "turntable";
  const h = await open(`index.html?${mode === "test" ? "test&" : ""}level=${lvl}`, { w: 390, h: 844, dpr: 1 });
  const P = h.page;
  await P.waitForFunction(() => window.Game && Game.ready && Game.state === "play", null, { timeout: 90000 });
  await sleep(mode === "test" ? 1500 : 5000);
  await P.evaluate(() => { window.__ev = []; ["mechGrab", "mechMove", "mechSnap", "mechLocked", "tap"].forEach(n => Game.bus.on(n, d => { if (n !== "mechMove" || window.__ev.filter(e => e[0] === "mechMove").length < 3) window.__ev.push([n, JSON.stringify(d).slice(0, 80)]); })); });
  const hs = await P.evaluate(g => Game.handleScreen(g), gid);
  const topEl = await P.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "." + e.className : null; }, [hs.x, hs.y]);
  console.log("handle", JSON.stringify(hs), "topmost element:", topEl, "state", await P.evaluate(() => Game.state));
  for (const [name, dx, dy] of [["right", 80, 0], ["left", -80, 0], ["down", 0, 80], ["up", 0, -80], ["upright", 60, -40], ["downleft", -60, 40]]) {
    await P.evaluate(g => Game.setMech(g, Game.groups[g].values[0]), gid); await sleep(800);
    await P.mouse.move(hs.x, hs.y); await P.mouse.down();
    for (let k = 1; k <= 12; k++) { await P.mouse.move(hs.x + dx * k / 12, hs.y + dy * k / 12); await sleep(25); }
    await sleep(100);
    const cur = await P.evaluate(g => Game.groups[g].cur, gid);
    await P.mouse.up(); await sleep(1200);
    console.log(name, "cur during drag", Math.round(cur), "snapped", await P.evaluate(g => Game.groups[g].value, gid));
  }
  // single tap on handle -> step
  await P.evaluate(g => Game.setMech(g, Game.groups[g].values[0]), gid); await sleep(800);
  await P.mouse.click(hs.x, hs.y); await sleep(1500);
  console.log("tap on handle ->", await P.evaluate(g => Game.groups[g].value, gid));
  console.log("events", JSON.stringify(await P.evaluate(() => window.__ev.slice(0, 14))));
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].slice(0, 20).join("\n") : "errors: none");
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
