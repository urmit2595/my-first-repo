// Review-lead: why is the intro card invisible? Dumps computed style of .sl-intro and ancestors while it is "vis".
const { open } = require("../../../tools/harness");
(async () => {
  const h = await open("index.html?level=3", { w: 390, h: 844, dpr: 1 });
  const P = h.page;
  await P.waitForFunction(() => !!document.querySelector(".sl-intro.vis"), null, { timeout: 90000 });
  await new Promise(r => setTimeout(r, 1200));
  console.log(JSON.stringify(await P.evaluate(() => {
    const out = []; let e = document.querySelector(".sl-intro");
    const h2 = e.querySelector("h2"), cs2 = getComputedStyle(h2);
    out.push({ h2: h2.textContent, op: cs2.opacity, vis: cs2.visibility, rect: h2.getBoundingClientRect().toJSON() });
    while (e && e !== document.body) { const cs = getComputedStyle(e); out.push({ el: e.tagName + "." + e.className, display: cs.display, op: cs.opacity, vis: cs.visibility, z: cs.zIndex, pos: cs.position }); e = e.parentElement; }
    const r = h2.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    out.push({ topmostAtH2: top && (top.tagName + "." + top.className) });
    return out;
  })));
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
