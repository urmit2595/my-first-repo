// Review-lead: find who removes the intro card's "vis" class (patches DOMTokenList.remove before boot).
const { open } = require("../../../tools/harness");
(async () => {
  const h = await open("index.html?level=3", { w: 390, h: 844, dpr: 1 });
  const P = h.page;
  await P.addInitScript(() => {
    window.__who = []; const t0 = performance.now();
    const rm = DOMTokenList.prototype.remove, ad = DOMTokenList.prototype.add;
    DOMTokenList.prototype.remove = function (...a) { if (this.contains && this.contains("sl-intro")) window.__who.push({ t: Math.round(performance.now() - t0), rm: a, st: new Error().stack.split("\n").slice(2, 8).map(s => s.trim().replace(/http:\/\/[^/]+\//, "")).join(" < ") }); return rm.apply(this, a); };
    DOMTokenList.prototype.add = function (...a) { if (this.contains && this.contains("sl-intro")) window.__who.push({ t: Math.round(performance.now() - t0), add: a, st: new Error().stack.split("\n").slice(2, 5).map(s => s.trim().replace(/http:\/\/[^/]+\//, "")).join(" < ") }); return ad.apply(this, a); };
  });
  await P.reload();
  await P.waitForFunction(() => window.Game && Game.ready, null, { timeout: 90000 });
  await new Promise(r => setTimeout(r, 7000));
  console.log(JSON.stringify(await P.evaluate(() => window.__who), null, 1));
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
