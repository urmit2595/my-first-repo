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
    let confetti = null, confettiTimer = null;
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
@media(prefers-reduced-motion:reduce){
 #home .logo,#progress i::after{animation:none}
 #game .float{animation:juice-fade .8s ease-out forwards}
 #game .juice-pressed:not(:disabled){transform:none}
 #game .juice-confetti{display:none}
}
@keyframes juice-fade{0%,55%{opacity:1}100%{opacity:0}}
`;
      document.head.appendChild(style);
    }

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

    function showBanner(isBoss) {
      title.textContent = isBoss ? "BOSS!" : `LEVEL ${level ? level.level : (ctx.L ? ctx.L.level : 1)}`;
      subtitle.textContent = isBoss ? "" : (level ? level.name : "");
      subtitle.hidden = isBoss;
      banner.classList.toggle("juice-boss", isBoss);
      banner.hidden = false;
      animate(banner, [
        { opacity: 0, transform: isBoss ? "scale(1.7)" : "translateX(-120%) scale(.9)", offset: 0 },
        { opacity: 1, transform: "scale(1.04)", offset: .16 },
        { opacity: 1, transform: "scale(1)", offset: .24 },
        { opacity: 1, transform: "scale(1)", offset: .82 },
        { opacity: 0, transform: "translateX(120%) scale(.95)", offset: 1 }
      ], 1700, {}, () => { banner.hidden = true; });
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
      animate(el, [{ transform: "scale(.88)" }, { transform: "scale(1.14)", offset: .45 }, { transform: "scale(1)" }], 320);
    }
    function clearConfetti() {
      if (confettiTimer !== null) clearTimeout(confettiTimer);
      confettiTimer = null;
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
      confettiTimer = setTimeout(safe(clearConfetti), 2500);
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
      level = data; levelRef = ctx.L; weapon = 0;
      intro = 1.1; bossActive = false; bossBlend = 0; shake = 0; kick = 0;
      stop(banner); banner.hidden = true; clearConfetti();
      stop($("weaponTag")); stop($("count"));
    });
    on("state", ({ from, to }) => {
      if (from === "home" && to === "play") { intro = reduced ? 1.1 : 0; showBanner(false); }
      if (to === "home" || to === "win" || to === "lose") bossActive = false;
      if (to !== "play" && to !== "boss") { stop(banner); banner.hidden = true; }
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
    on("gatePass", ({ before, after }) => { if (after > before) fov(5, .35); else if (after < before) jolt(.2, .2); });
    on("solidBreak", ({ o, earned }) => { if (earned && o && ["blockYellow", "crate", "weaponCase"].includes(o.kind)) jolt(.13, .18); });
    on("bossStart", () => { bossActive = true; showBanner(true); pulse(); });
    on("bossWarn", () => { jolt(.065, .8); pulse(); });
    on("bossSlam", () => { jolt(.48, .4); pulse(); });
    on("bossDown", () => { bossActive = false; fov(-5, .3); });
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
    on("frame", ({ dt, camera, look, state }) => {
      const delta = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0;
      clock += delta;
      if (reduced || !camera || !look) return;
      const active = state === "play" || state === "boss";
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
      camera.lookAt(look);
    });
    const motionChanged = safe(() => {
      reduced = media.matches;
      if (!reduced) return;
      intro = 1.1; shake = 0; kick = 0; bossBlend = 0;
      clearConfetti();
      animations.forEach(animation => animation.cancel()); animations.clear();
      banner.hidden = true;
    });
    if (media.addEventListener) media.addEventListener("change", motionChanged);
    else if (media.addListener) media.addListener(motionChanged);
  })(); }
  return { setup };
})();
