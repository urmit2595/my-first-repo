"use strict";
// Obj3D: real 3D gates and shootable solids (blocks, crates, tyres, weapon cases, ammo boxes).
// See design/overhaul.md section 6. API: setup, clear, gate, gateHalf, gateUsed, solid, solidLabel, solidHit, solidBreak, update.
// Surge Update: solid kinds airdrop (supply crate + beacon) and barrel (explosive), and golden jackpot gate halves (h.jackpot).
//
// Resource rules: geometries, textures and materials of the object kinds are built once and shared for the whole
// page life; only label canvases / label materials / gate-half materials are per object and disposed in clear().
// Colours are written as sRGB hex; when the renderer outputs sRGB (outputEncoding) they are converted to linear
// (three r128 has no colour management), so the same code looks right with or without the new colour pipeline.
window.Obj3D = (() => {
  let C = null, ready = false;
  let LIN = null;                       // renderer outputs sRGB => convert colours to linear
  let gatePosts = null; const postMatrix = new THREE.Matrix4();
  const LEVELGEO = [];
  let T = 0;                            // animation clock
  let fbEnv = null, envMode = null;     // own fallback environment (used only while scene.environment is null)

  const MATS = [];                      // shared materials (repainted when the colour pipeline changes)
  const TEXS = [];                      // shared colour textures
  const LMATS = [], LTEX = [], LEVELMATS = []; // per level: label materials, label textures, gate-half materials
  const HALVES = [], SOLIDS = [], GATES = [];       // live animated things
  const G = {}, M = {}, X = {};         // shared geometries, materials, textures

  // ---------------------------------------------------------------- colour / material helpers
    function setC(target, srgb) { target.copy(srgb); if (LIN) target.convertSRGBToLinear(); return target; }
  function setHex(target, hex) { target.set(hex); if (LIN) target.convertSRGBToLinear(); return target; }
  function paint(m) {
    const h = m.userData.hex; if (!h) return;
    if (h.color != null) setHex(m.color, h.color);
    if (h.emissive != null && m.emissive) setHex(m.emissive, h.emissive);
  }
  function mat(kind, p, level) {
    const hex = { color: p.color, emissive: p.emissive }; delete p.color; delete p.emissive;
    const m = new THREE[kind](p); m.userData.hex = hex; paint(m);
    if (m.isMeshStandardMaterial && fbEnv && !C.scene.environment) m.envMap = fbEnv;
    (level ? LEVELMATS : MATS).push(m); return m;
  }
  function flashOf(m) {
    if (m.userData.flash) return m.userData.flash;
    const f = m.clone(); f.userData = { hex: { color: m.userData.hex.color, emissive: 0xffffff } };
    f.emissiveIntensity = 0.55; paint(f); if (m.envMap) f.envMap = m.envMap; MATS.push(f);
    m.userData.flash = f; return f;
  }
  function tex(canvas, color) {
    const t = new THREE.CanvasTexture(canvas); t.anisotropy = 4;
    t.encoding = color && LIN ? THREE.sRGBEncoding : THREE.LinearEncoding;
    if (color) TEXS.push(t); return t;
  }
  function refreshPipeline() {
    const lin = C.renderer.outputEncoding === THREE.sRGBEncoding;
    if (lin === LIN) return;
    LIN = lin;
    for (const m of MATS) { paint(m); m.needsUpdate = true; }
    for (const m of LEVELMATS) { paint(m); m.needsUpdate = true; }
    for (const t of TEXS.concat(LTEX)) { t.encoding = lin ? THREE.sRGBEncoding : THREE.LinearEncoding; t.needsUpdate = true; }
    for (const m of LMATS) m.needsUpdate = true;
    for (const hs of HALVES) paintHalf(hs);
  }
  function syncEnv() {
    const mode = C.scene.environment ? "scene" : "own";
    if (mode === envMode) return; envMode = mode;
    if (mode === "own" && !fbEnv) fbEnv = buildEnv();
    const e = mode === "own" ? fbEnv : null;
    for (const m of MATS.concat(LEVELMATS)) if (m.isMeshStandardMaterial && !m.userData.keepEnv) { m.envMap = e; m.needsUpdate = true; }
  }
  // small sky + warm sun + soft boxes environment for PBR reflections when the scene has none
  function buildEnv() {
    const gen = new THREE.PMREMGenerator(C.renderer), sc = new THREE.Scene();
    const sg = new THREE.SphereBufferGeometry(60, 32, 20), pos = sg.attributes.position, col = [];
    const top = new THREE.Color(0.3, 0.5, 0.95), hor = new THREE.Color(0.95, 0.8, 0.6), bot = new THREE.Color(0.07, 0.07, 0.08), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 60;
      if (y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.min(1, -y * 14));
      col.push(c.r, c.g, c.b);
    }
    sg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const lamp = (r, x, y, z, rgb) => { const m = new THREE.Mesh(new THREE.SphereBufferGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]) })); m.position.set(x, y, z); sc.add(m); };
    lamp(7, -28, 34, 26, [9, 7.5, 5.5]);       // warm sun, upper left, behind the camera
    lamp(9, 34, 18, 22, [2.2, 2.4, 3.0]);      // cool soft box on the right
    lamp(12, 0, 55, 0, [1.8, 2.0, 2.4]);       // skylight
    lamp(10, 0, 8, -40, [1.4, 1.1, 0.9]);      // warm glow ahead
    const rt = gen.fromScene(sc, 0.02); gen.dispose(); sg.dispose();
    return rt.texture;
  }

  // ---------------------------------------------------------------- geometry helpers
  // box with true rounded (bevelled) edges and corners: smooth normals, box-style UVs per face
  function roundedBox(w, h, d, r, B = 3) {
    const H = [w / 2, h / 2, d / 2]; r = Math.min(r, H[0], H[1], H[2]);
    const ticks = a => { const t = [], hh = H[a] - r; for (let k = B; k >= 0; k--) t.push(-hh - r * Math.tan(k / B * Math.PI / 4)); for (let k = 0; k <= B; k++) t.push(hh + r * Math.tan(k / B * Math.PI / 4)); return t; };
    const pos = [], nor = [], uv = [], idx = [];
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      const b = (a + 1) % 3, c = (a + 2) % 3, tb = ticks(b), tc = ticks(c), nb = tb.length, nc = tc.length, base = pos.length / 3;
      for (let i = 0; i < nb; i++) for (let j = 0; j < nc; j++) {
        const p = [0, 0, 0]; p[a] = s * H[a]; p[b] = tb[i]; p[c] = tc[j];
        const n = [0, 0, 0], q = [0, 0, 0]; let len = 0;
        for (let k = 0; k < 3; k++) { const inn = Math.max(-(H[k] - r), Math.min(H[k] - r, p[k])); n[k] = p[k] - inn; q[k] = inn; len += n[k] * n[k]; }
        len = Math.sqrt(len) || 1;
        for (let k = 0; k < 3; k++) { n[k] /= len; pos.push(q[k] + n[k] * r); nor.push(n[k]); }
        uv.push((tb[i] + H[b]) / (2 * H[b]), (tc[j] + H[c]) / (2 * H[c]));
      }
      for (let i = 0; i < nb - 1; i++) for (let j = 0; j < nc - 1; j++) {
        const v00 = base + i * nc + j, v10 = base + (i + 1) * nc + j, v01 = v00 + 1, v11 = v10 + 1;
        if (s > 0) idx.push(v00, v10, v01, v10, v11, v01); else idx.push(v00, v01, v10, v10, v01, v11);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); return g;
  }
  function merge(parts) { // [{g, x, y, z, c?}] => one non-indexed geometry (c = sRGB hex vertex colour, if any part has one)
    const P = [], N = [], U = [], K = [], m = new THREE.Matrix4(), tc = new THREE.Color(), wantC = parts.some(q => q.c != null);
    for (const { g, x = 0, y = 0, z = 0, c } of parts) {
      const t = g.index ? g.toNonIndexed() : g.clone(); t.applyMatrix4(m.makeTranslation(x, y, z));
      for (const q of t.attributes.position.array) P.push(q); for (const q of t.attributes.normal.array) N.push(q); for (const q of (t.attributes.uv ? t.attributes.uv.array : new Float32Array(t.attributes.position.count * 2))) U.push(q);
      if (wantC) { setHex(tc, c == null ? 0xffffff : c); for (let i = 0; i < t.attributes.position.count; i++) K.push(tc.r, tc.g, tc.b); }
      t.dispose(); g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    if (wantC) out.setAttribute("color", new THREE.Float32BufferAttribute(K, 3));
    return out;
  }
  class RoundRectCurve extends THREE.Curve {
    constructor(hw, hh, r) {
      super(); const sx = 2 * (hw - r), sy = 2 * (hh - r), arc = r * Math.PI / 2;
      this.hw = hw; this.hh = hh; this.r = r; this.seg = [sx, arc, sy, arc, sx, arc, sy, arc]; this.total = this.seg.reduce((a, b) => a + b, 0);
    }
    getPoint(t, out = new THREE.Vector3()) {
      let d = (t % 1) * this.total; const { hw, hh, r } = this; let i = 0;
      while (i < 7 && d > this.seg[i]) d -= this.seg[i++];
      const f = this.seg[i] ? d / this.seg[i] : 0, a = f * Math.PI / 2;
      switch (i) {
        case 0: return out.set(-(hw - r) + f * 2 * (hw - r), -hh, 0);
        case 1: return out.set(hw - r + Math.sin(a) * r, -(hh - r) - Math.cos(a) * r, 0);
        case 2: return out.set(hw, -(hh - r) + f * 2 * (hh - r), 0);
        case 3: return out.set(hw - r + Math.cos(a) * r, hh - r + Math.sin(a) * r, 0);
        case 4: return out.set(hw - r - f * 2 * (hw - r), hh, 0);
        case 5: return out.set(-(hw - r) - Math.sin(a) * r, hh - r + Math.cos(a) * r, 0);
        case 6: return out.set(-hw, hh - r - f * 2 * (hh - r), 0);
        default: return out.set(-(hw - r) - Math.cos(a) * r, -(hh - r) - Math.sin(a) * r, 0);
      }
    }
  }
  const cvs = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const lcg = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---------------------------------------------------------------- specs
  const GOOD = { panel: new THREE.Color(0x1a78ff), edge: new THREE.Color(0x9ff0ff), glow: new THREE.Color(0x2f9bff) };
  const GOLD = { panel: new THREE.Color(0xffa800), edge: new THREE.Color(0xfff1a8), glow: new THREE.Color(0xffc424) };
  const BAD = { panel: new THREE.Color(0xff2b2b), edge: new THREE.Color(0xffb4a0), glow: new THREE.Color(0xff4a3a) };
  const PW = 5.2, PH = 2.7, PD = 0.36, PY = 1.65;       // gate panel size and centre height

  function build() {
    // ---- textures
    { // glass panel: vertical emissive gradient, top 1.0 to bottom 0.6 (greyscale emissiveMap)
      const c = cvs(256, 128), g = c.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#999999"); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
      X.panel = tex(c, false);
    }
    { const c = cvs(128, 64), g = c.getContext("2d"); g.scale(2, 1); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.5, "rgba(255,255,255,.4)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); X.glow = tex(c, true); }
    { // crate: frame, planks, grain, diagonal brace
      const c = cvs(256, 256), g = c.getContext("2d"), r = lcg(7);
      g.fillStyle = "#c98f4e"; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) { g.fillStyle = `hsl(${28 + r() * 6},${52 + r() * 10}%,${50 + r() * 8}%)`; g.fillRect(0, i * 64, 256, 63); g.fillStyle = "rgba(60,30,10,.55)"; g.fillRect(0, i * 64 + 61, 256, 3); }
      g.strokeStyle = "rgba(90,50,20,.22)"; g.lineWidth = 1.5; for (let i = 0; i < 70; i++) { const y = r() * 256, x = r() * 220; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 40, y + (r() - 0.5) * 2); g.stroke(); }
      g.save(); g.translate(128, 128); g.rotate(Math.atan2(1, 1)); g.fillStyle = "#a8692f"; g.fillRect(-190, -19, 380, 38); g.fillStyle = "rgba(255,225,170,.35)"; g.fillRect(-190, -19, 380, 4); g.fillStyle = "rgba(40,20,5,.5)"; g.fillRect(-190, 17, 380, 3); g.restore();
      g.lineWidth = 26; g.strokeStyle = "#a86a2c"; g.strokeRect(13, 13, 230, 230); g.lineWidth = 3; g.strokeStyle = "rgba(255,225,170,.4)"; g.strokeRect(1.5, 1.5, 253, 253); g.strokeStyle = "rgba(40,20,5,.55)"; g.strokeRect(26, 26, 204, 204);
      X.wood = tex(c, true);
    }
    { // ammo box front: hazard stripes + gold bullet
      const c = cvs(512, 256), g = c.getContext("2d");
      for (const y of [14, 196]) { g.save(); rrect(g, 24, y, 464, 46, 10); g.clip(); g.fillStyle = "#ffd21f"; g.fillRect(0, y, 512, 46); g.fillStyle = "#2a2f18"; for (let x = -60; x < 540; x += 56) { g.beginPath(); g.moveTo(x, y + 46); g.lineTo(x + 28, y + 46); g.lineTo(x + 58, y); g.lineTo(x + 30, y); g.closePath(); g.fill(); } g.restore(); }
      g.translate(256, 128); g.rotate(-0.55);
      const bullet = (ox, oy, fill, line) => { g.beginPath(); g.moveTo(-74 + ox, -26 + oy); g.lineTo(26 + ox, -26 + oy); g.quadraticCurveTo(84 + ox, -24 + oy, 96 + ox, 0 + oy); g.quadraticCurveTo(84 + ox, 24 + oy, 26 + ox, 26 + oy); g.lineTo(-74 + ox, 26 + oy); g.closePath(); g.lineJoin = "round"; if (line) { g.lineWidth = 12; g.strokeStyle = line; g.stroke(); } g.fillStyle = fill; g.fill(); };
      bullet(0, 0, "#ffc928", "#2a2f18");
      g.fillStyle = "#e0a210"; g.fillRect(-74, -26, 50, 52); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(-16, -18, 90, 8);
      X.ammo = tex(c, true);
    }
    { // jackpot glass: twinkling four-point stars (additive) and a soft diagonal shine band
      const c = cvs(256, 128), g = c.getContext("2d"), r = lcg(21);
      for (let i = 0; i < 16; i++) {
        const x = 10 + r() * 236, y = 8 + r() * 112, s = 5 + r() * 13, gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, "rgba(255,250,215,1)"); gr.addColorStop(0.35, "rgba(255,225,120,.45)"); gr.addColorStop(1, "rgba(255,200,60,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
        g.strokeStyle = "rgba(255,248,210,.95)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - s * 1.9, y); g.lineTo(x + s * 1.9, y); g.moveTo(x, y - s * 1.9); g.lineTo(x, y + s * 1.9); g.stroke();
      }
      X.sparkle = tex(c, false);
      const d = cvs(64, 128), h = d.getContext("2d"), gr = h.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,247,200,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      h.fillStyle = gr; h.transform(1, 0, -0.45, 1, 28, 0); h.fillRect(-20, 0, 64, 128);
      X.shine = tex(d, false);
    }
    { // barrel hazard band: yellow / black diagonal stripes around the circumference
      const c = cvs(512, 64), g = c.getContext("2d"); g.fillStyle = "#ffcf1f"; g.fillRect(0, 0, 512, 64);
      g.fillStyle = "#23232b"; for (let x = -64; x < 540; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
      g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(0, 0, 512, 5); g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, 59, 512, 5);
      X.hazard = tex(c, true);
    }
    { // supply crate stencil: white star in a ring
      const c = cvs(128, 128), g = c.getContext("2d"); g.translate(64, 64); g.strokeStyle = g.fillStyle = "rgba(245,240,215,.92)"; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 54, 0, 7); g.stroke();
      g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 20 : 46; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
      X.star = tex(c, true);
    }
    { const c = cvs(128, 64), g = c.getContext("2d"), gr = g.createRadialGradient(64, 28, 4, 64, 32, 80); gr.addColorStop(0, "#f4f9ff"); gr.addColorStop(1, "#8fa9c9"); g.fillStyle = gr; g.fillRect(0, 0, 128, 64); X.back = tex(c, true); }

    // ---- geometries
    G.panel = roundedBox(PW, PH, PD, 0.17, 4);
    G.frame = new THREE.TubeBufferGeometry(new RoundRectCurve(PW / 2 - 0.09, PH / 2 - 0.09, 0.2), 96, 0.1, 8, true);
    G.posts = (() => {
      const p = [[0.001, 0], [0.46, 0], [0.51, 0.04], [0.51, 0.1], [0.46, 0.17], [0.34, 0.23], [0.27, 0.31], [0.25, 0.42], [0.25, 2.8], [0.29, 2.88], [0.31, 2.95], [0.28, 3.0]].map(([x, y]) => new THREE.Vector2(x, y));
      for (let a = -42; a <= 90; a += 12) { const r = a * Math.PI / 180; p.push(new THREE.Vector2(Math.max(0.001, Math.cos(r) * 0.4), 3.3 + Math.sin(r) * 0.4)); }
      const lathe = () => new THREE.LatheBufferGeometry(p, 32), R = C.ROAD - 0.05;
      return merge([{ g: lathe(), x: -R }, { g: lathe() }, { g: lathe(), x: R }]);
    })();
    G.plane2 = new THREE.PlaneBufferGeometry(1, 0.5);
    G.plane = new THREE.PlaneBufferGeometry(1, 1);
    G.floor = new THREE.PlaneBufferGeometry(1, 1).rotateX(-Math.PI / 2);
    G.chunk = roundedBox(1, 1, 1, 0.22, 2);
    G.blue = roundedBox(2.1, 2.1, 1.4, 0.34, 4); G.yellow = roundedBox(2.3, 2.3, 1.5, 0.38, 4);
    G.crate = roundedBox(2.3, 2.2, 1.4, 0.1, 2);
    G.bracket = (() => { const parts = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) parts.push({ g: roundedBox(0.52, 0.52, 0.52, 0.1, 2), x: sx * 1.04, y: 1.1 + sy * 0.94, z: sz * 0.44 }); return merge(parts); })();
    G.tyres = (() => { const parts = []; for (let i = 0; i < 3; i++) { const t = new THREE.TorusBufferGeometry(0.54, 0.34, 14, 28); t.rotateX(Math.PI / 2); parts.push({ g: t, x: [0.03, -0.05, 0.04][i], y: 0.34 + i * 0.66, z: [0.02, -0.03, 0.03][i], c: 0x2e2f36 }); } for (let i = 0; i < 3; i++) parts.push({ g: new THREE.CylinderBufferGeometry(0.3, 0.3, 0.34, 20), x: [0.03, -0.05, 0.04][i], y: 0.34 + i * 0.66, z: [0.02, -0.03, 0.03][i], c: 0xdfe6f2 }); parts.push({ g: new THREE.CylinderBufferGeometry(0.33, 0.33, 0.12, 20), x: 0.04, y: 1.88, z: 0.03, c: 0xdfe6f2 }); return merge(parts); })();
    G.ammo = merge([{ g: roundedBox(2.0, 1.3, 1.2, 0.12, 3), y: 0.65, z: -0.58, c: 0x62802c }, { g: roundedBox(2.06, 0.3, 1.26, 0.1, 3), y: 1.45, z: -0.58, c: 0x7a9a3a }]);
    G.latches = merge([-1, 1].map(sx => ({ g: roundedBox(0.34, 0.52, 0.12, 0.05, 2), x: sx * 0.62, y: 1.25, z: 0 })));
    G.caseBase = roundedBox(2.55, 0.5, 1.3, 0.12, 3); G.glass = roundedBox(2.4, 1.45, 1.16, 0.1, 3);
    G.gold = (() => { const parts = [{ g: roundedBox(2.55, 0.16, 1.3, 0.07, 2), y: 2.03 }]; for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ g: roundedBox(0.14, 1.5, 0.14, 0.05, 2), x: sx * 1.2, y: 1.25, z: sz * 0.56 }); return merge(parts); })();

    G.supply = merge((() => {
      const P = [{ g: roundedBox(2.2, 1.5, 1.4, 0.16, 3), y: 0.75, c: 0x5f7a3a }, { g: roundedBox(2.32, 0.2, 1.52, 0.09, 2), y: 1.6, c: 0x4f6730 }];
      for (const sx of [-1, 1]) { P.push({ g: roundedBox(0.3, 1.58, 1.47, 0.07, 2), x: sx * 0.66, y: 0.75, c: 0xe3cf8d }); P.push({ g: roundedBox(0.3, 0.26, 1.58, 0.07, 2), x: sx * 0.66, y: 1.6, c: 0xe3cf8d }); }
      for (const sx of [-1, 1]) for (const sy of [0.12, 1.38]) for (const sz of [-1, 1]) P.push({ g: roundedBox(0.34, 0.34, 0.34, 0.08, 2), x: sx * 1.04, y: sy, z: sz * 0.54, c: 0x6e7480 });
      P.push({ g: new THREE.CylinderBufferGeometry(0.2, 0.26, 0.18, 14), y: 1.78, c: 0x6e7480 });
      return P;
    })());
    G.dome = new THREE.SphereBufferGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    G.barrel = (() => {
      const p = [[0.001, 0.02], [0.52, 0.02], [0.6, 0.05], [0.6, 0.13], [0.56, 0.17], [0.62, 0.22], [0.69, 0.27], [0.7, 0.31], [0.65, 0.35], [0.66, 0.45], [0.68, 0.8], [0.68, 1.05], [0.66, 1.15], [0.65, 1.2], [0.7, 1.26], [0.7, 1.3], [0.65, 1.35], [0.6, 1.4], [0.6, 1.47], [0.52, 1.5], [0.46, 1.46], [0.001, 1.46]].map(([x, y]) => new THREE.Vector2(x, y));
      return new THREE.LatheBufferGeometry(p, 28);
    })();
    G.band = new THREE.CylinderBufferGeometry(0.695, 0.695, 0.42, 36, 1, true);
    G.bung = merge([{ g: new THREE.CylinderBufferGeometry(0.13, 0.13, 0.08, 12), x: 0.26, y: 1.5, z: -0.12 }, { g: new THREE.CylinderBufferGeometry(0.075, 0.075, 0.1, 10), x: -0.24, y: 1.5, z: 0.14 }]);

    // ---- materials
    if (!fbEnv) fbEnv = buildEnv();
    M.post = mat("MeshStandardMaterial", { color: 0xd9e2ee, metalness: 1, roughness: 0.05, envMapIntensity: 2.5 }); M.post.envMap = fbEnv; M.post.userData.keepEnv = true;
    M.blue = mat("MeshPhysicalMaterial", { color: 0x1c5cf0, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x000000, envMapIntensity: 1 });
    M.yellow = mat("MeshPhysicalMaterial", { color: 0xffb400, roughness: 0.26, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x5a3300, emissiveIntensity: 0.25, envMapIntensity: 1.1 });
    M.wood = mat("MeshStandardMaterial", { color: 0xffffff, map: X.wood, roughness: 0.7, metalness: 0 });
    M.steel = mat("MeshStandardMaterial", { color: 0x9aa3b0, metalness: 0.9, roughness: 0.3 });
    M.tyre = mat("MeshStandardMaterial", { color: 0xffffff, vertexColors: true, roughness: 0.38, metalness: 0.25, envMapIntensity: 1 });
    M.ammo = mat("MeshStandardMaterial", { color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.1 });
    M.decal = mat("MeshStandardMaterial", { color: 0xffffff, map: X.ammo, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.caseBase = mat("MeshStandardMaterial", { color: 0x56637a, metalness: 0.6, roughness: 0.32 });
    M.gold = mat("MeshStandardMaterial", { color: 0xf6bd2a, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });
    M.glass = mat("MeshStandardMaterial", { color: 0xcdeeff, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 1.6 });
    M.supply = mat("MeshStandardMaterial", { color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.9 });
    M.star = mat("MeshStandardMaterial", { color: 0xffffff, map: X.star, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.beacon = mat("MeshBasicMaterial", { color: 0xff4a3a, toneMapped: false });
    M.beaconGlow = mat("MeshBasicMaterial", { color: 0xff5a40, map: X.glow, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    M.barrel = mat("MeshPhysicalMaterial", { color: 0xd8261b, roughness: 0.3, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x2a0402, emissiveIntensity: 0.4, envMapIntensity: 1.1 });
    M.hazard = mat("MeshStandardMaterial", { color: 0xffffff, map: X.hazard, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.8 });
    M.flame = mat("MeshBasicMaterial", { color: 0xffffff, map: flameTex(), transparent: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.back = mat("MeshBasicMaterial", { color: 0xffffff, map: X.back, toneMapped: false });
    syncEnv();
  }
  let FLAME = null;
  function flameTex() { // small flame emblem for the barrel (the UI flame icon)
    if (FLAME) return FLAME; FLAME = new THREE.TextureLoader().load("assets/ui/icons/flame.webp");
    FLAME.encoding = LIN ? THREE.sRGBEncoding : THREE.LinearEncoding; FLAME.anisotropy = 4; TEXS.push(FLAME); return FLAME;
  }
  function ensure() {
    if (ready) return; ready = true; build();
  }

  // ---------------------------------------------------------------- labels
  function newLabel(w, h, worldW, order) {
    const lab = C.makeLabel(w, h); lab.tex.encoding = LIN ? THREE.sRGBEncoding : THREE.LinearEncoding; LTEX.push(lab.tex);
    const m = new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false, toneMapped: false }); LMATS.push(m);
    const mesh = new THREE.Mesh(G.plane2, m); mesh.scale.set(worldW, worldW, 1); mesh.renderOrder = order || 5;
    return { lab, mesh, w: worldW };
  }

  // number on a dark pill (or plain), white with navy stroke; redrawn on demand (e.g. after the web font loads)
  function drawNum(lab, text, color, pill, force) {
    const key = text + "|" + color; if (!force && lab.last === key) return; lab.last = key;
    const g = lab.ctx, c = lab.c; g.clearRect(0, 0, c.width, c.height);
    g.font = `${Math.round(c.height * 0.74)}px 'Lilita One', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    if (pill) { const w = Math.min(c.width - 6, g.measureText(text).width + c.height * 0.55), h = c.height * 0.88; g.fillStyle = "rgba(10,18,44,.82)"; rrect(g, (c.width - w) / 2, (c.height - h) / 2, w, h, h / 2); g.fill(); }
    g.lineWidth = c.height * 0.13; g.strokeStyle = "#0d1630"; g.strokeText(text, c.width / 2, c.height * 0.54); g.fillStyle = color; g.fillText(text, c.width / 2, c.height * 0.54);
    lab.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- gates
  function paintHalf(hs) {
    setC(hs.panel.emissive, hs.cur.panel); setC(hs.panel.color, hs.cur.panel).multiplyScalar(0.25); setC(hs.halo.color, hs.cur.glow);
    setC(hs.frame.color, hs.cur.edge); setC(hs.glow.color, hs.cur.glow);
  }
  function gate(g) {
    refreshPipeline(); ensure(); syncEnv();
    const { track } = C, grp = new THREE.Group(); grp.position.set(0, 0, g.z); track.add(grp); GATES.push(grp);
    if (!gatePosts) { gatePosts = new THREE.InstancedMesh(G.posts, M.post, 128); gatePosts.count = 0; gatePosts.frustumCulled = false; gatePosts.castShadow = gatePosts.receiveShadow = true; track.add(gatePosts); }
    grp.userData.postIndex = gatePosts.count++; g.vis = grp;
    for (const h of g.halves) {
      const body = new THREE.Group(); body.position.set(h.x, PY, 0); grp.add(body);
      const panel = mat("MeshStandardMaterial", { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveMap: X.panel, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0, depthWrite: false, envMapIntensity: 0.7 }, true);
      const frame = mat("MeshBasicMaterial", { color: 0xffffff, transparent: true, toneMapped: false }, true);
      const glow = mat("MeshBasicMaterial", { color: 0xffffff, map: X.glow, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }, true);
      const pm = new THREE.Mesh(G.panel, panel); pm.renderOrder = 2; pm.castShadow = false; pm.receiveShadow = false; body.add(pm);
      const fm = new THREE.Mesh(G.frame, frame); fm.renderOrder = 3; fm.castShadow = false; body.add(fm);
      const halo = mat("MeshBasicMaterial", { color: 0xffffff, map: X.glow, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }, true);
      const hm = new THREE.Mesh(G.plane, halo); hm.scale.set(PW * 1.15, PH * 1.15, 1); hm.position.z = -PD / 2 - 0.03; hm.renderOrder = 1; body.add(hm);
      const gm = new THREE.Mesh(G.floor, glow); gm.scale.set(PW * 0.95, 1, 2.6); gm.position.set(h.x, 0.03, 1.1); gm.renderOrder = 1; grp.add(gm);
      const L = newLabel(384, 192, 3.7, 5); L.mesh.position.set(0, 0.02, PD / 2 + 0.05); body.add(L.mesh);
      const hs = { grp, body, panel, frame, glow, halo, L, cur: { panel: new THREE.Color(), edge: new THREE.Color(), glow: new THREE.Color() }, src: null, dst: null, bt: 1, good: undefined, text: undefined, pulse: 0, flash: 0, ph: rnd() * 6, used: false, ut: 0, chosen: false, done: false, gm };
      if (h.jackpot) { // golden half: twinkling stars, a travelling shine and a bigger warm halo
        const tm = (map, op) => mat("MeshBasicMaterial", { color: 0xfff2b0, map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }, true);
        hs.spk1 = new THREE.Mesh(G.plane, tm(X.sparkle, 0.8)); hs.spk2 = new THREE.Mesh(G.plane, tm(X.sparkle, 0.8)); hs.shine = new THREE.Mesh(G.plane, tm(X.shine, 0));
        hs.spk1.scale.set(PW * 0.92, PH * 0.82, 1); hs.spk2.scale.set(PW * 0.92, PH * 0.82, 1); hs.shine.scale.set(PW * 0.5, PH * 0.9, 1);
        hs.spk2.rotation.z = Math.PI; hs.spk1.position.z = hs.spk2.position.z = hs.shine.position.z = PD / 2 + 0.03; hs.spk2.position.z += 0.005; hs.shine.position.z += 0.01;
        for (const m of [hs.spk1, hs.spk2, hs.shine]) { m.renderOrder = 4; body.add(m); }
        hm.scale.set(PW * 1.4, PH * 1.45, 1); hs.haloK = 1.5;
      }
      if (h.powerup) { hs.tool = toolIcon(h.powerup, 2.25); hs.tool.position.set(0, 0, 0.3); body.add(hs.tool); L.mesh.visible = false; }
      h.vis = hs; HALVES.push(hs);
    }
  }
  function moveGate(g) { if (g.vis) g.vis.position.x = g.offset || 0; }
  function gateHalf(g, h, good, text) {
    const hs = h.vis; if (!hs) return;
    const pal = h.jackpot ? GOLD : good ? GOOD : BAD; good = h.jackpot ? "gold" : good;
    if (hs.good === undefined) { for (const k in pal) hs.cur[k].copy(pal[k]); hs.dst = pal; hs.bt = 1; paintHalf(hs); }
    else if (hs.good !== good) { hs.src = { panel: hs.cur.panel.clone(), edge: hs.cur.edge.clone(), glow: hs.cur.glow.clone() }; hs.dst = pal; hs.bt = 0; hs.flash = 1; }
    hs.good = good;
    if (hs.text !== text) { if (hs.text !== undefined) hs.pulse = 1; hs.text = text; C.drawLabel(hs.L.lab, text, h.jackpot ? "#fff3b8" : "#ffffff", 0.74); }
  }
  function gateUsed(g, half) {
    for (const h of g.halves) { const hs = h.vis; if (!hs || hs.used) continue; hs.used = true; hs.ut = 0; hs.chosen = h === half; }
  }
  const VIS_FAR = 85, VIS_BACK = 6;   // objects further than this ahead of the camera (or behind it) are not drawn
  const ease = t => t * t * (3 - 2 * t);
  function updateHalf(hs, dt) {
    if (hs.done) return;
    if (hs.bt < 1) {
      hs.bt = Math.min(1, hs.bt + dt / 0.35); const e = ease(hs.bt);
      for (const k in hs.cur) hs.cur[k].copy(hs.src[k]).lerp(hs.dst[k], e);
      paintHalf(hs);
    }
    hs.pulse = Math.max(0, hs.pulse - dt * 4.5); hs.flash = Math.max(0, hs.flash - dt * 2.5);
    const br = Math.sin(T * 2.3 + hs.ph);
    let f = 0, s = 1 + 0.4 * hs.pulse * hs.pulse + 0.15 * Math.sin(hs.pulse * Math.PI);
    let em = 1.2 + 0.12 * br + 1.1 * hs.flash;
    let gs = 1;
    if (hs.used) {
      hs.ut += dt; const u = hs.ut / 0.42; f = ease(Math.max(0, Math.min(1, (hs.ut - 0.1) / 0.32)));
      const pop = hs.chosen ? Math.sin(Math.min(1, hs.ut / 0.2) * Math.PI) : 0;
      gs = (1 + 0.14 * pop) * (1 - (hs.chosen ? 0.18 : 0.32) * f);
      if (hs.chosen) em += 1.8 * Math.max(0, 1 - hs.ut / 0.3);
      if (u >= 1) { hs.done = true; hs.grp.visible = true; hs.body.visible = false; hs.gm.visible = false; return; }
    }
    hs.body.scale.setScalar(gs);
    hs.L.mesh.scale.set(hs.L.w * s, hs.L.w * s, 1);
    hs.panel.emissiveIntensity = em;
    hs.panel.opacity = 0.8 * (1 - f); hs.halo.opacity = 0.6 * (hs.haloK || 1) * (1 + 0.12 * br) * (1 - f); hs.frame.opacity = (1 - f); hs.glow.opacity = 0.85 * (1 + 0.1 * br) * (1 - f);
    hs.L.mesh.material.opacity = 1 - f;
    if (hs.spk1) {
      hs.spk1.material.opacity = (0.5 + 0.5 * Math.sin(T * 4.1 + hs.ph)) * (1 - f); hs.spk2.material.opacity = (0.5 + 0.5 * Math.cos(T * 3.3 + hs.ph * 2)) * (1 - f);
      const p = (T * 0.5 + hs.ph * 0.3) % 1.7; hs.shine.visible = p < 1; if (p < 1) { hs.shine.position.x = -PW * 0.4 + p * PW * 0.8; hs.shine.material.opacity = 0.75 * Math.sin(p * Math.PI) * (1 - f); }
    }
  }

  // ---------------------------------------------------------------- solids
  const PICON = {};
  function powerIcon(type) {
    if (PICON[type]) return PICON[type];
    const t = new THREE.TextureLoader().load(`assets/ui/icons/pu-${type}.webp`);
    t.encoding = LIN ? THREE.sRGBEncoding : THREE.LinearEncoding; TEXS.push(t);
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    MATS.push(m); return (PICON[type] = m);
  }
  function toolIcon(type, size) { const m = new THREE.Sprite(powerIcon(type)); m.scale.set(size, size, 1); m.renderOrder = 6; return m; }
  const WICON = {};
  function weaponIcon(idx) {
    if (WICON[idx]) return WICON[idx];
    const w = C.WEAPONS[idx] || C.WEAPONS[1], e = { aspect: 1.7, meshes: [] };
    e.tex = new THREE.TextureLoader().load(w.img, t => { e.aspect = t.image.width / t.image.height; for (const m of e.meshes) fitIcon(m, e.aspect); });
    e.tex.encoding = LIN ? THREE.sRGBEncoding : THREE.LinearEncoding; e.tex.anisotropy = 4; TEXS.push(e.tex);
    e.mat = new THREE.MeshBasicMaterial({ map: e.tex, transparent: true, toneMapped: false }); MATS.push(e.mat);
    return (WICON[idx] = e);
  }
  const fitIcon = (mesh, a) => { const w = Math.min(1.95, 0.98 * a); mesh.scale.set(w, w / a, 1); };

  function part(vis, root, geo, material, x, y, z, flash = true, cast = true) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m);
    if (flash && material.userData.hex) vis.body.push({ mesh: m, base: material, fl: flashOf(material) });
    return m;
  }
  const SPEC = {
    fuelTruck(v, r) {
      part(v,r,G.crate,M.barrel,0,1.1,-.7); const tank=part(v,r,G.barrel,M.steel,0,2,-.7);tank.rotation.z=Math.PI/2;tank.scale.set(1.2,1.6,1.2);
      return {y:3.3,w:2.6,pill:true};
    },
    shortcut(v,r) { const wall=part(v,r,G.blue,M.wood,0,1.5,-.6);wall.scale.set(1.5,1.4,1);return {y:3.4,w:2.8,pill:true}; },
    blockBlue(v, r) { part(v, r, G.blue, M.blue, 0, 1.05, -0.66); return { y: 1.62, w: 2.0 }; },
    blockYellow(v, r) { part(v, r, G.yellow, M.yellow, 0, 1.15, -0.71); return { y: 1.7, w: 2.1 }; },
    crate(v, r) { part(v, r, G.crate, M.wood, 0, 1.1, -0.66); part(v, r, G.bracket, M.steel, 0, 0, -0.66, false, false); return { y: 1.1, w: 2.0, pill: true }; },
    tyres(v, r) {
      part(v, r, G.tyres, M.tyre, 0, 0, -0.9);
      return { y: 3.0, w: 3.0, pill: true };
    },
    ammo(v, r) {
      part(v, r, G.ammo, M.ammo, 0, 0, 0);
      const d = new THREE.Mesh(G.plane, M.decal); d.scale.set(1.78, 0.89, 1); d.position.set(0, 0.66, 0.025); r.add(d);
      part(v, r, G.latches, M.steel, 0, 0, 0, false, false);
      return { y: 2.35, w: 2.8, pill: true };
    },
    barricade(v, r) {
      const wall = part(v, r, G.blue, M.steel, 0, 1.7, -0.65); wall.scale.set(3.6 / 2.1, 3.4 / 2.1, 1);
      const band = part(v, r, G.crate, M.hazard, 0, 1.8, 0.08, false); band.scale.set(3.55 / 2.3, 0.22, 0.1);
      return { y: 4.1, w: 2.8, pill: true };
    },
    mortar(v, r) {
      const base = part(v, r, G.blue, M.caseBase, 0, 1.1, -0.4); base.scale.set(0.75, 1.05, 0.8);
      const tube = part(v, r, G.barrel, M.steel, 0, 2.3, -0.4); tube.scale.set(0.65, 1.15, 0.65); tube.rotation.x = 0.5;
      return { y: 4.6, w: 2.4, pill: true };
    },
    airdrop(v, r, o) {
      part(v, r, G.supply, M.supply, 0, 0, -0.7);
      const st = new THREE.Mesh(G.plane, M.star); st.scale.set(0.74, 0.74, 1); st.position.set(0, 0.76, 0.012); r.add(st);
      const dm = new THREE.Mesh(G.dome, M.beacon); dm.position.set(0, 1.87, -0.7); r.add(dm);
      const gl = new THREE.Mesh(G.plane, M.beaconGlow); gl.scale.set(1.9, 1.9, 1); gl.position.set(0, 2.05, -0.3); gl.renderOrder = 4; r.add(gl);
      const icon = toolIcon(o.powerup || "shield", 2); icon.position.set(0, 4.3, 0); r.add(icon);
      return { y: 2.65, w: 2.3, pill: true };
    },
    barrel(v, r) {
      const z = -0.45;
      part(v, r, G.barrel, M.barrel, 0, 0, z);
      const b = new THREE.Mesh(G.band, M.hazard); b.position.set(0, 0.54, z); b.castShadow = true; b.receiveShadow = true; r.add(b); v.body.push({ mesh: b, base: M.hazard, fl: flashOf(M.hazard) });
      part(v, r, G.bung, M.steel, 0, 0, z, false, false);
      const f = new THREE.Mesh(G.plane, M.flame); f.scale.set(0.6, 0.66, 1); f.position.set(0, 1.04, z + 0.69); r.add(f);
      return { y: 2.25, w: 2.3, pill: true };
    },
    weaponCase(v, r, o) {
      part(v, r, G.caseBase, M.caseBase, 0, 0.25, -0.65);
      part(v, r, G.gold, M.gold, 0, 0, -0.65);
      const back = new THREE.Mesh(G.plane, M.back); back.scale.set(2.3, 1.4, 1); back.position.set(0, 1.25, -1.1); r.add(back);
      const ic = weaponIcon(o.weapon || 1), im = new THREE.Mesh(G.plane, ic.mat); im.position.set(0, 1.25, -0.42); im.renderOrder = 2; fitIcon(im, ic.aspect); ic.meshes.push(im); r.add(im); v.icon = im; v.iconY = 1.25;
      const gl = new THREE.Mesh(G.glass, M.glass); gl.position.set(0, 1.25, -0.65); gl.renderOrder = 3; r.add(gl);
      return { y: 2.95, w: 3.0, pill: true };
    },
  };
  function solid(o) {
    refreshPipeline(); ensure(); syncEnv();
    const spec = SPEC[o.kind] || SPEC.blockBlue, root = new THREE.Group(); root.position.set(o.x, 0, o.z);
    const v = { root, body: [], L: null, text: undefined, pulse: 0, hit: 0, flash: 0, flashed: false, icon: null, dead: false, ph: rnd() * 6, o };
    const s = spec(v, root, o) || { y: 1, w: 1.7 };
    const onFront = o.kind === "blockBlue" || o.kind === "blockYellow" || o.kind === "crate";
    v.pill = !!s.pill; v.L = newLabel(256, 128, s.w, 5); v.L.mesh.position.set(0, s.y, onFront ? 0.08 : 0.1); if (!onFront) v.L.mesh.renderOrder = 6; root.add(v.L.mesh);
    C.track.add(root); SOLIDS.push(v); o.vis = v;
  }
  function solidLabel(o, text, color) {
    const v = o.vis; if (!v || v.dead) return;
    if (v.text !== text) { if (v.text !== undefined) v.pulse = 1; v.text = text; }
    v.color = color || "#fff"; drawNum(v.L.lab, text, v.color, v.pill);
  }
  function solidHit(o) { const v = o.vis; if (!v || v.dead) return; v.hit = 1; v.flash = 0.1; }
  function setFlash(v, on) { if (v.flashed === on) return; v.flashed = on; for (const b of v.body) b.mesh.material = on ? b.fl : b.base; }

  // ---------------------------------------------------------------- debris
  const DEBRIS = {
    blockBlue: [[0x2f7bff, 0x7fb4ff, 0x1f5fd6], 0.3, 0.6], blockYellow: [[0xffc41c, 0xffe27a, 0xe09a00], 0.32, 0.65],
    crate: [[0xc98f4e, 0x8a5527, 0x9aa3b0], 0.28, 0.58], tyres: [[0x2b2c32, 0x2b2c32, 0xe9eef7], 0.3, 0.62],
    ammo: [[0x62802c, 0x729238, 0xffd21f], 0.26, 0.55], weaponCase: [[0x56637a, 0xf6bd2a, 0xcdeeff], 0.24, 0.55],
    airdrop: [[0x5f7a3a, 0xe3cf8d, 0x6e7480], 0.28, 0.6], barrel: [[0xd8261b, 0xffcf1f, 0x2e2f36], 0.26, 0.56],
  };
  let blinkOn = null;
  const POOL = []; let dgroup = null, dnext = 0; const rnd = lcg(12345);
  function ensureDebris() {
    if (dgroup) return; dgroup = new THREE.Group(); C.track.add(dgroup);
    for (let i = 0; i < 56; i++) {
      const m = mat("MeshStandardMaterial", { color: 0xffffff, roughness: 0.35, metalness: 0.05, transparent: true }), me = new THREE.Mesh(G.chunk, m);
      me.visible = false; dgroup.add(me); POOL.push({ me, m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, life: 0, max: 1, s: 1, active: false });
    }
  }
  function solidBreak(o) {
    const v = o.vis; if (!v || v.dead) return; ensureDebris(); v.dead = true;
    const d = DEBRIS[o.kind] || DEBRIS.blockBlue, hw = o.hw || 1, top = o.kind === "tyres" ? 2 : o.kind === "ammo" ? 1.6 : o.kind === "weaponCase" ? 2.1 : 2;
    for (let i = 0; i < 10; i++) {
      const p = POOL[dnext++ % POOL.length], s = (d[1] + rnd() * (d[2] - d[1])) * 1.3, hex = d[0][i % 3];
      p.m.userData.hex.color = hex; paint(p.m); p.m.opacity = o.kind === "weaponCase" && i % 3 === 2 ? 0.55 : 1; p.base = p.m.opacity;
      p.s = s; p.me.scale.set(s, s * (0.6 + rnd() * 0.5), s * (0.8 + rnd() * 0.4)); p.me.visible = true; p.active = true;
      p.me.position.set(o.x + (rnd() - 0.5) * hw * 1.4, 0.3 + rnd() * top, o.z - rnd() * 0.8);
      p.vx = (p.me.position.x - o.x) * 3.2 + (rnd() - 0.5) * 3; p.vy = 3 + rnd() * 5; p.vz = 1.5 + rnd() * 5 - 1.5; // mostly outward and toward the camera
      p.rx = (rnd() - 0.5) * 12; p.ry = (rnd() - 0.5) * 12; p.rz = (rnd() - 0.5) * 12; p.max = p.life = 0.9 + rnd() * 0.5;
    }
    C.track.remove(v.root);
    disposeLabel(v);
    const i = SOLIDS.indexOf(v); if (i >= 0) { SOLIDS[i] = SOLIDS[SOLIDS.length - 1]; SOLIDS.pop(); }
    o.vis = null;
  }
  function disposeLabel(v) {
    const m = v.L.mesh.material, t = v.L.lab.tex; m.dispose(); t.dispose();
    let i = LMATS.indexOf(m); if (i >= 0) { LMATS[i] = LMATS[LMATS.length - 1]; LMATS.pop(); }
    i = LTEX.indexOf(t); if (i >= 0) { LTEX[i] = LTEX[LTEX.length - 1]; LTEX.pop(); }
  }
  function updateDebris(dt) {
    for (const p of POOL) {
      if (!p.active) continue;
      p.life -= dt; if (p.life <= 0) { p.active = false; p.me.visible = false; continue; }
      p.vy -= 20 * dt; const me = p.me; me.position.x += p.vx * dt; me.position.y += p.vy * dt; me.position.z += p.vz * dt;
      const floor = p.s * 0.3; if (me.position.y < floor) { me.position.y = floor; p.vy = p.vy < -2 ? -p.vy * 0.35 : 0; p.vx *= 0.7; p.vz *= 0.7; p.rx *= 0.6; p.ry *= 0.6; p.rz *= 0.6; }
      me.rotation.x += p.rx * dt; me.rotation.y += p.ry * dt; me.rotation.z += p.rz * dt;
      p.m.opacity = p.base * Math.min(1, p.life / 0.4);
    }
  }

  // Holo warnings and mortar markers are owned by track; all unique materials/labels
  // use the existing per-level disposal lists. Icon textures and geometry are shared.
  function threatSign(t) {
    ensure();
    const sign = new THREE.Group(); sign.position.set(0, 4.7, t.z); C.track.add(sign);
    const plateM = mat("MeshBasicMaterial", { color: 0x1467a0, transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false }, true);
    const plate = new THREE.Mesh(G.panel, plateM); plate.scale.set(1.3, 0.65, 0.3); sign.add(plate);
    const lab = newLabel(512, 128, 5.4, 7); lab.mesh.scale.set(5.4, 2.7, 1); lab.mesh.position.set(-0.45, 0.1, 0.3);
    C.drawLabel(lab.lab, "! " + t.kind.toUpperCase(), "#ffe066", 0.7); sign.add(lab.mesh);
    const icon = toolIcon(t.counter, 1.6); icon.position.set(2.6, 0, 0.4); sign.add(icon);
    const post = new THREE.Mesh(G.chunk, M.beaconGlow); post.scale.set(0.14, 4.7, 0.14); post.position.set(-3.1, -2.35, 0); sign.add(post);
    if (!G.target) G.target = new THREE.RingBufferGeometry(2.45, 2.8, 40).rotateX(-Math.PI / 2);
    const ringM = mat("MeshBasicMaterial", { color: 0xff3628, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }, true);
    const ring = new THREE.Mesh(G.target, ringM), shell = new THREE.Mesh(G.chunk, M.barrel);
    shell.scale.set(0.4, 0.7, 0.4); ring.visible = shell.visible = false; ring.renderOrder = 4;
    C.track.add(ring); C.track.add(shell); t.vis = { sign, ring, shell };
  }

  function finishArch(z) {
    ensure();
    const geo=merge([{g:roundedBox(.5,5,.7,.15),x:-5.5,y:2.5},{g:roundedBox(.5,5,.7,.15),x:5.5,y:2.5},{g:roundedBox(11.5,.6,.7,.15),y:5}]);LEVELGEO.push(geo);
    const root=new THREE.Group();root.position.z=z;C.track.add(root);root.add(new THREE.Mesh(geo,M.gold));
    const label=newLabel(512,128,6,5);label.mesh.position.set(0,4.95,.4);C.drawLabel(label.lab,"DISTRICT CLEAR","#fff3b8",.7);root.add(label.mesh);
  }
  function hazard(h) {
    ensure();const root=new THREE.Group();root.position.set(h.x,0,h.z);C.track.add(root);h.vis=root;
    const warning=mat("MeshBasicMaterial",{color:0xffb329,transparent:true,opacity:.4,depthWrite:false,toneMapped:false},true);
    const floor=new THREE.Mesh(G.floor,warning);floor.scale.set(2.7,1,3.2);floor.position.y=.06;root.add(floor);
    const moving=new THREE.Mesh(h.kind==="saw"?G.tyres:G.blue,M.steel);moving.position.y=h.kind==="crusher"?5:.2;moving.scale.set(1.1,h.kind==="collapse"?.08:.5,1.2);root.add(moving);h.marker=floor;h.movingPart=moving;root.visible=false;
  }
  function updateHazard(h) {
    if(!h.vis)return;h.vis.visible=h.warned&&!h.done;h.vis.position.x=h.x;
    h.marker.material.color.set(h.active?0xff3020:0xffb329);h.marker.material.opacity=h.active?.75:.35+.2*Math.sin(h.age*12);
    if(h.kind==="crusher")h.movingPart.position.y=h.active?.2:5;
    else if(h.kind==="saw")h.movingPart.rotation.z=h.age*10;
    else h.movingPart.position.y=h.active?-3:.05;
  }
  let bossMark=null, bossWarn=null;
  function bossWarning(b,on) {
    ensure();if(!bossWarn){bossWarn=new THREE.Mesh(G.floor,mat("MeshBasicMaterial",{color:0xff3020,transparent:true,opacity:.5,depthWrite:false},true));bossWarn.scale.set(2.7,1,22);C.track.add(bossWarn);}
    bossWarn.visible=on;if(on)bossWarn.position.set(b.lockX,.07,C.L.sz-5);
  }
  function weakMarker(b,on) {
    if(b.def?.update)return; // Scripted bosses own their pooled marker.
    ensure();if(!bossMark){bossMark=new THREE.Mesh(G.plane,M.beaconGlow);bossMark.scale.set(2.5,2.5,1);C.track.add(bossMark);}
    bossMark.visible=on;if(on){bossMark.position.set(b.x,4,b.z+1);bossMark.quaternion.copy(C.camera.quaternion);}
  }

  // ---------------------------------------------------------------- lifecycle
  function setup(ctx) {
    C = ctx;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
      for (const v of SOLIDS) if (v.text !== undefined) drawNum(v.L.lab, v.text, v.color, v.pill, true);
      for (const hs of HALVES) if (hs.text !== undefined) { hs.L.lab.last = null; C.drawLabel(hs.L.lab, hs.text, hs.spk1 ? "#fff3b8" : "#ffffff", 0.74); }
    }).catch(() => {});
  }
  function clear() {
    if (!C) return;
    const t = C.track;
    for (const c of t.children.slice()) if (c !== dgroup) t.remove(c);
    for (const m of LMATS) m.dispose(); for (const x of LTEX) x.dispose(); for (const m of LEVELMATS) m.dispose();
    for(const g of LEVELGEO)g.dispose();LEVELGEO.length=0;gatePosts=null;bossMark=bossWarn=null;
    LMATS.length = LTEX.length = LEVELMATS.length = HALVES.length = SOLIDS.length = GATES.length = 0;
    for (const k in WICON) WICON[k].meshes.length = 0;
    for (const p of POOL) { p.active = false; p.me.visible = false; }
  }
  function update(dt) {
    if (!C || !ready) return; dt = Math.min(dt, 0.1); T += dt;
    refreshPipeline(); syncEnv();
    const cz = C.camera.position.z, vis = z => cz - z < VIS_FAR && z - cz < VIS_BACK;
    for (const g of GATES) {
      g.visible = vis(g.position.z);
      if(gatePosts){postMatrix.makeScale(g.visible?1:0,g.visible?1:0,g.visible?1:0);postMatrix.setPosition(g.position.x,0,g.position.z);gatePosts.setMatrixAt(g.userData.postIndex,postMatrix);}
    }
    if(gatePosts)gatePosts.instanceMatrix.needsUpdate=true;
    for (const hs of HALVES) if (hs.grp.visible) updateHalf(hs, dt);
    for (const v of SOLIDS) {
      const on = vis(v.root.position.z); v.root.visible = on; if (!on) continue;
      if (v.hit > 0) { v.hit = Math.max(0, v.hit - dt * 7); const q = v.hit * v.hit; v.root.scale.set(1 + 0.07 * q, 1 - 0.12 * q, 1 + 0.07 * q); }
      if (v.flash > 0) { v.flash -= dt; setFlash(v, v.flash > 0); } else if (v.flashed) setFlash(v, false);
      if (v.pulse > 0) { v.pulse = Math.max(0, v.pulse - dt * 5); const s = 1 + 0.3 * Math.sin(v.pulse * Math.PI * 0.85) + 0.1 * v.pulse; v.L.mesh.scale.set(v.L.w * s, v.L.w * s, 1); }
      if (v.icon) { v.icon.position.y = v.iconY + 0.04 * Math.sin(T * 1.8 + v.ph); v.icon.rotation.y = 0.15 * Math.sin(T * 1.3 + v.ph); }
    }
    updateDebris(dt);
    if (M.beacon) { // supply-crate beacon blinks in sync (shared materials)
      const on = Math.sin(T * 7) > 0.1; if (on !== blinkOn) { blinkOn = on; setHex(M.beacon.color, on ? 0xff5a44 : 0x4a100c); }
      M.beaconGlow.opacity = on ? 0.9 : 0.12;
    }
  }

  return { setup, clear, finishArch, hazard, updateHazard, moveGate, bossWarning, weakMarker, threatSign, gate, gateHalf, gateUsed, solid, solidLabel, solidHit, solidBreak, update };
})();
