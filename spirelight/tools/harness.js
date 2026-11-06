// Shared headless harness for Spirelight tests (Playwright + swiftshader).
// Serves the spirelight/ folder on a random port and swaps the CDN libraries for local copies (the CDNs are blocked
// in this sandbox). Use it from your own test scripts:
//
//   const { open } = require("./harness");
//   const h = await open("tests/blocks.html", { w: 1280, h: 720 });   // page path relative to spirelight/
//   await h.page.waitForFunction(() => window.__ready);              // your page sets window.__ready = true
//   await h.page.screenshot({ path: "design/qa/blocks.png" });
//   console.log(h.errors);                                            // console errors, page errors, HTTP >= 400
//   await h.close();
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const VENDOR = process.env.SL_VENDOR || "/tmp/claude-0/-home-user/d08fbbcb-599c-5888-a78c-4e8e85154330/scratchpad/vendor";
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };

function serve() {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    const f = path.join(ROOT, u === "/" ? "index.html" : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

async function open(page = "index.html?test", opts = {}) {
  const server = await serve();
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1280, height: opts.h || 720 },
    deviceScaleFactor: opts.dpr || 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push("PAGEERROR " + e.message));
  p.on("console", m => {
    const t = m.text();
    if ((m.type() === "error" || m.type() === "warning") && !/GPU stall|GL Driver|swiftshader|WebGL-|ReadPixels/i.test(t)) errors.push(m.type() + " " + t);
    if (opts.log) console.log("[page]", m.type(), t);
  });
  p.on("response", r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.route("**/three.min.js", r => r.fulfill({ path: path.join(VENDOR, "three/build/three.min.js"), contentType: "application/javascript" }));
  await p.route("**/three@0.128.0/examples/js/**", r => r.fulfill({ path: path.join(VENDOR, "three/examples/js", r.request().url().split("/examples/js/")[1]), contentType: "application/javascript" }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (opts.save !== false) await p.addInitScript(s => { try { if (s) localStorage.setItem("spirelight-v1", JSON.stringify(s)); } catch (e) {} }, opts.save || { unlocked: 99, sound: false, music: false });
  const url = `http://127.0.0.1:${server.address().port}/${page.replace(/^\//, "")}`;
  await p.goto(url);
  return { page: p, browser, ctx, errors, url, close: async () => { await browser.close(); server.close(); } };
}

module.exports = { open, ROOT, VENDOR };
