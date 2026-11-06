/* Spirelight: Blocks (design.md 7.2). Builds the look of every block: bevelled cubes with world-aligned PBR textures,
   baked corner AO, paver slabs with brass inlay, real stairs, columns, hedges and deterministic wall details.
   Nothing here depends on camera depth or absolute height: all per-block randomness hashes the *projected*
   cell coordinates (p = x-y, q = z-y), so two blocks that look identical on screen also get identical dressing. */
(function () {
  "use strict";
  let THREE = null, renderer = null;
  const Blocks = { version: 1, ready: false, basePath: null, styles: {}, textures: {}, windowGlow: 1 };

  const STYLE_LIST = {
    sandstone: "Sandstone", brick: "Brick", marble: "Marble", darkstone: "Dark stone", brass: "Brass",
    copper: "Copper", slate: "Slate", wood: "Wood", column: "Column", hedge: "Hedge"
  };
  Object.keys(STYLE_LIST).forEach(k => (Blocks.styles[k] = { label: STYLE_LIST[k] }));

  // ---- material table: texture file, world units per texture tile, PBR constants, plain fallback colour ----------
  const MAT = {
    sandstone: { tex: "sandstone", scale: 2.0, rough: 0.92, metal: 0.0, color: 0xf0c08e, fb: 0xc98c55, nrm: 1.0 },
    brick:     { tex: "brick",     scale: 2.6, rough: 0.88, metal: 0.0, color: 0xf0d8d0, fb: 0xa5503a, nrm: 1.1 },
    marble:    { tex: "marble",    scale: 2.4, rough: 0.6, metal: 0.0, color: 0xead3b4, fb: 0xeee2d0, nrm: 0.5 },
    darkstone: { tex: "darkstone", scale: 2.0, rough: 0.95, metal: 0.0, color: 0xe6d8e8, fb: 0x4a4056, nrm: 1.2 },
    brass:     { tex: "brass",     scale: 2.0, rough: 0.36, metal: 0.8, env: 1.0, color: 0xffeccc, fb: 0xc8963e, nrm: 0.9 },
    copper:    { tex: "copper",    scale: 2.4, rough: 0.5, metal: 0.55, env: 0.9, color: 0xf2fff8, fb: 0x4fa597, nrm: 0.9 },
    slate:     { tex: "slate",     scale: 2.2, rough: 0.62, metal: 0.05, color: 0xf2f2ff, fb: 0x3b3d5c, nrm: 1.2 },
    wood:      { tex: "wood",      scale: 2.0, rough: 0.82, metal: 0.0, color: 0xf5e2d0, fb: 0x8a5a34, nrm: 1.0 },
    moss:      { tex: "moss",      scale: 1.5, rough: 1.0,  metal: 0.0, color: 0xe8f0d8, fb: 0x6f8f3a, nrm: 1.0 },
    hedge:     { tex: "hedge",     scale: 1.5, rough: 0.82, metal: 0.0, color: 0xeaf4e0, fb: 0x4d8a2c, nrm: 0.8 },
    paver:     { tex: "paver",     scale: 1.7, rough: 0.85, metal: 0.0, color: 0xd9c7a6, fb: 0xefe2c6, nrm: 0.8 },
    brassTrim: { tex: "brass",     scale: 0.6, rough: 0.28, metal: 0.9, env: 1.3, color: 0xffe2a0, fb: 0xc8963e, nrm: 0.0 },
    grate:     { canvas: "grate",  scale: 1.0, rough: 0.4,  metal: 0.8, env: 1.0, color: 0xffffff, fb: 0x6a4a22, nrm: 0.0 },
    iron:      { scale: 1, rough: 0.45, metal: 0.8, env: 0.8, color: 0x4a4048, fb: 0x4a4048, nrm: 0.0 },
    darkiron:  { scale: 1, rough: 0.7, metal: 0.3, color: 0x120e16, fb: 0x120e16, nrm: 0.0 },
    grime:     { canvas: "grime", scale: 1.0, rough: 1.0, metal: 0.0, color: 0xffffff, fb: 0x28182a, soft: true, decal: true },
    window:    { canvas: "window", scale: 1.0, rough: 0.3, metal: 0.0, color: 0xffffff, fb: 0xffb35a, emissive: true },
    decal:     { canvas: "decal",  scale: 1.0, rough: 1.0, metal: 0.0, color: 0xffffff, fb: 0x6f8f3a, alpha: true, decal: true }
  };
  const STYLE_BODY = { sandstone: "sandstone", brick: "brick", marble: "marble", darkstone: "darkstone", brass: "brass",
    copper: "copper", slate: "slate", wood: "wood", column: "marble", hedge: "hedge" };
  // detail probabilities per style: window, trim band, moss strip, crack
  const DETAIL = {
    sandstone: { win: 0.2, trim: 0.18, moss: 0.5, crack: 0.1 }, brick: { win: 0.2, trim: 0.1, moss: 0.15, crack: 0.08 },
    marble: { win: 0.12, trim: 0.3, moss: 0.05, crack: 0.04 }, darkstone: { win: 0, trim: 0, moss: 0.62, crack: 0.14 },
    brass: { win: 0, trim: 0, moss: 0, crack: 0 }, copper: { win: 0, trim: 0, moss: 0.05, crack: 0 },
    slate: { win: 0, trim: 0, moss: 0.08, crack: 0.05 }, wood: { win: 0, trim: 0, moss: 0.06, crack: 0.05 }
  };
  const DETAIL_OVERRIDE = true;
  const TEX_FILES = ["sandstone", "brick", "marble", "darkstone", "brass", "copper", "slate", "wood", "moss", "hedge", "paver"];

  function hash(a, b, c, d) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  // ---- procedural canvases ---------------------------------------------------------------------------------------
  function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  function drawWindow() {
    const W = 128, H = 256, c = mkCanvas(W, H), g = c.getContext("2d");
    const gr = g.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, "#fff0b0"); gr.addColorStop(0.35, "#ffc45e"); gr.addColorStop(1, "#ff9a30");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W * 0.5, H * 0.72, 4, W * 0.5, H * 0.72, W * 0.8);
    rg.addColorStop(0, "rgba(255,250,210,0.95)"); rg.addColorStop(1, "rgba(255,200,90,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // a hint of a room: dark shelf / silhouette bars at the bottom
    g.fillStyle = "rgba(110,50,10,0.35)"; g.fillRect(0, H * 0.83, W, H * 0.17);
    g.fillStyle = "rgba(90,40,8,0.22)"; g.fillRect(W * 0.12, H * 0.62, W * 0.22, H * 0.24);
    // mullions
    g.fillStyle = "#4a2410";
    g.fillRect(W * 0.5 - 3, 0, 6, H); g.fillRect(0, H * 0.56 - 3, W, 6); g.fillRect(0, H * 0.3 - 3, W, 6);
    g.strokeStyle = "#3a1a0c"; g.lineWidth = 7; g.strokeRect(0, 0, W, H);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function drawMoss() {
    const W = 256, H = 128, c = mkCanvas(W, H), g = c.getContext("2d");
    const img = g.createImageData(W, H), R = rng(77);
    const ph = [R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28];
    const tufts = []; for (let i = 0; i < 22; i++) tufts.push([R() * W, 6 + R() * 26, 3 + R() * 7]);
    const noise = (x, y) => Math.sin(x * 0.19 + y * 0.31 + ph[0]) + Math.sin(x * 0.43 - y * 0.17 + ph[1]) + Math.sin(x * 0.087 + y * 0.52 + ph[2]);
    for (let x = 0; x < W; x++) {
      const k = x / W * 6.2832;
      let depth = 0.34 + 0.14 * Math.sin(k * 3 + ph[0]) + 0.1 * Math.sin(k * 7 + ph[1]) + 0.06 * Math.sin(k * 13 + ph[2]);
      let d = depth * H;
      for (const t of tufts) { let dx = Math.abs(x - t[0]); dx = Math.min(dx, W - dx); if (dx < t[2]) d = Math.max(d, H * 0.34 + t[1] * (1 - dx / t[2])); }
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4, n = noise(x, y);
        const edge = d - y;
        let a = edge > 2 ? 255 : edge > -1 ? 255 * (edge + 1) / 3 : 0;
        if (edge < 7 && edge > -1) a *= (0.55 + 0.45 * Math.sin(x * 1.7 + y * 2.3) * 0.5 + 0.2);
        const m = 0.5 + n * 0.16;
        img.data[i] = 70 + 70 * m + (edge < 8 ? 20 : 0); img.data[i + 1] = 112 + 70 * m; img.data[i + 2] = 36 + 30 * m;
        if (y < 3) { img.data[i] *= 0.8; img.data[i + 1] *= 0.8; }
        img.data[i + 3] = Math.max(0, Math.min(255, a));
      }
    }
    g.putImageData(img, 0, 0);
    // tiny leaf specks
    for (let i = 0; i < 260; i++) {
      const x = R() * W, y = R() * H * 0.5; g.fillStyle = R() < 0.5 ? "rgba(170,205,80,0.55)" : "rgba(40,80,28,0.45)";
      g.beginPath(); g.ellipse(x, y, 2.4, 1.3, R() * 3, 0, 6.3); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function drawCracks() {
    const S = 128, c = mkCanvas(S * 2, S * 2), g = c.getContext("2d"), R = rng(4242);
    g.lineCap = "round"; g.lineJoin = "round";
    for (let q = 0; q < 4; q++) {
      const ox = (q & 1) * S, oy = (q >> 1) * S;
      const branch = (x, y, ang, len, w) => {
        g.beginPath(); g.moveTo(ox + x, oy + y);
        for (let i = 0; i < len; i++) {
          ang += (R() - 0.5) * 1.0; x += Math.cos(ang) * 5; y += Math.sin(ang) * 5;
          if (x < 3 || x > S - 3 || y < 3 || y > S - 3) break;
          g.lineTo(ox + x, oy + y);
          if (R() < 0.12 && w > 1) branch(x, y, ang + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.6), len * 0.5 | 0, w * 0.6);
        }
        g.lineWidth = w; g.strokeStyle = "rgba(36,22,26,0.92)"; g.stroke();
      };
      branch(S * (0.2 + R() * 0.2), 4, 1.2 + (R() - 0.5) * 0.8, 24, 2.6);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  // one cutout atlas: moss strip on top (256x128), four crack variants below (2x2 of 128)
  function drawDecalAtlas() {
    const mc = drawMoss().image, cc = drawCracks().image, c = mkCanvas(256, 384), g = c.getContext("2d");
    g.drawImage(mc, 0, 0); g.drawImage(cc, 0, 128);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function drawGrime() {
    const W = 128, H = 128, c = mkCanvas(W, H), g = c.getContext("2d"), R = rng(909);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      const x = 10 + R() * (W - 20), w = 3 + R() * 9, len = H * (0.45 + R() * 0.55), a = 0.25 + R() * 0.4;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, "rgba(38,24,34," + a + ")"); gr.addColorStop(0.6, "rgba(38,24,34," + a * 0.5 + ")"); gr.addColorStop(1, "rgba(38,24,34,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, 0); g.lineTo(x + w / 2, 0); g.lineTo(x + w * 0.2, len); g.lineTo(x - w * 0.2, len); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function makeEnv() {
    if (!renderer || !THREE.PMREMGenerator) return null;
    const sc = new THREE.Scene(), n = 48, geo = new THREE.SphereGeometry(10, n, 24), col = [];
    const pos = geo.attributes.position, top = new THREE.Color(0x4a3c9c), mid = new THREE.Color(0xc07a8a), bot = new THREE.Color(0xff9a52), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10; if (y > 0) tmp.copy(mid).lerp(top, Math.pow(y, 0.7)); else tmp.copy(mid).lerp(bot, Math.min(1, -y * 1.4));
      tmp.multiplyScalar(0.9); col.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 4.2, 2.0), side: THREE.DoubleSide }));
    patch.position.set(-5, 5.2, 4.5); patch.lookAt(0, 0, 0); sc.add(patch);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.6, 3.0), side: THREE.DoubleSide }));
    p2.position.set(6, 6, -4); p2.lookAt(0, 0, 0); sc.add(p2);
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.03); pm.dispose();
    geo.dispose(); return rt.texture;
  }
  function drawGrate() {
    const S = 256, c = mkCanvas(S, S), g = c.getContext("2d");
    g.fillStyle = "#1c120a"; g.fillRect(0, 0, S, S);
    const n = 8, cell = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * cell, y = j * cell;
      const gr = g.createLinearGradient(x, y, x + cell, y + cell);
      gr.addColorStop(0, "#f1c46a"); gr.addColorStop(1, "#a8782c");
      g.fillStyle = gr; g.fillRect(x, y, cell, cell);
      g.fillStyle = "#120a05"; g.beginPath(); g.roundRect ? g.roundRect(x + 6, y + 6, cell - 12, cell - 12, 6) : g.rect(x + 6, y + 6, cell - 12, cell - 12); g.fill();
      g.fillStyle = "rgba(255,225,150,0.45)"; g.fillRect(x + 6, y + 6, cell - 12, 2);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }

  // ---- textures & materials ----------------------------------------------------------------------------------------
  let texCache = {}, matCache = {}, windowMats = [];
  function loadTex(name, srgb) {
    return new Promise(res => {
      try {
        new THREE.TextureLoader().load(Blocks.basePath + name + ".webp", t => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
          t.anisotropy = Math.min(8, (renderer && renderer.capabilities.getMaxAnisotropy()) || 4); res(t);
        }, undefined, () => res(null));
      } catch (e) { res(null); }
    });
  }
  Blocks.init = function (three, rend) {
    THREE = three || window.THREE; renderer = rend || null;
    texCache = {}; matCache = {}; windowMats = [];
    if (!Blocks.basePath) {
      let base = "assets/tex/";
      try {
        const s = document.currentScript && document.currentScript.src || (Array.from(document.scripts).find(x => /blocks\.js/.test(x.src)) || {}).src;
        if (s) base = s.replace(/js\/blocks\.js.*$/, "assets/tex/");
      } catch (e) { /* keep default */ }
      Blocks.basePath = base;
    }
    try {
      texCache.window = drawWindow(); texCache.decal = drawDecalAtlas(); texCache.grate = drawGrate(); texCache.grime = drawGrime();
    } catch (e) { console.warn("[blocks] canvas textures failed", e); }
    try { Blocks.envMap = makeEnv(); } catch (e) { Blocks.envMap = null; console.warn("[blocks] env failed", e); }
    const jobs = [];
    TEX_FILES.forEach(n => {
      jobs.push(loadTex(n, true).then(t => { if (t) texCache[n] = t; }));
      jobs.push(loadTex(n + "_n", false).then(t => { if (t) texCache[n + "_n"] = t; }));
    });
    return Promise.all(jobs).then(() => { Blocks.ready = true; Blocks.textures = texCache; }, () => { Blocks.ready = true; });
  };

  function getMat(key, low) {
    const ck = key + (low ? "_L" : "");
    if (matCache[ck]) return matCache[ck];
    const d = MAT[key] || MAT.sandstone;
    const p = { roughness: d.rough, metalness: d.metal, vertexColors: !d.emissive };
    const map = d.canvas ? texCache[d.canvas] : texCache[d.tex];
    if (map) { p.map = map; p.color = new THREE.Color(d.color); } else p.color = new THREE.Color(d.fb);
    if (!low && d.tex && d.nrm > 0 && texCache[d.tex + "_n"]) { p.normalMap = texCache[d.tex + "_n"]; p.normalScale = new THREE.Vector2(d.nrm, d.nrm); }
    if (d.soft) { p.transparent = true; p.depthWrite = false; }
    if (d.alpha) { p.alphaTest = d.decal ? 0.3 : 0.5; p.side = THREE.DoubleSide; }
    if (d.emissive) { p.emissive = new THREE.Color(0xffffff); p.emissiveIntensity = 1.5; if (map) p.emissiveMap = map; else p.emissive = new THREE.Color(0xffb35a); }
    if (!d.env) p.envMapIntensity = 0.3;
    const m = new THREE.MeshStandardMaterial(p);
    m.name = "blocks:" + key;
    if (d.env && Blocks.envMap && !Blocks.sceneEnv) { m.envMap = Blocks.envMap; m.envMapIntensity = d.env; } else if (d.env) m.envMapIntensity = d.env;
    m.userData.env = d.env || 0;
    if (d.decal) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    if (d.emissive) windowMats.push(m);
    return (matCache[ck] = m);
  }

  Blocks.update = function (dt, t) {
    try {
      const k = Blocks.windowGlow * (0.95 + 0.05 * Math.sin(t * 1.7) + 0.02 * Math.sin(t * 5.3));
      for (const m of windowMats) m.emissiveIntensity = 1.5 * k;
    } catch (e) { /* ignore */ }
  };
  // Call with scene.environment (or null). When World provides one, Blocks stops overriding it.
  Blocks.useSceneEnvironment = function (env) {
    Blocks.sceneEnv = env || null;
    Object.keys(matCache).forEach(k => { const m = matCache[k]; if (m.userData.env) { m.envMap = env ? null : Blocks.envMap; m.needsUpdate = true; } else m.envMapIntensity = 0.3; });
  };
  Blocks.setWindowGlow = function (k) { Blocks.windowGlow = k; };
  // Disposes the geometry of an object returned by build(). Materials are shared and cached, never disposed.
  Blocks.disposeObject = function (obj) { obj && obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };

  // ---- geometry builder ------------------------------------------------------------------------------------------------
  const DIR = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+z": [0, 0, 1], "-z": [0, 0, -1], "+y": [0, 1, 0], "-y": [0, -1, 0] };
  const PLUM = [0.42, 0.30, 0.44];

  function Builder(group, ctx) {
    this.ctx = ctx || {}; this.low = (ctx && ctx.quality) === "low"; this.seed = (ctx && ctx.seed) | 0;
    this.bufs = {}; this.map = new Map();
    this.cell = [0, 0, 0]; this.hp = 0; this.hq = 0; this.tint = [1, 1, 1];
    for (const b of group.blocks) this.map.set(b.cell[0] + "," + b.cell[1] + "," + b.cell[2], b);
  }
  Builder.prototype.occ = function (x, y, z) {
    if (this.ctx.occupied) { try { return !!this.ctx.occupied(x, y, z); } catch (e) { /* fall through */ } }
    return this.map.has(x + "," + y + "," + z);
  };
  Builder.prototype.setCell = function (c) {
    this.cell = c; this.hp = c[0] - c[1]; this.hq = c[2] - c[1];
  };
  Builder.prototype.h = function (face, n) { return hash(this.hp, this.hq, face * 17 + (n | 0), this.seed + 1013); };
  Builder.prototype.buf = function (k) {
    return this.bufs[k] || (this.bufs[k] = { pos: [], nor: [], uv: [], col: [], idx: [] });
  };
  // corner AO 0..1 for a point on a face (axis a, side s) of the current cell
  Builder.prototype.ao = function (a, s, P) {
    const c = this.cell, b = (a + 1) % 3, d = (a + 2) % 3;
    const o = [c[0], c[1], c[2]]; o[a] += s ? 1 : -1;
    const sb = P[b] > c[b] + 0.5 ? 1 : -1, sd = P[d] > c[d] + 0.5 ? 1 : -1;
    const ob = [o[0], o[1], o[2]]; ob[b] += sb;
    const od = [o[0], o[1], o[2]]; od[d] += sd;
    const oc = [ob[0], ob[1], ob[2]]; oc[d] += sd;
    const s1 = this.occ(ob[0], ob[1], ob[2]) ? 1 : 0, s2 = this.occ(od[0], od[1], od[2]) ? 1 : 0, cc = this.occ(oc[0], oc[1], oc[2]) ? 1 : 0;
    return (s1 && s2) ? 0 : (3 - s1 - s2 - cc) / 3;
  };
  Builder.prototype.color = function (a, s, P, tint, aoOff) {
    const v = aoOff ? 1 : this.ao(a, s, P), k = Math.pow(v, 0.85), t = tint || this.tint;
    return [t[0] * (PLUM[0] + (1 - PLUM[0]) * k), t[1] * (PLUM[1] + (1 - PLUM[1]) * k), t[2] * (PLUM[2] + (1 - PLUM[2]) * k)];
  };
  // world-aligned uv with per-face random offset / flip / quarter turn. proj = projection axis (0:x,1:y,2:z)
  Builder.prototype.uvFor = function (matKey, proj, P, salt) {
    const d = MAT[matKey] || MAT.sandstone, sc = d.scale;
    let u, v;
    if (proj === 1) { u = P[0]; v = P[2]; } else if (proj === 0) { u = P[2]; v = P[1]; } else { u = P[0]; v = P[1]; }
    const r1 = this.h(salt, 1), r2 = this.h(salt, 2), r3 = this.h(salt, 3);
    if (proj === 1) { if (r3 < 0.5) { const t = u; u = v; v = t; } if (r3 < 0.25 || r3 > 0.75) u = -u; }
    else if (r3 < 0.5) u = -u;
    let ou = r1 * sc, ov = proj === 1 ? r2 * sc : Math.round(r2 * 2) * sc * 0.5; // vertical walls keep courses on cell lines
    if (matKey === "grate" || matKey === "brassTrim") { ou = 0; ov = 0; }
    return [(u + ou) / sc, (v + ov) / sc];
  };
  Builder.prototype.quadRaw = function (matKey, pts, n, uvs, cols) {
    const b = this.buf(matKey), base = b.pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      b.pos.push(pts[i][0], pts[i][1], pts[i][2]); b.nor.push(n[0], n[1], n[2]); b.uv.push(uvs[i][0], uvs[i][1]);
      b.col.push(cols[i][0], cols[i][1], cols[i][2]);
    }
    // winding fix: geometric normal must agree with n
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    if (pts.length === 4) {
      if (!flip) b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); else b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    } else if (!flip) b.idx.push(base, base + 1, base + 2); else b.idx.push(base, base + 2, base + 1);
  };

  // bevelled box. lo/hi world extents, bev, mats[6] (face index = axis*2+side), draw[6], salt, opts{tint, aoOff}
  Builder.prototype.box = function (lo, hi, bev, mats, draw, salt, opts) {
    opts = opts || {};
    const tint = opts.tint || this.tint, aoOff = !!opts.aoOff;
    // clamp bevel so thin boxes stay valid
    let b = bev; for (let i = 0; i < 3; i++) b = Math.min(b, (hi[i] - lo[i]) * 0.45);
    const inset = (ax, s, sideAxis) => 0; // placeholder for readability
    const CB = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const nrm = new Array(6);
    for (let fi = 0; fi < 6; fi++) { const n = [0, 0, 0]; n[fi >> 1] = (fi & 1) ? 1 : -1; nrm[fi] = n; }
    for (let fi = 0; fi < 6; fi++) {
      if (!draw[fi]) continue;
      const a = fi >> 1, s = fi & 1, b1 = (a + 1) % 3, c1 = (a + 2) % 3, pts = [], uvs = [], cols = [];
      let ft = tint; if (opts.faceVar) { const v = 1 + (this.h(salt * 6 + fi, 90) - 0.5) * 0.14, w = (this.h(salt * 6 + fi, 91) - 0.5) * 0.05; ft = [tint[0] * (v + w), tint[1] * v, tint[2] * (v - w)]; }
      for (const [cb, cc] of CB) {
        const P = [0, 0, 0]; P[a] = s ? hi[a] : lo[a];
        P[b1] = cb ? hi[b1] - b : lo[b1] + b; P[c1] = cc ? hi[c1] - b : lo[c1] + b;
        pts.push(P); uvs.push(this.uvFor(mats[fi], a, P, salt * 6 + fi)); cols.push(this.color(a, s, P, ft, aoOff));
      }
      this.quadRaw(mats[fi], pts, nrm[fi], uvs, cols);
    }
    if (b <= 0.0005) return;
    // edge chamfers
    for (let a1 = 0; a1 < 3; a1++) for (let b1 = a1 + 1; b1 < 3; b1++) for (let sa = 0; sa < 2; sa++) for (let sb = 0; sb < 2; sb++) {
      const fa = a1 * 2 + sa, fb = b1 * 2 + sb;
      if (!draw[fa] && !draw[fb]) continue;
      const c1 = 3 - a1 - b1, mk = draw[fa] ? mats[fa] : mats[fb], pts = [], uvs = [], cols = [];
      const proj = draw[fa] ? a1 : b1, sal = salt * 6 + (draw[fa] ? fa : fb);
      for (const e of [0, 1]) {
        const cc = e ? hi[c1] - b : lo[c1] + b;
        const F = [0, 0, 0]; F[a1] = sa ? hi[a1] : lo[a1]; F[b1] = sb ? hi[b1] - b : lo[b1] + b; F[c1] = cc;
        const G = [0, 0, 0]; G[b1] = sb ? hi[b1] : lo[b1]; G[a1] = sa ? hi[a1] - b : lo[a1] + b; G[c1] = cc;
        pts.push(F, G);
        uvs.push(this.uvFor(mk, proj, F, sal), this.uvFor(mk, proj, G, sal));
        cols.push(this.color(a1, sa, F, tint, aoOff), this.color(b1, sb, G, tint, aoOff));
      }
      // order F0,G0,G1,F1 for a proper quad
      const o = [0, 1, 3, 2];
      const n = [0, 0, 0]; n[a1] = sa ? 0.7071 : -0.7071; n[b1] = sb ? 0.7071 : -0.7071;
      this.quadRaw(mk, o.map(i => pts[i]), n, o.map(i => uvs[i]), o.map(i => cols[i]));
    }
    // corner triangles
    for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) for (let sz = 0; sz < 2; sz++) {
      const sg = [sx, sy, sz], fs = [0 * 2 + sx, 1 * 2 + sy, 2 * 2 + sz];
      if (!draw[fs[0]] && !draw[fs[1]] && !draw[fs[2]]) continue;
      const mk = draw[fs[0]] ? mats[fs[0]] : draw[fs[1]] ? mats[fs[1]] : mats[fs[2]];
      const pts = [], uvs = [], cols = [];
      for (let a = 0; a < 3; a++) {
        const P = [0, 0, 0];
        for (let k = 0; k < 3; k++) P[k] = k === a ? (sg[k] ? hi[k] : lo[k]) : (sg[k] ? hi[k] - b : lo[k] + b);
        pts.push(P); uvs.push(this.uvFor(mk, 1, P, salt * 6 + fs[1])); cols.push(this.color(a, sg[a], P, tint, aoOff));
      }
      this.quadRaw(mk, pts, [sx ? 0.577 : -0.577, sy ? 0.577 : -0.577, sz ? 0.577 : -0.577], uvs, cols);
    }
  };

  // ---- helpers for placing detail on a side face -----------------------------------------------------------------------
  // face (a in {0,2}, s): hAxis is the other horizontal axis; hh in cell-local [0,1], yy in cell-local [0,1]
  Builder.prototype.fp = function (a, s, hh, yy, out) {
    const c = this.cell, P = [0, 0, 0], hA = a === 0 ? 2 : 0;
    P[a] = c[a] + (s ? 1 : 0) + (s ? out : -out); P[hA] = c[hA] + hh; P[1] = c[1] + yy; return P;
  };
  Builder.prototype.faceBox = function (a, s, h0, h1, y0, y1, depth, bev, matKey, salt, tint) {
    const c = this.cell, hA = a === 0 ? 2 : 0, lo = [0, 0, 0], hi = [0, 0, 0];
    if (s) { lo[a] = c[a] + 1 - 0.01; hi[a] = c[a] + 1 + depth; } else { lo[a] = c[a] - depth; hi[a] = c[a] + 0.01; }
    lo[hA] = c[hA] + h0; hi[hA] = c[hA] + h1; lo[1] = c[1] + y0; hi[1] = c[1] + y1;
    const draw = [1, 1, 1, 1, 1, 1]; draw[a * 2 + (s ? 0 : 1)] = 0; draw[2] = 0;
    this.box(lo, hi, bev, [matKey, matKey, matKey, matKey, matKey, matKey], draw, salt, { tint });
  };
  function archOutline(hw, y0, rectH, seg) {
    const o = [[-hw, y0], [hw, y0], [hw, y0 + rectH]];
    for (let i = 1; i < seg; i++) { const th = Math.PI * i / seg; o.push([hw * Math.cos(th), y0 + rectH + hw * Math.sin(th)]); }
    o.push([-hw, y0 + rectH]); return o;
  }
  Builder.prototype.windowOn = function (a, s, tintBase, salt) {
    const hw = 0.17, y0 = 0.28, rectH = 0.3, totalH = rectH + hw, seg = 8;
    const nrm = [0, 0, 0]; nrm[a] = s ? 1 : -1;
    const inner = archOutline(hw, y0, rectH, seg), outer = archOutline(hw + 0.05, y0 - 0.035, rectH, seg);
    // glass: fan
    const pts = inner.map(p => this.fp(a, s, 0.5 + p[0], p[1], 0.006));
    const uv = inner.map(p => [(p[0] + hw) / (2 * hw), (p[1] - y0) / totalH]);
    const white = [1, 1, 1];
    const b = this.buf("window"), base = b.pos.length / 3;
    for (let i = 0; i < pts.length; i++) { b.pos.push(pts[i][0], pts[i][1], pts[i][2]); b.nor.push(nrm[0], nrm[1], nrm[2]); b.uv.push(uv[i][0], uv[i][1]); b.col.push(1, 1, 1); }
    const flip = (() => { // fan winding from first three pts
      const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
      return (e1[1] * e2[2] - e1[2] * e2[1]) * nrm[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * nrm[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * nrm[2] < 0;
    })();
    for (let i = 1; i < pts.length - 1; i++) { if (!flip) b.idx.push(base, base + i, base + i + 1); else b.idx.push(base, base + i + 1, base + i); }
    // stone frame (proud of the wall) between outline loops
    const mat = this.styleBody;
    const tint = [tintBase[0] * 1.08, tintBase[1] * 1.06, tintBase[2] * 1.02];
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      const q = [this.fp(a, s, 0.5 + inner[i][0], inner[i][1], 0.004), this.fp(a, s, 0.5 + inner[j][0], inner[j][1], 0.004),
        this.fp(a, s, 0.5 + outer[j][0], outer[j][1], 0.014), this.fp(a, s, 0.5 + outer[i][0], outer[i][1], 0.014)];
      const col = q.map(P => this.color(a, s, P, tint));
      this.quadRaw(mat, q, nrm, q.map(P => this.uvFor(mat, a, P, salt * 6 + 7)), col);
      // outer lip, a thin raised ring
      const lip = [this.fp(a, s, 0.5 + outer[i][0], outer[i][1], 0.014), this.fp(a, s, 0.5 + outer[j][0], outer[j][1], 0.014),
        this.fp(a, s, 0.5 + outer[j][0], outer[j][1], 0.0), this.fp(a, s, 0.5 + outer[i][0], outer[i][1], 0.0)];
      const ln = [outer[j][1] - outer[i][1], 0, 0]; // outward normal of the outline segment, in (h,y) then mapped
      let nh = outer[j][1] - outer[i][1], ny = -(outer[j][0] - outer[i][0]);
      const L = Math.hypot(nh, ny) || 1; nh /= L; ny /= L;
      const cxy = [(outer[i][0] + outer[j][0]) / 2, (outer[i][1] + outer[j][1]) / 2 - (y0 + rectH * 0.5)];
      if (nh * cxy[0] + ny * cxy[1] < 0) { nh = -nh; ny = -ny; }
      const n2 = [0, ny, 0]; n2[a === 0 ? 2 : 0] = nh;
      this.quadRaw(mat, lip, n2, lip.map(P => this.uvFor(mat, a, P, salt * 6 + 8)), lip.map(P => this.color(a, s, P, tint)));
    }
    // sill
    this.faceBox(a, s, 0.5 - hw - 0.06, 0.5 + hw + 0.06, y0 - 0.075, y0 - 0.03, 0.05, 0.008, mat, salt + 31, tint);
    if (!this.low) this.grime(a, s, 0.5, 0.42, y0 - 0.075, y0 - 0.075 + 0.0 + 0.2, salt, 1);
  };

  Builder.prototype.mossStrip = function (a, s, salt, small) {
    const r = this.h(salt, 50);
    const hgt = (small ? 0.1 : 0.2) + 0.1 * this.h(salt, 51), flip = r < 0.5, uo = this.h(salt, 52);
    const o = small ? 0.048 : 0.007, pts = [this.fp(a, s, -0.005, 1.0, o), this.fp(a, s, 1.005, 1.0, o), this.fp(a, s, 1.005, 1 - hgt, o), this.fp(a, s, -0.005, 1 - hgt, o)];
    const u1 = uo * 0.5, uvs = flip ? [[u1 + 0.5, 1], [u1, 1], [u1, 0.68], [u1 + 0.5, 0.68]] : [[u1, 1], [u1 + 0.5, 1], [u1 + 0.5, 0.68], [u1, 0.68]];
    const nrm = [0, 0, 0]; nrm[a] = s ? 1 : -1;
    const tn = 0.6 + 0.25 * this.h(salt, 53), c = [tn, tn, tn];
    const cols = pts.map(P => { const v = this.color(a, s, P, c); return v; });
    this.quadRaw("decal", pts, nrm, uvs, cols);
  };
  Builder.prototype.crack = function (a, s, salt) {
    const q = Math.floor(this.h(salt, 60) * 4), sz = 0.5 + 0.3 * this.h(salt, 61);
    const hc = 0.25 + 0.5 * this.h(salt, 62), yc = 0.3 + 0.4 * this.h(salt, 63), mirror = this.h(salt, 64) < 0.5;
    const u0 = (q & 1) * 0.5, v0 = 1 - (128 + ((q >> 1) + 1) * 128) / 384;
    const pts = [this.fp(a, s, hc - sz / 2, yc - sz / 2, 0.004), this.fp(a, s, hc + sz / 2, yc - sz / 2, 0.004), this.fp(a, s, hc + sz / 2, yc + sz / 2, 0.004), this.fp(a, s, hc - sz / 2, yc + sz / 2, 0.004)];
    const uvs = [[u0, v0 + 0.005], [u0 + 0.5, v0 + 0.005], [u0 + 0.5, v0 + 0.328], [u0, v0 + 0.328]]; if (mirror) { const t = uvs[0]; uvs[0] = uvs[1]; uvs[1] = t; const t2 = uvs[2]; uvs[2] = uvs[3]; uvs[3] = t2; }
    const nrm = [0, 0, 0]; nrm[a] = s ? 1 : -1;
    this.quadRaw("decal", pts, nrm, uvs, pts.map(() => [1, 1, 1]));
  };

  // ---- walkable top test ---------------------------------------------------------------------------------------------------
  Builder.prototype.walkTop = function (x, y, z) {
    const b = this.map.get(x + "," + y + "," + z);
    if (!b || b.kind === "veil" || b.kind === "stair" || b.walk === false) return false;
    if (b.style === "column" || b.style === "hedge") return false;
    return !this.occ(x, y + 1, z);
  };

  function tintFor(self, style, salt) {
    // slight per-block tint jitter, depth-invariant (hash of projected coordinates)
    const j1 = self.h(salt, 70) - 0.5, j2 = self.h(salt, 71) - 0.5, j3 = self.h(salt, 72) - 0.5;
    const b = 1 + j1 * 0.16;
    return [b * (1 + j2 * 0.06), b * (1 + j3 * 0.04), b * (1 - j2 * 0.05 + j3 * 0.04)];
  }

  // ---- cube ---------------------------------------------------------------------------------------------------------------------------
  Builder.prototype.cube = function (blk) {
    const c = this.cell, style = blk.style in MAT || blk.style in STYLE_BODY ? blk.style : "sandstone";
    const body = STYLE_BODY[style] || "sandstone";
    this.styleBody = body;
    const tint = this.tint = tintFor(this, style, 0);
    const draw = [0, 0, 0, 0, 0, 0];
    const nb = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
    // face order: index = axis*2 + side -> (-x,+x,-y,+y,-z,+z)
    for (let fi = 0; fi < 6; fi++) { const d = nb[fi]; draw[fi] = this.occ(c[0] + d[0], c[1] + d[1], c[2] + d[2]) ? 0 : 1; }
    const mats = [body, body, body, body, body, body];
    const walkTop = this.walkTop(c[0], c[1], c[2]);
    const stoneish = style === "sandstone" || style === "brick" || style === "marble" || style === "darkstone";
    const capped = !walkTop && draw[3] && stoneish;
    const det = DETAIL[style] || DETAIL.sandstone;
    if (capped) mats[3] = "darkstone";
    this.box([c[0], c[1], c[2]], [c[0] + 1, c[1] + 1, c[2] + 1], this.low ? 0.03 : 0.035, mats, draw, 0, { tint, faceVar: true });
    if (walkTop) { this.paverSlab(c, style); if (style === "wood") this.woodStraps(c); }
    if (capped) this.stoneCap(c, draw, nb);
    if (style === "slate" && !walkTop && draw[3]) this.roofRidge(c);
    // wall details on exposed sides
    for (const [a, s, fi] of [[0, 1, 1], [0, 0, 0], [2, 1, 5], [2, 0, 4]]) {
      if (!draw[fi]) continue;
      this.detailSide(a, s, 10 + fi, style, det, tint, walkTop, draw[3], draw[2]);
    }
  };
  // dark weathered stone cap on non-walkable tops, with moss creeping in from the edges
  Builder.prototype.stoneCap = function (c, draw, nb) {
    const I = 0.05, lo = [c[0] + I, c[1] + 0.99, c[2] + I], hi = [c[0] + 1 - I, c[1] + 1.03, c[2] + 1 - I];
    const t = [this.tint[0] * 0.92, this.tint[1] * 0.9, this.tint[2] * 0.95];
    this.box(lo, hi, 0.014, Array(6).fill("darkstone"), [1, 1, 0, 1, 1, 1], 3, { tint: t, faceVar: true });
    if (this.low) return;
    const dirs = [[-1, 0, 0, 0, 0], [1, 0, 0, 1, 0], [0, 0, -1, 2, 0], [0, 0, 1, 3, 1]];
    for (const [dx, , dz, k] of dirs) {
      if (this.occ(c[0] + dx, c[1], c[2] + dz) || this.h(30 + k, 5) > 0.7) continue;
      const w = 0.2 + 0.12 * this.h(30 + k, 6), y = c[1] + 1.034, uo = this.h(30 + k, 7);
      const P = (h, d) => { // h along the edge 0..1, d inward distance
        const x = dx ? (dx < 0 ? c[0] + 0.04 + d : c[0] + 0.96 - d) : c[0] + h, z = dz ? (dz < 0 ? c[2] + 0.04 + d : c[2] + 0.96 - d) : c[2] + h;
        return [x, y, z];
      };
      const pts = [P(0.04, 0), P(0.96, 0), P(0.96, w), P(0.04, w)];
      const u1 = uo * 0.5, uvs = [[u1, 1], [u1 + 0.5, 1], [u1 + 0.5, 0.68], [u1, 0.68]], tn = 0.55 + 0.25 * this.h(30 + k, 8);
      this.quadRaw("decal", pts, [0, 1, 0], uvs, pts.map(() => [tn, tn, tn]));
    }
  };
  Builder.prototype.detailSide = function (a, s, salt, style, det, tint, walkTop, topExposed, bottomExposed) {
    const c = this.cell, mat = this.styleBody;
    if (!(style in DETAIL)) return;
    const light = [tint[0] * 1.1, tint[1] * 1.08, tint[2] * 1.03];
    const hasWin = det.win && this.h(salt, 1) < det.win;
    if (hasWin) this.windowOn(a, s, tint, salt);
    if (this.low) return;
    // carved cornice under every exposed top edge: full on walkable tops, a subtle lip on roofs and caps
    const cornStyle = style === "sandstone" || style === "brick" || style === "marble" || style === "darkstone" || style === "slate";
    if (topExposed && cornStyle) {
      if (walkTop) {
        this.faceBox(a, s, -0.01, 1.01, 0.925, 1.0, 0.04, 0.01, mat, salt + 40, light);
        this.faceBox(a, s, -0.01, 1.01, 0.905, 0.925, 0.022, 0.006, mat, salt + 41, [light[0] * 0.92, light[1] * 0.92, light[2] * 0.92]);
        for (let i = 0; i < 7; i++) this.faceBox(a, s, 0.035 + i * 0.14, 0.035 + i * 0.14 + 0.08, 0.845, 0.905, 0.03, 0.006, mat, salt + 42 + i, light);
      } else {
        this.faceBox(a, s, -0.01, 1.01, 0.94, 1.0, 0.028, 0.008, mat, salt + 40, [light[0] * 0.95, light[1] * 0.95, light[2] * 0.95]);
      }
    }
    // corbel brackets under overhangs (block exposed below): stepped stone brackets on the visible faces
    if (bottomExposed && s === 1 && !this.low && (style === "sandstone" || style === "brick" || style === "marble") && this.h(salt, 11) < 0.75) {
      for (const hc of [0.2, 0.8]) {
        this.faceBox(a, s, hc - 0.07, hc + 0.07, -0.05, 0.0, 0.07, 0.006, mat, salt + 100, light);
        this.faceBox(a, s, hc - 0.06, hc + 0.06, -0.12, -0.05, 0.045, 0.006, mat, salt + 101, light);
        this.faceBox(a, s, hc - 0.05, hc + 0.05, -0.19, -0.12, 0.022, 0.006, mat, salt + 102, light);
      }
    }
    // plinth on the lowest course of a stack
    if (!this.occ(c[0], c[1] - 1, c[2]) && style !== "brass" && style !== "copper" && style !== "wood")
      this.faceBox(a, s, -0.01, 1.01, 0.0, 0.1, 0.035, 0.01, mat, salt + 60, [tint[0] * 0.93, tint[1] * 0.92, tint[2] * 0.95]);
    // occasional string course mid-wall
    if (!hasWin && det.trim && this.h(salt, 2) < det.trim) {
      this.faceBox(a, s, -0.01, 1.01, 0.5, 0.57, 0.03, 0.01, mat, salt + 70, light);
      this.faceBox(a, s, -0.01, 1.01, 0.57, 0.6, 0.018, 0.006, mat, salt + 71, light);
    }
    if (style === "wood") {
      for (const hc of [0.14, 0.86]) this.faceBox(a, s, hc - 0.045, hc + 0.045, 0.04, 0.96, 0.014, 0.004, "iron", salt + 110, [0.9, 0.9, 0.9]);
      this.faceBox(a, s, 0.0, 1.0, 0.47, 0.53, 0.012, 0.004, "iron", salt + 111, [0.9, 0.9, 0.9]);
    }
    // vents and iron rings (never on window faces)
    if (!hasWin && style !== "darkstone") {
      const r = this.h(salt, 8);
      if (r < 0.05) this.vent(a, s, salt);
      else if (r < 0.09) this.ring(a, s, salt);
    }
    if (det.moss && this.h(salt, 3) < det.moss && !this.occ(c[0], c[1] + 1, c[2]) && !walkTop) this.mossStrip(a, s, salt);
    else if (det.moss && walkTop && this.h(salt, 3) < det.moss * 0.7) this.mossStrip(a, s, salt, true);
    if (det.crack && this.h(salt, 4) < det.crack) this.crack(a, s, salt);
  };
  Builder.prototype.vent = function (a, s, salt) {
    const hc = 0.3 + 0.4 * this.h(salt, 9), y0 = 0.3 + 0.12 * this.h(salt, 10), w = 0.07;
    this.faceBox(a, s, hc - w - 0.02, hc + w + 0.02, y0 - 0.02, y0 + 2 * w + 0.02, 0.018, 0.006, "iron", salt + 80, [1, 1, 1]);
    for (let i = 0; i < 4; i++) this.faceBox(a, s, hc - w, hc + w, y0 + i * 0.036 + 0.004, y0 + i * 0.036 + 0.026, 0.024, 0.002, "iron", salt + 81 + i, [0.16, 0.13, 0.18]);
  };
  Builder.prototype.ring = function (a, s, salt) {
    const hc = 0.3 + 0.4 * this.h(salt, 9), yc = 0.42 + 0.1 * this.h(salt, 10), N = 10, R0 = 0.05, R1 = 0.075;
    const nrm = [0, 0, 0]; nrm[a] = s ? 1 : -1;
    this.faceBox(a, s, hc - 0.03, hc + 0.03, yc + R1 - 0.03, yc + R1 + 0.03, 0.02, 0.004, "iron", salt + 90, [1, 1, 1]);
    for (let i = 0; i < N; i++) {
      const t0 = i / N * 6.2832, t1 = (i + 1) / N * 6.2832;
      const q = [this.fp(a, s, hc + R0 * Math.cos(t0), yc + R0 * Math.sin(t0), 0.03), this.fp(a, s, hc + R0 * Math.cos(t1), yc + R0 * Math.sin(t1), 0.03),
        this.fp(a, s, hc + R1 * Math.cos(t1), yc + R1 * Math.sin(t1), 0.03), this.fp(a, s, hc + R1 * Math.cos(t0), yc + R1 * Math.sin(t0), 0.03)];
      this.quadRaw("iron", q, nrm, q.map(() => [0.5, 0.5]), q.map(() => [0.9, 0.9, 0.9]));
    }
  };
  Builder.prototype.grime = function (a, s, hc, wd, yTop, len, salt, strength) {
    const k = strength, pts = [this.fp(a, s, hc - wd / 2, yTop, 0.005), this.fp(a, s, hc + wd / 2, yTop, 0.005), this.fp(a, s, hc + wd / 2, yTop - len, 0.005), this.fp(a, s, hc - wd / 2, yTop - len, 0.005)];
    const nrm = [0, 0, 0]; nrm[a] = s ? 1 : -1; const uo = this.h(salt, 95) < 0.5;
    const uvs = uo ? [[0, 1], [1, 1], [1, 0], [0, 0]] : [[1, 1], [0, 1], [0, 0], [1, 0]];
    this.quadRaw("grime", pts, nrm, uvs, pts.map(() => [k, k, k]));
  };

  Builder.prototype.woodStraps = function (c) {
    const x = c[0], y = c[1], z = c[2], F = [1, 1, 0, 1, 1, 1], M = Array(6).fill("iron");
    for (const t of [0.17, 0.74]) this.box([x + t, y + 1.025, z + 0.09], [x + t + 0.09, y + 1.046, z + 0.91], 0.005, M, F, 8, { tint: [1, 1, 1] });
    for (const t of [0.17, 0.74]) for (const e of [0.13, 0.84]) this.box([x + t + 0.025, y + 1.045, z + e], [x + t + 0.065, y + 1.057, z + e + 0.04], 0.004, M, F, 9, { tint: [1.4, 1.3, 1.1] });
  };
  Builder.prototype.roofRidge = function (c) {
    const x = c[0], y = c[1], z = c[2], isS = (dx, dz) => (this.map.get((x + dx) + "," + y + "," + (z + dz)) || {}).style === "slate";
    const alongX = (isS(-1, 0) || isS(1, 0)) || !(isS(0, -1) || isS(0, 1));
    const lo = [x, y + 0.99, z], hi = [x + 1, y + 1.1, z + 1], cl = [x, y + 1.1, z], ch = [x + 1, y + 1.135, z + 1];
    if (alongX) { lo[2] += 0.22; hi[2] -= 0.22; cl[2] += 0.43; ch[2] -= 0.43; if (isS(-1, 0)) { lo[0] -= 0.0; } }
    else { lo[0] += 0.22; hi[0] -= 0.22; cl[0] += 0.43; ch[0] -= 0.43; }
    const t = [this.tint[0] * 0.95, this.tint[1] * 0.95, this.tint[2] * 0.97];
    this.box(lo, hi, 0.02, Array(6).fill("slate"), [1, 1, 0, 1, 1, 1], 4, { tint: t });
    this.box(cl, ch, 0.008, Array(6).fill("copper"), [1, 1, 0, 1, 1, 1], 5, { tint: [1, 1, 1] });
  };
  Builder.prototype.paverSlab = function (c, style) {
    const x = c[0], y = c[1], z = c[2];
    const jx0 = this.walkTop(x - 1, y, z), jx1 = this.walkTop(x + 1, y, z), jz0 = this.walkTop(x, y, z - 1), jz1 = this.walkTop(x, y, z + 1);
    const topMat = style === "brass" ? "grate" : style === "wood" ? "wood" : "paver";
    const trimMat = style === "brass" ? "copper" : style === "wood" ? "iron" : "brassTrim";
    const I = 0.095, J = 0.014;     // slab inset on open edges / joined edges
    const lo = [x + (jx0 ? J : I), y + 0.99, z + (jz0 ? J : I)], hi = [x + 1 - (jx1 ? J : I), y + 1.03, z + 1 - (jz1 ? J : I)];
    const draw = [1, 1, 0, 1, 1, 1];
    const tint = [this.tint[0] * 1.03, this.tint[1] * 1.03, this.tint[2] * 1.03];
    this.box(lo, hi, 0.014, [topMat, topMat, topMat, topMat, topMat, topMat], draw, 1, { tint });
    // brass inlay along every open edge
    const T0 = 0.04, T1 = 0.078, ty0 = y + 0.99, ty1 = y + 1.016, tt = [1, 1, 1];
    const dr = [1, 1, 0, 1, 1, 1], ms = [trimMat, trimMat, trimMat, trimMat, trimMat, trimMat];
    const zl = z + (jz0 ? 0 : T0), zh = z + 1 - (jz1 ? 0 : T0), xl = x + (jx0 ? 0 : T0), xh = x + 1 - (jx1 ? 0 : T0);
    if (!jx0) this.box([x + T0, ty0, zl], [x + T1, ty1, zh], 0.006, ms, dr, 2, { tint: tt });
    if (!jx1) this.box([x + 1 - T1, ty0, zl], [x + 1 - T0, ty1, zh], 0.006, ms, dr, 3, { tint: tt });
    if (!jz0) this.box([xl, ty0, z + T0], [xh, ty1, z + T1], 0.006, ms, dr, 4, { tint: tt });
    if (!jz1) this.box([xl, ty0, z + 1 - T1], [xh, ty1, z + 1 - T0], 0.006, ms, dr, 5, { tint: tt });
  };

  // ---- stairs -------------------------------------------------------------------------------------------------------------------------------------
  Builder.prototype.stair = function (blk) {
    const c = this.cell, style = blk.style in STYLE_BODY ? blk.style : "sandstone", body = STYLE_BODY[style];
    this.styleBody = body;
    const tint = this.tint = tintFor(this, style, 0);
    const u = DIR[blk.up] || DIR["-x"], ua = u[0] ? 0 : 2, pa = u[0] ? 2 : 0, pos = (u[0] + u[2]) > 0;
    const walkable = blk.up === "-x" || blk.up === "-z";
    const tread = !walkable ? body : (style === "brass" ? "grate" : style === "wood" ? "wood" : "paver");
    const nbOcc = (d) => this.occ(c[0] + d[0], c[1] + d[1], c[2] + d[2]);
    const lowDir = [-u[0], 0, -u[2]], highDir = u;
    const sideA = [0, 0, 0], sideB = [0, 0, 0]; sideA[pa] = -1; sideB[pa] = 1;
    for (let i = 0; i < 4; i++) {
      const t0 = i / 4, t1 = (i + 1) / 4, lo = [c[0], c[1], c[2]], hi = [c[0] + 1, c[1] + (i + 1) / 4, c[2] + 1];
      if (pos) { lo[ua] = c[ua] + t0; hi[ua] = c[ua] + t1; } else { lo[ua] = c[ua] + 1 - t1; hi[ua] = c[ua] + 1 - t0; }
      const mats = [body, body, body, tread, body, body], draw = [0, 0, 0, 1, 0, 0];
      // faces: axis*2+side
      const lowFace = ua * 2 + (pos ? 0 : 1), highFace = ua * 2 + (pos ? 1 : 0);
      draw[lowFace] = (i > 0 || !nbOcc(lowDir)) ? 1 : 0;
      draw[highFace] = (i === 3 && !nbOcc(highDir)) ? 1 : 0;
      draw[pa * 2] = nbOcc(sideA) ? 0 : 1; draw[pa * 2 + 1] = nbOcc(sideB) ? 0 : 1;
      const stepTint = i % 2 ? tint : [tint[0] * 1.04, tint[1] * 1.04, tint[2] * 1.04];
      this.box(lo, hi, 0.02, mats, draw, i + 1, { tint: stepTint });
      if (walkable && style !== "brass" && style !== "wood" && !this.low) {
        // brass nosing on the lip of each tread
        const nl = [lo[0], c[1] + (i + 1) / 4 - 0.004, lo[2]], nh = [hi[0], c[1] + (i + 1) / 4 + 0.012, hi[2]];
        if (pos) { nl[ua] = lo[ua]; nh[ua] = lo[ua] + 0.035; } else { nh[ua] = hi[ua]; nl[ua] = hi[ua] - 0.035; }
        nl[pa] += 0.03; nh[pa] -= 0.03;
        this.box(nl, nh, 0.005, Array(6).fill("brassTrim"), [1, 1, 0, 1, 1, 1], 20 + i, { tint: [1, 1, 1] });
      }
    }
  };

  // ---- column ----------------------------------------------------------------------------------------------------------------------------------
  Builder.prototype.cyl = function (cx, cz, y0, y1, r0, r1, seg, flute, fd, matKey, tint, capTop, capBot, ao0) {
    const b = this.buf(matKey), base = b.pos.length / 3, rows = [[y0, r0], [y1, r1]];
    const rAt = (r, th) => r * (1 - fd * (0.5 + 0.5 * Math.cos(flute * th)));
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * Math.PI * 2;
      for (let k = 0; k < 2; k++) {
        const r = rAt(rows[k][1], th), eps = 1e-3;
        const rp = rAt(rows[k][1], th + eps), x = r * Math.cos(th), z = r * Math.sin(th);
        const dx = (rp * Math.cos(th + eps) - x) / eps, dz = (rp * Math.sin(th + eps) - z) / eps;
        let nx = dz, nz = -dx; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
        const slope = (r0 - r1) / (y1 - y0); const ny = slope * 0.6; const LL = Math.hypot(nx, ny, nz);
        b.pos.push(cx + x, rows[k][0], cz + z); b.nor.push(nx / LL, ny / LL, nz / LL);
        b.uv.push(i / seg * 3.2, rows[k][0] / MAT[matKey].scale * 1.0 + (k ? 0 : 0));
        const dark = (k === 0 ? ao0 : 1); b.col.push(tint[0] * dark, tint[1] * dark, tint[2] * dark * 0.98);
      }
    }
    for (let i = 0; i < seg; i++) { const q = base + i * 2; b.idx.push(q, q + 1, q + 3, q, q + 3, q + 2); }
    const disc = (y, r, up) => {
      const bb = this.buf(matKey), b0 = bb.pos.length / 3;
      bb.pos.push(cx, y, cz); bb.nor.push(0, up ? 1 : -1, 0); bb.uv.push(0.5, 0.5); bb.col.push(tint[0], tint[1], tint[2]);
      for (let i = 0; i <= seg; i++) {
        const th = i / seg * Math.PI * 2, rr = r * (1 - fd * (0.5 + 0.5 * Math.cos(flute * th)));
        bb.pos.push(cx + rr * Math.cos(th), y, cz + rr * Math.sin(th)); bb.nor.push(0, up ? 1 : -1, 0);
        bb.uv.push(0.5 + 0.5 * Math.cos(th) * rr / r, 0.5 + 0.5 * Math.sin(th) * rr / r); bb.col.push(tint[0] * 0.95, tint[1] * 0.95, tint[2] * 0.95);
      }
      for (let i = 0; i < seg; i++) { if (up) bb.idx.push(b0, b0 + i + 2, b0 + i + 1); else bb.idx.push(b0, b0 + i + 1, b0 + i + 2); }
    };
    if (capTop) disc(y1, r1, true); if (capBot) disc(y0, r0, false);
  };
  Builder.prototype.column = function (blk) {
    const c = this.cell, tint = this.tint = tintFor(this, "column", 0), cx = c[0] + 0.5, cz = c[2] + 0.5, y = c[1];
    this.styleBody = "marble";
    const below = this.occ(c[0], c[1] - 1, c[2]) && (this.map.get(c[0] + "," + (c[1] - 1) + "," + c[2]) || {}).style === "column";
    const above = this.occ(c[0], c[1] + 1, c[2]) && (this.map.get(c[0] + "," + (c[1] + 1) + "," + c[2]) || {}).style === "column";
    const seg = this.low ? 24 : 48, fl = this.low ? 0 : 10, fd = this.low ? 0 : 0.07;
    const F = [1, 1, 0, 1, 1, 1], M = Array(6).fill("marble"), warm = [tint[0] * 1.02, tint[1] * 0.96, tint[2] * 0.9];
    const full = (y0, y1, ins, bev, tn) => this.box([c[0] + ins, y + y0, c[2] + ins], [c[0] + 1 - ins, y + y1, c[2] + 1 - ins], bev, M, [1, 1, y0 === 0 ? 1 : 0, 1, 1, 1], 7, { tint: tn || tint, aoOff: true });
    if (!below) { full(0, 0.07, 0.04, 0.015, warm); this.cyl(cx, cz, y + 0.07, y + 0.16, 0.45, 0.40, seg, 0, 0, "marble", warm, true, false, 0.85); }
    const sy0 = below ? 0 : 0.16, sy1 = above ? 1 : 0.8;
    this.cyl(cx, cz, y + sy0, y + sy1, 0.37, 0.36, seg, fl, fd, "marble", tint, false, false, below ? 1 : 0.8);
    if (!above) {
      this.cyl(cx, cz, y + 0.8, y + 0.86, 0.4, 0.4, seg, 0, 0, "marble", warm, true, false, 1);
      this.cyl(cx, cz, y + 0.86, y + 0.93, 0.37, 0.46, seg, 0, 0, "marble", warm, false, false, 1);
      full(0.93, 1.0, 0.04, 0.015, warm);
    }
  };

  // ---- hedge -----------------------------------------------------------------------------------------------------------------------------------------
  function vnoise(x, y, z, sd) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
    const sm = t => t * t * (3 - 2 * t), u = sm(fx), v = sm(fy), w = sm(fz);
    const h = (i, j, k) => hash(xi + i, yi + j, zi + k, sd);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
  }
  Builder.prototype.isHedge = function (x, y, z) { const b = this.map.get(x + "," + y + "," + z); return !!b && b.style === "hedge"; };
  // Adjacent hedge cells share smooth, un-rounded joins and one continuous lumpy noise field: a single leafy mass.
  Builder.prototype.hedge = function (blk) {
    const c = this.cell, N = this.low ? 4 : 10, R = 0.2, inner = 0.5 - R;
    const j = this.h(0, 70) - 0.5, tint = this.tint = [1 + j * 0.05, 1 + j * 0.04, 1 + j * 0.05];
    this.styleBody = "hedge";
    const b = this.buf("hedge"), sd = this.seed + 77;
    const nbr = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
    const hasN = nbr.map(d => this.isHedge(c[0] + d[0], c[1] + d[1], c[2] + d[2]));
    for (let fi = 0; fi < 6; fi++) {
      const a = fi >> 1, s = fi & 1, d = nbr[fi];
      if (this.occ(c[0] + d[0], c[1] + d[1], c[2] + d[2])) continue;
      const b1 = (a + 1) % 3, c1 = (a + 2) % 3, base = b.pos.length / 3;
      for (let jj = 0; jj <= N; jj++) for (let i = 0; i <= N; i++) {
        const P = [0, 0, 0]; P[a] = s ? 0.5 : -0.5; P[b1] = i / N - 0.5; P[c1] = jj / N - 0.5;
        const cl = [0, 0, 0];
        for (let k = 0; k < 3; k++) { const lo = hasN[k * 2] ? -0.6 : -inner, hi = hasN[k * 2 + 1] ? 0.6 : inner; cl[k] = Math.max(lo, Math.min(hi, P[k])); }
        const dd = [P[0] - cl[0], P[1] - cl[1], P[2] - cl[2]], L = Math.hypot(dd[0], dd[1], dd[2]);
        let n; if (L < 1e-6) { n = [0, 0, 0]; n[a] = s ? 1 : -1; } else n = [dd[0] / L, dd[1] / L, dd[2] / L];
        const W = [c[0] + 0.5 + cl[0] + n[0] * R, c[1] + 0.5 + cl[1] + n[1] * R, c[2] + 0.5 + cl[2] + n[2] * R];
        // world-continuous two-octave noise: lumps, tufts and slight overhang past the cell silhouette
        const n1 = vnoise(W[0] * 5.3, W[1] * 5.3, W[2] * 5.3, sd), n2 = vnoise(W[0] * 11.7 + 9, W[1] * 11.7, W[2] * 11.7, sd + 1);
        const lump = (n1 - 0.5) * 0.13 + (n2 - 0.5) * 0.06 + 0.02;
        W[0] += n[0] * lump; W[1] += n[1] * lump; W[2] += n[2] * lump;
        const col = this.color(a, s, W, tint), crev = 0.62 + 0.62 * Math.max(0, Math.min(1, (n1 * 0.65 + n2 * 0.35) * 1.15 - 0.05));
        const uvp = a === 1 ? [W[0], W[2]] : a === 0 ? [W[2], W[1]] : [W[0], W[1]];
        b.pos.push(W[0], W[1], W[2]); b.nor.push(n[0], n[1], n[2]);
        b.uv.push(uvp[0] / MAT.hedge.scale + 0.31 * a, uvp[1] / MAT.hedge.scale);
        b.col.push(col[0] * crev, col[1] * crev, col[2] * crev * 0.97);
      }
      for (let jj = 0; jj < N; jj++) for (let i = 0; i < N; i++) {
        const q = base + jj * (N + 1) + i, i1 = q + 1, i2 = q + N + 2, i3 = q + N + 1, A = q * 3, B = i1 * 3, C = i2 * 3;
        const e1 = [b.pos[B] - b.pos[A], b.pos[B + 1] - b.pos[A + 1], b.pos[B + 2] - b.pos[A + 2]], e2 = [b.pos[C] - b.pos[A], b.pos[C + 1] - b.pos[A + 1], b.pos[C + 2] - b.pos[A + 2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (cr[0] * b.nor[A] + cr[1] * b.nor[A + 1] + cr[2] * b.nor[A + 2] >= 0) b.idx.push(q, i1, i2, q, i2, i3); else b.idx.push(q, i2, i1, q, i3, i2);
      }
    }
  };

  // ---- build ---------------------------------------------------------------------------------------------------------------------------------------------
  function toMesh(bufs, low, root, castMap) {
    for (const k of Object.keys(bufs)) {
      const bf = bufs[k]; if (!bf.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(bf.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(bf.nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(bf.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(bf.col, 3));
      g.setIndex(bf.idx);
      const m = new THREE.Mesh(g, getMat(k, low));
      m.name = "blocks:" + k;
      const decal = k === "decal" || k === "grime";
      m.castShadow = !decal && k !== "window"; m.receiveShadow = true;
      if (decal) { m.userData.cutout = true; m.renderOrder = 1; }
      root.add(m);
    }
  }

  Blocks.build = function (group, ctx) {
    const root = new THREE.Group();
    root.name = "blocks:" + (group && group.id);
    root.userData.sharedMaterials = true;
    try {
      const S = new Builder(group, ctx);
      for (const blk of group.blocks) {
        S.setCell(blk.cell);
        const style = blk.style && (blk.style in STYLE_LIST) ? blk.style : "sandstone";
        const bb = { cell: blk.cell, style, kind: blk.kind || "cube", walk: blk.walk, up: blk.up };
        S.map.set(blk.cell.join(","), bb);
      }
      for (const blk of group.blocks) {
        S.setCell(blk.cell);
        const bb = S.map.get(blk.cell.join(","));
        try {
          if (blk.kind === "stair" || blk.up && blk.kind !== "veil") S.stair(bb);
          else if (bb.style === "column") S.column(bb);
          else if (bb.style === "hedge") S.hedge(bb);
          else S.cube(bb);
        } catch (e) { console.warn("[blocks] block failed", blk.cell, e); }
      }
      toMesh(S.bufs, S.low, root);
    } catch (e) {
      console.error("[blocks] build failed, using plain boxes", e);
      try {
        const m = new THREE.MeshStandardMaterial({ color: 0xc98c55, roughness: 0.9 });
        for (const blk of group.blocks) {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
          mesh.position.set(blk.cell[0] + 0.5, blk.cell[1] + 0.5, blk.cell[2] + 0.5); root.add(mesh);
        }
      } catch (e2) { /* give up quietly */ }
    }
    return root;
  };

  window.Blocks = Blocks;
})();
