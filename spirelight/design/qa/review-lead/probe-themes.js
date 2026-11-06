// Review-lead: portrait shots of L6 (night) and L9 (dawn), the complete card, and the intro card (non-test).
const path = require("path");
const { open } = require("../../../tools/harness");
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let h = await open("index.html?test&level=6", { w: 390, h: 844, dpr: 2 });
  let P = h.page; const shot = async n => { await P.screenshot({ path: path.join(__dirname, n) }); console.log("saved", n); };
  await P.waitForFunction(() => window.Game && Game.ready && Game.state === "play", null, { timeout: 90000 });
  await sleep(2500); await shot("l6-p.png");
  await P.evaluate(() => Game.startLevel(8)); await sleep(3000); await shot("l9-p.png");
  const r = await P.evaluate(() => Game.runSolution(8)); console.log("run9", JSON.stringify(r));
  await sleep(1500); await shot("l9-complete-p.png");
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].slice(0, 20).join("\n") : "errors: none");
  await h.close();
  h = await open("index.html?level=3", { w: 390, h: 844, dpr: 2 }); P = h.page;
  await P.waitForFunction(() => { const e = document.querySelector(".sl-intro.vis"); return !!e; }, null, { timeout: 90000 }).catch(() => console.log("intro never became visible"));
  await sleep(1300); await shot("l3-intro-p.png");
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].slice(0, 20).join("\n") : "errors: none");
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
