"use strict";
// Powerups: airdrops (cargo plane, parachute crate, a shootable supply crate holding a power-up), the four power-ups
// (SHIELD, AIRSTRIKE, GIANT, JACKPOT) and explosive barrels. See design/engagement.md F5 / F6.
// Everything simulates on the bus `tick` (game time, so slow-mo applies); billboards are oriented on `frame`.
// Visual objects live in their own group in the scene (Obj3D.clear() only empties the track group) and are shared
// pools built once; per-level things (labels) are disposed on generate / levelStart / win / lose.
window.Powerups = (() => {
  let C = null, THREE = null, root = null, ready = false, L = null, T = 0;
  const S = { drop: null, strike: null, labels: [], rings: [], bombs: [], shieldDur: 6, giantDur: 6, bOp: 0, giantRingT: 0, plan: [], barrels: [] };
  const W = { cargo: null, jet: null, chute: null };            // textures
  let planeM = null, chuteM = null, chuteGeoFull = null, chuteGeoCanopy = null, jets = [], bubble = null, shieldRing = null, giantRing = null, ringGeo = null, bombGeo = null, bombMat = null;
  const WEIGHTS = [["airstrike", 35], ["shield", 30], ["giant", 30], ["jackpot", 5]];
  const NAMES = { shield: "SHIELD!", airstrike: "AIRSTRIKE!", giant: "GIANT!", jackpot: "JACKPOT!" };
  const CH_W = 4.0, CH_H = 4.0 * 499 / 361;
  const sRGB = () => C.renderer.outputEncoding === THREE.sRGBEncoding;

  // ---------------------------------------------------------------- shared visuals
  function loadTex(url) {
    const t = new THREE.TextureLoader().load(url); t.anisotropy = 4; t.encoding = sRGB() ? THREE.sRGBEncoding : THREE.LinearEncoding; return t;
  }
  function spriteMat(map) { return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, fog: false }); }
  function sprite(map, w, h, order) {
    const m = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), spriteMat(map)); m.scale.set(w, h, 1); m.renderOrder = order || 8; m.visible = false; m.frustumCulled = false; root.add(m); return m;
  }
  const BUBBLE_VS = "varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }";
  const BUBBLE_FS = "uniform vec3 uColor; uniform float uOp; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;" +
    "void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float band = 0.5 + 0.5 * sin(vY * 9.0 - uTime * 2.5);" +
    "float a = (0.07 + 0.8 * f + 0.07 * band) * uOp; gl_FragColor = vec4(uColor * (0.8 + 0.7 * f), a); }";
  const RING_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  const RING_FS = "uniform vec3 uColor; uniform float uFrac; uniform float uOp; varying vec2 vUv;" +
    "void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float ang = atan(p.x, p.y) / 6.2831853; if (ang < 0.0) ang += 1.0;" +
    "float ring = smoothstep(0.86, 0.9, r) * (1.0 - smoothstep(0.96, 1.0, r)); float on = ang < uFrac ? 1.0 : 0.16; float tip = 1.0 - smoothstep(0.0, 0.03, abs(ang - uFrac));" +
    "gl_FragColor = vec4(uColor * (1.0 + 0.8 * tip), ring * on * uOp); }";
  function ringMat(color) {
    return new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uFrac: { value: 1 }, uOp: { value: 1 } }, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, fog: false });
  }
  function build() {
    if (ready) return; ready = true;
    root = new THREE.Group(); C.scene.add(root);
    W.cargo = loadTex("assets/fx-extra/cargo-plane.webp"); W.jet = loadTex("assets/fx-extra/jet.webp"); W.chute = loadTex("assets/fx-extra/parachute-crate.webp");
    planeM = sprite(W.cargo, 9, 9 * 390 / 686, 8);
    for (let i = 0; i < 2; i++) jets.push(sprite(W.jet, 8, 8 * 261 / 631, 8));
    chuteM = sprite(W.chute, CH_W, CH_H, 8);
    chuteGeoFull = chuteM.geometry;
    chuteGeoCanopy = new THREE.PlaneBufferGeometry(1, 0.7); { const uv = chuteGeoCanopy.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.3 + 0.7 * uv.getY(i)); }
    // shield bubble: fresnel rim, additive
    bubble = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 28, 18), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.3, 0.85, 1.0) }, uOp: { value: 0 }, uTime: { value: 0 } }, vertexShader: BUBBLE_VS, fragmentShader: BUBBLE_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    bubble.renderOrder = 6; bubble.visible = false; bubble.frustumCulled = false; root.add(bubble);
    // ground timer rings: a thin ring that depletes clockwise as the power-up runs out
    const flat = new THREE.PlaneBufferGeometry(1, 1).rotateX(-Math.PI / 2);
    shieldRing = new THREE.Mesh(flat, ringMat(0x5ad8ff)); giantRing = new THREE.Mesh(flat, ringMat(0xffa23a));
    for (const r of [shieldRing, giantRing]) { r.renderOrder = 3; r.visible = false; r.frustumCulled = false; root.add(r); }
    // pooled expanding rings (shockwaves, bursts, dust)
    ringGeo = new THREE.RingBufferGeometry(0.8, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false })); m.visible = false; m.renderOrder = 4; m.frustumCulled = false; root.add(m);
      S.rings.push({ m, t: 0, life: 1, r0: 1, r1: 2, op: 1, on: false });
    }
    // bombs
    bombGeo = new THREE.CylinderBufferGeometry(0.2, 0.2, 1.0, 8); bombMat = new THREE.MeshBasicMaterial({ color: 0x23262e, toneMapped: false, fog: false });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(bombGeo, bombMat); m.visible = false; m.frustumCulled = false; root.add(m); S.bombs.push(m); }
  }
  function ring(x, z, r0, r1, life, color, additive, op) {
    const r = S.rings.find(q => !q.on) || S.rings[0];
    Object.assign(r, { t: 0, life, r0, r1, op: op == null ? 1 : op, on: true });
    r.m.material.color.set(color); r.m.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending; r.m.position.set(x, 0.07, z); r.m.visible = true; r.m.scale.setScalar(r0);
  }
  function updateRings(dt) {
    for (const r of S.rings) {
      if (!r.on) continue; r.t += dt; const u = r.t / r.life;
      if (u >= 1) { r.on = false; r.m.visible = false; continue; }
      r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * (1 - (1 - u) * (1 - u))); r.m.material.opacity = r.op * (1 - u) * (1 - u * 0.3);
    }
  }
  // world-space "SHOOT IT!" labels (first time only), billboarded and bobbing above a solid
  function addLabel(o, text, color, y) {
    const lab = C.makeLabel(512, 128); lab.tex.encoding = sRGB() ? THREE.sRGBEncoding : THREE.LinearEncoding; C.drawLabel(lab, text, color, 0.62);
    const m = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    m.scale.set(4.6, 1.15, 1); m.renderOrder = 9; m.frustumCulled = false; root.add(m);
    S.labels.push({ o, m, lab, y });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lab.last = null; C.drawLabel(lab, text, color, 0.62); }).catch(() => {});
  }
  function dropLabel(l) { root.remove(l.m); l.m.geometry.dispose(); l.m.material.dispose(); l.lab.tex.dispose(); }
  function removeLabelsFor(o) { for (let i = S.labels.length - 1; i >= 0; i--) if (S.labels[i].o === o) { dropLabel(S.labels[i]); S.labels.splice(i, 1); } }

  function reset() {
    if (!ready) { S.plan = []; S.barrels = []; S.drop = S.strike = null; return; }
    for (const l of S.labels) dropLabel(l); S.labels.length = 0;
    S.drop = S.strike = null; S.bOp = 0; S.giantRingT = 0;
    planeM.visible = chuteM.visible = bubble.visible = shieldRing.visible = giantRing.visible = false;
    for (const j of jets) j.visible = false; for (const b of S.bombs) b.visible = false; for (const r of S.rings) { r.on = false; r.m.visible = false; }
  }
  function hideSquadFx() { if (!ready) return; S.bOp = 0; bubble.visible = shieldRing.visible = giantRing.visible = false; }

  // ---------------------------------------------------------------- level planning (on `generate`)
  function pickPower(rng) {
    let r = rng() * WEIGHTS.reduce((a, w) => a + w[1], 0);
    for (const [k, w] of WEIGHTS) { if ((r -= w) < 0) return k; } return "airstrike";
  }
  // blocked? solids/gates near (x,z); also checks that a barrel/crate there leaves a >= 3.2 wide corridor
  function spotFree(x, z, hw, apart) {
    for (const g of L.gates) if (Math.abs(g.z - z) < 7) return false;
    for (const o of L.solids) if (o.alive && Math.abs(o.z - z) < apart && Math.abs(o.x - x) < o.hw + hw + 1.6) return false;
    for (const p of S.plan) if (Math.abs(p.z - z) < 9) return false;
    const iv = [[x - hw - 0.3, x + hw + 0.3]];
    for (const o of L.solids) if (o.alive && Math.abs(o.z - z) < 3.2) iv.push([o.x - o.hw - 0.3, o.x + o.hw + 0.3]);
    iv.sort((a, b) => a[0] - b[0]); let cur = -C.ROAD, gap = 0;
    for (const [a, b] of iv) { gap = Math.max(gap, a - cur); cur = Math.max(cur, b); }
    return Math.max(gap, C.ROAD - cur) >= 3.2;
  }
  function planAirdrops(rng, level, length) {
    const n = level === 1 ? 1 : (rng() < 0.5 ? 1 : 2);
    const fr = level === 1 ? [0.45] : n === 1 ? [0.3 + 0.4 * rng()] : [0.25 + 0.15 * rng(), 0.55 + 0.2 * rng()];
    fr.forEach((f, i) => {
      const lead = 35 + rng() * 10, power = level === 1 && i === 0 ? "airstrike" : pickPower(rng);
      const xs = [3.2, -3.2, 1.8, -1.8, 0, 4.2, -4.2].sort(() => rng() - 0.5);
      let best = null;
      for (let dz = 0; dz < 60 && !best; dz += 3) for (const sgn of dz ? [1, -1] : [1]) {
        const z = -length * Math.min(0.78, f) + sgn * dz; if (z > -30 || z < -length * 0.8) continue;
        for (const x of xs) if (spotFree(x, z, 1.2, 5)) { best = { x, z }; break; }
        if (best) break;
      }
      if (!best) best = { x: 3.2, z: -length * Math.min(0.78, f) };
      S.plan.push({ x: best.x, z: best.z, lead, powerup: power, fired: false, o: null });
    });
  }
  function planBarrels(rng, level, length) {
    if (level < 3) return;
    const want = 1 + Math.floor(rng() * 3), pool = L.enemies.filter(e => e.z < -30 && e.z > -length * 0.86 && Math.abs(e.x) < C.ROAD).sort(() => rng() - 0.5);
    const placed = [];
    for (const e of pool) {
      if (placed.length >= want) break;
      if (placed.some(p => Math.abs(p.z - e.z) < 18)) continue;
      const s0 = e.x >= 0 ? 1 : -1;
      for (const sgn of [s0, -s0]) {
        const x = Math.max(-C.ROAD + 1.4, Math.min(C.ROAD - 1.4, e.x + sgn * (1.9 + rng() * 1.2))), z = e.z + 1.5 + rng() * 2.5;
        if (!spotFree(x, z, 0.8, 4)) continue;
        const b = C.spawnSolid("barrel", x, z, 3 + level, { explosive: true }); placed.push(b); S.barrels.push(b);
        if (placed.length < want && rng() < 0.4) { // a chain pair: a second barrel right beside the first
          const x2 = x + (x > 0 ? -1 : 1) * 1.9, z2 = z + (rng() - 0.5) * 1.2;
          if (spotFree(x2, z2, 0.8, 1)) { const b2 = C.spawnSolid("barrel", x2, z2, 3 + level, { explosive: true }); placed.push(b2); S.barrels.push(b2); }
        }
        break;
      }
    }
  }
  function onGenerate(ev) {
    L = ev.L; reset(); S.plan = []; S.barrels = [];
    if (ev.level === 1) planAirdrops(ev.rng, ev.level, ev.length);
    else for (let i = 0; i < L.threats.length; i++) {
      const t = L.threats[i]; if (t.tool) continue;
      // Alternating fork drops: the second icon is a different tool, never a disguised copy.
      const fork = i === 0 ? ev.level % 2 === 0 : ev.level % 2 !== 0;
      const alternatives = ["airstrike", "giant", "shield"].filter(k => k !== t.counter);
      S.plan.push({ x: fork ? -3.3 : 0, z: t.z + 43, lead: 35, powerup: t.counter, other: fork ? alternatives[Math.floor(ev.rng() * 2)] : null, guaranteed: t.teaching, fired: false, o: null });
    }
    planBarrels(ev.rng, ev.level, ev.length);
  }

  // ---------------------------------------------------------------- airdrop sequence
  const TR = 1.0, TF = 2.0, VP = 55;            // release time, fall time, plane speed
  function startDrop(p) {
    build(); p.fired = true; S.drop = { p, t: 0, chute: false, landed: false, ct: 0 };
    C.bus.emit("airdrop", { x: p.x, z: p.z }); C.sfx("bad", 0.5);
  }
  function landDrop(d) {
    const p = d.p; d.landed = true; d.ct = 0;
    const o = C.spawnSolid("airdrop", p.x, p.z, 8 + 2 * L.level, { powerup: p.powerup }); p.o = o;
    if (p.other) p.otherO = C.spawnSolid("airdrop", 3.3, p.z, 8 + 2 * L.level, { powerup: p.other });
    chuteM.geometry = chuteGeoCanopy; chuteM.scale.set(CH_W, CH_H * 0.7, 1);
    L.fx.push({ x: p.x, y: 0.5, z: p.z + 0.5, f: 4, t: 0, dur: 0.3, size: 3 }); ring(p.x, p.z, 0.6, 3.4, 0.45, 0xd9c7a0, false, 0.7);
    if (!C.save.seenAirdrop) { C.save.seenAirdrop = true; try { C.persist(); } catch (e) {} addLabel(o, "SHOOT IT!", "#ffe066", 5.1); }
  }
  function updateDrop(dt) {
    const d = S.drop; if (!d) return; d.t += dt;
    const p = d.p, zr = p.z - 10;
    if (d.t < 2.7) { planeM.visible = true; planeM.position.set(p.x * 0.5, 15 + d.t * 0.8, zr + VP * (TR - d.t)); } else planeM.visible = false;
    if (!d.chute && d.t >= TR) { d.chute = true; chuteM.geometry = chuteGeoFull; chuteM.scale.set(CH_W, CH_H, 1); chuteM.material.opacity = 1; chuteM.visible = true; }
    if (d.chute && !d.landed) {
      const u = Math.min(1, (d.t - TR) / TF), y = 15 * (1 - u), sw = Math.sin(u * 7) * 0.5 * (1 - u);
      chuteM.position.set(p.x + sw, y + CH_H / 2, zr + 10 * u); chuteM.material.opacity = Math.min(1, u * 6);
      if (u >= 1) landDrop(d);
    } else if (d.landed) {            // the canopy settles and fades
      d.ct += dt; const u = Math.min(1, d.ct / 0.7);
      chuteM.position.set(p.x, CH_H * 0.3 + CH_H * 0.35 * (1 - u * 0.75), p.z - 0.4); chuteM.scale.set(CH_W * (1 + 0.25 * u), CH_H * 0.7 * (1 - 0.6 * u), 1); chuteM.material.opacity = 1 - u * u;
      if (u >= 1) { chuteM.visible = false; if (d.t >= 2.7) S.drop = null; }
    }
  }

  // ---------------------------------------------------------------- power-ups
  function usePower(type) {
    build(); C.bus.emit("powerup", { type }); C.sfx("win");
    const x = L.sx, z = L.sz;
    if (type !== "jackpot") C.floatText(x, 3.3, z, NAMES[type], type === "shield" ? "#7fe0ff" : type === "giant" ? "#ffb347" : "#ff8a5a");
    if (type === "shield") { S.shieldDur = 6; C.setShield(6); ring(x, z, 1, 7, 0.6, 0x5ad8ff, true, 0.9); }
    else if (type === "giant") { S.giantDur = 6; C.setGiant(6); S.giantRingT = 0; L.shake = Math.max(L.shake, 0.25); }
    else if (type === "airstrike") {
      // Boss damage is exactly 18%; road bombs below cannot add accidental boss splash.
      if (C.state === "boss") { C.damageArea(L.sx, L.sz - 8, 22, 100 + 8 * L.level, { skipBoss: true }); C.damageBoss(L.boss.maxHp * 0.18); }
      startStrike();
    }
    else if (type === "jackpot") {
      C.addSoldiers(20 + 10 * L.level); C.floatText(x, 3.2, z, "JACKPOT!", "#ffd84a");
      ring(x, z, 1, 9, 0.7, 0xffd84a, true, 1); ring(x, z, 0.5, 6, 0.55, 0xfff1a8, true, 1);
      for (let i = 0; i < 16; i++) L.fx.push({ x: x + (Math.random() - 0.5) * 6, y: 0.6 + Math.random() * 3.2, z: z + (Math.random() - 0.5) * 4, f: 14, t: -Math.random() * 0.35, dur: 0.6, size: 1.3 + Math.random() * 1.4 });
    }
  }
  function startStrike() {
    const st = { t: 0, zs: L.sz, bombs: [], jetDone: false, threat: C.threat, boss: C.state === "boss" };
    for (let i = 0; i < 8; i++) st.bombs.push({ rt: 0.55 + 1.2 * i / 7, ahead: 10 + 35 * i / 7 + (Math.random() - 0.5) * 3, x: (i % 2 ? 1 : -1) * (0.8 + Math.random() * 3.4), z: 0, rel: false, done: false, mesh: S.bombs[i] });
    S.strike = st; C.sfx("boom", 2); L.shake = Math.max(L.shake, 0.12);
  }
  function updateStrike(dt) {
    const st = S.strike; if (!st) return; st.t += dt;
    jets.forEach((j, i) => {
      const t = st.t - i * 0.14, z = st.zs + 32 - 78 * t;
      j.visible = t > 0 && t < 2.4; if (j.visible) j.position.set((i ? 3.6 : -3.6) * (1 + 0.5 * t), 13 + t * 2.2, z);
    });
    let alive = false;
    for (const b of st.bombs) {
      if (b.done) continue; alive = true;
      if (!b.rel && st.t >= b.rt) { b.rel = true; b.z = Math.max(L.sz - b.ahead, -L.length + 6); b.mesh.visible = true; }
      if (!b.rel) continue;
      const u = Math.min(1, (st.t - b.rt) / 0.32); b.mesh.position.set(b.x, 14 * (1 - u * u) + 0.4, b.z - 4 * (1 - u)); b.mesh.rotation.x = -0.35 * (1 - u); b.mesh.scale.set(1.3, 1.6, 1.3);
      if (u >= 1) {
        b.done = true; b.mesh.visible = false;
        if (st.threat && st.threat.kind === "swarm") {
          for (const e of st.threat.actors) if (e.hp > 0) { b.x = e.x; b.z = e.z; break; }
        }
        // Keep explosions away from the boss hit box; clear nearby adds with a separate
        // damageArea option so the boss always takes exactly the promised fraction.
        C.damageArea(b.x, b.z, st.threat && st.threat.kind === "swarm" ? 10 : 4, 40 + 8 * L.level, { skipBoss: true });
        L.fx.push({ x: b.x, y: 0.7, z: b.z, f: 9, t: 0, dur: 0.5, size: 8.5 }, { x: b.x + 1.2, y: 1.6, z: b.z - 0.8, f: 9, t: -0.06, dur: 0.45, size: 5.5 }, { x: b.x - 1.4, y: 0.9, z: b.z + 0.6, f: 4, t: 0, dur: 0.3, size: 4 });
        ring(b.x, b.z, 1, 6.5, 0.45, 0xffa040, true, 0.9); C.sfx("boom", 0.9 + Math.random() * 0.3); L.shake = Math.max(L.shake, 0.2);
      }
    }
    if (!alive && st.t > 2.5) { S.strike = null; for (const j of jets) j.visible = false; }
  }

  // ---------------------------------------------------------------- barrels
  function explodeBarrel(o) {
    C.damageArea(o.x, o.z, 4.5, 30 + 10 * (L ? L.level : 1));
    L.fx.push({ x: o.x, y: 0.8, z: o.z, f: 9, t: 0, dur: 0.5, size: 9 }, { x: o.x + 1, y: 1.8, z: o.z - 0.6, f: 9, t: -0.07, dur: 0.45, size: 5.5 }, { x: o.x - 1.2, y: 0.9, z: o.z + 0.5, f: 4, t: -0.03, dur: 0.3, size: 4.5 });
    build(); ring(o.x, o.z, 1, 7, 0.5, 0xff8a30, true, 0.9);
    C.sfx("boom"); L.shake = Math.max(L.shake, 0.25);
  }
  function onSolidBreak(ev) {
    const o = ev.o; if (!o || o._pu) return;
    if (o.kind === "airdrop") { o._pu = true; removeLabelsFor(o); if (ev.earned) C.collectPowerup(o.powerup || "shield"); }
    else if (o.kind === "barrel") { o._pu = true; removeLabelsFor(o); explodeBarrel(o); }
  }

  // ---------------------------------------------------------------- per-frame
  function updateSquad(dt) {
    const n = L.soldiers.length, gk = L.giantK || 1, R = C.squadRadius(n) * gk;
    // shield bubble
    const sOn = L.shieldT > 0;
    S.bOp += ((sOn ? 1 : 0) - S.bOp) * Math.min(1, dt * 9);
    bubble.visible = S.bOp > 0.02;
    if (bubble.visible) {
      const rx = R * 1.15 + 0.7, ry = (1.6 + R * 0.3) * Math.max(1, gk * 0.85), fl = sOn && L.shieldT < 1 ? 0.55 + 0.45 * Math.sin(T * 38) : 1, pulse = 1 + 0.025 * Math.sin(T * 5);
      bubble.position.set(L.sx, ry * 0.5, L.sz); bubble.scale.set(rx * pulse, ry * pulse, rx * 0.9 * pulse);
      bubble.material.uniforms.uOp.value = S.bOp * fl; bubble.material.uniforms.uTime.value = T;
    }
    // timer rings
    for (const [mesh, t, dur, off] of [[shieldRing, L.shieldT, S.shieldDur, 0.9], [giantRing, L.giantT, S.giantDur, 1.5]]) {
      if (t > 0) {
        if (t > dur) { if (mesh === shieldRing) S.shieldDur = t; else S.giantDur = t; }
        const rr = R + off + (mesh === giantRing && L.shieldT > 0 ? 0.55 : 0);
        mesh.visible = true; mesh.position.set(L.sx, 0.08, L.sz); mesh.scale.set(rr * 2, 1, rr * 2);
        mesh.material.uniforms.uFrac.value = Math.min(1, t / Math.max(dur, 0.1)); mesh.material.uniforms.uOp.value = t < 1 ? 0.5 + 0.5 * Math.sin(T * 30) : 1;
      } else mesh.visible = false;
    }
    // GIANT: a dust shockwave under every stomp
    if (L.giantT > 0) {
      S.giantRingT -= dt;
      if (S.giantRingT <= 0) { S.giantRingT = 0.6; ring(L.sx, L.sz, R * 0.8, R + 6, 0.55, 0xe4d2a8, false, 0.75); L.shake = Math.max(L.shake, 0.06); }
    }
  }
  function updateLabels() {
    const cam = C.camera, sz = L.sz;
    for (let i = S.labels.length - 1; i >= 0; i--) {
      const l = S.labels[i];
      if (!l.o.alive) { dropLabel(l); S.labels.splice(i, 1); continue; }
      const far = sz - l.o.z; // >0 ahead of the squad
      if (far < -2 || far > 90) { l.m.visible = false; continue; }
      l.m.visible = true; l.m.position.set(l.o.x, l.y + 0.25 * Math.sin(T * 4), l.o.z); const k = 1 + 0.06 * Math.sin(T * 8); l.m.scale.set(4.6 * k, 1.15 * k, 1);
      if (l.o.kind === "barrel" && far < 40 && !C.save.seenBarrel) { C.save.seenBarrel = true; try { C.persist(); } catch (e) {} }
    }
    // first-time barrel hint: shown on the first barrel once the squad is within sight
    if (!C.save.seenBarrel && !S.barrelHintFor) { // create once per level
      const b = S.barrels.find(q => q.alive && L.sz - q.z > -2 && L.sz - q.z < 80);
      if (b) { S.barrelHintFor = b; addLabel(b, "SHOOT!", "#ff9a7a", 4.0); }
    }
    void cam;
  }
  function onTick(ev) {
    L = ev.L; if (!L) return; T += ev.dt; build();
    if (ev.state === "play" && !S.drop) {
      for (const p of S.plan) {
        if (p.fired || L.sz <= p.z + 12) { if (!p.fired && L.sz <= p.z + 12) p.fired = true; continue; }
        if (L.sz <= p.z + p.lead + C.SPEED * (L.speedMul || 1) * (TR + TF)) { startDrop(p); break; }
      }
    }
    updateDrop(ev.dt);
    // Teaching supplies are guaranteed even if the player steers past the crate.
    // Both the ordinary shot/contact path and this fallback use _pu to award once.
    for (const p of S.plan) if (p.guaranteed && p.o && !p.o._pu && L.sz <= p.z + 4) {
      C.damageArea(p.o.x, p.o.z, 0.01, p.o.hp, { skipBoss: true });
    }
    updateStrike(ev.dt); updateRings(ev.dt); updateSquad(ev.dt); updateLabels();
  }
  function onFrame(ev) { // billboards face the camera
    if (!ready) return; const q = ev.camera.quaternion;
    if (planeM.visible) planeM.quaternion.copy(q); if (chuteM.visible) chuteM.quaternion.copy(q);
    for (const j of jets) if (j.visible) j.quaternion.copy(q);
    for (const l of S.labels) if (l.m.visible) l.m.quaternion.copy(q);
  }

  function setup(ctx) {
    C = ctx; THREE = ctx.THREE; const b = ctx.bus;
    b.on("generate", ev => { S.barrelHintFor = null; onGenerate(ev); });
    b.on("levelStart", () => { const plan = S.plan, bar = S.barrels; reset(); S.plan = plan; S.barrels = bar; S.barrelHintFor = null; for (const p of S.plan) { p.fired = false; } });
    b.on("tick", onTick); b.on("frame", onFrame); b.on("solidBreak", onSolidBreak);
    b.on("win", hideSquadFx); b.on("lose", hideSquadFx);
    b.on("state", ev => { if (ev.to === "home" || ev.to === "levels") hideSquadFx(); });
  }
  // test hooks: Powerups.force("shield" | "airstrike" | "giant" | "jackpot")
  return { setup, activate: type => { if (C && C.L) { L = C.L; usePower(type); } }, force: type => { if (C && C.L) { L = C.L; usePower(type); } } };
})();
