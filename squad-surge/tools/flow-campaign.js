#!/usr/bin/env node
// THREE_LOCAL=/path/three.min.js node tools/flow-campaign.js  (screens go to design/qa/campaign/flow)
// Click-through test of the Operation Homeward UI in a real browser.
// A: fresh player — home, map, briefing, START, radio, loss + hint, retry, Assist offer, assisted retry,
//    quit to home, Arcade, Daily.   B: returning player — chapter 1 boss via the UI, results, vignette, chapter 2 map.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = require("path").resolve(__dirname, ".."), OUT = ROOT + "/design/qa/campaign/flow";
const THREE_LOCAL = process.env.THREE_LOCAL; if (!THREE_LOCAL) throw Error("Set THREE_LOCAL to a local three.min.js (r128)");
fs.mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split("?")[0]); const f = path.join(ROOT, u === "/" ? "index.html" : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
const botSrc = fs.readFileSync(ROOT + "/tools/bot-campaign.js", "utf8");
const installSrc = botSrc.slice(botSrc.indexOf("async function installBot"), botSrc.indexOf("function makeSimulation"))
  .replace(/await C\.goMission\(id,\{assist:0\}\);/, ""); // drive a mission the UI already started
if (!installSrc.startsWith("async function installBot")) throw Error("installBot not found");
const checks = []; let failed = 0;
const check = (name, ok, info = "") => { checks.push({ name, ok: !!ok, info }); if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + name + (info ? "  — " + info : "")); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(br, save) {
  const p = await br.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", e => errs.push("pageerror: " + e.message)); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  p.on("response", r => { if (r.status() >= 400) errs.push("HTTP " + r.status() + " " + r.url()); });
  await p.route("**/three.min.js", r => r.fulfill({ path: THREE_LOCAL, contentType: "application/javascript" }));
  await p.addInitScript(s => { localStorage.setItem("squad-surge-v1", JSON.stringify(s)); }, save);
  await p.goto(`http://127.0.0.1:${server.address().port}/index.html?hq`);
  await p.waitForFunction(() => window.__game && __game.state === "home", null, { timeout: 60000 });
  await p.waitForTimeout(2000);
  return { p, errs };
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const panelText = p => p.evaluate(() => document.querySelector(".st-panel")?.innerText.replace(/\s+/g, " ").trim() || null);
const clickText = (p, re, scope = ".st-panel") => p.evaluate(([src, scope]) => {
  const re = new RegExp(src, "i"); const b = [...document.querySelectorAll(scope + " button")].find(x => re.test(x.textContent) && !x.disabled && !x.closest("[hidden]"));
  if (b) { b.click(); return b.textContent.trim(); } return null; }, [re.source, scope]);
const waitState = (p, states, ms = 20000) => p.waitForFunction(s => s.includes(__game.state), states, { timeout: ms }).then(() => true, () => false);
const info = p => p.evaluate(() => { const g = __game, L = g.L; return { state: g.state, mission: L?.mission?.id || null, mode: L?.mode, assist: L?.missionState?.assisted ?? null, level: L?.level, pill: document.getElementById("levelNo")?.textContent, squad: L?.soldiers.length }; });
const wipe = p => p.evaluate(() => __game.ctx.killSoldiersInRect(-1e3, 1e3, -1e9, 1e9, Infinity, "horde"));
async function drive(p, policy = "smart") { // run the started mission to its end with the bot policy, in test mode
  await p.evaluate(`(${installSrc})(${JSON.stringify({ id: "ui", policy, seed: 7 })})`);
  let d; let bossShot = false;
  do {
    d = await p.evaluate(() => window.__campaignBatch(120));
    if (!bossShot && await p.evaluate(() => __game.state === "boss")) { bossShot = true; await p.evaluate(() => { for (let i = 0; i < 120 && __game.state === "boss"; i++) __game.advance(1); __game.draw(); }); await shot(p, "B3-boss-fight"); }
  } while (!d.done && d.tick < 18000);
  await p.evaluate(() => __game.setTestMode(false));
  return d;
}

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

  // ---------------- A: fresh player ----------------
  { const { p, errs } = await newPage(br, { sound: false, vibe: false });
    await shot(p, "A1-home");
    const home = await p.evaluate(() => ({ story: !document.getElementById("storyHome")?.hidden && document.getElementById("storyHome")?.textContent, arcade: document.getElementById("playBtn")?.textContent, daily: !!document.getElementById("mmDaily") }));
    check("home shows STORY button", home.story && /STORY|CONTINUE/.test(home.story), JSON.stringify(home));
    check("home relabels play as ARCADE", /ARCADE/.test(home.arcade || ""));
    await p.evaluate(() => document.getElementById("storyHome").click()); await p.waitForTimeout(800); await shot(p, "A2-map");
    const map = await p.evaluate(() => { const n = [...document.querySelectorAll(".st-node")]; return { nodes: n.length, open: n.filter(b => !b.disabled).length, next: document.querySelector(".st-node.next")?.innerText.replace(/\s+/g, " ") }; });
    check("map lists 36 missions, only the first open", map.nodes === 36 && map.open === 1, JSON.stringify(map));
    await p.evaluate(() => document.querySelector(".st-node:not(:disabled)").click()); await p.waitForTimeout(600); await shot(p, "A3-briefing");
    const brief = await panelText(p);
    check("briefing shows title, radio lines, 3 objectives", brief && /START/.test(brief) && (await p.evaluate(() => document.querySelectorAll(".st-panel .st-objectives li").length)) === 3, brief?.slice(0, 160));
    await clickText(p, /^\s*START/); const started = await waitState(p, ["play"]);
    let i1 = await info(p);
    check("START launches c1m1 with the overlay closed", started && i1.mission === "c1m1" && !(await p.$(".st-overlay")), JSON.stringify(i1));
    check("HUD pill shows campaign chapter and mission", /^C1 · 1/.test(i1.pill || ""), i1.pill);
    // advance the fixed-step sim until the first radio line fires (swiftshader runs slower than real time)
    const radioSeen = await p.evaluate(() => { const g = __game; g.setTestMode(true); const r = document.getElementById("storyRadio");
      for (let i = 0; i < 60 * 40 && g.state === "play"; i++) { g.advance(1); if (!r.hidden && r.textContent.trim()) { g.draw(); return r.textContent.trim(); } } return null; });
    await shot(p, "A4-radio"); await p.evaluate(() => __game.setTestMode(false)); check("radio line appears in play", !!radioSeen, radioSeen || "");
    await wipe(p); const lost = await waitState(p, ["lose"]); await p.waitForTimeout(1600); await shot(p, "A5-lose");
    const loseTxt = await panelText(p);
    check("loss shows results sheet with a hint", lost && /WIPED OUT/.test(loseTxt || "") && /gates|wave|steer|squad/i.test(loseTxt || ""), loseTxt?.slice(0, 220));
    check("first loss shows no Assist yet", await p.evaluate(() => !!document.querySelector(".st-assist")?.hidden));
    await clickText(p, /^\s*RETRY/); await waitState(p, ["play"]);
    i1 = await info(p); check("RETRY restarts the same mission", i1.mission === "c1m1" && i1.state === "play", JSON.stringify(i1));
    await wipe(p); await waitState(p, ["lose"]); await p.waitForTimeout(1600); await shot(p, "A6-assist-offer");
    check("second loss offers Assist", await p.evaluate(() => { const a = document.querySelector(".st-assist"); return !!a && !a.hidden; }), await p.evaluate(() => document.querySelector(".st-assist")?.textContent));
    await p.evaluate(() => { const c = document.querySelector(".st-assist input"); c.checked = true; });
    await clickText(p, /^\s*RETRY/); await waitState(p, ["play"]);
    i1 = await info(p); check("assisted retry starts with Assist on", i1.mission === "c1m1" && !!i1.assist, JSON.stringify(i1));
    await wipe(p); await waitState(p, ["lose"]); await p.waitForTimeout(1200);
    check("Assist stays ticked after an assisted loss", await p.evaluate(() => !!document.querySelector(".st-assist input")?.checked));
    await clickText(p, /^\s*RETRY/); await waitState(p, ["play"]);
    i1 = await info(p); check("retry after an assisted loss keeps Assist", !!i1.assist, JSON.stringify(i1));
    // quit from the pause menu, then Arcade must not resume the campaign
    await p.evaluate(() => document.getElementById("pauseBtn").click()); await waitState(p, ["paused"], 5000); await shot(p, "A7-pause");
    const quitLabel = await p.evaluate(() => document.getElementById("quitBtn").textContent);
    await p.evaluate(() => document.getElementById("quitBtn").click()); await waitState(p, ["home"]); await p.waitForTimeout(800);
    check("pause quit returns home", (await info(p)).state === "home", quitLabel);
    await p.evaluate(() => document.getElementById("playBtn").click()); const arc = await waitState(p, ["play"]); await p.waitForTimeout(2500); await shot(p, "A8-arcade");
    i1 = await info(p); check("ARCADE starts a normal level, not the campaign", arc && !i1.mission && i1.mode === "normal" && /Level/.test(i1.pill || ""), JSON.stringify(i1));
    await p.evaluate(() => __game.ctx.goMode({ mode: "normal", level: __game.save.level || 1, next: "home" })); await waitState(p, ["home"]); await p.waitForTimeout(800);
    await p.evaluate(() => document.getElementById("mmDaily").click()); const dl = await waitState(p, ["play"]); await p.waitForTimeout(2500); await shot(p, "A9-daily");
    i1 = await info(p); check("Daily starts the daily mode", dl && i1.mode === "daily" && !i1.mission, JSON.stringify(i1));
    check("A: no page errors or failed requests", errs.length === 0, [...new Set(errs)].slice(0, 8).join(" | "));
    await p.close(); }

  // ---------------- B: returning player, chapter 1 boss ----------------
  { const recs = {}, stars = {}; for (let n = 1; n <= 5; n++) { recs["c1m" + n] = { won: true, stars: 3, rescued: 4 }; stars["c1m" + n] = 3; }
    const { p, errs } = await newPage(br, { sound: false, vibe: false, level: 6, storyUI: { started: true, records: recs, vignettes: {}, offers: {} }, campaign: { stars } });
    const cont = await p.evaluate(() => document.getElementById("storyHome")?.textContent);
    check("home offers CONTINUE for a returning player", /CONTINUE/.test(cont || ""), cont);
    await p.evaluate(() => document.getElementById("storyHome").click()); await p.waitForTimeout(800); await shot(p, "B1-map-progress");
    const nx = await p.evaluate(() => document.querySelector(".st-node.next")?.innerText.replace(/\s+/g, " "));
    check("next node is the chapter 1 boss", /6/.test(nx || "") && /♛/.test(nx || ""), nx);
    await p.evaluate(() => document.querySelector(".st-node.next").click()); await p.waitForTimeout(600); await shot(p, "B2-boss-briefing");
    check("boss briefing is tagged BOSS", /BOSS/.test(await panelText(p) || ""));
    let won = false, tries = 0, last;
    while (!won && tries < 3) {
      tries++;
      if (tries === 1) await clickText(p, /^\s*START/); else await clickText(p, /^\s*RETRY/);
      await waitState(p, ["play"]); last = await drive(p, "smart"); won = last.result?.result === "win";
      await p.waitForTimeout(1800);
    }
    await shot(p, "B4-results");
    const res = await panelText(p);
    check("boss mission won through the UI (smart driver)", won, `tries ${tries}; ${JSON.stringify(last.result && { result: last.result.result, stars: last.result.stars, keptPct: last.result.keptPct, cause: last.result.cause })}`);
    if (won) {
      check("win sheet offers NEXT", /NEXT/.test(res || ""), res?.slice(0, 200));
      await clickText(p, /^\s*NEXT/); await p.waitForTimeout(900); await shot(p, "B5-vignette");
      const vg = await panelText(p);
      check("chapter vignette shows after the chapter's last win", /LIGHTS UP|RESTORED|NEXT DISTRICT/.test(vg || ""), vg?.slice(0, 200));
      await clickText(p, /NEXT DISTRICT|MAP/); await p.waitForTimeout(900); await shot(p, "B6-map-chapter2");
      const m2 = await p.evaluate(() => document.querySelector(".st-node.next")?.innerText.replace(/\s+/g, " "));
      check("map then points at chapter 2 mission 1", /1/.test(m2 || ""), m2);
    }
    check("B: no page errors or failed requests", errs.length === 0, [...new Set(errs)].slice(0, 8).join(" | "));
    await p.close(); }

  fs.writeFileSync(OUT + "/flow-checks.json", JSON.stringify(checks, null, 1));
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  await br.close(); server.close(); process.exitCode = failed ? 1 : 0;
})().catch(async e => { console.error("FAIL", e.stack || e.message); process.exit(2); });
