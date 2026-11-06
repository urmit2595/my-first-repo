#!/usr/bin/env node
// Screenshot any Spirelight page headlessly and print errors.
//
//   node tools/shot.js PAGE OUT.png [--w 1280] [--h 720] [--dpr 1] [--wait 1500] [--until "window.__ready"]
//                      [--eval "js expression (awaited), result printed as JSON"] [--mobile] [--reduced] [--log]
//
// PAGE is relative to spirelight/, e.g. "index.html?test" or "tests/hero.html". --until waits (up to 60 s) for an
// expression to be truthy before the --wait delay; it defaults to "window.__ready || (window.Game && Game.ready)".
const path = require("path");
const { open, ROOT } = require("./harness");
const argv = process.argv.slice(2), pos = [], opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) { const k = argv[i].slice(2), v = argv[i + 1]; if (v === undefined || v.startsWith("--")) opt[k] = "1"; else { opt[k] = v; i++; } }
  else pos.push(argv[i]);
}
const [page = "index.html?test", out = "design/qa/shot.png"] = pos;
(async () => {
  const h = await open(page, { w: +(opt.w || 1280), h: +(opt.h || 720), dpr: +(opt.dpr || 1), mobile: !!opt.mobile, reducedMotion: !!opt.reduced, log: !!opt.log });
  const until = opt.until || "window.__ready || (window.Game && Game.ready)";
  await h.page.waitForFunction(until, null, { timeout: 60000 }).catch(() => h.errors.push("timeout waiting for: " + until));
  if (opt.eval) {
    const r = await h.page.evaluate(`(async () => (${opt.eval}))()`).catch(e => "EVAL ERROR " + e.message);
    console.log(JSON.stringify(r));
  }
  await h.page.waitForTimeout(+(opt.wait || 1500));
  const file = path.resolve(ROOT, out);
  await h.page.screenshot({ path: file });
  console.log("saved " + path.relative(ROOT, file));
  console.log(h.errors.length ? "ERRORS:\n" + [...new Set(h.errors)].slice(0, 30).join("\n") : "errors: none");
  await h.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
