#!/usr/bin/env node
// Render an SVG (e.g. from tools/solve.js --svg) to PNG with headless Chromium so you can look at it.
//   node tools/svgshot.js in.svg [out.png] [--scale 1]
// out.png defaults to in.png. Several inputs: node tools/svgshot.js a.svg b.svg c.svg (each to its own .png).
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
let scale = 1;
const files = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === "--scale") scale = +argv[++i]; else files.push(argv[i]); }
if (!files.length) { console.error("usage: node tools/svgshot.js in.svg [out.png] [--scale 1]"); process.exit(2); }
const jobs = files.length === 2 && /\.png$/i.test(files[1]) ? [[files[0], files[1]]] : files.map(f => [f, f.replace(/\.svg$/i, "") + ".png"]);
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [inp, out] of jobs) {
      const svg = fs.readFileSync(inp, "utf8");
      const W = +(svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/) || [0, 1200])[1];
      const H = +(svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/) || [0, 800])[1];
      const page = await browser.newPage({ viewport: { width: Math.ceil(W), height: Math.ceil(H) }, deviceScaleFactor: scale });
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#222">${svg}</body></html>`);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: Math.ceil(W), height: Math.ceil(H) } });
      await page.close();
      console.log("saved " + path.relative(process.cwd(), path.resolve(out)));
    }
  } finally { await browser.close(); }
})().catch(e => { console.error("FAIL " + e.message); process.exit(1); });
