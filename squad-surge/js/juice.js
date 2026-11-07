"use strict";
// Visual-only effects. index.html owns gameplay and resets the camera each frame.
window.Juice = (() => {
  let C = null;
  const safe = fn => (...args) => { try { return fn(...args); } catch (_) { /* Polish must never interrupt play. */ } };

  function setup(ctx) { safe(() => {
    if (C || !ctx || !ctx.bus) return;
    C = ctx;
    const game = ctx.gameEl || document.getElementById("game");
    if (!game) return;
    const $ = id => document.getElementById(id);
    const media = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let reduced = media.matches;
    let level = null, levelRef = ctx.L, weapon = 0;
    let clock = 0, intro = 1.1, bossActive = false, bossBlend = 0;
    let kick = 0, kickAge = 1, kickDuration = .35;
    let shake = 0, shakeAge = 1, shakeDuration = .4;
    let confetti = null, confettiLeft = 0;
    let trauma = 0, pullback = 0, surgeKick = 0;
    let surgeOn = false, shieldOn = false, giantOn = false, meterHot = false;
    let current = null, calloutAge = 0, toastRelease = 0;
    const callouts = [], flights = [];
    const inRun = () => ["play", "boss", "bonus"].includes(ctx.state);
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const animations = new Map();
    const on = (name, fn) => ctx.bus.on(name, safe(fn));
    const smooth = x => x * x * (3 - 2 * x);

    if (!$("juice-css")) {
      const style = document.createElement("style");
      style.id = "juice-css";
      style.textContent = `
#view{transition:filter .6s ease}
#view.juice-lost{filter:saturate(.2) brightness(.72)}
#home .logo{animation:juice-bob 3.6s ease-in-out infinite}
@keyframes juice-bob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-7px) rotate(-2deg)}}
#progress i{overflow:hidden}
#progress i::after{content:"";position:absolute;inset:0; background:linear-gradient(110deg,transparent 30%,#fff9 50%,transparent 70%);transform:translateX(-110%);animation:juice-shine 2.8s ease-in-out infinite}
@keyframes juice-shine{0%,35%{transform:translateX(-110%)}80%,100%{transform:translateX(110%)}}
#game .float{animation:rise .9s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes rise{0%{opacity:0;transform:translate(-50%,-40%) scale(.45)}12%{opacity:1;transform:translate(-50%,-65%) scale(1.34)}28%{opacity:1;transform:translate(-50%,-85%) scale(1.08)}65%{opacity:1}100%{opacity:0;transform:translate(-50%,-210%) scale(.95)}}
#game .juice-vignette{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 36%,#ed25335c 72%,#d90025b8 100%)}
#game .juice-banner{position:absolute;left:6%;right:6%;top:32%;z-index:5;pointer-events:none;text-align:center;padding:14px 12px 17px;border:3px solid #102b65;border-radius:20px;background:linear-gradient(165deg,#6bcaff,#2874ed);box-shadow:0 6px 0 #102b65,0 12px 30px #10214455;color:#fff;font-family:'Lilita One',Nunito,sans-serif;transform-origin:center}
#game .juice-banner strong{display:block;font-size:clamp(30px,9vw,48px);line-height:1.05;text-shadow:0 3px #102b65}
#game .juice-banner small{display:block;font-size:17px;margin-top:5px;letter-spacing:1px}
#game .juice-banner.juice-boss{background:linear-gradient(165deg,#ff8863,#ed2840);border-color:#80152a;box-shadow:0 6px 0 #80152a,0 12px 30px #80152a55}
#game .juice-boss strong{text-shadow:0 3px #80152a;font-size:52px}
#game .modal .panel{position:relative;z-index:1;transform-origin:50% 55%}
#game .juice-confetti{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.juice-confetti i{position:absolute;left:50%;top:28%;width:8px;height:13px;border-radius:2px;opacity:0;animation:juice-confetti 2.1s linear forwards;animation-delay:var(--delay)}
@keyframes juice-confetti{0%{opacity:0;transform:translate(0,0) rotate(0)}8%{opacity:1}28%{transform:translate(var(--x),var(--y)) rotate(180deg)}75%{opacity:1}100%{opacity:0;transform:translate(var(--end),80vh) rotate(var(--spin))}}
#game .btn,#game .round,#game .lvtile{transform-origin:center;transition:filter .15s}
#game .juice-pressed:not(:disabled){transform:translateY(3px) scale(.95,.9);filter:brightness(1.12)}
#game .juice-banner{top:19%;padding:10px 8px;border-color:#543418;background:linear-gradient(165deg,#302e49ee,#151a32ee);box-shadow:0 4px 0 #111b35,0 0 24px var(--heat,#ffc84955);color:var(--color,#fff)}
#game .juice-banner strong{font-size:clamp(24px,var(--size,7vw),48px);text-shadow:0 3px #261b30}
#game .juice-banner img{width:42px;height:42px;object-fit:contain;vertical-align:middle;margin-bottom:3px}
#game .juice-banner.juice-stamp{top:43%;border:0;background:none;box-shadow:none}
#game .juice-stamp strong{font-size:clamp(40px,var(--size,12vw),90px)}
#game .juice-layer{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0}
#game .juice-gold{box-shadow:inset 0 0 65px 15px #ffc52b99;background:radial-gradient(ellipse,transparent 55%,#ffbd3026)}
#game .juice-lines{background:repeating-conic-gradient(from 4deg at 50% 48%,transparent 0deg 13deg,#fff5b326 13.2deg 13.5deg,transparent 13.8deg 24deg);mask-image:radial-gradient(ellipse,transparent 40%,#000 100%);-webkit-mask-image:radial-gradient(ellipse,transparent 40%,#000 100%)}
#game .juice-blue{background:#329bff;mix-blend-mode:screen}
#game .juice-orange{background:#ff8a24;mix-blend-mode:screen}
#game .juice-flash{background:radial-gradient(ellipse,transparent 25%,#ffd650aa)}
#game .juice-points{position:absolute;z-index:5;pointer-events:none;font:24px 'Lilita One',sans-serif;color:#ffe68a;text-shadow:0 2px 2px #34251d}
#surgeBar.juice-hot{box-shadow:0 0 12px 3px #ffd54a;animation:juice-meter .65s ease-in-out infinite alternate}
@keyframes juice-meter{from{opacity:.55}to{opacity:1}}
@media(prefers-reduced-motion:reduce){
 #count.surging .surge i{animation:none}
 #game .juice-lines{display:none}

 #home .logo,#progress i::after{animation:none}
 #game .float{animation:juice-fade .8s ease-out forwards}
 #game .juice-pressed:not(:disabled){transform:none}
 #game .juice-confetti{display:none}
}
@keyframes juice-fade{0%,55%{opacity:1}100%{opacity:0}}
`;
      document.head.appendChild(style);
    }

    // Tactics overlays are event-driven; no DOM queries or allocations in the frame loop.
    const tacticsStyle = document.createElement("style");
    tacticsStyle.textContent = `
#game .jt-chip{position:absolute;z-index:6;pointer-events:none;background:#17223aef;border:2px solid #705934;border-radius:16px;padding:7px 10px;color:#ffe392;font:16px 'Lilita One',sans-serif;text-align:center;max-width:90%;box-sizing:border-box}
#game .jt-chip[hidden]{display:none}
#game .jt-chip img{width:30px;height:30px;vertical-align:middle;object-fit:contain;margin-right:6px}
#game .jt-threat{top:110px;left:50%;transform:translateX(-50%);white-space:nowrap}
#game .jt-swap{bottom:calc(100px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);white-space:nowrap}
#game .jt-swap svg{width:30px;height:30px;vertical-align:middle;margin-left:6px;transform:rotate(-90deg)}
#game .jt-swap circle{fill:none;stroke:#ffd84a;stroke-width:3;stroke-dasharray:76;stroke-dashoffset:0}
#game .jt-coach{width:220px;transform:translateX(-50%)}
#game .jt-coach span{position:absolute;top:100%;font-size:32px;left:var(--finger,50%);transform:translateX(-50%);animation:jt-point .6s ease-in-out infinite alternate}
#game .jt-waste{font-size:13px;color:#b6bdc8;border-color:#707887;transform:translate(-50%,-100%)}
#game .jt-ring{position:absolute;inset:-18px;border:4px solid #ffd84a;border-radius:50%;pointer-events:none;animation:jt-burst .65s ease-out forwards}
@keyframes jt-point{to{margin-top:8px;filter:drop-shadow(0 0 7px #ffd84a)}}
@keyframes jt-burst{from{transform:scale(.5);opacity:1}to{transform:scale(1.5);opacity:0}}
@media(prefers-reduced-motion:reduce){#game .jt-coach span{animation:none}#game .jt-ring{animation:juice-fade .65s forwards}}
`;
    document.head.appendChild(tacticsStyle);
    function chip(cls) {
      const el = document.createElement("div"); el.className = "jt-chip " + cls;
      el.hidden = true; el.setAttribute("role", "status"); game.appendChild(el); return el;
    }
    const threatChip = chip("jt-threat"), swapChip = chip("jt-swap"), coachChip = chip("jt-coach"), wasteChip = chip("jt-waste");
    const counters = { swarm: "airstrike", barricade: "giant", mortars: "shield", mortar: "shield", boss: "shield", slam: "shield" };
    const toolType = t => ["airstrike", "shield", "giant", "surge"].includes(t) ? t : null;
    const toolIcon = t => toolType(t) ? `<img alt="" src="assets/ui/icons/${t === "surge" ? "surge" : "pu-" + t}.webp">` : "";
    let threatId = null, readyShown = false, coachTimer = 0, coachRetry = 0, swapTimer = 0, wasteTimer = 0;
    function slotButton(slot) {
      if (slot !== 0 && slot !== 1) return null;
      return game.querySelector('[data-slot="' + slot + '"]') || $("beltSlot" + slot) || $("belt" + slot) || $("powerup" + slot);
    }
    function clearCoach() { clearTimeout(coachTimer); clearTimeout(coachRetry); coachChip.hidden = true; }
    function clearSwap() { clearTimeout(swapTimer); swapChip.hidden = true; }
    function clearTactics() {
      clearCoach(); clearSwap(); clearTimeout(wasteTimer); wasteChip.hidden = threatChip.hidden = true;
      threatId = null; readyShown = false;
    }
    on("threat", (d = {}) => {
      const kind = String(d.kind || "").toLowerCase(), counter = toolType(d.counter) || counters[kind];
      const label = kind === "swarm" ? "SWARM AHEAD" : kind === "barricade" ? "BARRICADE" : kind === "mortars" || kind === "mortar" ? "MORTARS" : "BOSS SLAM";
      threatId = d.id; threatChip.innerHTML = toolIcon(counter) + "⚠ " + label; threatChip.hidden = false;
    });
    on("threatEnd", (d = {}) => { if (d.id == null || threatId == null || d.id === threatId) { threatChip.hidden = true; threatId = null; } });
    on("swapOffer", (d = {}) => {
      clearSwap();
      swapChip.innerHTML = toolIcon(d.type) + 'SWAP?<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="12"/></svg>';
      swapChip.setAttribute("aria-label", "Swap power-up? Three seconds to choose a slot"); swapChip.hidden = false;
      const ring = swapChip.querySelector("circle");
      if (ring.animate) ring.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 76 }], { duration: 3000, fill: "forwards" });
      swapTimer = setTimeout(clearSwap, 3000);
    });
    on("swapDone", clearSwap); on("swapExpired", clearSwap);
    on("tacticsCoach", (d = {}) => {
      clearCoach();
      const kind = String(d.kind || "").toLowerCase(), type = toolType(kind) || counters[kind];
      if (!type || (d.slot !== 0 && d.slot !== 1)) return;
      const expires = Date.now() + 4000;
      const place = safe(() => {
        if (Date.now() >= expires) return;
        const button = slotButton(d.slot);
        if (!button || !button.getBoundingClientRect().width) { coachRetry = setTimeout(place, 100); return; }
        const r = button.getBoundingClientRect(), g = game.getBoundingClientRect();
        const target = r.left + r.width / 2 - g.left, center = clamp(target, Math.min(115, g.width / 2), Math.max(g.width - 115, g.width / 2));
        coachChip.innerHTML = "Tap to " + (type === "airstrike" ? "call an AIRSTRIKE!" : type === "giant" ? "go GIANT!" : "activate " + type.toUpperCase() + "!") + "<span>👇</span>";
        coachChip.style.left = center + "px"; coachChip.style.bottom = (g.bottom - r.top + 38) + "px";
        coachChip.style.setProperty("--finger", (110 + target - center) + "px"); coachChip.hidden = false;
      });
      place(); coachTimer = setTimeout(clearCoach, 4000);
    });
    on("powerupUse", (d = {}) => {
      clearCoach();
      const type = toolType(d.type);
      if (d.perfect && type) enqueue("PERFECT " + type.toUpperCase() + "!", { color: "#ffd84a", size: 9, ring: true, priority: true });
      else if (d.wasted) {
        const button = slotButton(d.slot), g = game.getBoundingClientRect(), r = button && button.getBoundingClientRect();
        wasteChip.textContent = "WASTED"; wasteChip.style.left = (r ? r.left + r.width / 2 - g.left : g.width / 2) + "px";
        wasteChip.style.top = (r ? r.top - g.top - 8 : g.height - 100) + "px"; wasteChip.hidden = false;
        clearTimeout(wasteTimer); wasteTimer = setTimeout(() => { wasteChip.hidden = true; }, 1200);
      } else if (d.misused) enqueue("MISFIRE", { color: "#a8b0be", size: 5 });
      if (type === "surge") readyShown = false;
    });
    on("bank", (d = {}) => {
      const count = Number.isFinite(d.count) ? d.count : 0, bonus = Number.isFinite(d.bonus) ? d.bonus : count * .5;
      enqueue(`BANKED ×${count} → +${bonus.toFixed(1)}×`, { color: "#ffd84a", size: 7 });
    });
    on("surgeReady", () => { if (!readyShown) { readyShown = true; enqueue("SURGE READY!", { color: "#ffd84a", icon: "surge" }); } });
    on("surge", d => { if (d && d.on) readyShown = false; });

    function stop(el) {
      const animation = animations.get(el);
      if (animation) { animations.delete(el); animation.cancel(); }
    }
    function animate(el, frames, duration, options = {}, done) {
      if (!el) return;
      stop(el);
      if (!el.animate) { if (done) done(); return; }
      // In reduced motion all programmatic transforms become simple fades.
      if (reduced) frames = frames.map(f => ({ opacity: f.opacity === undefined ? 1 : f.opacity, offset: f.offset }));
      const animation = el.animate(frames, Object.assign({ duration, easing: "ease-out" }, options));
      animations.set(el, animation);
      animation.onfinish = safe(() => {
        if (animations.get(el) !== animation) return;
        animations.delete(el);
        animation.cancel();
        if (done) done();
      });
    }
    const vignette = document.createElement("div");
    vignette.className = "juice-vignette";
    vignette.setAttribute("aria-hidden", "true");
    game.appendChild(vignette);
    const banner = document.createElement("div");
    banner.className = "juice-banner";
    banner.setAttribute("aria-hidden", "true");
    banner.hidden = true;
    const title = document.createElement("strong"), subtitle = document.createElement("small");
    banner.append(title, subtitle);
    game.appendChild(banner);

    const icon = document.createElement("img");
    icon.alt = ""; icon.hidden = true; banner.prepend(icon);
    const layers = ["gold", "lines", "blue", "orange", "flash"].map(kind => {
      const el = document.createElement("div");
      el.className = "juice-layer juice-" + kind;
      el.setAttribute("aria-hidden", "true"); game.appendChild(el);
      return { el, value: 0 };
    });
    let flash = 0;
    function enqueue(text, options = {}) {
      if (!inRun()) return;
      const item = Object.assign({ text, color: "#fff", size: 7, sub: "", icon: "", stamp: false }, options);
      if (item.priority) {
        if (current) callouts.unshift(current);
        callouts.unshift(item); nextCallout();
        banner.style.opacity = "1";
      } else callouts.push(item);
    }
    function nextCallout() {
      current = callouts.shift() || null; calloutAge = 0;
      clearTimeout(toastRelease);
      if (!current) {
        banner.hidden = true;
        toastRelease = setTimeout(() => game.classList.remove("juice-callout"), 1200);
        return;
      }
      game.classList.add("juice-callout");
      const oldRing = banner.querySelector(".jt-ring"); if (oldRing) oldRing.remove();
      if (current.ring) { const ring = document.createElement("i"); ring.className = "jt-ring"; banner.appendChild(ring); }
      title.textContent = current.text; subtitle.textContent = current.sub;
      subtitle.hidden = !current.sub;
      icon.hidden = !current.icon;
      if (current.icon) icon.src = "assets/ui/icons/" + current.icon + ".webp";
      banner.className = "juice-banner" + (current.stamp ? " juice-stamp" : "");
      banner.style.setProperty("--color", current.color);
      banner.style.setProperty("--heat", current.color + "55");
      banner.style.setProperty("--size", current.size + "vw");
      banner.style.opacity = "0"; banner.hidden = false;
    }
    function showBanner(isBoss) {
      const m = ctx.mission;
      enqueue(isBoss ? "BOSS!" : m ? `C${m.chapter} · ${m.n}` : `LEVEL ${level ? level.level : (ctx.L ? ctx.L.level : 1)}`, {
        sub: isBoss ? "" : (level ? level.name : ""), color: isBoss ? "#ff6957" : "#8bd9ff"
      });
    }
    function clearMoments() {
      clearTactics();
      callouts.length = 0; current = null; banner.hidden = true;
      clearTimeout(toastRelease); game.classList.remove("juice-callout");
      trauma = pullback = surgeKick = flash = 0;
      surgeOn = shieldOn = giantOn = false;
      layers.forEach(layer => { layer.value = 0; layer.el.style.opacity = "0"; });
      flights.forEach(f => f.el.remove()); flights.length = 0;
      meterHot = false; if ($("surgeBar")) $("surgeBar").classList.remove("juice-hot");
    }
    function updateMoments(delta, active, L) {
      if (active) {
        if (!current && callouts.length) nextCallout();
        if (current) {
          calloutAge += delta;
          const t = clamp(calloutAge / .8, 0, 1);
          banner.style.opacity = String(Math.min(1, t / .12, (1 - t) / .18));
          banner.style.transform = reduced ? "none" : `scale(${1 + .18 * Math.pow(1 - clamp(t / .3, 0, 1), 2)})`;
          if (t >= 1) nextCallout();
        }
      }
      flash = Math.max(0, flash - delta * 2);
      const targets = [surgeOn ? 1 : 0, surgeOn && !reduced ? .65 : 0, shieldOn ? .065 : 0, giantOn ? .065 : 0, flash];
      layers.forEach((layer, i) => {
        const value = layer.value + (targets[i] - layer.value) * Math.min(1, delta * 8);
        const rounded = Math.abs(value - targets[i]) < .001 ? targets[i] : value;
        if (layer.value !== rounded) { layer.value = rounded; layer.el.style.opacity = rounded.toFixed(3); }
      });
      const hot = active && !surgeOn && L && L.surge > .8;
      if (!!hot !== meterHot) { meterHot = !!hot; if ($("surgeBar")) $("surgeBar").classList.toggle("juice-hot", meterHot); }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i]; f.age += delta;
        const t = clamp(f.age / .7, 0, 1), k = t * t;
        f.el.style.opacity = String(Math.min(1, (1 - t) / .2));
        if (!reduced) f.el.style.transform = `translate(${f.dx * k}px,${f.dy * k - Math.sin(t * Math.PI) * 30}px) scale(${1 - k * .55})`;
        if (t >= 1) { f.el.remove(); flights.splice(i, 1); pop($("scoreBox")); }
      }
    }
    function pulse() {
      animate(vignette, [{ opacity: 0 }, { opacity: reduced ? .35 : .85, offset: .18 }, { opacity: 0 }], 650);
    }
    function jolt(amount, duration) {
      if (reduced) return;
      shake = Math.max(amount, shake * Math.max(0, 1 - shakeAge / shakeDuration));
      shakeAge = 0; shakeDuration = duration;
    }
    function fov(amount, duration) {
      if (reduced) return;
      kick = amount; kickAge = 0; kickDuration = duration;
    }
    function pop(el) {
      animate(el, [{ opacity: .55, transform: "scale(.88)" }, { opacity: 1, transform: "scale(1.14)", offset: .45 }, { opacity: 1, transform: "scale(1)" }], 320);
    }
    function clearConfetti() {
      confettiLeft = 0;
      if (confetti) confetti.remove();
      confetti = null;
    }
    function celebrate() {
      clearConfetti();
      const modal = $("winModal");
      if (reduced || !modal || modal.hidden) return;
      confetti = document.createElement("div");
      confetti.className = "juice-confetti";
      confetti.setAttribute("aria-hidden", "true");
      const colors = ["#ffcf36", "#55caff", "#ff6785", "#6cef98", "#fff5cb"];
      for (let i = 0; i < 80; i++) {
        const bit = document.createElement("i"), x = (Math.random() - .5) * 100;
        bit.style.cssText = `background:${colors[i % colors.length]};--x:${x}vw;--y:${-8 - Math.random() * 25}vh;--end:${x * 1.35}vw;--spin:${Math.random() * 1080 - 540}deg;--delay:${Math.random() * .15}s`;
        confetti.appendChild(bit);
      }
      modal.prepend(confetti);
      confettiLeft = 2.5;
    }

    const visibility = new WeakMap();
    function syncModals() {
      game.querySelectorAll(".modal").forEach(modal => {
        const visible = !modal.hidden;
        if (visibility.get(modal) === visible) return;
        visibility.set(modal, visible);
        const panel = modal.querySelector(".panel");
        if (visible) animate(panel, [
          { opacity: 0, transform: "scale(.85)" },
          { opacity: 1, transform: "scale(1.04)", offset: .65 },
          { opacity: 1, transform: "scale(1)" }
        ], 340);
        else stop(panel);
        if (modal.id === "loseModal" && $("view")) $("view").classList.toggle("juice-lost", visible);
        if (modal.id === "winModal" && !visible) clearConfetti();
      });
    }
    const observer = new MutationObserver(safe(syncModals));
    observer.observe(game, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
    syncModals();

    let pressed = null;
    function release() {
      if (!pressed) return;
      const el = pressed; pressed = null;
      el.classList.remove("juice-pressed");
      animate(el, [{ transform: "translateY(3px) scale(.95,.9)" }, { transform: "scale(1.035,1.06)", offset: .55 }, { transform: "scale(1)" }], 240);
    }
    game.addEventListener("pointerdown", safe(e => {
      const el = e.target.closest(".btn,.round,.lvtile");
      if (!el || el.disabled) return;
      release(); stop(el); pressed = el; el.classList.add("juice-pressed");
    }), { passive: true });
    window.addEventListener("pointerup", safe(release), { passive: true });
    window.addEventListener("pointercancel", safe(release), { passive: true });
    window.addEventListener("blur", safe(release));

    on("levelStart", data => {
      clearMoments();
      level = data; levelRef = ctx.L; weapon = 0;
      intro = 1.1; bossActive = false; bossBlend = 0; shake = 0; kick = 0;
      stop(banner); banner.hidden = true; clearConfetti();
      stop($("weaponTag")); stop($("count"));
    });
    on("state", ({ from, to }) => {
      if (from === "home" && to === "play") { intro = reduced ? 1.1 : 0; showBanner(false); }
      if (to === "home" || to === "win" || to === "lose") bossActive = false;
      if (!["play", "boss", "bonus", "paused"].includes(to)) { clearMoments(); shake = kick = bossBlend = 0; }
      if (to === "paused") banner.hidden = true;
      else if (current) banner.hidden = false;
      syncModals();
    });
    on("soldiersAdded", () => animate($("count"), [
      { transform: "translate(-50%,-100%) scale(1)", backgroundColor: "#38d575" },
      { transform: "translate(-50%,-100%) scale(1.25)", backgroundColor: "#38d575", offset: .35 },
      { transform: "translate(-50%,-100%) scale(1)", backgroundColor: "#1f5fd6" }
    ], 360));
    on("soldiersLost", () => animate($("count"), [
      { transform: "translate(-50%,-100%)", backgroundColor: "#ef4351" },
      { transform: "translate(calc(-50% - 5px),-100%)", backgroundColor: "#ef4351", offset: .2 },
      { transform: "translate(calc(-50% + 5px),-100%)", offset: .4 },
      { transform: "translate(calc(-50% - 3px),-100%)", offset: .6 },
      { transform: "translate(-50%,-100%)", backgroundColor: "#1f5fd6" }
    ], 280));
    on("weapon", ({ index }) => {
      // startLevel calls setWeapon(0) before emitting levelStart.
      const reset = ctx.L !== levelRef || index === weapon;
      weapon = index;
      if (!reset) pop($("weaponTag"));
    });
    on("rateUp", () => animate($("weaponTag"), [
      { boxShadow: "0 0 0 0 #8dff8200" },
      { boxShadow: "0 0 22px 5px #8dff82bb", offset: .35 },
      { boxShadow: "0 0 0 0 #8dff8200" }
    ], 550));
    on("gatePass", ({ before, after, half }) => { if (half && half.jackpot) { flash = 1; enqueue("JACKPOT!", { icon: "pu-jackpot", color: "#ffd84a" }); } if (after > before) fov(5, .35); else if (after < before) jolt(.2, .2); });
    on("solidBreak", ({ o, earned }) => { if (earned && o && ["blockYellow", "crate", "weaponCase"].includes(o.kind)) jolt(.13, .18); });
    on("bossStart", () => { bossActive = true; showBanner(true); pulse(); });
    on("bossWarn", () => { jolt(.065, .8); pulse(); });
    on("bossSlam", () => { jolt(.48, .4); pulse(); });
    on("bossDown", () => { bossActive = false; fov(-5, .3); });
    on("combo", ({ count, tier }) => {
      const rank = Number.isFinite(tier) ? clamp(Math.round(tier), 1, 4) : count >= 100 ? 4 : count >= 50 ? 3 : count >= 25 ? 2 : 1;
      enqueue(["NICE", "GREAT", "SURGE!", "UNSTOPPABLE"][rank - 1], {
        sub: "x" + [1.5, 2, 3, 4][rank - 1], size: 6 + rank,
        color: ["#ffe48a", "#ffb33f", "#ff793e", "#ff493e"][rank - 1], icon: rank >= 3 ? "flame" : ""
      });
      animate($("combo"), [{ transform: "translateY(-50%) scale(.85)" }, { transform: "translateY(-50%) scale(1.3)", offset: .4 }, { transform: "translateY(-50%) scale(1)" }], 320);
    });
    on("surge", ({ on }) => {
      surgeOn = !!on;
      if (on) { if (!reduced) surgeKick = .8; enqueue("SURGE!", { icon: "surge", color: "#ffd84a", size: 10 }); }
    });
    on("shield", ({ on }) => { shieldOn = !!on; });
    on("giant", ({ on }) => { giantOn = !!on; });
    on("airdrop", () => enqueue("SUPPLY DROP!", { icon: "airdrop", color: "#8bd9ff" }));
    on("powerup", ({ type }) => {
      if (["shield", "airstrike", "giant", "jackpot"].includes(type)) enqueue(type.toUpperCase(), {
        icon: "pu-" + type, color: type === "shield" ? "#8bd9ff" : type === "giant" ? "#ffae60" : "#ffd84a"
      });
    });
    on("explosion", ({ x, z, radius }) => {
      const L = ctx.L;
      if (reduced || !inRun() || !L || ![x, z, radius, L.sx, L.sz].every(Number.isFinite)) return;
      const distance = Math.hypot(x - L.sx, z - L.sz);
      trauma = clamp(trauma + clamp(radius / 10, 0, .7) / (1 + distance / Math.max(1, radius)), 0, 1);
    });
    on("bossPhase", ({ phase } = {}) => {
      enqueue(`BOSS PHASE ${Number.isFinite(Number(phase)) ? Number(phase) : "SHIFT"}!`, { color: "#ff8563", icon: "boss", priority: true });
      pulse();
    });
    on("bossWeak", ({ on: weak } = {}) => {
      if (weak) enqueue("WEAK POINT!", { color: "#ffe478", size: 9, priority: true, ring: true });
    });
    on("bossEnrage", () => { enqueue("BOSS IS ANGRY!", { color: "#ff5549", icon: "boss" }); pulse(); });
    on("bonusStart", () => { bossActive = false; enqueue("SURGE FINALE!", { icon: "surge", color: "#ffd84a" }); });
    function bonusStamp(mult, final) {
      if (!Number.isFinite(mult)) return;
      const k = clamp((mult - 1) / 9, 0, 1);
      enqueue(`x${mult}${final ? " BONUS!" : ""}`, { stamp: true, size: 11 + k * 9,
        color: `#ff${Math.round(255 - k * 39).toString(16)}${Math.round(255 - k * 181).toString(16)}` });
    }
    on("bonusWall", ({ mult }) => bonusStamp(mult, false));
    on("bonusEnd", ({ mult }) => bonusStamp(mult, true));
    on("squadMilestone", ({ n }) => {
      const text = { 100: "BIG SQUAD!", 250: "MEGA SQUAD!", 500: "ULTRA SQUAD!" }[n];
      if (!text) return;
      enqueue(text, { icon: "squad", color: "#ffd84a", size: n === 500 ? 9 : 8 });
      if (!reduced) pullback = 1;
    });
    on("score", ({ delta }) => {
      const box = $("scoreBox");
      if (!inRun() || !Number.isFinite(delta) || delta < 150 || !box || box.hidden || flights.length >= 6) return;
      const g = game.getBoundingClientRect(), b = box.getBoundingClientRect();
      const x = g.width * .56, y = g.height * .34;
      const el = document.createElement("div"); el.className = "juice-points";
      el.setAttribute("aria-hidden", "true"); el.textContent = "+" + Math.round(delta);
      el.style.left = x + "px"; el.style.top = y + "px"; game.appendChild(el);
      flights.push({ el, age: 0, dx: b.left - g.left + b.width / 2 - x, dy: b.top - g.top - y });
    });
    on("win", ({ stars }) => {
      const container = $("stars");
      if (container) container.querySelectorAll("svg").forEach((star, i) => {
        const base = i === 1 ? "translateY(-10px) " : "";
        animate(star, [
          { opacity: 0, transform: base + "scale(.25)", filter: "drop-shadow(0 0 0 transparent)" },
          { opacity: 1, transform: base + "scale(1.3)", filter: i < stars ? "drop-shadow(0 0 14px #ffe782)" : "none", offset: .55 },
          { opacity: 1, transform: base + "scale(1)", filter: "drop-shadow(0 0 0 transparent)" }
        ], 480, { delay: 140 + i * 180, fill: "backwards" });
      });
      celebrate();
    });
    on("lose", syncModals);
    on("frame", ({ dt, realDt, camera, look, state, L }) => {
      const elapsed = Number.isFinite(realDt) ? realDt : dt;
      const delta = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
      const active = state === "play" || state === "boss" || state === "bonus";
      if (confettiLeft > 0) { confettiLeft -= delta; if (confettiLeft <= 0) clearConfetti(); }
      updateMoments(delta, active, L || ctx.L);
      trauma = Math.max(0, trauma - delta * 1.7);
      pullback = Math.max(0, pullback - delta);
      surgeKick = Math.max(0, surgeKick - delta);
      clock += delta;
      if (reduced || !camera || !look) return;
      if (active) intro = Math.min(1.1, intro + delta);
      if (state === "home") {
        camera.position.x += Math.sin(clock * .45) * .22;
        camera.position.y += Math.sin(clock * .38) * .16;
        camera.position.z += Math.cos(clock * .38) * .35;
      }
      if (active && intro < 1.1) {
        const amount = 1 - smooth(intro / 1.1);
        camera.position.y += amount * 6;
        camera.position.z += amount * 8;
      }
      if (state !== "paused") bossBlend = Math.max(0, Math.min(1, bossBlend + (bossActive ? 1 : -1) * delta / .8));
      camera.position.y += smooth(bossBlend) * 1.5;
      camera.position.z += smooth(bossBlend) * 2.5;
      if (state !== "paused") { kickAge += delta; shakeAge += delta; }
      if (kickAge < kickDuration) camera.fov += kick * Math.pow(1 - kickAge / kickDuration, 3);
      if (active && shakeAge < shakeDuration) {
        const amount = shake * Math.pow(1 - shakeAge / shakeDuration, 2);
        camera.position.x += Math.sin(clock * 113) * amount;
        camera.position.y += Math.cos(clock * 97) * amount * .55;
      }
      if (active) {
        camera.fov += 6 * Math.pow(surgeKick / .8, 3);
        camera.position.y += 2 * Math.sin(pullback * Math.PI);
        camera.position.z += 4 * Math.sin(pullback * Math.PI);
        const amount = trauma * trauma * .8;
        camera.position.x += Math.sin(clock * 127) * amount;
        camera.position.y += Math.cos(clock * 103) * amount * .6;
      }
      camera.lookAt(look);
    });
    const motionChanged = safe(() => {
      reduced = media.matches;
      if (!reduced) return;
      intro = 1.1; shake = 0; kick = 0; bossBlend = 0; trauma = pullback = surgeKick = 0;
      clearConfetti();
      animations.forEach(animation => animation.cancel()); animations.clear();
      banner.style.transform = "none";
      flights.forEach(f => { f.el.style.transform = "none"; });
    });
    if (media.addEventListener) media.addEventListener("change", motionChanged);
    else if (media.addListener) media.addListener(motionChanged);
  })(); }
  return { setup };
})();
