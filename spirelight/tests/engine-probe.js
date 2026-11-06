// Quick probe: runs level N's solution and prints events. node tests/engine-probe.js [levelIndex] [w] [h]
const { open } = require("../tools/harness");
(async () => {
  const li = +(process.argv[2] || 0), W = +(process.argv[3] || 640), H = +(process.argv[4] || 360);
  const h = await open("tests/engine-index.html?test", { w: W, h: H });
  await h.page.waitForFunction(() => window.Game && Game.ready, null, { timeout: 60000 });
  const ev = f => h.page.evaluate(f);
  await ev(() => { window.__ev = []; ["tap","path","heroStep","heroStop","plate","glimmer","goal","beacon","levelComplete","mechSnap"].forEach(n => Game.bus.on(n, d => __ev.push(n + " " + JSON.stringify(d).slice(0, 100)))); });
  await h.page.evaluate(i => { window.__r = null; Game.runSolution(i).then(r => (window.__r = r)); }, li);
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 2500)); const s = await ev(() => ({ r: window.__r, t: +Game.time.toFixed(1), st: Game.state, ev: __ev.splice(0) })); console.log(JSON.stringify(s)); if (s.r) break; }
  console.log(JSON.stringify(await ev(() => Game.debug())));
  console.log(h.errors.slice(0, 10)); await h.close(); process.exit(0);
})();
