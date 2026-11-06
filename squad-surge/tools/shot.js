#!/usr/bin/env node
// Headless check of the game: screenshots, console errors, fps and draw calls.
// Starts its own static server for the game folder and serves three.js r128 from a local copy (cdnjs is blocked here).
//
//   node tools/shot.js [--levels 1,2,3] [--out DIR] [--views home,play,boss] [--play-ms 2500] [--w 390 --h 780] [--dpr 1]
//
// Writes DIR/L<level>-<view>.png and prints one JSON line per level plus any console errors.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? acc.concat([[a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"]]) : acc), []));
const ROOT = path.resolve(__dirname, "..");
const THREE_LOCAL = process.env.THREE_LOCAL || "/tmp/claude-0/-home-user-my-first-repo/d08fbbcb-599c-5888-a78c-4e8e85154330/scratchpad/npm/package/build/three.min.js";
const levels = (args.levels || "1").split(",").map(Number);
const views = (args.views || "home,play,boss").split(",");
const OUT = path.resolve(args.out || path.join(ROOT, "design/qa"));
const W = +(args.w || 390), H = +(args.h || 780), DPR = +(args.dpr || 1), PLAY_MS = +(args["play-ms"] || 2500);
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
  page.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/GPU stall|GL Driver|ERR_FAILED|fonts\.g/.test(m.text())) errors.push(m.type() + " " + m.text()); });
  page.on("requestfailed", r => { if (!/fonts\.g/.test(r.url())) errors.push("REQUEST FAILED " + r.url()); });
  page.on("response", r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route("**/three.min.js", r => r.fulfill({ path: THREE_LOCAL, contentType: "application/javascript" }));
  await page.route("**fonts.g*/**", r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem("squad-surge-v1", JSON.stringify({ level: 1, unlocked: 99, sound: false, vibe: false })); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${port}/index.html?hq`); // ?hq: keep full quality (swiftshader is always slow)
  await page.waitForFunction(() => window.__game && __game.state === "home", null, { timeout: 60000 });

  for (const lv of levels) {
    await page.evaluate(l => __game.goLevel(l, "home"), lv);
    await page.waitForFunction(l => __game.L && __game.L.level === l && __game.state === "home", lv, { timeout: 60000 });
    await page.waitForTimeout(600);
    const info = {};
    if (views.includes("home")) await page.screenshot({ path: path.join(OUT, `L${lv}-home.png`) });
    if (views.includes("play")) {
      await page.evaluate(() => {
        __game.setState("play");
        window.__bot = setInterval(() => { // steer to the better gate half, else hold the centre
          const L = __game.L; if (!L) return; let best = null;
          for (const g of L.gates) { if (g.used || g.z > L.sz || g.z < L.sz - 30) continue; const n = L.soldiers.length, val = h => h.op === "x" ? n * h.v : n + h.v; best = g.halves.reduce((a, h) => val(h) > val(a) ? h : a).x; break; }
          L.targetX = best ?? 0;
        }, 50);
      });
      await page.waitForTimeout(PLAY_MS);
      await page.screenshot({ path: path.join(OUT, `L${lv}-play.png`) });
      Object.assign(info, await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res({ fps: n }); })(); })));
      Object.assign(info, await page.evaluate(() => { const r = __game.ctx.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, textures: r.memory.textures, geometries: r.memory.geometries, state: __game.state, soldiers: __game.L.soldiers.length }; }));
      await page.evaluate(() => clearInterval(window.__bot));
    }
    if (views.includes("boss")) {
      await page.evaluate(() => { const L = __game.L; if (__game.state !== "play") __game.setState("play"); L.sz = -L.length + 0.5; L.enemies.length = 0; for (let i = 0; i < 25; i++) L.soldiers.push({ x: 0, z: L.sz, ph: 0, born: 0 }); });
      await page.waitForFunction(() => __game.state === "boss", null, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(OUT, `L${lv}-boss.png`) });
    }
    console.log(JSON.stringify({ level: lv, theme: await page.evaluate(() => __game.L.theme.id), ...info }));
  }
  console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].slice(0, 30).join("\n") : "errors: none");
  await browser.close(); server.close();
})().catch(e => { console.error("FAIL", e.message); server.close(); process.exit(1); });
