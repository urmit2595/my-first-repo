/* Squad Surge "Surge Update": meta layer (missions, daily, results, armory, trophies, bests, share).
   window.Meta.setup(ctx). Own storage key squad-surge-meta-v1. Everything is wrapped so the game works without it. */
(function () {
"use strict";
const KEY = "squad-surge-meta-v1";
const DAY0 = Date.UTC(2026, 0, 1);
let ctx, bus, $, game, M, run, haveIcons = null, activeSeen = false;
const q = (s, r) => (r || document).querySelector(s);
const fmt = n => Math.round(+n || 0).toLocaleString("en-US");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tryF = f => { try { return f(); } catch (e) { console.error("meta", e); } };

/* ---------------- storage ---------------- */
function fresh() {
  return { v: 1, uid: 1, started: false, medals: 0, missions: [], trophies: {}, seenUnlock: {}, skin: null, tracer: null,
    daily: { best: {}, stars: {}, lastDay: null, streak: 0, bestStreak: 0, freezes: 0, wins: 0, played: {} },
    stats: { perfect: 0, wasted: 0, banked: 0, threatsCountered: 0, bankLevels: 0, cleanWins: 0, kills: 0, wins: 0, gates: 0, maxCombo: 0, maxSquad: 0, maxMult: 0, maxScore: 0, surges: 0, barrels: 0, slams: 0, airdrops: 0, noLoss: 0, missions: 0, maxRunKills: 0, jackpots: 0, bosses: 0, pu: {} } };
}
function load() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(KEY)); } catch (e) { m = null; }
  const f = fresh();
  if (!m || typeof m !== "object") return f;
  // Merge nested defaults before replacing their parent (also migrates pre-tactics saves).
  const daily = Object.assign({}, f.daily, m.daily || {}), stats = Object.assign({}, f.stats, m.stats || {});
  m = Object.assign(f, m, { daily, stats });
  for (const k of ["perfect", "wasted", "banked", "threatsCountered", "bankLevels", "cleanWins"])
    if (!Number.isFinite(m.stats[k]) || m.stats[k] < 0) m.stats[k] = 0;
  if (!Array.isArray(m.missions)) m.missions = [];
  return m;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) { /* storage unavailable: fine */ } }
const gsave = () => (ctx && ctx.save) || {};
const active = () => (gsave().unlocked || 1) >= 3 || !!gsave().storyUI?.started;
const storyStars = () => Object.values(gsave().storyUI?.records || {}).map(r => Number(r.stars) || 0);
const totalStars = () => Object.values(gsave().stars || {}).reduce((a, b) => a + (+b || 0), 0) + storyStars().reduce((a, b) => a + b, 0);
const stars3 = () => Object.values(gsave().stars || {}).filter(v => v >= 3).length + storyStars().filter(v => v >= 3).length;

/* ---------------- icons ---------------- */
const SV = {
  skull: '<path fill="#fff" stroke="#0d1630" stroke-width="1.5" d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.6 1.2 4.6 3 5.8V19a1 1 0 0 0 1 1h1.5v-2h2v2h2v-2h2v2h1.5a1 1 0 0 0 1-1v-3c1.8-1.2 3-3.2 3-5.8C20.5 5.6 17 2 12 2z"/><circle cx="8.7" cy="11" r="2" fill="#0d1630"/><circle cx="15.3" cy="11" r="2" fill="#0d1630"/>',
  gate: '<rect x="2.5" y="5" width="8" height="14" rx="2" fill="#ff5a4d" stroke="#0d1630" stroke-width="1.5"/><rect x="13.5" y="5" width="8" height="14" rx="2" fill="#4fb0ff" stroke="#0d1630" stroke-width="1.5"/>',
  block: '<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="#ffc928" stroke="#0d1630" stroke-width="1.5"/><path d="M7 8h10" stroke="#fff" stroke-width="2" opacity=".6"/>',
  crown: '<path fill="#ffc928" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  flame: '<path fill="#ff8a1f" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-6 .5 1.5 1 2 2 2 0-3-1-5 1-8z"/><path fill="#ffd84a" d="M12 21a3.2 3.2 0 0 1-3.2-3.2c0-2 1.7-2.8 2.4-4.4 1.7 1.2 4 2.4 4 4.4A3.2 3.2 0 0 1 12 21z"/>',
  bolt: '<path fill="#ffe14a" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M13 2L4.5 13.5H11L9.5 22l9-12H12z"/>',
  star: '<path fill="#ffd84a" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3" fill="#fff" stroke="#0d1630" stroke-width="1.5"/><rect x="3" y="5" width="18" height="5" rx="2" fill="#e8392f" stroke="#0d1630" stroke-width="1.5"/><path d="M8 14h3M13 14h3M8 17.5h3" stroke="#0d1630" stroke-width="2" stroke-linecap="round"/>',
  medal: '<path fill="#4fb0ff" stroke="#0d1630" stroke-width="1.5" d="M7 2h4l1 6H8zM17 2h-4l-1 6h4z"/><circle cx="12" cy="15" r="6" fill="#ffc928" stroke="#0d1630" stroke-width="1.5"/><path fill="#fff" opacity=".8" d="M12 11.5l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3z"/>',
  airdrop: '<path fill="#ff5a4d" stroke="#0d1630" stroke-width="1.5" d="M2.5 11a9.5 9 0 0 1 19 0c-1.5-1.6-3.4-1.6-4.8 0-1.4-1.6-3.2-1.6-4.7 0-1.4-1.6-3.3-1.6-4.8 0-1.4-1.6-3.2-1.6-4.7 0z"/><path d="M3.5 11.5L10 19M20.5 11.5L14 19M12 11v8" stroke="#0d1630" stroke-width="1.2" fill="none"/><rect x="9.5" y="18" width="5" height="4" rx="1" fill="#c88a3a" stroke="#0d1630" stroke-width="1.2"/>',
  barrel: '<path fill="#e8392f" stroke="#0d1630" stroke-width="1.5" d="M6 3h12l2 4v10l-2 4H6l-2-4V7z"/><path d="M4.5 8.5h15M4.5 15.5h15" stroke="#0d1630" stroke-width="1.4"/><path fill="#ffc928" d="M12 9.5l2 2.5-2 2.5-2-2.5z"/>',
  "helmet-plus": '<path fill="#2f7bff" stroke="#0d1630" stroke-width="1.5" d="M3 15a9 9 0 0 1 18 0v2H3z"/><path d="M16 4v6M13 7h6" stroke="#38c95b" stroke-width="3" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#0d1630" stroke-width="1.5"/><circle cx="12" cy="12" r="6" fill="#e8392f"/><circle cx="12" cy="12" r="3" fill="#fff"/><circle cx="12" cy="12" r="1.3" fill="#e8392f"/>',
  trophy: '<path fill="#ffc928" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M7 3h10v6a5 5 0 0 1-10 0z"/><path d="M7 5H3.5c0 4 1.5 5.5 3.7 5.5M17 5h3.5c0 4-1.5 5.5-3.7 5.5" stroke="#0d1630" stroke-width="1.5" fill="none"/><path fill="#ffc928" stroke="#0d1630" stroke-width="1.5" d="M10.5 14h3v4h-3zM7 21h10v-3H7z"/>',
  "pu-shield": '<path fill="#4fd0ff" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><path fill="#fff" opacity=".6" d="M12 5v14c3-1.2 5-4 5-7.5V7z"/>',
  "pu-airstrike": '<path fill="#9aa7b8" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M12 2l2.5 7 7.5 4v2.5L14 14l-.5 5 2.5 1.5V22H8v-1.5l2.5-1.5-.5-5L2 15.5V13l7.5-4z"/>',
  "pu-giant": '<path fill="#38c95b" stroke="#0d1630" stroke-width="1.5" stroke-linejoin="round" d="M12 2l5 8-3 0 4 7H6l4-7H7z"/><path d="M3 21h18" stroke="#0d1630" stroke-width="2" stroke-linecap="round"/>',
  "pu-jackpot": '<circle cx="12" cy="12" r="9.5" fill="#ffc928" stroke="#0d1630" stroke-width="1.5"/><path d="M12 6v12M15 9c-1-1.3-5-1.6-5 .8 0 2.7 5 1.4 5 4 0 2.3-4 2-5 .5" stroke="#0d1630" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#8a97c0" stroke="#0d1630" stroke-width="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#0d1630" stroke-width="2" fill="none"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  armory: '<path fill="#fff" stroke="#0d1630" stroke-width="1.5" d="M5 11a7 7 0 0 1 14 0v2H5z"/><path fill="#ffc928" stroke="#0d1630" stroke-width="1.5" d="M3 13h18l-1.5 4.5h-15z"/><path fill="#fff" stroke="#0d1630" stroke-width="1.5" d="M8 17.5h8l-1 3.5H9z"/>',
};
const ALIAS = { crown: "boss", bolt: "surge", calendar: "daily", "helmet-plus": "squad" };
function ico(name, cls) {
  const n = SV[name] ? name : "star";
  const key = ALIAS[name] || name;
  if (haveIcons && haveIcons[key]) return `<img class="mi ${cls || ""}" src="${haveIcons[key]}" alt="" draggable="false">`;
  return `<svg class="mi ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true">${SV[n]}</svg>`;
}
function probeIcons() {
  try {
    fetch("assets/ui/icons/icons.json").then(r => r.ok ? r.json() : null).then(j => {
      if (!j) return;
      const src = j.icons && !Array.isArray(j.icons) ? j.icons : j, map = {};
      if (Array.isArray(src)) src.forEach(x => { const n = String(x.name || x).replace(/\.\w+$/, ""); map[n] = x.file || `assets/ui/icons/${n}.webp`; });
      else Object.keys(src).forEach(n => { map[n] = (src[n] && src[n].file) || `assets/ui/icons/${n}.webp`; });
      haveIcons = map;
      refreshHome();
    }).catch(() => {});
  } catch (e) { /* no icons */ }
}

/* ---------------- toasts ---------------- */
let toastBox;
function toast(html, cls) {
  if (!toastBox) return;
  if (toastBox.parentElement.classList.contains("juice-callout")) {
    setTimeout(() => toast(html, cls), 1200); return;
  }
  const t = document.createElement("div"); t.className = "mt-toast " + (cls || ""); t.innerHTML = html;
  toastBox.appendChild(t);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ---------------- days / daily ---------------- */
function dayIndex(d) { d = d || new Date(); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAY0) / 864e5); }
function dailyInfo() {
  const d = dayIndex(), keys = Object.keys((ctx && ctx.MODIFIERS) || {});
  const modifier = keys.length ? keys[d % keys.length] : null;
  const mod = modifier && ctx.MODIFIERS[modifier];
  return { day: d, num: d + 1, level: 2 + (d * 5) % 7, /* levels 2-8: fair for newer players */ modifier, modName: (mod && mod.name) || (modifier ? String(modifier).toUpperCase() : "Surprise"), seed: d };
}
function effStreak() {
  const D = M.daily, d = dayIndex();
  if (D.lastDay == null) return 0;
  const gap = d - D.lastDay;
  if (gap <= 1) return D.streak;
  return D.freezes >= gap - 1 ? D.streak : 0;
}
function recordDaily(data) {
  const D = M.daily, d = dayIndex(), score = data.total != null ? data.total : data.score || 0;
  D.best[d] = Math.max(D.best[d] || 0, score);
  D.stars[d] = Math.max(D.stars[d] || 0, data.stars || 0);
  const keep = Object.keys(D.best).map(Number).sort((a, b) => b - a).slice(0, 60);
  for (const k of Object.keys(D.best)) if (!keep.includes(+k)) { delete D.best[k]; delete D.stars[k]; }
  let used = 0, first = false;
  if (D.lastDay !== d) {
    first = true; D.wins++;
    if (D.lastDay == null) D.streak = 1;
    else {
      const gap = d - D.lastDay;
      if (gap <= 1) D.streak++;
      else if (D.freezes >= gap - 1) { D.freezes -= gap - 1; used = gap - 1; D.streak++; }
      else D.streak = 1;
    }
    if (D.streak % 7 === 0) D.freezes = Math.min(2, D.freezes + 1);
    D.lastDay = d; D.bestStreak = Math.max(D.bestStreak, D.streak);
  }
  return { first, used, score, day: d };
}

/* ---------------- missions ---------------- */
// k = feed kind; mode sum (accumulates) or max (best value seen). All are normal-play goals.
const POOL = [
  { id: "tPerfect", k: "tPerfectRun", mode: "max", t: "Score {n} PERFECT uses in one run", base: 3, per: 0, m: 2, ic: "target" },
  { id: "tBank", k: "tBank", t: "Bank {n} power-ups", base: 2, per: 0, m: 1, ic: "airdrop" },
  { id: "tSwarm", k: "tCounter_swarm", t: "Counter {n} SWARM with AIRSTRIKE", base: 1, per: 0, m: 2, ic: "pu-airstrike" },
  { id: "tClean", k: "tClean", t: "Win without wasting a power-up", base: 1, per: 0, m: 2, ic: "target" },
  { id: "tBarricade", k: "tCounter_barricade", t: "Counter {n} BARRICADES as GIANT", base: 2, per: 0, m: 2, ic: "pu-giant" },
  { id: "tMortars", k: "tCounter_mortars", t: "Counter {n} MORTARS with SHIELD", base: 2, per: 0, m: 2, ic: "pu-shield" },
  { id: "tSurge", k: "tSurge", t: "Score {n} PERFECT SURGE uses", base: 2, per: 0, m: 2, ic: "surge" },
  { id: "kill1", k: "kill", t: "Kill {n} enemies", base: 120, per: 30, step: 10, m: 1, ic: "skull", endow: 1 },
  { id: "kill2", k: "kill", t: "Kill {n} enemies", base: 350, per: 70, step: 10, m: 2, ic: "skull", endow: 1 },
  { id: "runkill", k: "runkills", mode: "max", t: "Kill {n} enemies in one level", base: 40, per: 8, step: 5, m: 2, ic: "target" },
  { id: "brute", k: "brute", t: "Take down {n} brutes", base: 4, per: .8, m: 1, ic: "skull" },
  { id: "gate1", k: "gate", t: "Pass {n} gain gates", base: 14, per: 3, step: 2, m: 1, ic: "gate", endow: 1 },
  { id: "gate2", k: "gate", t: "Pass {n} gain gates", base: 40, per: 6, step: 5, m: 2, ic: "gate", endow: 1 },
  { id: "jack", k: "jackpot", t: "Hit {n} golden gates", base: 1, per: .15, m: 2, ic: "pu-jackpot" },
  { id: "combo1", k: "combo", mode: "max", t: "Reach a combo of {n}", base: 15, per: 2, step: 5, m: 1, ic: "flame" },
  { id: "combo2", k: "combo", mode: "max", t: "Reach a combo of {n}", base: 35, per: 4, step: 5, m: 3, ic: "flame" },
  { id: "surge1", k: "surge", t: "Trigger SURGE {n} times", base: 2, per: .3, m: 1, ic: "surge" },
  { id: "surge2", k: "surge", t: "Trigger SURGE {n} times", base: 5, per: .6, m: 2, ic: "surge" },
  { id: "air1", k: "pu", t: "Open {n} airdrops", base: 2, per: .3, m: 1, ic: "airdrop" },
  { id: "air2", k: "pu", t: "Open {n} airdrops", base: 5, per: .5, m: 2, ic: "airdrop" },
  { id: "giant", k: "pu_giant", t: "Go GIANT {n} times", base: 1, per: .3, m: 2, ic: "pu-giant" },
  { id: "shield", k: "pu_shield", t: "Pop {n} shields", base: 2, per: .3, m: 1, ic: "pu-shield" },
  { id: "strike", k: "pu_airstrike", t: "Call in {n} airstrikes", base: 1, per: .3, m: 2, ic: "pu-airstrike" },
  { id: "barrel1", k: "barrel", t: "Blow up {n} barrels", base: 3, per: .5, m: 1, ic: "barrel" },
  { id: "barrel2", k: "barrel", t: "Blow up {n} barrels", base: 8, per: 1, m: 2, ic: "barrel" },
  { id: "dodge1", k: "dodge", t: "Dodge {n} boss slams", base: 3, per: .3, m: 1, ic: "target" },
  { id: "dodge2", k: "dodge", t: "Dodge {n} boss slams", base: 6, per: .6, m: 2, ic: "target" },
  { id: "finale", k: "finale", mode: "max", t: "Reach x{n} in the finale", vals: [2, 3, 4, 5, 7], m: 2, ic: "crown" },
  { id: "finale2", k: "finale", mode: "max", t: "Reach x{n} in the finale", vals: [5, 7, 10], m: 3, ic: "crown" },
  { id: "squadwin", k: "squadwin", mode: "max", t: "Win with {n}+ soldiers", base: 25, per: 7, step: 5, m: 2, ic: "helmet-plus" },
  { id: "squad", k: "squad", mode: "max", t: "Grow your squad to {n}", base: 40, per: 10, step: 5, m: 2, ic: "helmet-plus" },
  { id: "star", k: "star", t: "Earn {n} stars", base: 4, per: .6, m: 1, ic: "star" },
  { id: "win", k: "win", t: "Win {n} levels", base: 2, per: .3, m: 1, ic: "crown" },
  { id: "score", k: "score", mode: "max", t: "Score {n} in one level", base: 3000, per: 800, step: 500, m: 2, ic: "star" },
  { id: "noloss", k: "noloss", t: "Win with no soldiers lost", base: 1, per: 0, m: 3, ic: "pu-shield" },
  { id: "block", k: "block", t: "Smash {n} yellow blocks", base: 3, per: .5, m: 1, ic: "block" },
  { id: "crate", k: "crate", t: "Smash {n} crates", base: 8, per: 1.5, m: 1, ic: "block" },
  { id: "case", k: "case", t: "Open {n} weapon cases", base: 2, per: .3, m: 1, ic: "target" },
  { id: "daily", k: "daily", t: "Play today's Daily", base: 1, per: 0, m: 2, ic: "calendar" },
];
const FIRST_IDS = ["surge1", "dodge1", "barrel1", "air1"];
const pdef = id => POOL.find(p => p.id === id);
function progLevel() { return clamp((gsave().unlocked || 3) - 2, 1, 25); }
function targetFor(e) {
  const p = progLevel();
  if (e.vals) return e.vals[Math.min(e.vals.length - 1, Math.floor((p - 1) / 2))];
  const s = e.step || 1;
  return Math.max(e.base, Math.round((e.base + e.per * (p - 1)) / s) * s);
}
const mtext = m => { const e = pdef(m.id); return e ? e.t.replace("{n}", fmt(m.target)) : "Mission"; };
function drawMission(first) {
  const used = new Set(M.missions.map(m => (pdef(m.id) || {}).k));
  const ids = new Set(M.missions.map(m => m.id));
  let cands = POOL.filter(p => !used.has(p.k) && !ids.has(p.id));
  if (first) cands = cands.filter(p => FIRST_IDS.includes(p.id));
  if (!cands.length) cands = POOL.filter(p => !ids.has(p.id));
  const e = cands[Math.floor(Math.random() * cands.length)];
  const m = { uid: M.uid++, id: e.id, target: targetFor(e), prog: 0 };
  if (first) { m.target = 3; m.prog = 1; }          // endowed start: 1 of 3 done
  else if (e.endow && m.target >= 10) m.prog = Math.floor(m.target * 0.15);
  return m;
}
function ensureMissions() {
  if (!active()) return;
  while (M.missions.length < 3) M.missions.push(drawMission(!M.started && M.missions.length === 0));
  M.started = true;
}
function feed(kind, val, tag) {
  if (!active() || !M.missions.length) return;
  let changed = false;
  for (let i = 0; i < M.missions.length; i++) {
    const m = M.missions[i], e = pdef(m.id);
    if (!e || e.k !== kind) continue;
    const before = m.prog;
    if (e.mode === "max") m.prog = Math.max(m.prog, val); else m.prog += val;
    if (m.prog !== before) changed = true;
    if (m.prog >= m.target) completeMission(i);
  }
  if (changed) persist();
}
function completeMission(i) {
  const m = M.missions[i], e = pdef(m.id);
  M.medals += e.m; M.stats.missions++;
  run.done.push({ text: mtext(m), medals: e.m, ic: e.ic });
  toast(`${ico("medal")}<span><b>MISSION COMPLETE</b><small>${mtext(m)} · +${e.m} medal${e.m > 1 ? "s" : ""}</small></span>`, "ms");
  M.missions[i] = drawMission(false);
  persist();
  setTimeout(() => { checkUnlocks(); checkTrophies(); refreshHome(); }, 50);
}

/* ---------------- armory ---------------- */
const SKIN_REQ = [null, { m: 5 }, { s: 6 }, { st: 3 }, { m: 15 }, { s: 18 }, { st: 7 }, { m: 40 }];
const TRACER_REQ = [null, { m: 10 }, { s: 12 }, { st: 5 }, { m: 30 }];
const FALLBACK_SKINS = [["blue", "SQUAD BLUE", "#2f7bff"], ["red", "CRIMSON", "#e8392f"], ["green", "FOREST", "#38c95b"], ["gold", "GOLDEN", "#ffb300"], ["purple", "VIOLET", "#8a4bff"], ["orange", "BLAZE", "#ff7a1a"], ["pink", "ROSE", "#ff5fa8"], ["black", "NIGHT", "#2a2f3d"]];
const FALLBACK_TRACERS = [["yellow", "CLASSIC", "#ffe14a"], ["cyan", "ICE", "#4fe0ff"], ["red", "EMBER", "#ff4a3a"], ["green", "TOXIC", "#6cf07a"], ["white", "PULSE", "#ffffff"]];
function toHex(c) { if (typeof c === "number") return "#" + c.toString(16).padStart(6, "0"); return typeof c === "string" ? c : null; }
function entries(src, fb) {
  const out = [], pal = ["#2f7bff", "#e8392f", "#38c95b", "#ffb300", "#8a4bff", "#ff7a1a", "#ff5fa8", "#2a2f3d"];
  if (src && typeof src === "object") {
    const arr = Array.isArray(src) ? src.map((v, i) => [v && v.id != null ? v.id : i, v]) : Object.entries(src);
    arr.forEach(([id, v], i) => out.push({ hue: v && v.hue, sat: v && v.sat, val: v && v.val, id, name: String((v && v.name) || id).toUpperCase(), color: (v && Array.isArray(v.rgb)) ? "#" + v.rgb.map(c => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, "0")).join("") : toHex(v && (v.color ?? v.tint ?? v.hex ?? v.c ?? v.col ?? (v.colors && v.colors[0]))) || pal[i % pal.length] }));
  }
  if (!out.length) fb.forEach(([id, name, color]) => out.push({ id, name, color }));
  return out;
}
const skins = () => entries(ctx && ctx.SKINS, FALLBACK_SKINS);
const tracers = () => entries(ctx && ctx.TRACERS, FALLBACK_TRACERS);
function reqOf(table, i) { return i === 0 ? null : table[i] || { m: 10 * i }; }
function reqState(r) {
  if (!r) return { ok: true, need: 0, text: "" };
  if (r.m) return { ok: M.medals >= r.m, need: r.m - M.medals, text: `${r.m} medals`, unit: "medal" };
  if (r.s) return { ok: totalStars() >= r.s, need: r.s - totalStars(), text: `${r.s} total stars`, unit: "star" };
  return { ok: M.daily.bestStreak >= r.st, need: r.st - M.daily.bestStreak, text: `${r.st}-day daily streak`, unit: "streak" };
}
function armoryItems() {
  const out = [];
  skins().forEach((s, i) => out.push({ kind: "skin", i, ...s, req: reqState(reqOf(SKIN_REQ, i)) }));
  tracers().forEach((t, i) => out.push({ kind: "tracer", i, ...t, req: reqState(reqOf(TRACER_REQ, i)) }));
  for (const it of out) if (gsave().storyUI?.cosmetics?.[it.kind + ":" + it.id]) it.req = { ok: true, need: 0, text: "Chapter reward" };
  return out;
}
// Chapter rewards use the same armory items, equip buttons and unlock toast.
function unlockChapter(id) {
  if (!ctx || !M || !ctx.save) return null;
  const list = skins(), item = list[1 + ((Number(id) - 1) % Math.max(1, list.length - 1))] || list[0];
  const s = ctx.save.storyUI ||= {}; s.cosmetics ||= {};
  s.cosmetics["skin:" + item.id] = true;
  ctx.persist?.(); checkUnlocks(); checkTrophies();
  return item;
}
function checkUnlocks() {
  if (!active()) return;
  const fresh = armoryItems().filter(it => it.req.ok && !M.seenUnlock[it.kind + ":" + it.id] && it.i > 0);
  if (!fresh.length) return;
  for (const it of fresh) M.seenUnlock[it.kind + ":" + it.id] = 1;
  persist();
  toast(`${ico("helmet-plus")}<span><b>ARMORY UNLOCKED</b><small>${fresh.length === 1 ? fresh[0].name + (fresh[0].kind === "skin" ? " squad" : " tracers") : fresh.length + " new items"}</small></span>`, "ar");
}
function skinFilter(it) {
  if (it.hue != null) return `hue-rotate(${Math.round(it.hue * 360 - 217)}deg) saturate(${(0.5 + it.sat * 0.9).toFixed(2)}) brightness(${(it.val || 1).toFixed(2)})`;
  if (it.i === 0) return "none";
  const hex = it.color;
  const m = /^#?([0-9a-f]{6})/i.exec(hex || ""); if (!m) return "none";
  const r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  if (s < 0.2) return l < 0.3 ? "grayscale(1) brightness(.45)" : l > 0.75 ? "grayscale(1) brightness(1.9)" : "grayscale(1)";
  return `hue-rotate(${Math.round(h - 217)}deg) saturate(${(0.8 + s * 0.7).toFixed(2)}) brightness(${(0.72 + l * 0.55).toFixed(2)})`;
}
function curSkin() { const l = skins(); return M.skin != null && l.some(x => x.id == M.skin) ? M.skin : l[0].id; }
function curTracer() { const l = tracers(); return M.tracer != null && l.some(x => x.id == M.tracer) ? M.tracer : l[0].id; }
function applySkin() { tryF(() => ctx.setSkin && ctx.setSkin(curSkin(), curTracer())); }
function nextUnlockGoal() {
  let best = null;
  for (const it of armoryItems()) {
    if (it.req.ok) continue;
    const need = it.req.need;
    const score = it.req.unit === "streak" ? need * 3 : need; // streaks are slower to earn
    if (!best || score < best.score) best = { it, need, score };
  }
  if (best) {
    const { it, need } = best, u = it.req.unit;
    const what = `${it.name} ${it.kind === "skin" ? "squad" : "tracers"}`;
    if (u === "streak") return `Reach a ${it.req.text} to unlock ${what}`;
    return `${need} more ${u}${need > 1 ? "s" : ""} to unlock ${what}`;
  }
  let t = null;
  for (const tr of TROPHIES) {
    if (M.trophies[tr.id] || !tr.p) continue;
    const [c, n] = tr.p(); const f = c / n;
    if (!t || f > t.f) t = { tr, f, c, n };
  }
  return t ? `Trophy ${t.tr.n}: ${fmt(t.c)}/${fmt(t.n)}` : "";
}

/* ---------------- trophies ---------------- */
const S = () => M.stats;
const TROPHIES = [
  { id: "tactician", n: "TACTICIAN", d: "10 lifetime PERFECT uses", ic: "target", f: () => S().perfect >= 10, p: () => [S().perfect, 10] },
  { id: "hoarder", n: "HOARDER", d: "Bank 2 power-ups in 5 levels", ic: "airdrop", f: () => S().bankLevels >= 5, p: () => [S().bankLevels, 5] },
  { id: "neverWasted", n: "NEVER WASTED", d: "Win 5 levels without wasting a power-up", ic: "pu-shield", f: () => S().cleanWins >= 5, p: () => [S().cleanWins, 5] },
  { id: "first", n: "FIRST WIN", d: "Win a level", ic: "crown", f: () => S().wins >= 1 },
  { id: "vet", n: "VETERAN", d: "Win 25 levels", ic: "crown", f: () => S().wins >= 25, p: () => [S().wins, 25] },
  { id: "k100", n: "MOW 'EM DOWN", d: "100 kills in one level", ic: "skull", f: () => S().maxRunKills >= 100, p: () => [S().maxRunKills, 100] },
  { id: "k1000", n: "ENEMY OF THE DEAD", d: "1,000 lifetime kills", ic: "skull", f: () => S().kills >= 1000, p: () => [S().kills, 1000] },
  { id: "sq100", n: "CENTURION", d: "A squad of 100+", ic: "helmet-plus", f: () => S().maxSquad >= 100, p: () => [S().maxSquad, 100] },
  { id: "c25", n: "ON A ROLL", d: "Reach a combo of 25", ic: "flame", f: () => S().maxCombo >= 25, p: () => [S().maxCombo, 25] },
  { id: "c50", n: "SURGE MASTER", d: "Reach a combo of 50", ic: "flame", f: () => S().maxCombo >= 50, p: () => [S().maxCombo, 50] },
  { id: "c100", n: "UNSTOPPABLE", d: "Reach a combo of 100", ic: "flame", f: () => S().maxCombo >= 100, p: () => [S().maxCombo, 100] },
  { id: "st6", n: "STAR COLLECTOR", d: "3 stars on 6 levels", ic: "star", f: () => stars3() >= 6, p: () => [stars3(), 6] },
  { id: "st12", n: "PERFECTIONIST", d: "3 stars on 12 levels", ic: "star", f: () => stars3() >= 12, p: () => [stars3(), 12] },
  { id: "x5", n: "MULTIPLIER", d: "Reach x5 in the finale", ic: "crown", f: () => S().maxMult >= 5 },
  { id: "x10", n: "TEN TIMES", d: "Reach x10 in the finale", ic: "crown", f: () => S().maxMult >= 10 },
  { id: "str7", n: "WEEK ON FIRE", d: "7-day daily streak", ic: "flame", f: () => M.daily.bestStreak >= 7, p: () => [M.daily.bestStreak, 7] },
  { id: "dly5", n: "DAILY REGULAR", d: "Win 5 daily challenges", ic: "calendar", f: () => M.daily.wins >= 5, p: () => [M.daily.wins, 5] },
  { id: "noloss", n: "FLAWLESS", d: "Win without losing a soldier", ic: "pu-shield", f: () => S().noLoss >= 1 },
  { id: "allpu", n: "FULL ARSENAL", d: "Use every power-up", ic: "pu-jackpot", f: () => ["shield", "airstrike", "giant", "jackpot"].every(k => S().pu[k]), p: () => [["shield", "airstrike", "giant", "jackpot"].filter(k => S().pu[k]).length, 4] },
  { id: "barrel", n: "DEMOLITION", d: "Blow up 25 barrels", ic: "barrel", f: () => S().barrels >= 25, p: () => [S().barrels, 25] },
  { id: "slam", n: "NIMBLE", d: "Dodge 10 boss slams", ic: "target", f: () => S().slams >= 10, p: () => [S().slams, 10] },
  { id: "gate", n: "GATE RUNNER", d: "Pass 500 gain gates", ic: "gate", f: () => S().gates >= 500, p: () => [S().gates, 500] },
  { id: "surge", n: "SURGE RIDER", d: "Trigger SURGE 10 times", ic: "surge", f: () => S().surges >= 10, p: () => [S().surges, 10] },
  { id: "jack", n: "LUCKY STRIKE", d: "Pass a golden gate", ic: "pu-jackpot", f: () => S().jackpots >= 1 },
  { id: "score", n: "HIGH ROLLER", d: "Score 50,000 in one level", ic: "star", f: () => S().maxScore >= 50000, p: () => [S().maxScore, 50000] },
  { id: "miss", n: "ON A MISSION", d: "Complete 10 missions", ic: "medal", f: () => S().missions >= 10, p: () => [S().missions, 10] },
  { id: "medal", n: "MEDAL HOARDER", d: "Collect 50 medals", ic: "medal", f: () => M.medals >= 50, p: () => [M.medals, 50] },
  { id: "armory", n: "FULL ARMORY", d: "Unlock every squad colour and tracer", ic: "helmet-plus", f: () => armoryItems().every(i => i.req.ok) },
];
function checkTrophies() {
  if (!active()) return;
  let any = false;
  for (const t of TROPHIES) {
    if (M.trophies[t.id]) continue;
    let ok = false; try { ok = t.f(); } catch (e) { ok = false; }
    if (!ok) continue;
    M.trophies[t.id] = Date.now(); any = true;
    toast(`${ico(t.ic)}<span><b>TROPHY: ${t.n}</b><small>${t.d}</small></span>`, "tr");
  }
  if (any) persist();
}

/* ---------------- share ---------------- */
function shareText(d, info) {
  const st = "★".repeat(d.stars || 0) + "☆".repeat(3 - (d.stars || 0));
  const sc = fmt(d.total != null ? d.total : d.score || 0);
  if (d.mode === "daily" && info) { const s = effStreak(); return `Squad Surge Daily #${info.num} ${st} ${sc}${s > 0 ? " 🔥" + s : ""}`; }
  return `Squad Surge L${d.level} ${st} ${sc}`;
}
async function share(text) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("<span><b>Copied!</b></span>", "tr"); return; } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove(); toast("<span><b>Copied!</b></span>", "tr");
  } catch (e) { toast("<span><b>Could not share</b></span>", "tr"); }
}

/* ---------------- CSS ---------------- */
const CSS = `
.mi{width:1.15em;height:1.15em;flex:none;display:inline-block;vertical-align:middle;object-fit:contain}
#game.juice-callout #metaToasts{visibility:hidden}
.mt-toast{display:flex;align-items:center;gap:8px;max-width:92%;padding:6px 14px 6px 8px;border-radius:14px;background:linear-gradient(#2b4a9a,#1b2a52);border:2px solid #0d1630;box-shadow:0 3px 0 #0d1630,0 8px 18px #0006;font:15px 'Lilita One',sans-serif;color:#fff;animation:mtIn .35s cubic-bezier(.2,1.4,.4,1) both;transition:opacity .35s,transform .35s}
.mt-toast .mi{width:30px;height:30px}.mt-toast span{display:grid;line-height:1.1;text-align:left}.mt-toast small{font:12px Nunito,sans-serif;font-weight:800;color:#bcd0ff}
.mt-toast.ms{background:linear-gradient(#3aa85a,#1f7a3a)}.mt-toast.ms small{color:#d6ffe0}.mt-toast.tr b{color:#ffd84a}
.mt-toast.out{opacity:0;transform:translateY(-10px)}
@keyframes mtIn{from{opacity:0;transform:translateY(-14px) scale(.8)}to{opacity:1;transform:none}}
#metaToasts{position:absolute;left:0;right:0;top:calc(max(10px,env(safe-area-inset-top)) + 96px);z-index:30;display:grid;justify-items:center;gap:6px;pointer-events:none}
#metaHome{position:absolute;inset:0;z-index:6;pointer-events:none}
#metaHome[hidden]{display:none}
#metaHome>*{pointer-events:auto}
.mm-daily{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;width:min(88%,340px);height:36px;padding:0 10px;border-radius:18px;background:linear-gradient(#ffb43a,#f28a0f);border:2px solid #0d1630;box-shadow:0 3px 0 #0d1630;color:#fff;font:16px 'Lilita One',sans-serif;white-space:nowrap}
.mm-daily .mi{width:22px;height:22px}
.mm-daily .mod{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:left;font-size:13px;opacity:.95}
.mm-daily .bst{font-size:13px;background:#0d163088;border-radius:9px;padding:1px 7px}
.mm-daily .fl{display:flex;align-items:center;gap:2px;font-size:15px}
.mm-daily.done{background:linear-gradient(#5be07a,#2bb64c)}
.mm-card{position:absolute;left:50%;transform:translateX(-50%);width:min(88%,340px);padding:6px 10px 8px;border-radius:14px;background:#0d1630cc;border:2px solid #0d1630;color:#fff;text-align:left;display:grid;gap:3px}
.mm-card .hd{display:flex;align-items:center;justify-content:space-between;font:12px 'Lilita One',sans-serif;color:#9fb6f0;letter-spacing:1px}
.mm-card .hd b{display:flex;align-items:center;gap:3px;color:#ffd84a;font-weight:400}.mm-card .hd .mi{width:15px;height:15px}
.mm-row{display:grid;grid-template-columns:20px 1fr 44px;align-items:center;gap:6px;font:13px 'Lilita One',sans-serif}
.mm-row .tx{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-bar{height:9px;border-radius:5px;background:#22305a;border:1.5px solid #0d1630;overflow:hidden;position:relative}
.mm-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#7cf08f,#2bb64c);border-radius:4px;transition:width .6s ease-out}
.mm-row .nm{font-size:11px;color:#bcd0ff;text-align:right}
.mm-row .mi{width:18px;height:18px}
.mm-side{position:absolute;width:50px;display:grid;justify-items:center;gap:1px;background:none;color:#fff;font:11px 'Lilita One',sans-serif;padding:0}
.mm-side .round{width:46px;height:46px}.mm-side .round .mi{width:28px;height:28px}
.mm-side small{text-shadow:0 1px 0 #0d1630,0 -1px 0 #0d1630,1px 0 0 #0d1630,-1px 0 0 #0d1630;font-size:11px}
.mm-modal{z-index:9}
.mm-modal .panel{max-height:100%;overflow:auto;overscroll-behavior:contain}
.mm-modal h2{display:flex;align-items:center;justify-content:center;gap:8px}
.mm-modal h2 .mi{width:32px;height:32px}
.mm-sec{font:13px 'Lilita One',sans-serif;color:#9fb6f0;letter-spacing:1px;text-align:left;margin:10px 2px 6px}
.mm-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.mm-cell{position:relative;display:grid;justify-items:center;align-content:start;gap:3px;padding:6px 2px 5px;border-radius:12px;background:#142048;border:2px solid #0d1630;color:#fff;font:10px/1.1 'Lilita One',sans-serif;min-height:104px}
.mm-cell.sel{border-color:#5be07a;box-shadow:0 0 0 2px #5be07a88}
.mm-cell.lock{opacity:.8}.mm-cell.lock .pv,.mm-cell.lock .trc{filter:grayscale(1) brightness(.55)!important}
.mm-cell .pv{width:44px;height:78px;background:url(assets/soldier.webp) 0 0/159px 156px no-repeat}
.mm-cell .lk{position:absolute;right:3px;top:3px}.mm-cell .lk .mi{width:16px;height:16px}
.mm-cell .rq{color:#ffd84a;font-size:9.5px}
.mm-cell .trc{width:44px;height:78px;display:grid;align-content:center;gap:9px;justify-items:center}
.mm-cell .trc i{display:block;width:5px;height:20px;border-radius:3px}
.mm-cell .ok{color:#5be07a}
.mm-cnt{font:16px 'Lilita One',sans-serif;color:#ffd84a}
.mm-trophies{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.mm-tr{display:grid;grid-template-columns:30px 1fr;gap:6px;align-items:center;text-align:left;padding:6px;border-radius:12px;background:#142048;border:2px solid #0d1630;font:11px/1.15 'Lilita One',sans-serif}
.mm-tr .mi{width:28px;height:28px}.mm-tr small{display:block;font:800 10px/1.15 Nunito,sans-serif;color:#9fb6f0}
.mm-tr.lock .mi{filter:grayscale(1) brightness(.5)}.mm-tr.lock{opacity:.75}.mm-tr:not(.lock){border-color:#ffc928}
.mm-mrow{display:grid;grid-template-columns:30px 1fr;gap:8px;align-items:center;text-align:left;padding:7px 8px;border-radius:12px;background:#142048;border:2px solid #0d1630;margin-bottom:7px;font:15px 'Lilita One',sans-serif}
.mm-mrow .mi{width:28px;height:28px}.mm-mrow .mm-bar{margin-top:4px;height:11px}
.mm-mrow small{font:800 11px Nunito,sans-serif;color:#9fb6f0;float:right}
.mm-tr-btn{background:none}
.mm-near{display:grid;gap:2px;margin:2px 0 6px}
.mm-near .big{font:46px/1 'Lilita One',sans-serif;color:#ffd84a}
.mm-near .big.sm{font-size:38px}
.mm-near .ln{font:800 14px Nunito,sans-serif;color:#bcd0ff}
.mm-goal{font:800 13px Nunito,sans-serif;color:#ffe9a6;margin:4px 0 0}
#loseModal.mm-on #losePct,#loseModal.mm-on #loseBest,#loseModal.mm-on .sub{display:none}
#loseModal.mm-on #retryBtn{font-size:28px;min-height:62px;margin-top:8px}
.mt{display:grid;gap:6px;margin:4px 0 2px;text-align:center}
.mt-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.mt-r{display:flex;justify-content:space-between;align-items:center;padding:3px 9px;border-radius:9px;background:#142048;font:14px 'Lilita One',sans-serif;opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}
.mt-r.mt-tactics{grid-column:1/-1;flex-wrap:wrap;gap:3px 8px}.mt-tactics b{font-size:12px}
.mt-r.on{opacity:1;transform:none}.mt-r span{color:#9fb6f0;font-size:12px}
.mt-total{display:flex;align-items:center;justify-content:center;gap:10px;opacity:0;transition:opacity .2s;position:relative;min-height:44px}
.mt-total.on{opacity:1}
.mt-total .lb{font:13px 'Lilita One',sans-serif;color:#9fb6f0;letter-spacing:1px}
.mt-total .num{font:40px/1 'Lilita One',sans-serif;color:#ffd84a;text-shadow:0 3px 0 #0d1630,0 0 0 #0d1630}
.mt-best{position:absolute;right:-2px;top:-6px;transform:rotate(8deg) scale(0);background:linear-gradient(#ff7a5a,#e8392f);border:2px solid #0d1630;border-radius:8px;padding:1px 8px;font:13px 'Lilita One',sans-serif;color:#fff;box-shadow:0 2px 0 #0d1630}
.mt-best.on{animation:mtPop .5s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes mtPop{0%{transform:rotate(8deg) scale(0)}70%{transform:rotate(8deg) scale(1.3)}100%{transform:rotate(8deg) scale(1)}}
.mt-spark{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}
.mt-spark i{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:2px;background:#ffd84a;animation:mtSp .8s ease-out forwards}
@keyframes mtSp{from{transform:translate(0,0) rotate(0);opacity:1}to{transform:translate(var(--dx),var(--dy)) rotate(260deg) scale(.4);opacity:0}}
.mt-hint{font:800 13px Nunito,sans-serif;color:#ffe9a6}
.mt-goal{font:800 12.5px Nunito,sans-serif;color:#bcd0ff}
.mt-ms{display:grid;gap:4px;margin-top:2px}
.mt-ms .mm-row{grid-template-columns:20px 1fr 52px;background:#142048;border-radius:9px;padding:3px 7px}
.mt-ms .mm-row .nm.d{color:#5be07a}
.mt-dly{font:13px 'Lilita One',sans-serif;color:#ffb43a}
.mt-btns{display:flex;gap:8px;margin-top:10px;align-items:stretch}
.mt-btns .btn{margin:0;width:auto;flex:1}
.mt-btns #nextBtn{flex:1.7}
.mt-btns .share{flex:none;width:52px;padding:0;display:grid;place-items:center}
.mt-btns .share .mi{width:26px;height:26px}
#winModal .panel{max-height:100%;overflow:auto}
@media (max-height:720px){.mm-row.x2,.mm-row.x3{display:none}.stars svg{width:44px;height:44px}.stars svg:nth-child(2){width:52px;height:52px}}
@media (prefers-reduced-motion:reduce){.mt-toast,.mt-best.on{animation-duration:.01s}.mt-spark{display:none}}
`;

/* ---------------- missions UI ---------------- */
function missionRow(m, cls) {
  const e = pdef(m.id) || {}, pc = clamp(m.prog / m.target, 0, 1) * 100;
  return `<div class="mm-row ${cls || ""}">${ico(e.ic)}<div><div class="tx">${mtext(m)}</div><div class="mm-bar"><i style="width:${pc}%"></i></div></div><span class="nm">${fmt(Math.min(m.prog, m.target))}/${fmt(m.target)}</span></div>`;
}

/* ---------------- home ---------------- */
let home, homeParts = {};
function buildHome() {
  home = document.createElement("div"); home.id = "metaHome"; home.hidden = true;
  home.innerHTML = `<button class="mm-daily" id="mmDaily" aria-label="Daily challenge"></button>
    <button class="mm-card" id="mmCard" aria-label="Missions"></button>
    <button class="mm-side" id="mmArmory" aria-label="Armory"><span class="round">${ico("armory")}</span><small>ARMORY</small></button>
    <button class="mm-side" id="mmTroph" aria-label="Trophies"><span class="round">${ico("trophy")}</span><small>TROPHIES</small></button>`;
  game.appendChild(home);
  homeParts = { daily: $("mmDaily"), card: $("mmCard"), arm: $("mmArmory"), tro: $("mmTroph") };
  homeParts.daily.onclick = startDaily;
  homeParts.card.onclick = () => openPanel("missions");
  homeParts.arm.onclick = () => openPanel("armory");
  homeParts.tro.onclick = () => openPanel("trophies");
}
function startDaily() {
  const i = dailyInfo();
  if (ctx.goMode) { M.daily.played[i.day] = 1; ctx.goMode({ mode: "daily", level: i.level, modifier: i.modifier, seed: i.seed, next: "play" }); }
  else toast("<span><b>Daily coming soon</b></span>", "tr");
}
function refreshHome() {
  if (!home) return;
  const on = (ctx.state === "home") && (active() || (window.Campaign && ctx.goMission)) && !openedPanel;
  home.hidden = !on;
  if (!on) return;
  ensureMissions();
  const i = dailyInfo(), D = M.daily, best = D.best[i.day], done = D.lastDay === i.day, st = effStreak();
  homeParts.daily.className = "mm-daily" + (done ? " done" : "");
  homeParts.daily.innerHTML = `${ico("calendar")}<b>DAILY</b><span class="mod">${i.modName}</span>${best ? `<span class="bst">${fmt(best)}</span>` : ""}<span class="fl">${ico("flame")}${st}</span>`;
  homeParts.daily.setAttribute("aria-label", `Daily challenge, ${i.modName}${best ? ", best " + fmt(best) : ""}, streak ${st}`);
  const rows = M.missions.map((m, k) => missionRow(m, "x" + (k + 1))).join("");
  homeParts.card.innerHTML = `<div class="hd"><span>MISSIONS</span><b>${ico("medal")}${M.medals}</b></div>${rows}`;
  layoutHome();
}
function layoutHome() {
  if (!home || home.hidden) return;
  const gr = game.getBoundingClientRect(), logo = $("logo").getBoundingClientRect(), play = $("playBtn").getBoundingClientRect();
  const story = $("storyHome");
  const hint = story && !story.hidden ? story.getBoundingClientRect() : q(".hint", game) ? q(".hint", game).getBoundingClientRect() : play;
  const top = Math.max(0, logo.bottom - gr.top - 4), limit = hint.top - gr.top - 6;
  const d = homeParts.daily, c = homeParts.card;
  d.style.top = top + "px";
  const room = limit - (top + 36 + 8);
  c.style.top = top + 44 + "px";
  c.hidden = !active();
  c.style.display = "";
  const full = c.scrollHeight;
  // if the card does not fit, drop rows (CSS hides x2/x3 on short screens); hide it entirely when there is no room
  if (room < 40) c.style.display = "none"; else if (full > room) { for (const r of c.querySelectorAll(".mm-row.x3,.mm-row.x2")) r.style.display = "none"; }
  const cy = play.top - gr.top + play.height / 2 - 28;
  homeParts.arm.style.top = cy + "px"; homeParts.arm.style.left = "10px";
  homeParts.tro.style.top = cy + "px"; homeParts.tro.style.right = "10px";
}

/* ---------------- panels ---------------- */
let openedPanel = null, panelEl = null;
function openPanel(kind) {
  closePanel();
  openedPanel = kind;
  const m = document.createElement("div"); m.className = "modal mm-modal";
  m.addEventListener("pointerdown", e => { e.stopPropagation(); if (e.target === m) closePanel(); });
  m.innerHTML = `<div class="panel" role="dialog"></div>`;
  panelEl = m; game.appendChild(m);
  const p = q(".panel", m);
  if (kind === "armory") renderArmory(p); else if (kind === "trophies") renderTrophies(p); else renderMissions(p);
  refreshHome();
}
function closePanel() { if (panelEl) { panelEl.remove(); panelEl = null; } openedPanel = null; refreshHome(); }
function backBtn(p) { const b = document.createElement("button"); b.className = "btn alt"; b.textContent = "BACK"; b.onclick = closePanel; p.appendChild(b); }
function renderMissions(p) {
  p.setAttribute("aria-label", "Missions");
  p.innerHTML = `<h2 class="stroke">${ico("target")}MISSIONS</h2><div class="sub">${ico("medal")} ${M.medals} medals collected</div>` +
    M.missions.map(m => { const e = pdef(m.id) || {}; const pc = clamp(m.prog / m.target, 0, 1) * 100;
      return `<div class="mm-mrow">${ico(e.ic)}<div>${mtext(m)}<small>+${e.m || 1} ${ico("medal")}</small><div class="mm-bar"><i style="width:${pc}%"></i></div></div></div>`; }).join("") +
    `<div class="mm-goal">Missions refresh as you complete them.</div>`;
  backBtn(p);
}
function renderArmory(p) {
  const items = armoryItems(), got = items.filter(i => i.req.ok).length;
  p.setAttribute("aria-label", "Armory");
  p.innerHTML = `<h2 class="stroke">ARMORY</h2><div class="mm-cnt">${got}/${items.length} collected</div><div class="sub" style="margin:2px 0 0">${ico("medal")} ${M.medals} medals · ${ico("star")} ${totalStars()} stars</div>`;
  const sec = (title, kind) => {
    const h = document.createElement("div"); h.className = "mm-sec"; h.textContent = title; p.appendChild(h);
    const g = document.createElement("div"); g.className = "mm-grid"; p.appendChild(g);
    for (const it of items.filter(x => x.kind === kind)) {
      const sel = kind === "skin" ? curSkin() == it.id : curTracer() == it.id;
      const b = document.createElement("button"); b.className = "mm-cell" + (sel ? " sel" : "") + (it.req.ok ? "" : " lock");
      const vis = kind === "skin" ? `<div class="pv" style="filter:${skinFilter(it)}"></div>` : `<div class="trc"><i style="background:${it.color};box-shadow:0 0 8px ${it.color}"></i><i style="background:${it.color};box-shadow:0 0 8px ${it.color}"></i></div>`;
      b.innerHTML = `${it.req.ok ? "" : `<span class="lk">${ico("lock")}</span>`}${vis}<span>${it.name}</span>${it.req.ok ? (sel ? '<span class="ok">EQUIPPED</span>' : "") : `<span class="rq">${it.req.text}</span>`}`;
      b.setAttribute("aria-label", `${it.name} ${kind === "skin" ? "squad colour" : "tracer"}${it.req.ok ? (sel ? ", equipped" : "") : ", locked: " + it.req.text}`);
      b.onclick = () => {
        if (!it.req.ok) { toast(`<span><b>${it.name}</b><small>Unlock: ${it.req.text}</small></span>`, "tr"); return; }
        if (kind === "skin") M.skin = it.id; else M.tracer = it.id;
        persist(); applySkin(); renderArmory(p);
      };
      g.appendChild(b);
    }
  };
  sec("SQUAD COLOURS", "skin"); sec("TRACERS", "tracer");
  backBtn(p);
}
function renderTrophies(p) {
  const got = TROPHIES.filter(t => M.trophies[t.id]).length;
  p.setAttribute("aria-label", "Trophies");
  p.innerHTML = `<h2 class="stroke">${ico("trophy")}TROPHIES</h2><div class="mm-cnt">${got}/${TROPHIES.length}</div><div class="mm-sec"></div><div class="mm-trophies">` +
    TROPHIES.map(t => { const have = !!M.trophies[t.id]; let pr = ""; if (!have && t.p) { const [c, n] = t.p(); pr = ` · ${fmt(Math.min(c, n))}/${fmt(n)}`; }
      return `<div class="mm-tr${have ? "" : " lock"}">${ico(t.ic)}<div>${t.n}<small>${t.d}${pr}</small></div></div>`; }).join("") + `</div>`;
  backBtn(p);
}

/* ---------------- results (win) ---------------- */
let tallyAnim = null, winRoot = null;
function cleanupResults() {
  if (tallyAnim) { cancelAnimationFrame(tallyAnim.raf); tallyAnim = null; }
  const pn = q("#winModal .panel"); if (!pn) return;
  for (const el of pn.querySelectorAll(".mt,.mt-btns-ph")) el.remove();
}
function ensureWinButtons() {
  const pn = q("#winModal .panel"), next = $("nextBtn");
  if (!pn || !next || q(".mt-btns", pn)) return q(".mt-btns", pn);
  const row = document.createElement("div"); row.className = "mt-btns";
  const retry = document.createElement("button"); retry.className = "btn alt"; retry.id = "mtRetry"; retry.textContent = "RETRY";
  const sh = document.createElement("button"); sh.className = "btn alt share"; sh.id = "mtShare"; sh.setAttribute("aria-label", "Share result"); sh.innerHTML = ico("share");
  next.before(row); row.append(next, retry, sh);
  return row;
}
function retryRun(d) {
  const L = ctx.L || {};
  const mode = d.mode || L.mode || "normal", level = d.level || L.level;
  if (ctx.goMode) ctx.goMode({ mode, level, modifier: d.modifier != null ? d.modifier : L.modifier, seed: d.seed != null ? d.seed : L.seed, next: "play" });
  else if (window.__game && __game.goLevel) __game.goLevel(level, "play");
}
function onWin(d) {
  d = d || {};
  if (Array.isArray(d.stars)) d = { ...d, stars: d.stars.filter(Boolean).length };
  if (run.resultRecorded) return;
  run.resultRecorded = true;
  const L = ctx.L || {};
  const noLoss = run.lost === 0;
  finishTactics(true);
  S().wins++; if (!ctx.mission || ctx.mission.boss) S().bosses++;
  S().maxSquad = Math.max(S().maxSquad, d.n || 0);
  const total = d.total != null ? d.total : d.score;
  if (total != null) S().maxScore = Math.max(S().maxScore, total);
  if (d.mult) S().maxMult = Math.max(S().maxMult, d.mult);
  const bc = d.bestCombo != null ? d.bestCombo : L.bestCombo || run.combo; S().maxCombo = Math.max(S().maxCombo, bc || 0);
  const kills = d.kills != null ? d.kills : run.kills;
  S().maxRunKills = Math.max(S().maxRunKills, kills || 0);
  if (noLoss) S().noLoss++;
  const wasActive = active(); // level 2 clear unlocks the meta
  let dinfo = null, drec = null;
  if (d.mode === "daily") { dinfo = dailyInfo(); drec = recordDaily({ ...d, stars: d.stars }); }
  if (wasActive) {
    ensureMissions();
    feed("win", 1); feed("star", d.stars || 0); feed("squadwin", d.n || 0);
    if (total != null) feed("score", total);
    if (d.mult > 1) feed("finale", d.mult);
    if (noLoss) feed("noloss", 1);
    if (d.mode === "daily") feed("daily", 1);
    feed("combo", bc || 0); feed("runkills", kills || 0);
  }
  persist();
  checkUnlocks(); checkTrophies();
  if (!wasActive && active()) ensureMissions();
  if (!ctx.mission && d.mode !== "campaign" && d.mode !== "story") buildResults(d, { kills, bc, total, dinfo, drec });
}
function buildResults(d, x) {
  cleanupResults();
  const pn = q("#winModal .panel"); if (!pn) return;
  const row = ensureWinButtons();
  const wrap = document.createElement("div"); wrap.className = "mt";
  const rows = [];
  const add = (lab, val, fmtFn) => rows.push({ lab, val, fmtFn });
  if (x.kills != null) add("KILLS", x.kills);
  if (x.bc) add("BEST COMBO", x.bc);
  add("SQUAD", d.n || 0);
  if (d.keptPct != null) add("SQUAD KEPT", d.keptPct, v => Math.round(v) + "%");
  if (d.mult > 1) add("FINALE", d.mult, v => "x" + (Math.round(v * 10) / 10));
  add("TACTICS", run.perfect, () => `${run.perfect} PERFECT · +${run.bankBonus.toFixed(1)}× banked · ${run.wasted} wasted`);
  const hasTotal = x.total != null;
  let html = `<div class="mt-grid">` + rows.map((r, i) => `<div class="mt-r${r.lab === "TACTICS" ? " mt-tactics" : ""}" data-i="${i}"><span>${r.lab}</span><b>${r.fmtFn ? r.fmtFn(r.val) : fmt(r.val)}</b></div>`).join("") + `</div>`;
  if (run.perfect >= 2 && run.wasted === 0) html += '<div class="mt-hint" style="color:#ffd84a">★ TACTICIAN</div>';
  if (hasTotal) html += `<div class="mt-total" id="mtTotal"><span class="lb">SCORE</span><span class="num" id="mtNum">0</span><span class="mt-best" id="mtBest">NEW BEST!</span><span class="mt-spark" id="mtSpark"></span></div>`;
  const n = d.n || 0, lv = d.level || (ctx.L && ctx.L.level) || 1, t3 = 30 + 10 * lv, t2 = 10 + 3 * lv;
  if (d.keptPct != null && d.keptPct < 65) html += '<div class="mt-hint">Counter threats to keep your squad</div>';
  if ((d.stars || 0) < 3) {
    const need = (d.stars || 0) >= 2 ? t3 - n : t2 - n, tgt = (d.stars || 0) >= 2 ? "★★★" : "★★";
    if (need > 0) html += `<div class="mt-hint">${need} more soldier${need > 1 ? "s" : ""} for ${tgt}</div>`;
  }
  if (x.dinfo) {
    const s = effStreak();
    html += `<div class="mt-dly">DAILY #${x.dinfo.num}${s > 0 ? " · " + s + "-day streak" : ""}${x.drec && x.drec.used ? " · freeze saved your streak" : ""}</div>`;
  }
  if (active()) {
    const goal = nextUnlockGoal(); if (goal) html += `<div class="mt-goal">Next: ${goal}</div>`;
    html += `<div class="mt-ms" id="mtMs"></div>`;
  }
  wrap.innerHTML = html;
  const anchor = $("winSub"); (anchor || pn.firstChild).after(wrap);
  // mission ticks
  const msBox = q("#mtMs", wrap);
  if (msBox) {
    const items = [];
    for (const s of run.snap) {
      const cur = M.missions.find(m => m.uid === s.uid);
      if (cur) { if (cur.prog !== s.prog) items.push({ text: mtext(cur), ic: (pdef(cur.id) || {}).ic, from: s.prog / cur.target, to: cur.prog / cur.target, label: `${fmt(cur.prog)}/${fmt(cur.target)}` }); }
    }
    for (const dn of run.done) items.push({ text: dn.text, ic: dn.ic, from: 0.7, to: 1, label: `+${dn.medals}`, done: true });
    if (!items.length && M.missions[0]) { const m = M.missions[0]; items.push({ text: mtext(m), ic: (pdef(m.id) || {}).ic, from: m.prog / m.target, to: m.prog / m.target, label: `${fmt(m.prog)}/${fmt(m.target)}` }); }
    msBox.innerHTML = items.slice(0, 3).map(it => `<div class="mm-row">${ico(it.ic)}<div><div class="tx">${it.text}</div><div class="mm-bar"><i style="width:${clamp(it.from, 0, 1) * 100}%" data-to="${clamp(it.to, 0, 1) * 100}"></i></div></div><span class="nm${it.done ? " d" : ""}">${it.label}</span></div>`).join("");
  }
  // buttons
  q("#mtRetry", pn).onclick = () => retryRun(d);
  q("#mtShare", pn).onclick = () => share(shareText({ ...d, total: x.total }, x.dinfo));
  // tally animation, skippable, <= ~2 s, never blocks the buttons
  const rEls = [...wrap.querySelectorAll(".mt-r")], totEl = q("#mtTotal", wrap), numEl = q("#mtNum", wrap), bestEl = q("#mtBest", wrap);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    if (tallyAnim) cancelAnimationFrame(tallyAnim.raf);
    rEls.forEach(e => e.classList.add("on"));
    if (totEl) { totEl.classList.add("on"); numEl.textContent = fmt(x.total); if (d.newBestScore) bestEl.classList.add("on"); }
    wrap.querySelectorAll(".mm-bar i[data-to]").forEach(i => i.style.width = i.dataset.to + "%");
    wrap.removeEventListener("pointerdown", finish);
  };
  wrap.addEventListener("pointerdown", finish);
  if (reduced) { finish(); return; }
  const t0 = performance.now(), STAG = 130, rowsEnd = rEls.length * STAG + 100, COUNT = 1100;
  tallyAnim = { raf: 0 };
  const step = now => {
    if (finished) return;
    const t = now - t0;
    rEls.forEach((e, i) => { if (t > i * STAG) e.classList.add("on"); });
    if (totEl && t > rowsEnd) {
      totEl.classList.add("on");
      const k = clamp((t - rowsEnd) / COUNT, 0, 1), e = 1 - Math.pow(1 - k, 3);
      numEl.textContent = fmt(x.total * e);
      if (k >= 1) { if (d.newBestScore) { bestEl.classList.add("on"); burst(q("#mtSpark", wrap)); } finish(); return; }
    } else if (!totEl && t > rowsEnd) { finish(); return; }
    tallyAnim.raf = requestAnimationFrame(step);
  };
  tallyAnim.raf = requestAnimationFrame(step);
  setTimeout(() => finish(), 2800);
  if (d.newBestScore && false) burst(null);
}
function burst(el) {
  if (!el) return;
  el.innerHTML = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2, r = 60 + Math.random() * 40; return `<i style="--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r * .7}px;background:${i % 2 ? "#ffd84a" : "#ff7a5a"}"></i>`; }).join("");
  setTimeout(() => { el.innerHTML = ""; }, 900);
}

/* ---------------- near-miss (lose) ---------------- */
function onLose(d) {
  d = d || {};
  if (run.resultRecorded) return;
  run.resultRecorded = true;
  finishTactics(false);
  const L = ctx.L || {};
  if (active()) { feed("combo", L.bestCombo || run.combo || 0); feed("runkills", run.kills); }
  S().maxCombo = Math.max(S().maxCombo, L.bestCombo || run.combo || 0);
  S().maxRunKills = Math.max(S().maxRunKills, run.kills);
  persist(); checkTrophies();
  if (ctx.mission || d.mode === "campaign" || d.mode === "story") return;
  const modal = $("loseModal"), pn = modal && q(".panel", modal); if (!pn) return;
  q(".mm-near", pn) && q(".mm-near", pn).remove();
  modal.classList.add("mm-on");
  const lv = L.level || 1, bests = (gsave().bestScore || {}), bestS = bests[lv];
  let head, sub;
  if (d.atBoss && d.bossPct != null) { head = `Boss at ${Math.round(d.bossPct)}%!`; sub = d.bossPct <= 30 ? "So close. One more push." : "Hit it harder next time."; }
  else { const p = d.pct != null ? d.pct : Math.floor((L.reached || 0) * 100); head = `${p}% of the way`; sub = p >= 70 ? "Almost there." : "Grab more gates to grow the squad."; }
  const lines = [`<div class="ln">${sub}</div>`];
  const near = d.atBoss ? d.bossPct != null && d.bossPct <= 30 : (d.pct != null ? d.pct : (L.reached || 0) * 100) >= 70;
  const tip = near && tacticsTip();
  if (tip) lines.push(`<div class="ln">${tip}</div>`);
  const prevPct = gsave().best && gsave().best[lv];
  if (bestS) lines.push(`<div class="ln">Best score ${fmt(bestS)}${d.score != null ? " · this run " + fmt(d.score) : ""}</div>`);
  else if (d.score != null) lines.push(`<div class="ln">Score ${fmt(d.score)}</div>`);
  if (prevPct && prevPct < 1 && !d.atBoss) lines.push(`<div class="ln">Best run ${Math.floor(prevPct * 100)}%</div>`);
  if (active()) { const g = nextUnlockGoal(); if (g) lines.push(`<div class="mm-goal">Next: ${g}</div>`); }
  const box = document.createElement("div"); box.className = "mm-near";
  box.innerHTML = `<div class="big${head.length > 14 ? " sm" : ""} stroke">${head}</div>${lines.join("")}`;
  q("#loseTitle", pn).after(box);
}

/* ---------------- personal bests on level tiles ---------------- */
function decorateLevels() {
  const grid = $("lvgrid"); if (!grid) return;
  const bests = gsave().bestScore || {};
  [...grid.children].forEach((t, i) => {
    if (!t.classList || t.disabled || q(".mbest", t)) return;
    const b = bests[i + 1];
    if (b) { const s = document.createElement("small"); s.className = "mbest"; s.style.cssText = "color:#ffe9a6;font-size:10px"; s.textContent = fmt(b); t.appendChild(s); }
  });
  const modal = $("levelsModal"), pn = modal && q(".panel", modal);
  if (pn && !q(".mm-bd", pn) && active()) {
    const i = dailyInfo(), D = M.daily;
    const best = Math.max(0, ...Object.values(D.best).map(Number));
    const d = document.createElement("div"); d.className = "mm-goal mm-bd";
    d.textContent = `Daily best ${best ? fmt(best) : "-"} · streak ${effStreak()}`;
    $("levelsClose").before(d);
  }
}

/* ---------------- tactics tracking ---------------- */
const COUNTERS = { swarm: "airstrike", barricade: "giant", mortars: "shield", mortar: "shield", boss: "shield", slam: "shield" };
const threatKind = k => String(k || "").toLowerCase() === "mortar" ? "mortars" : String(k || "").toLowerCase();
function currentBelt() { return Array.isArray(ctx.belt) ? ctx.belt : run.belt; }
function rememberThreat(d) {
  const kind = threatKind(d.kind);
  if (!kind) return null;
  const key = d.id != null ? d.id : kind;
  let t = run.threats.get(key);
  if (!t) { t = { kind, counter: COUNTERS[kind], matched: false, credited: false, live: false, heldAtHit: false, lost: 0, ended: false }; run.threats.set(key, t); }
  run.liveThreat = t;
  return t;
}
function creditCounter(t) {
  if (t && t.ended && t.countered && t.matched && !t.credited) {
    t.credited = true; feed("tCounter_" + t.kind, 1);
  }
}
function finishTactics(won) {
  if (run.tacticsFinished) return;
  run.tacticsFinished = true;
  // Completion feeds once per run, so newly drawn missions cannot reuse the same run's peak.
  feed("tPerfectRun", run.perfect);
  if (won && run.wasted === 0) { S().cleanWins++; feed("tClean", 1); }
  if (won && run.banked >= 2) S().bankLevels++;
}
function tacticsTip() {
  let missed = null;
  for (const t of run.threats.values()) if (t.lost > 0 && !t.countered) missed = t;
  if (missed && missed.counter) {
    const tool = missed.counter.toUpperCase();
    const danger = missed.kind === "mortars" ? "mortars hit" : missed.kind === "swarm" ? "swarm hit" : missed.kind === "barricade" ? "barricade hit" : "boss slammed";
    if (missed.heldAtHit) return `You had ${tool === "AIRSTRIKE" ? "an" : "a"} ${tool} when the ${danger} — tap it!`;
    return `Save ${tool === "AIRSTRIKE" ? "an" : "a"} ${tool} for the ${missed.kind === "swarm" ? "swarm before the boss" : missed.kind === "barricade" ? "barricade" : missed.kind === "mortars" ? "mortars" : "boss slam"}.`;
  }
  if (run.misused) return "Match the power-up icon on the threat warning for a PERFECT counter.";
  if (run.wasted) return "Wait for a threat warning before using its matching power-up.";
  if (run.ready) return "Your SURGE was ready — tap it during a threat or the boss fight!";
  if (run.belt.some(Boolean)) return "Use your saved power-ups before the squad runs out!";
  return "Save a matching power-up for the next threat warning.";
}

/* ---------------- run tracking ---------------- */
function newRun() {
  run = { perfect: 0, wasted: 0, misused: 0, banked: 0, bankBonus: 0, bankSeen: false, tacticsFinished: false, ready: false, belt: [null, null], threats: new Map(), liveThreat: null, kills: 0, lost: 0, combo: 0, done: [], snap: M.missions.map(m => ({ uid: m.uid, prog: m.prog })), cTick: 0 };
}
function wire() {
  const on = (n, f) => bus.on(n, d => tryF(() => f(d || {})));
  on("levelStart", () => {
    newRun();
    const L = ctx.L;
    if (L && L.mode === "daily" && active()) { M.daily.played[dayIndex()] = 1; feed("daily", 0); }
  });
  on("state", d => {
    if (d.to === "home") { ensureMissions(); closeStale(); }
    if (d.to === "levels") decorateLevels();
    if (d.to === "play" && d.from === "home") run.snap = M.missions.map(m => ({ uid: m.uid, prog: m.prog }));
    if (d.to !== "lose") { const lm = $("loseModal"); lm && lm.classList.remove("mm-on"); }
    if (d.to !== "win") cleanupResults();
    refreshHome();
  });
  on("belt", d => { if (Array.isArray(d.slots)) run.belt = d.slots.slice(0, 2); });
  on("surgeReady", () => { run.ready = true; });
  on("powerupUse", d => {
    if (run.tacticsFinished) return;
    if (d.perfect) { run.perfect++; S().perfect++; if (d.type === "surge") feed("tSurge", 1); }
    if (d.wasted) { run.wasted++; S().wasted++; }
    if (d.misused) run.misused++;
    if (d.type === "surge") run.ready = false;
    if (d.slot === 0 || d.slot === 1) run.belt[d.slot] = null;
    let t = run.liveThreat;
    // Effects may synchronously end their threat before powerupUse is emitted.
    if (!t && d.threatKind) for (const candidate of run.threats.values())
      if (candidate.kind === threatKind(d.threatKind)) t = candidate;
    if (t && d.perfect && d.type === t.counter && (!d.threatKind || threatKind(d.threatKind) === t.kind)) { t.matched = true; creditCounter(t); }
    persist(); checkTrophies();
  });
  on("bank", d => {
    if (run.bankSeen || run.tacticsFinished) return;
    run.bankSeen = true;
    run.banked = Number.isFinite(d.count) ? Math.max(0, Math.floor(d.count)) : 0;
    run.bankBonus = Number.isFinite(d.bonus) ? Math.max(0, d.bonus) : run.banked * .5;
    S().banked += run.banked; feed("tBank", run.banked); persist();
  });
  on("threat", rememberThreat);
  on("threatLive", d => { const t = rememberThreat(d); if (t) t.live = true; });
  on("threatEnd", d => {
    const kind = threatKind(d.kind), key = d.id != null ? d.id : kind;
    let t = run.threats.get(key);
    if (!t) t = rememberThreat(d);
    if (!t || t.ended || run.tacticsFinished) return;
    t.ended = true; t.countered = !!d.countered;
    t.lost = Math.max(t.lost, Number.isFinite(d.lost) ? d.lost : 0);
    if (d.countered) {
      S().threatsCountered++;
      // PERFECT SURGE alone is not proof that the named matching tool cleared a threat.
      creditCounter(t);
    }
    if (run.liveThreat === t) run.liveThreat = null;
    persist(); checkTrophies();
  });
  on("enemyDie", d => {
    run.kills++; S().kills++; feed("kill", 1);
    if (d.e && d.e.type === "brute") feed("brute", 1);
    feed("runkills", run.kills);
  });
  on("gatePass", d => {
    if (d.after > d.before) { S().gates++; feed("gate", 1); }
    if (d.half && d.half.jackpot) { S().jackpots++; feed("jackpot", 1); }
  });
  on("soldiersAdded", d => { if (d.total != null) { S().maxSquad = Math.max(S().maxSquad, d.total); feed("squad", d.total); } });
  on("squadMilestone", d => { if (d.n) S().maxSquad = Math.max(S().maxSquad, d.n); });
  on("soldiersLost", d => {
    const lost = d.n || 1; run.lost += lost;
    const t = run.liveThreat;
    if (t && t.live && !t.ended) { t.lost += lost; if (currentBelt().includes(t.counter)) t.heldAtHit = true; }
  });
  on("surge", d => { if (d.on) { S().surges++; feed("surge", 1); } });
  on("comboEnd", d => { if (d.count) { S().maxCombo = Math.max(S().maxCombo, d.count); feed("combo", d.count); } });
  on("combo", d => { if (d.count) { run.combo = Math.max(run.combo, d.count); feed("combo", d.count); } });
  on("tick", d => {
    const L = d.L || ctx.L; if (!L || L.combo == null) return;
    run.combo = Math.max(run.combo, L.combo || 0);
    run.cTick += d.dt || 0.016;
    if (run.cTick > 0.3) { run.cTick = 0; feed("combo", L.combo || 0); S().maxCombo = Math.max(S().maxCombo, L.combo || 0); }
  });
  on("powerup", d => {
    S().airdrops++; if (d.type) S().pu[d.type] = 1; feed("pu", 1); if (d.type) feed("pu_" + d.type, 1);
    checkTrophies();
  });
  on("solidBreak", d => {
    const k = d.o && d.o.kind;
    if (k === "barrel") { S().barrels++; feed("barrel", 1); }
    else if (k === "blockYellow") feed("block", 1);
    else if (k === "crate") feed("crate", 1);
    else if (k === "weaponCase") feed("case", 1);
  });
  on("bossSlam", d => { if (!d.killed) { S().slams++; feed("dodge", 1); } });
  on("bonusEnd", d => { if (d.mult) { S().maxMult = Math.max(S().maxMult, d.mult); feed("finale", d.mult); } });
  on("missionStart", () => { Promise.resolve().then(() => tryF(ensureMissions)); });
  on("missionEnd", d => {
    // Defer until all missionEnd listeners and any legacy win/lose event finish.
    const thisRun = run;
    Promise.resolve().then(() => tryF(() => {
      if (run !== thisRun) return;
      if (run.resultRecorded) { checkUnlocks(); checkTrophies(); return; }
      const won = d.result === "win" || d.result === "won" || d.result === true;
      const result = { ...d, mode: "campaign", stars: Array.isArray(d.stars) ? d.stars.filter(Boolean).length : Number(d.stars) || 0,
        n: ctx.L?.soldiers?.length || 0, score: ctx.L?.score || 0 };
      if (d.assisted) result.stars = Math.min(2, result.stars);
      if (won) onWin(result); else onLose(result);
    }));
  });
  on("win", onWin);
  on("lose", onLose);
  addEventListener("resize", () => tryF(layoutHome));
  // keep the keyboard from starting a run while one of our panels is open
  addEventListener("keydown", e => {
    if (!openedPanel) return;
    if (e.key === "Escape") closePanel();
    e.stopImmediatePropagation(); e.preventDefault();
  }, true);
}
function closeStale() { if (openedPanel && ctx.state !== "home") closePanel(); }

/* ---------------- setup ---------------- */
function setup(c) {
  ctx = c; bus = c.bus; $ = c.$ || (id => document.getElementById(id)); game = c.gameEl || $("game");
  M = load(); newRun();
  try {
    if (!$("meta-css")) { const st = document.createElement("style"); st.id = "meta-css"; st.textContent = CSS; document.head.appendChild(st); }
    toastBox = document.createElement("div"); toastBox.id = "metaToasts"; game.appendChild(toastBox);
    buildHome(); ensureWinButtons();
    wire(); probeIcons();
    if (M.skin != null || M.tracer != null) applySkin();
    if (active()) { ensureMissions(); for (const it of armoryItems()) if (it.req.ok) M.seenUnlock[it.kind + ":" + it.id] = M.seenUnlock[it.kind + ":" + it.id] || 1; persist(); }
    window.Story?.setup?.(ctx);
    refreshHome();
    window.addEventListener("load", () => tryF(layoutHome));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => tryF(layoutHome));
    const li = $("logoImg"); if (li) li.addEventListener("load", () => tryF(layoutHome));
    const grid = $("lvgrid"); if (grid) new MutationObserver(() => tryF(decorateLevels)).observe(grid, { childList: true });
  } catch (e) { console.error("meta setup", e); }
}
window.Meta = { setup, unlockChapter, _state: () => M, _dailyInfo: dailyInfo, _open: openPanel, _feed: feed, _toast: toast, _onWin: onWin, _onLose: onLose };
})();
