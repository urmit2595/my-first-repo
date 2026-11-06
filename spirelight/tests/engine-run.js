// Engine test runner. Usage: node tests/engine-run.js [shotPrefix]. Serves a copy of index.html using the inline test levels
// when levels/levels.js is empty. Needs Playwright (preinstalled).
const fs = require("fs"), path = require("path");
const { open, ROOT } = require("../tools/harness");
const lv = path.join(ROOT, "levels/levels.js");
const useInline = !fs.existsSync(lv) || fs.statSync(lv).size < 50;
const page = "tests/engine-index.html";
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
html = html.replace("<head>", '<head><base href="../">');
if (useInline) html = html.replace("levels/levels.js", "tests/engine-levels.js");
fs.writeFileSync(path.join(ROOT, page), html);
const out = path.join(ROOT, "design/qa/engine"); fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const which = process.argv[2] || "all";
  const h = await open(page + "?test", { w: 1280, h: 720 });
  await h.page.waitForFunction(() => window.Game && Game.ready, null, { timeout: 60000 });
  const ev = (f, a) => h.page.evaluate(f, a);
  const log = [];
  await ev(() => { window.__ev = []; ["tap","path","heroStep","heroStop","mechGrab","mechSnap","mechLocked","plate","glimmer","goal","beacon","levelComplete"].forEach(n => Game.bus.on(n, d => __ev.push(n + " " + JSON.stringify(d).slice(0, 90)))); });
  console.log("levels", await ev(() => Game.levels.map(l => l.id)), "mods", await ev(() => Game.debug().mods));
  const n = await ev(() => Game.levels.length);
  const only = process.argv[3] !== undefined ? [+process.argv[3]] : [...Array(n).keys()];
  for (const i of only) {
    await h.page.evaluate(i => { window.__r = null; Game.runSolution(i).then(r => (window.__r = r)); }, i);
    let r = null;
    for (let k = 0; k < 120 && !r; k++) { await sleep(1000); r = await ev(() => window.__r); }
    const d = await ev(() => Game.debug());
    console.log("level", i + 1, JSON.stringify(r), "draws", d.calls, "tris", d.tris, "state", d.state);
    await h.page.screenshot({ path: path.join(out, `level${i + 1}-done.png`) });
  }
  console.log((await ev(() => __ev)).join("\n"));
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].join("\n") : "errors: none");
  await h.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
