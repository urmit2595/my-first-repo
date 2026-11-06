#!/usr/bin/env node
// Headless check for Glowmoth: serves the game folder, swaps the CDN libraries for local copies (the CDNs are
// blocked in this sandbox), then for each level: screenshot the start, hold/release with a simple bot for a while,
// screenshot, and print fps, draw calls, game state and console errors.
//
//   node tools/shot.js [--levels 1,2] [--out DIR] [--play-ms 4000] [--w 1280 --h 720] [--dpr 1] [--steps "hold:600,free:400"]
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? a.concat([[x.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"]]) : a), []));
const ROOT = path.resolve(__dirname, "..");
const VENDOR = process.env.GM_VENDOR || "/tmp/claude-0/-home-user/d08fbbcb-599c-5888-a78c-4e8e85154330/scratchpad/vendor";
const levels = (args.levels || "1").split(",").map(Number);
const OUT = path.resolve(args.out || path.join(ROOT, "design/qa"));
const W = +(args.w || 1280), H = +(args.h || 720), DPR = +(args.dpr || 1), PLAY = +(args["play-ms"] || 4000);
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(ROOT, u === "/" ? "index.html" : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
  page.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/GPU stall|GL Driver|swiftshader/i.test(m.text())) errors.push(m.type() + " " + m.text()); });
  page.on("response", r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route("**/three.min.js", r => r.fulfill({ path: path.join(VENDOR, "three/build/three.min.js"), contentType: "application/javascript" }));
  await page.route("**/three@0.128.0/examples/js/**", r => r.fulfill({ path: path.join(VENDOR, "three/examples/js", r.request().url().split("/examples/js/")[1]), contentType: "application/javascript" }));
  await page.route("**/matter.min.js", r => r.fulfill({ path: path.join(VENDOR, "package/build/matter.min.js"), contentType: "application/javascript" }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem("glowmoth-v1", JSON.stringify({ unlocked: 99, sound: false })); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?test`);
  await page.waitForFunction(() => window.Game && Game.ready, null, { timeout: 60000 }).catch(() => errors.push("Game.ready never became true"));
  for (const lv of levels) {
    const ok = await page.evaluate(lv => Game.startLevel ? (Game.startLevel(lv), true) : false, lv).catch(e => (errors.push("startLevel " + e.message), false));
    if (!ok) break;
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `L${lv}-start.png`) });
    // simple bot: hold while the swarm is below the screen middle, release above it
    await page.evaluate(() => { window.__bot = setInterval(() => { try { const s = Game.debug && Game.debug(); if (!s) return; Game.setHold(s.swarmY > s.viewMidY + 30); } catch (e) {} }, 60); });
    await page.waitForTimeout(PLAY);
    await page.screenshot({ path: path.join(OUT, `L${lv}-play.png`) });
    const info = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res({ fps: n }); })(); }));
    const dbg = await page.evaluate(() => { clearInterval(window.__bot); Game.setHold && Game.setHold(false); const r = Game.renderer && Game.renderer.info; return { ...(Game.debug ? Game.debug() : {}), calls: r && r.render.calls, textures: r && r.memory.textures, geometries: r && r.memory.geometries }; });
    console.log(JSON.stringify({ level: lv, ...info, ...dbg }));
  }
  console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].slice(0, 30).join("\n") : "errors: none");
  await browser.close(); server.close();
})().catch(e => { console.error("FAIL", e.message); server.close(); process.exit(1); });
