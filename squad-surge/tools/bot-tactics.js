#!/usr/bin/env node
"use strict";
// Real browser balance run. No gameplay shortcuts: all policies share the same steering.
// node tools/bot-tactics.js [--runs 3] [--levels 1-8] [--steering casual|perfect]
//                         [--policies never,smart,random] [--three /path/three.min.js]
// Use --engine simulation when a local browser/server cannot run (requires THREE_LOCAL).
// THREE_LOCAL can provide offline three.js r128. Otherwise use the game's CDN.
// Outputs each result as JSON, then wins, stars and retention summary tables. A timeout is an error, not a loss.
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const runs = Math.max(1, Number(args.runs || 1)), policies = (args.policies || "never,smart,random").split(",");
const range = args.levels || "1-8";
const levels = range.includes("-") ? (() => { const [a, b] = range.split("-").map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); })() : range.split(",").map(Number);
const steering = args.steering || "casual";
if (!policies.every(p => ["never", "smart", "random"].includes(p)) || !["casual", "perfect"].includes(steering)) throw new Error("Invalid policy or steering");
const local = args.three || process.env.THREE_LOCAL;
if (args.engine && !["browser", "simulation"].includes(args.engine)) throw new Error("Invalid engine");
if (local) process.env.THREE_LOCAL = path.resolve(local);
if (local && !fs.existsSync(local)) throw new Error(`Missing THREE_LOCAL: ${local}`);
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.resolve(ROOT, "." + (name === "/" ? "/index.html" : name));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
});
async function setupBot({ level, policy, steering, seed }) {
  const g = window.__game, C = g.ctx;
  C.renderer.render = () => {};
  await g.goLevel(level, "play");
  let steerSeed = seed, actionSeed = seed ^ 0xaffe, nextDecision = 0, nextAction = 1, dodge = null, lastSlam = 0;
  const choices = new Map(), counts = { threats: 0, ends: 0, got: 0, uses: 0, perfect: 0, maxLive: 0 }, live = new Set();
  const sr = () => (steerSeed = (Math.imul(steerSeed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const ar = () => (actionSeed = (Math.imul(actionSeed, 1664525) + 1013904223) >>> 0) / 4294967296;
  C.bus.on("threatLive", t => { counts.threats++; live.add(t.id); counts.maxLive = Math.max(counts.maxLive, live.size); });
  C.bus.on("threatEnd", t => { counts.ends++; live.delete(t.id); });
  C.bus.on("powerupGot", () => counts.got++);
  C.bus.on("powerupUse", e => { counts.uses++; if (e.perfect) counts.perfect++; });
  window.__tacticsCounts = counts;
  window.__tacticsThreats = []; window.__tacticsWin = null;
  C.bus.on("threatEnd", t => window.__tacticsThreats.push({ ...t }));
  C.bus.on("win", d => { window.__tacticsWin = { stars: d.stars, keptPct: d.keptPct }; });
  C.bus.on("tick", () => {
    const L = g.L;
    if (g.state !== "play" && g.state !== "boss") return;
    if (L.time < nextDecision) return; nextDecision = L.time + 0.12;
    // Equal steering for all three policies, with independent RNG from power-up decisions.
    if (g.state === "boss") {
      if (L.boss.slamT < lastSlam) dodge = null; lastSlam = L.boss.slamT;
      if (dodge === null) dodge = steering === "perfect" || sr() < 0.5;
      L.targetX = L.boss.slamT > 1.5 && dodge ? (L.boss.x > 0 ? -5 : 5) : Math.sin(L.time * 0.8) * 1.5;
    } else {
      let gate = null;
      for (const q of L.gates) if (!q.used && q.z < L.sz && q.z > L.sz - 32 && (!gate || q.z > gate.z)) gate = q;
      if (gate) {
        if (!choices.has(gate)) {
          const value = h => h.powerup ? L.soldiers.length + 8 : h.op === "x" ? L.soldiers.length * h.v : L.soldiers.length + h.v;
          const good = value(gate.halves[0]) >= value(gate.halves[1]) ? 0 : 1;
          choices.set(gate, steering === "perfect" || sr() < 0.6 ? good : 1 - good);
        }
        L.targetX = gate.halves[choices.get(gate)].x;
      } else L.targetX = steering === "perfect" ? 0 : Math.sin(L.time * 0.65) * 3;
    }
    if (policy === "smart") {
      const t = C.threat;
      if (t) {
        if (L.swap && L.swap.type === t.counter) C.usePowerup(C.belt[0] === t.counter ? 1 : 0);
        if (!L.swap) { const slot = C.belt.indexOf(t.counter); if (slot >= 0) C.usePowerup(slot); }
      }
      if (g.state === "boss" && C.surgeReady) C.useSurge();
    } else if (policy === "random" && L.time >= nextAction) {
      nextAction = L.time + 0.8 + ar() * 2;
      C.usePowerup(ar() < 0.5 ? 0 : 1);
      if (C.surgeReady && ar() < 0.5) C.useSurge();
    }
  });
}
let browser;
(async () => {
  const results = [];
  if (args.engine === "simulation") {
    console.log("Simulation balance check: real core and bot policies; DOM/graphics stubbed, fixed 50 ms steps.");
    const vm = require("vm");
    process.chdir(ROOT);
    // Reuse the behavioral checker's boot fixture, without executing its tests.
    const fixture = fs.readFileSync(path.join(ROOT, "tools/check-tactics.js"), "utf8").split("const H=sandbox.H,events=[];")[0];
    for (let attempt = 0; attempt < runs; attempt++) for (const level of levels) for (const policy of policies) {
      const sandbox = new Function("require", fixture.replace(/^#!.*\n/, "") + "\nreturn sandbox;")(require);
      const H = sandbox.H;
      let randomSeed = level * 997 + attempt * 193 + 17;
      sandbox.Math = Object.create(Math);
      sandbox.Math.random = () => (randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) / 4294967296;
      sandbox.__game = { ctx: H.ctx, get L() { return H.L; }, get state() { return H.state; }, goLevel(l) { H.startLevel(l); H.setState("play"); } };
      const config = { level, policy, steering, seed: level * 173 + attempt * 697 + 11 };
      await vm.runInContext(`(${setupBot.toString()})(${JSON.stringify(config)})`, sandbox);
      for (let i = 0; i < 10000 && ["play", "boss", "bonus"].includes(H.state); i++) H.step(.05);
      const L = H.L, errors = [];
      if (sandbox.__tacticsCounts.maxLive > 1) errors.push("Overlapping live threats");
      if (policy === "never" && sandbox.__tacticsCounts.uses) errors.push("Never policy activated a power-up");
      const row = { level, policy, attempt: attempt + 1, steering, engine: "simulation",
        result: ["win", "lose"].includes(H.state) ? H.state : "ERROR", stars: sandbox.__tacticsWin?.stars ?? 0, keptPct: sandbox.__tacticsWin?.keptPct ?? Math.floor(L.soldiers.length / Math.max(1, L.peakSquad) * 100), 
        score: Math.round(L.score * L.mult), mult: L.mult, squad: L.bossSoldiers || L.soldiers.length, peakSquad: L.peakSquad, 
        threats: L.threats.map(t => ({ kind: t.kind, start: t.startSquad, cap: t.lossCap, lost: t.lost, countered: t.countered })), 
        tactics: { ...H.ctx.tactics }, events: sandbox.__tacticsCounts, errors };
      results.push(row); console.log(JSON.stringify(row));
    }
  } else {
    const { chromium } = require("playwright");
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    for (let attempt = 0; attempt < runs; attempt++) for (const level of levels) for (const policy of policies) {
      // Fresh context isolates saves, jackpot pity, coach counts and mission state per policy.
      const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
      if (local) await page.route("**/three.min.js", r => r.fulfill({ path: path.resolve(local), contentType: "application/javascript" }));
      await page.addInitScript(({ seed }) => {
        localStorage.setItem("squad-surge-v1", JSON.stringify({ level: 1, unlocked: 99, sound: false, vibe: false }));
        let r = seed >>> 0;
        Math.random = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296;
        const now = performance.now.bind(performance), raf = requestAnimationFrame.bind(window);
        performance.now = () => now() * 4;
        // RAF timestamps must use the same clock as performance.now; otherwise x4 has no effect.
        window.requestAnimationFrame = cb => raf(t => cb(t * 4));
      }, { seed: level * 997 + attempt * 193 + 17 });
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}/index.html?hq`);
        await page.waitForFunction(() => window.__game && __game.state === "home", null, { timeout: 60000 });
        await page.evaluate(setupBot, { level, policy, steering, seed: level * 173 + attempt * 697 + 11 });
        await page.waitForFunction(() => ["win", "lose"].includes(__game.state), null, { timeout: 180000, polling: 200 });
        const result = await page.evaluate(() => {
          const { L, state, ctx } = __game;
          return { result: state, stars: window.__tacticsWin?.stars ?? 0, keptPct: window.__tacticsWin?.keptPct ?? Math.round(L.soldiers.length / Math.max(1, L.peakSquad) * 100), peakSquad: L.peakSquad, threats: window.__tacticsThreats, squad: L.bossSoldiers || L.soldiers.length, progress: Math.round(L.reached * 100), bossPct: Math.max(0, Math.round(L.boss.hp / L.boss.maxHp * 100)), score: Math.round(L.score * L.mult), mult: L.mult, tactics: { ...ctx.tactics }, events: window.__tacticsCounts };
        });
        if (result.events.maxLive > 1) errors.push("Overlapping live threats");
        if (policy === "never" && result.events.uses) errors.push("Never policy activated a power-up");
        const row = { level, policy, attempt: attempt + 1, steering, ...result, errors };
        results.push(row); console.log(JSON.stringify(row));
      } catch (error) {
        const row = { level, policy, attempt: attempt + 1, result: "ERROR", error: error.message, errors };
        results.push(row); console.error(JSON.stringify(row)); process.exitCode = 1;
      } finally { await context.close(); }
    }
  }
  console.log(`\nWins / attempts (${steering} steering; errors reported separately)`);
  console.table(levels.map(level => {
    const row = { level };
    for (const policy of policies) { const r = results.filter(x => x.level === level && x.policy === policy); row[policy] = `${r.filter(x => x.result === "win").length}/${r.length}` + (r.some(x => x.result === "ERROR" || x.errors.length) ? " ERROR" : ""); }
    return row;
  }));
  console.log("Policy summary (completed runs; losses count as zero stars)");
  console.table(policies.map(policy => {
    const r = results.filter(x => x.policy === policy && x.result !== "ERROR");
    const avg = key => r.length ? (r.reduce((sum, x) => sum + x[key], 0) / r.length).toFixed(1) : "—";
    return { policy, wins: `${r.filter(x => x.result === "win").length}/${results.filter(x => x.policy === policy).length}`, averageStars: avg("stars"), averageKeptPct: avg("keptPct") };
  }));
  if (results.some(r => r.result === "ERROR" || r.errors.length)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
