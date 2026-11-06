// Drag regression: for EVERY handle in every level, perform a real pointer drag (rotary for rotors, along the axis for sliders)
// and assert the mechanism moved while dragging and snapped to an allowed value. node tests/engine-drag.js [levelIdx1-based ...] [--w 390 --h 844]
const path = require("path"), fs = require("fs");
const { open, ROOT } = require("../tools/harness");
const args = process.argv.slice(2), opt = {}, lv = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith("--")) { opt[args[i].slice(2)] = args[i + 1]; i++; } else lv.push(+args[i]); }
{ let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace("<head>", '<head><base href="../">');
  fs.writeFileSync(path.join(ROOT, "tests/engine-index.html"), html); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const W = +(opt.w || 960), H = +(opt.h || 540);
  const h = await open("tests/engine-index.html?test", { w: W, h: H, mobile: W < H });
  const p = h.page, ev = (f, a) => p.evaluate(f, a);
  await p.waitForFunction(() => window.Game && Game.ready, null, { timeout: 120000 });
  const n = await ev(() => Game.levels.length);
  let fails = 0, total = 0;
  for (const li of (lv.length ? lv.map(x => x - 1) : [...Array(n).keys()])) {
    await ev(i => { Game.startLevel(i); }, li); await sleep(500);
    const ids = await ev(() => Object.keys(Game.groups).filter(id => Game.groups[id].handle));
    for (const id of ids) {
      total++;
      const info = await ev(id => { const g = Game.groups[id]; return { kind: g.kind, axis: g.axis, hs: Game.handleScreen(id), cur: g.cur, values: g.values, type: g.handle.def.type, c: g.pivot }; }, id);
      // hero must not be on the mechanism (would lock x/z rotors): move him to start if needed
      let cur0 = info.cur, hs = info.hs, maxd = 0;
      await p.mouse.move(hs.x, hs.y); await p.mouse.down();
      if (info.kind === "rotor") {
        // circular sweep about a centre 40px to the side of the handle (covers on-axis cranks and off-axis ones alike)
        const cx = hs.x, cy = hs.y, R = 34;
        for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 1.1; await p.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a)); await sleep(30); const d = Math.abs(await ev(id => Game.groups[id].cur, id) - cur0); if (d > maxd) maxd = d; }
      } else {
        for (const dir of [[1, 0.55], [-1, 0.55], [1, -0.55], [-1, -0.55]]) { // try screen directions until one moves it
          for (let k = 1; k <= 8; k++) { await p.mouse.move(hs.x + dir[0] * k * 7, hs.y + dir[1] * k * 7); await sleep(30); }
          const d = Math.abs(await ev(id => Game.groups[id].cur, id) - cur0); if (d > maxd) maxd = d; if (maxd > 0.1) break;
          await p.mouse.move(hs.x, hs.y); await sleep(30);
        }
      }
      await p.mouse.up();
      for (let k = 0; k < 80; k++) { if ((await ev(id => Game.groups[id].state, id)) === "idle") break; await sleep(100); }
      const after = await ev(id => Game.groups[id].value, id);
      const ok = (info.kind === "rotor" ? maxd > 5 : maxd > 0.1) && info.values.includes(after);
      const locked = await ev(() => Game.debug().heroTile);
      if (!ok) fails++;
      console.log(`L${li + 1} ${id} (${info.type}, ${info.kind}${info.axis ? " " + info.axis : ""}) moved ${maxd.toFixed(2)} -> value ${after}  ${ok ? "OK" : "FAIL"}`);
      await ev(id => { const g = Game.groups[id]; Game.setMech(id, g.values[0]); }, id); await sleep(400);
    }
  }
  console.log(`handles ${total}, failures ${fails}`);
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].join("\n") : "errors: none");
  await h.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
