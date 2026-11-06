"use strict";
// SURGE FINALE (design/engagement.md F9): after the boss falls the squad charges 7 glass bonus walls.
// Each wall costs soldiers to break; the last broken wall sets the level multiplier.
// Game contract: Finale.start(ctx) -> true enters the "bonus" state; "tick {dt}" drives us; we end with ctx.finishLevel(mult).
(function () {
  const MULTS = [1.5, 2, 3, 4, 5, 7, 10];
  const FRAC = [0.10, 0.12, 0.18, 0.25, 0.35, 0.50, 0.75]; // of T3 = 30 + 10 x level; x10 needs 2.25 x T3 (tuned with the balance bot)
  const COLORS = ["#22e0c0", "#2ab4ff", "#4a7dff", "#7a5cff", "#b04cff", "#ff9a2e", "#ffd84a"];
  const SPACING = 4.2, RUN_SPEED = 11, STOP_T = 0.2, CELEBRATE_T = 0.6, FAIL_T = 0.55;
  const WALL_H = 3.0, WALL_D = 0.5;

  let C = null, THREE = null, bound = false;
  let run = null; // active finale state, null when idle

  function setup(ctx) {
    C = ctx; THREE = ctx.THREE;
    if (bound) return; bound = true;
    ctx.bus.on("levelStart", () => cleanup());
    ctx.bus.on("frame", onFrame);
    ctx.bus.on("tick", onTick);
  }

  // ---------- visuals ----------
  function roundRect(shape, w, h, r) {
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }
  function colorOf(hex, lin) { const c = new THREE.Color(hex); if (lin) c.convertSRGBToLinear(); return c; }

  function drawWallLabel(lab, mult, cost) {
    const g = lab.ctx, c = lab.c; g.clearRect(0, 0, c.width, c.height);
    g.lineJoin = "round"; g.textAlign = "center"; g.textBaseline = "middle";
    const big = Math.round(c.height * 0.62);
    g.font = `${big}px 'Lilita One', sans-serif`;
    g.lineWidth = c.height * 0.1; g.strokeStyle = "#0d1630";
    const t = "x" + mult;
    g.strokeText(t, c.width / 2, c.height * 0.4); g.fillStyle = "#ffffff"; g.fillText(t, c.width / 2, c.height * 0.4);
    const sm = Math.round(c.height * 0.2), w = c.width * 0.3, h = sm * 1.45;
    g.fillStyle = "rgba(10,18,44,.82)"; roundRect2(g, (c.width - w) / 2, c.height * 0.8 - h / 2, w, h, h / 2); g.fill();
    g.font = `${sm}px 'Lilita One', sans-serif`; g.fillStyle = "#ffe9a8";
    g.fillText("-" + cost + " troops", c.width / 2, c.height * 0.81);
    lab.tex.needsUpdate = true;
  }
  function roundRect2(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function build(ctx, L, level) {
    const lin = ctx.renderer.outputEncoding === THREE.sRGBEncoding;
    const W = ctx.ROAD * 2 - 0.3;
    const geoms = [], mats = [], texs = [];
    const keepG = g => (geoms.push(g), g), keepM = m => (mats.push(m), m);
    const panelG = keepG(new THREE.ExtrudeBufferGeometry(roundRect(new THREE.Shape(), W, WALL_H, 0.5), { depth: WALL_D, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 6 }));
    panelG.translate(0, 0, -WALL_D / 2);
    const frameShape = roundRect(new THREE.Shape(), W + 0.2, WALL_H + 0.2, 0.55);
    frameShape.holes.push(roundRect(new THREE.Path(), W - 0.12, WALL_H - 0.12, 0.42));
    const frameG = keepG(new THREE.ExtrudeBufferGeometry(frameShape, { depth: WALL_D + 0.16, bevelEnabled: false, curveSegments: 6 }));
    frameG.translate(0, 0, -(WALL_D + 0.16) / 2);
    const planeG = keepG(new THREE.PlaneBufferGeometry(1, 1));
    const floorG = keepG(new THREE.PlaneBufferGeometry(1, 1).rotateX(-Math.PI / 2));
    // soft glow texture
    const gc = document.createElement("canvas"); gc.width = gc.height = 64; const gx = gc.getContext("2d");
    const gr = gx.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(gc); glowTex.encoding = lin ? THREE.sRGBEncoding : THREE.LinearEncoding; texs.push(glowTex);

    const T3 = 30 + 10 * level;
    const walls = [];
    const z0 = L.boss.z - 2;
    for (let i = 0; i < 7; i++) {
      const col = colorOf(COLORS[i], lin), cost = Math.ceil(T3 * FRAC[i]);
      const grp = new THREE.Group(); grp.position.set(0, 0, z0 - i * SPACING); ctx.track.add(grp);
      const tilt = new THREE.Group(); tilt.position.y = 0.1; tilt.rotation.x = -0.6; grp.add(tilt);
      const body = new THREE.Group(); body.position.y = WALL_H / 2; tilt.add(body); // panels lean back so the labels stay readable from the chase camera
      const panelM = keepM(new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.25), emissive: col, emissiveIntensity: 1.1, transparent: true, opacity: 0.78, roughness: 0.1, metalness: 0, depthWrite: false }));
      const panel = new THREE.Mesh(panelG, panelM); panel.renderOrder = 2; body.add(panel);
      const frameM = keepM(new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.35), transparent: true, toneMapped: false }));
      const frame = new THREE.Mesh(frameG, frameM); frame.renderOrder = 3; body.add(frame);
      const haloM = keepM(new THREE.MeshBasicMaterial({ color: col, map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      const halo = new THREE.Mesh(planeG, haloM); halo.scale.set(W * 1.2, WALL_H * 1.5, 1); halo.position.z = -WALL_D; halo.renderOrder = 1; body.add(halo);
      const floorM = keepM(new THREE.MeshBasicMaterial({ color: col, map: glowTex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      const floor = new THREE.Mesh(floorG, floorM); floor.scale.set(W, 1, 3); floor.position.set(0, 0.04, 1.2); floor.renderOrder = 1; grp.add(floor);
      const lab = ctx.makeLabel(512, 256); lab.tex.encoding = lin ? THREE.sRGBEncoding : THREE.LinearEncoding; texs.push(lab.tex);
      drawWallLabel(lab, MULTS[i], cost);
      const labM = keepM(new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false, toneMapped: false }));
      const label = new THREE.Mesh(planeG, labM); label.scale.set(6.0, 3.0, 1); label.position.set(0, 0.05, WALL_D / 2 + 0.12); label.renderOrder = 5; body.add(label);
      walls.push({ i, z: grp.position.z, mult: MULTS[i], cost, grp, body, col, panelM, frameM, haloM, floorM, labM, broken: false, shake: 0 });
    }
    return { walls, geoms, mats, texs, shardG: keepG(new THREE.BoxBufferGeometry(1, 1, 1)), W };
  }

  function burstShards(w) {
    const r = run, n = 34, shMat = new THREE.MeshBasicMaterial({ color: w.col.clone().lerp(new THREE.Color(1, 1, 1), 0.4), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    r.mats.push(shMat);
    const list = [];
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(r.shardG, shMat), s = 0.18 + Math.random() * 0.4;
      m.scale.set(s, s * (0.5 + Math.random()), s * 0.3);
      m.position.set((Math.random() - 0.5) * r.W, 0.4 + Math.random() * WALL_H, w.z);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      C.track.add(m);
      list.push({ m, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 6, vz: 3 + Math.random() * 9, rx: (Math.random() - 0.5) * 12, ry: (Math.random() - 0.5) * 12 });
    }
    r.shards.push({ list, mat: shMat, t: 0 });
  }

  // ---------- run ----------
  function start(ctx) {
    try {
      C = ctx; THREE = ctx.THREE;
      const L = ctx.L;
      if (!L || !L.boss || !ctx.track || !ctx.makeLabel || !THREE.ExtrudeBufferGeometry) return false;
      cleanup();
      const built = build(ctx, L, L.level);
      run = Object.assign(built, {
        L, idx: 0, phase: "charge", t: 0, mult: 1, speed: 1, elapsed: 0, camK: 0, shards: [], lastBroken: -1, tapped: false,
        onTap: null,
      });
      run.onTap = () => { if (run && C.state === "bonus") run.speed = 2; };
      ctx.gameEl.addEventListener("pointerdown", run.onTap);
      ctx.bus.emit("bonusStart", { walls: run.walls.map(w => ({ mult: w.mult, cost: w.cost })) });
      return true;
    } catch (e) { console.error("finale start failed", e); cleanup(); return false; }
  }

  function stopZ(w) { return w.z + 0.8 + 0.425 * Math.sqrt(Math.max(1, run.L.soldiers.length)); }

  function breakWall(w) {
    const r = run, L = r.L;
    const after = L.soldiers.length - w.cost, next = r.walls[w.i + 1];
    const last = !next || after < next.cost;
    C.killSoldiers(w.cost, null, true);
    w.broken = true; r.mult = w.mult; r.lastBroken = w.i; w.body.visible = false; w.floorM.opacity = 0.0;
    burstShards(w);
    const nfx = last ? 26 : 10, size = last ? 2.4 : 1.4;
    for (let k = 0; k < nfx; k++) L.fx.push({ x: (Math.random() - 0.5) * r.W * 0.9, y: 0.6 + Math.random() * 2.4, z: w.z + 0.4, f: 4, t: 0, dur: last ? 0.6 : 0.35, size });
    L.shake = Math.max(L.shake, last ? 0.5 : 0.22);
    C.hitStop(0.06); C.sfx("gate", 1 + w.i * 0.12); C.vibe(last ? 60 : 25);
    C.floatText(0, 3.4, w.z, "x" + w.mult, last ? "#ffd84a" : "#ffffff");
    C.bus.emit("bonusWall", { index: w.i, mult: w.mult, cost: w.cost });
    if (last) { C.slowMo(0.35, 0.5, true); C.bus.emit("explosion", { x: 0, z: w.z, radius: 6 }); r.final = true; }
    r.phase = "pause"; r.t = 0;
  }

  function onTick(e) {
    const r = run; if (!r || C.state !== "bonus") return;
    const L = r.L, dt = e.dt * r.speed;
    r.elapsed += e.dt;
    L.targetX = 0; L.sx += (0 - L.sx) * Math.min(1, dt * 6);
    // shards (game time)
    for (let i = r.shards.length - 1; i >= 0; i--) {
      const s = r.shards[i]; s.t += dt;
      for (const p of s.list) { p.vy -= 16 * dt; p.m.position.x += p.vx * dt; p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt); p.m.position.z -= p.vz * dt * 0.35; p.m.rotation.x += p.rx * dt; p.m.rotation.y += p.ry * dt; }
      s.mat.opacity = Math.max(0, 0.9 * (1 - s.t / 1.1));
      if (s.t > 1.1) { for (const p of s.list) C.track.remove(p.m); r.shards.splice(i, 1); }
    }
    for (const w of r.walls) if (!w.broken) { const a = 0.55 + 0.1 * Math.sin(r.elapsed * 5 + w.i); w.haloM.opacity = a; }
    const w = r.walls[r.idx];
    if (r.phase === "charge") {
      const target = stopZ(w);
      L.sz = Math.max(target, L.sz - RUN_SPEED * dt);
      if (L.sz <= target + 0.01) {
        if (L.soldiers.length >= w.cost) breakWall(w);
        else { r.phase = "fail"; r.t = 0; C.sfx("bad"); C.vibe(40); C.floatText(0, 3.4, w.z, "NEED " + w.cost, "#ff6a5a"); }
      }
    } else if (r.phase === "pause") {
      r.t += dt;
      if (r.t >= STOP_T) {
        r.idx++;
        if (r.final || r.idx >= r.walls.length) { r.phase = "celebrate"; r.t = 0; } else r.phase = "charge";
      }
    } else if (r.phase === "fail") {
      r.t += dt;
      w.shake = 1 - r.t / FAIL_T;
      w.body.position.x = Math.sin(r.t * 60) * 0.18 * Math.max(0, w.shake);
      w.panelM.emissiveIntensity = 1.1 + Math.random() * 0.8 * Math.max(0, w.shake);
      L.shake = Math.max(L.shake, 0.18);
      if (r.t >= FAIL_T) { r.phase = "celebrate"; r.t = 0; }
    } else if (r.phase === "celebrate") {
      if (r.t === 0 && r.lastBroken >= 0 && !r.final) { /* ran out before the end */ }
      if (r.t === 0 && r.lastBroken < 0) C.floatText(0, 3.4, L.sz - 3, "x1", "#ffffff");
      r.t += dt;
      if (r.t >= CELEBRATE_T) finish();
    }
  }

  function onFrame(e) {
    const r = run; if (!r || e.state !== "bonus") return;
    r.camK += (1 - r.camK) * Math.min(1, (e.realDt || e.dt || 0.016) * 3);
    e.camera.position.y += 2.2 * r.camK; e.camera.position.z += 3.2 * r.camK;
    e.look.z -= 3 * r.camK;
    e.camera.lookAt(e.look);
  }

  function finish() {
    const r = run; if (!r) return;
    const mult = r.mult, C0 = C;
    C0.bus.emit("bonusEnd", { mult });
    cleanup();
    C0.finishLevel(mult);
  }

  function cleanup() {
    const r = run; run = null;
    if (!r) return;
    try { C.gameEl.removeEventListener("pointerdown", r.onTap); } catch (e) {}
    for (const w of r.walls) C.track.remove(w.grp);
    for (const s of r.shards) for (const p of s.list) C.track.remove(p.m);
    r.geoms.forEach(g => g.dispose()); r.mats.forEach(m => m.dispose()); r.texs.forEach(t => t.dispose());
  }

  window.Finale = { setup, start };
})();
