// SPIRELIGHT decor: props, mechanism handles, plants and machinery (design.md 7.3).
// One IIFE, one global: window.Decor.  three.js r128.  Everything is procedural (lathe / extrude / tube geometry,
// merged per material) except the plant cut-out cards, which use the atlases in assets/decor/ (with a procedural
// canvas fallback when they fail to load).
//
// Frames.  Every prop is built in a local frame and then placed on a face of its cell:
//   "floor" types : origin = face centre, +y = outward face normal (any face), rot spins about that normal.
//   "wall"  types : on a side face: origin = face centre, +z = outward normal, +y = world up, +x = right.
//                   on "+y": built standing on the top (mode "floor"); on "-y": hangs from the underside ("hang").
// Look at Decor.types for each type's mode and params.
(function () {
  "use strict";

  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  const BASE = SCRIPT_SRC ? SCRIPT_SRC.replace(/js\/decor\.js.*$/, "") + "assets/decor/" : "assets/decor/";
  const TAU = Math.PI * 2;
  let THREE = null, renderer = null, ready = false;

  // ------------------------------------------------------------------------------------------------ palette
  const C = {
    brass: 0xc8963e, brassHi: 0xffd27a, brassDk: 0x8c6428, bronze: 0x92602a,
    iron: 0x3c3a44, ironDk: 0x24232b, ironHi: 0x58566a,
    patina: 0x4fa597, patinaDk: 0x2f7068, copper: 0xb8693a,
    wood: 0x8a5230, woodDk: 0x4f2f1c, sand: 0xd9a46a, sandDk: 0xb97a4a, sandHi: 0xe8bd86, cream: 0xefe2c6,
    slate: 0x3b3d5c, slateHi: 0x5a5d88, moss: 0x6f8f3a, brick: 0xa8623f, brickDk: 0x7d4630, coral: 0xd9482f,
    lamp: 0xffb35a,
  };

  // ------------------------------------------------------------------------------------------------ small utils
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash3(x, y, z, s) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + (s || 0) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const P = (item, k, d) => (item && item[k] !== undefined ? item[k] : d);
  const warn = (...a) => { try { console.warn("[Decor]", ...a); } catch (e) { /* ignore */ } };

  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  // ------------------------------------------------------------------------------------------------ canvas textures
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function ctex(c, srgb) {
    const t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  const T = {};   // shared textures
  const M = {};   // shared materials
  const own = [];  // shared resources, for Decor.disposeShared

  function makeTextures() {
    // soft radial glow (white, tinted by sprite colour)
    let c = canvas(128, 128), g = c.getContext("2d");
    let gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,255,255,0.75)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.26)"); gr.addColorStop(0.65, "rgba(255,255,255,0.06)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); T.glow = ctex(c);
    // hot glow: white core, warm falloff (used un-tinted for flames)
    c = canvas(128, 128); g = c.getContext("2d");
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,250,225,1)"); gr.addColorStop(0.15, "rgba(255,214,130,0.9)"); gr.addColorStop(0.4, "rgba(255,150,60,0.4)");
    gr.addColorStop(0.7, "rgba(255,110,40,0.1)"); gr.addColorStop(1, "rgba(255,90,30,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); T.hot = ctex(c);
    // flame teardrop
    c = canvas(96, 160); g = c.getContext("2d");
    const flame = (sx, sy, a, col0, col1) => {
      g.save(); g.translate(48, 150); g.scale(sx, sy); g.beginPath();
      g.moveTo(0, 0); g.bezierCurveTo(-34, -6, -40, -54, -8, -92); g.bezierCurveTo(-4, -110, 6, -120, 2, -140);
      g.bezierCurveTo(22, -112, 36, -64, 30, -34); g.bezierCurveTo(26, -10, 14, 0, 0, 0); g.closePath();
      const lg = g.createLinearGradient(0, 0, 0, -140); lg.addColorStop(0, col0); lg.addColorStop(1, col1);
      g.fillStyle = lg; g.globalAlpha = a; g.fill(); g.restore();
    };
    g.filter = "blur(2px)";
    flame(1, 1, 0.8, "rgba(255,150,40,1)", "rgba(255,90,20,0)");
    flame(0.7, 0.8, 0.9, "rgba(255,200,90,1)", "rgba(255,140,40,0)");
    flame(0.4, 0.55, 1, "rgba(255,255,235,1)", "rgba(255,230,150,0)");
    T.flame = ctex(c);
    // four-point glint
    c = canvas(128, 128); g = c.getContext("2d");
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 20);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 2; k++) {
      g.save(); g.translate(64, 64); g.rotate(k * Math.PI / 2 + (k ? 0 : 0));
      const lg = g.createLinearGradient(-64, 0, 64, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, k ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(-64, 0); g.quadraticCurveTo(0, -4, 64, 0); g.quadraticCurveTo(0, 4, -64, 0); g.fill(); g.restore();
    }
    T.star = ctex(c);
    // soft ring (mechanism hint), drawn in the XY plane of a flat plane: a crisp thin ring with a soft halo
    c = canvas(256, 256); g = c.getContext("2d");
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 26; g.filter = "blur(8px)"; g.beginPath(); g.arc(128, 128, 98, 0, TAU); g.stroke();
    g.filter = "none"; g.strokeStyle = "rgba(255,255,255,1)"; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 98, 0, TAU); g.stroke();
    g.setLineDash([2, 26]); g.lineWidth = 14; g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineCap = "round"; g.beginPath(); g.arc(128, 128, 82, 0, TAU); g.stroke();
    T.ring = ctex(c);
    // smoke puff
    c = canvas(64, 64); g = c.getContext("2d");
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(210,196,200,0.8)"); gr.addColorStop(0.5, "rgba(190,176,186,0.35)"); gr.addColorStop(1, "rgba(180,170,185,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); T.smoke = ctex(c);
    // light beam (rotating lighthouse sweep): bright at the centre, long soft tails
    c = canvas(256, 32); g = c.getContext("2d");
    let lg = g.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, "rgba(255,200,120,0)"); lg.addColorStop(0.42, "rgba(255,205,130,0.55)"); lg.addColorStop(0.5, "rgba(255,240,200,1)");
    lg.addColorStop(0.58, "rgba(255,205,130,0.55)"); lg.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = lg; g.fillRect(0, 0, 256, 32);
    const vg = g.createLinearGradient(0, 0, 0, 32); vg.addColorStop(0, "rgba(0,0,0,1)"); vg.addColorStop(0.5, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = vg; g.fillRect(0, 0, 256, 32);
    T.beam = ctex(c);
    // fine noise for bump on stone / wood
    c = canvas(128, 128); g = c.getContext("2d");
    const id = g.createImageData(128, 128), rnd = mulberry32(77);
    for (let i = 0; i < 128 * 128; i++) { const v = 110 + rnd() * 90 | 0; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0); g.filter = "blur(0.6px)"; g.drawImage(c, 0, 0);
    T.noise = ctex(c, false); T.noise.wrapS = T.noise.wrapT = THREE.RepeatWrapping;
    // sun glyph for the pressure plate: returns {map, emissive}
    T.plate = sunGlyph(false); T.plateGlow = sunGlyph(true);
    // clock dial
    T.dial = dialTexture();
    // window pane (warm gradient with muntins)
    T.pane = paneTexture();
    for (const k in T) own.push(T[k]);
  }

  function sunGlyph(glow) {
    const S = 256, c = canvas(S, S), g = c.getContext("2d"), m = S / 2;
    if (glow) { g.fillStyle = "#000"; g.fillRect(0, 0, S, S); }
    else {
      const gr = g.createRadialGradient(m * 0.8, m * 0.8, 10, m, m, m);
      gr.addColorStop(0, "#a89d94"); gr.addColorStop(0.7, "#8f847c"); gr.addColorStop(1, "#6c635f");
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      const id = g.getImageData(0, 0, S, S), rnd = mulberry32(5);
      for (let i = 0; i < S * S; i++) { const k = 0.93 + rnd() * 0.14; id.data[i * 4] *= k; id.data[i * 4 + 1] *= k; id.data[i * 4 + 2] *= k; }
      g.putImageData(id, 0, 0);
    }
    const ink = glow ? "#ff8a2a" : "#4a3f4a", ink2 = glow ? "#ffd27a" : "#2e2530";
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = ink; g.lineWidth = 7;
    g.beginPath(); g.arc(m, m, m * 0.9, 0, TAU); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(m, m, m * 0.8, 0, TAU); g.stroke();
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU, long = i % 2 === 0, r0 = m * 0.4, r1 = m * (long ? 0.74 : 0.6), w = long ? 0.11 : 0.07;
      g.fillStyle = long ? ink2 : ink;
      g.beginPath(); g.moveTo(m + Math.cos(a - w) * r0, m + Math.sin(a - w) * r0); g.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1);
      g.lineTo(m + Math.cos(a + w) * r0, m + Math.sin(a + w) * r0); g.closePath(); g.fill();
    }
    g.fillStyle = ink2; g.beginPath(); g.arc(m, m, m * 0.34, 0, TAU); g.fill();
    g.fillStyle = glow ? "#ffc070" : "#8a7f78"; g.beginPath(); g.arc(m, m, m * 0.27, 0, TAU); g.fill();
    g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.arc(m, m, m * 0.18, 0, TAU); g.stroke();
    return ctex(c, !glow);
  }

  function dialTexture() {
    const S = 256, c = canvas(S, S), g = c.getContext("2d"), m = S / 2;
    const gr = g.createRadialGradient(m, m * 0.9, 10, m, m, m);
    gr.addColorStop(0, "#f7ecd0"); gr.addColorStop(1, "#d8c498");
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, m, 0, TAU); g.fill();
    g.strokeStyle = "#6b4a1f"; g.fillStyle = "#4a3016"; g.lineCap = "round";
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * TAU, big = i % 5 === 0; g.lineWidth = big ? 4 : 1.5;
      g.beginPath(); g.moveTo(m + Math.cos(a) * m * (big ? 0.76 : 0.82), m + Math.sin(a) * m * (big ? 0.76 : 0.82));
      g.lineTo(m + Math.cos(a) * m * 0.9, m + Math.sin(a) * m * 0.9); g.stroke();
    }
    g.font = "bold 26px serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const rom = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU - Math.PI / 2; g.fillText(rom[i], m + Math.cos(a) * m * 0.6, m + Math.sin(a) * m * 0.6); }
    g.strokeStyle = "rgba(107,74,31,0.5)"; g.lineWidth = 2; g.beginPath(); g.arc(m, m, m * 0.95, 0, TAU); g.stroke();
    return ctex(c);
  }

  function paneTexture() {
    const W = 128, H = 192, c = canvas(W, H), g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#ffe9a8"); gr.addColorStop(0.45, "#ffc766"); gr.addColorStop(1, "#ff9a3e");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H * 0.55, 4, W / 2, H * 0.55, W * 0.8);
    rg.addColorStop(0, "rgba(255,255,230,0.85)"); rg.addColorStop(1, "rgba(255,255,230,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#2b1a10"; g.lineWidth = 5; g.beginPath();
    g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); g.moveTo(0, H * 0.27); g.lineTo(W, H * 0.27); g.stroke();
    return ctex(c);
  }

  // stylised cloth for banners (swallowtail, emblem, trim)
  const clothCache = {};
  function clothTexture(colorName) {
    if (clothCache[colorName]) return clothCache[colorName];
    const pal = {
      crimson: ["#8f2d45", "#6a1d33", "#f0c060"], teal: ["#2f7d86", "#1d5560", "#f0c060"],
      plum: ["#6b3a7a", "#46244f", "#ffd27a"], gold: ["#c8963e", "#8c6428", "#4a2c1a"], indigo: ["#3b4a8a", "#27325f", "#ffd27a"],
    }[colorName] || ["#8f2d45", "#6a1d33", "#f0c060"];
    const W = 128, H = 256, c = canvas(W, H), g = c.getContext("2d");
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.moveTo(4, 0); g.lineTo(W - 4, 0); g.lineTo(W - 4, H - 46); g.lineTo(W / 2, H - 4); g.lineTo(4, H - 46); g.closePath();
    const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, pal[0]); lg.addColorStop(1, pal[1]);
    g.fillStyle = lg; g.fill(); g.save(); g.clip();
    g.globalAlpha = 0.18; g.strokeStyle = "#000";                       // weave
    for (let y = 0; y < H; y += 3) { g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.globalAlpha = 1; g.restore();
    g.strokeStyle = pal[2]; g.lineWidth = 5; g.beginPath();            // gold trim
    g.moveTo(14, 8); g.lineTo(14, H - 56); g.lineTo(W / 2, H - 16); g.lineTo(W - 14, H - 56); g.lineTo(W - 14, 8); g.stroke();
    g.fillStyle = pal[2]; g.fillRect(4, 0, W - 8, 10);
    // sun emblem
    g.translate(W / 2, 96); g.fillStyle = pal[2]; g.strokeStyle = pal[2]; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, -17); g.lineTo(5, -36); g.lineTo(-5, -36); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill(); g.fillStyle = pal[1]; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
    const t = ctex(c); clothCache[colorName] = t; own.push(t); return t;
  }

  // ------------------------------------------------------------------------------------------------ procedural environment (PBR metals need something to reflect)
  function makeEnvMap() {
    // painted dusk cube map (warm horizon, violet zenith, a bright sun blob): enough for brass and glass to read as metal
    try {
      if (window.__noenv) throw new Error("env disabled");
      const S = 64, faces = [];
      for (let f = 0; f < 6; f++) {
        const c = canvas(S, S), g = c.getContext("2d");
        if (f === 2) { const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.75); gr.addColorStop(0, "#5b4aa0"); gr.addColorStop(1, "#2a2468"); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
        else if (f === 3) { g.fillStyle = "#3a2540"; g.fillRect(0, 0, S, S); }
        else {
          const gr = g.createLinearGradient(0, 0, 0, S);
          gr.addColorStop(0, "#3d3b86"); gr.addColorStop(0.35, "#8a5a98"); gr.addColorStop(0.5, "#ffb070"); gr.addColorStop(0.58, "#ff9a6a"); gr.addColorStop(0.7, "#5a3358"); gr.addColorStop(1, "#3a2540");
          g.fillStyle = gr; g.fillRect(0, 0, S, S);
          if (f === 4 || f === 1) {  // sun side: nx and pz
            const rg = g.createRadialGradient(f === 4 ? S * 0.2 : S * 0.8, S * 0.38, 1, f === 4 ? S * 0.2 : S * 0.8, S * 0.38, S * 0.45);
            rg.addColorStop(0, "rgba(255,244,210,1)"); rg.addColorStop(0.3, "rgba(255,190,110,0.8)"); rg.addColorStop(1, "rgba(255,150,80,0)");
            g.fillStyle = rg; g.fillRect(0, 0, S, S);
          }
          if (f === 0 || f === 5) { const rg = g.createRadialGradient(S * 0.5, S * 0.3, 1, S * 0.5, S * 0.3, S * 0.4); rg.addColorStop(0, "rgba(120,160,255,0.5)"); rg.addColorStop(1, "rgba(120,160,255,0)"); g.fillStyle = rg; g.fillRect(0, 0, S, S); }
        }
        faces.push(c);
      }
      const ct = new THREE.CubeTexture(faces); ct.encoding = THREE.sRGBEncoding; ct.generateMipmaps = true; ct.minFilter = THREE.LinearMipmapLinearFilter; ct.needsUpdate = true;
      M._envTex = ct; own.push(ct);
    } catch (e) { warn("env map failed", e); M._envTex = null; }
  }

  function makeMaterials() {
    const env = M._envTex;
    M.metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.34, envMap: env, envMapIntensity: 1.25 });
    if (!env) { M.metal.metalness = 0.55; M.metal.roughness = 0.45; }
    M.matte = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.78, envMap: env, envMapIntensity: 0.5 });
    M.glass = new THREE.MeshStandardMaterial({ color: lin(0xcfe6f2), metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.3, envMap: env, envMapIntensity: 1.8, depthWrite: false });
    M.dial = new THREE.MeshStandardMaterial({ map: T.dial, metalness: 0.1, roughness: 0.6 });
    for (const k of ["metal", "matte", "glass", "dial"]) own.push(M[k]);
  }

  // ------------------------------------------------------------------------------------------------ Builder: merge parts per material
  const _o = { o: null };
  function tmpObj() { return _o.o || (_o.o = new THREE.Object3D()); }

  function Builder(opts) {
    this.parts = {};
    this.ao = opts && opts.ao !== undefined ? opts.ao : 0.28;   // vertical ambient darkening height (0 = off)
    this.a0 = opts && opts.a0 !== undefined ? opts.a0 : 0.72;
  }
  // add a geometry under material key `key`; o: {p:[x,y,z], r:[rx,ry,rz], s:n|[x,y,z], c:hex}
  Builder.prototype.add = function (key, geom, o) {
    o = o || {};
    const ob = tmpObj();
    ob.position.set(0, 0, 0); ob.rotation.set(0, 0, 0); ob.scale.set(1, 1, 1); ob.quaternion.identity();
    if (o.p) ob.position.set(o.p[0], o.p[1], o.p[2]);
    if (o.q) ob.quaternion.copy(o.q); else if (o.r) ob.rotation.set(o.r[0], o.r[1], o.r[2]);
    if (o.s !== undefined) { if (typeof o.s === "number") ob.scale.set(o.s, o.s, o.s); else ob.scale.set(o.s[0], o.s[1], o.s[2]); }
    ob.updateMatrix(); geom.applyMatrix4(ob.matrix);
    let g = geom;
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, col = new Float32Array(n * 3), pos = g.attributes.position.array;
    const base = lin(o.c !== undefined ? o.c : 0xffffff);
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (this.ao > 0) k = this.a0 + (1 - this.a0) * smooth(pos[i * 3 + 1] / this.ao);
      col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    (this.parts[key] || (this.parts[key] = [])).push(g);
    return this;
  };
  Builder.prototype.cyl = function (key, rt, rb, h, seg, o) { return this.add(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1), o); };
  Builder.prototype.box = function (key, w, h, d, o) { return this.add(key, new THREE.BoxGeometry(w, h, d), o); };
  Builder.prototype.sph = function (key, r, o, ws, hs) { return this.add(key, new THREE.SphereGeometry(r, ws || 14, hs || 10), o); };
  Builder.prototype.tor = function (key, R, r, o, seg, tseg) { return this.add(key, new THREE.TorusGeometry(R, r, tseg || 6, seg || 24), o); };
  Builder.prototype.lat = function (key, pts, o, seg) { return this.add(key, new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 20), o); };
  Builder.prototype.tube = function (key, pts, r, o, seg, closed, rseg) {
    const v = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = v.length === 2 ? new THREE.LineCurve3(v[0], v[1]) : new THREE.CatmullRomCurve3(v, !!closed, "catmullrom", 0.5);
    return this.add(key, new THREE.TubeGeometry(curve, seg || 16, r, rseg || 6, !!closed), o);
  };
  // rod between two points (cylinder)
  Builder.prototype.rod = function (key, a, b, r, seg, c, caps) {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const d = B.clone().sub(A), len = d.length(); if (len < 1e-5) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const m = A.add(B).multiplyScalar(0.5);
    return this.add(key, new THREE.CylinderGeometry(r, r, len, seg || 6, 1, caps === false), { p: [m.x, m.y, m.z], q, c });
  };
  // merge each material's parts into one mesh and add to parent. mats: per-prop material overrides
  Builder.prototype.finish = function (parent, mats, flags) {
    const out = {};
    for (const key of Object.keys(this.parts)) {
      const geoms = this.parts[key];
      let merged;
      if (THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries) merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geoms, false);
      if (!merged) {
        // fallback: draw each part separately
        for (const g of geoms) { const m = new THREE.Mesh(g, (mats && mats[key]) || M[key]); parent.add(m); }
        continue;
      }
      const mat = (mats && mats[key]) || M[key];
      const mesh = new THREE.Mesh(merged, mat);
      const f = (flags && flags[key]) || {};
      mesh.castShadow = f.cast !== undefined ? f.cast : !(key === "glass" || (mat && mat.transparent));
      mesh.receiveShadow = f.receive !== undefined ? f.receive : true;
      mesh.name = key;
      parent.add(mesh); out[key] = mesh;
      for (const g of geoms) g.dispose();
    }
    this.parts = {};
    return out;
  };

  // ------------------------------------------------------------------------------------------------ sprites and helpers
  function glowSprite(env, color, size, opacity, tex) {
    const m = new THREE.SpriteMaterial({ map: tex || T.glow, color: lin(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity === undefined ? 1 : opacity, fog: false });
    env.own.push(m);
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.renderOrder = 3; return s;
  }
  // flat additive glow plane (lies in the local XZ plane facing +y, or XY plane facing +z when vertical)
  function flatGlow(env, color, w, h, opacity, vertical, tex) {
    const m = new THREE.MeshBasicMaterial({ map: tex || T.glow, color: lin(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity === undefined ? 1 : opacity, side: THREE.DoubleSide });
    env.own.push(m);
    const g = new THREE.PlaneGeometry(w, h); env.ownG.push(g);
    const mesh = new THREE.Mesh(g, m); if (!vertical) mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 2; return mesh;
  }


  // ------------------------------------------------------------------------------------------------ billboard batches
  // One mesh of camera-facing quads (glows, glints, flames, smoke, foam) with per-quad position, size, colour, alpha, kind
  // and rotation. A whole prop's sprites cost ONE draw call. Kinds index a 3x2 atlas: 0 glow, 1 hot, 2 star, 3 smoke, 4 flame.
  // `add` 1 = additive, 0 = normal alpha blending (premultiplied blend state). Each batch owns a material so the engine's
  // static baker never merges it.
  let BOARD_TEX = null;
  function boardTexture() {
    if (BOARD_TEX) return BOARD_TEX;
    const c = canvas(384, 256), g = c.getContext("2d"), src = [T.glow, T.hot, T.star, T.smoke, T.flame];
    src.forEach((t, i) => { try { g.drawImage(t.image, (i % 3) * 128, Math.floor(i / 3) * 128, 128, 128); } catch (e) { /* ignore */ } });
    BOARD_TEX = new THREE.CanvasTexture(c); BOARD_TEX.generateMipmaps = false; BOARD_TEX.minFilter = THREE.LinearFilter; BOARD_TEX.magFilter = THREE.LinearFilter;
    own.push(BOARD_TEX); return BOARD_TEX;
  }
  const BOARD_VS = [
    "attribute vec2 corner; attribute vec2 size; attribute vec4 color; attribute vec3 misc;",
    "varying vec2 vUv; varying vec4 vCol; varying float vAdd;",
    "void main(){",
    "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  float sc = length(modelViewMatrix[0].xyz);",
    "  float cr = cos(misc.z), sr = sin(misc.z);",
    "  vec2 o = vec2(corner.x*cr - corner.y*sr, corner.x*sr + corner.y*cr) * size * 0.5 * sc;",
    "  mv.xy += o; gl_Position = projectionMatrix * mv;",
    "  float k = floor(misc.x + 0.5); float col = mod(k, 3.0), row = floor(k / 3.0);",
    "  vec2 q = corner * 0.5 + 0.5;",
    "  vUv = vec2((col + q.x) / 3.0, 1.0 - (row + 1.0 - q.y) / 2.0);",
    "  vCol = color; vAdd = misc.y; }",
  ].join("\n");
  const BOARD_FS = [
    "uniform sampler2D map; varying vec2 vUv; varying vec4 vCol; varying float vAdd;",
    "void main(){",
    "  vec4 t = texture2D(map, vUv); float a = t.a * vCol.a; if (a < 0.002) discard;",
    "  gl_FragColor = vec4(pow(t.rgb, vec3(2.2)) * vCol.rgb, 1.0);",
    "  #include <tonemapping_fragment>",
    "  #include <encodings_fragment>",
    "  gl_FragColor = vec4(gl_FragColor.rgb * a, a * (1.0 - vAdd)); }",
  ].join("\n");

  function makeBoard(env, n) {
    const geo = new THREE.BufferGeometry(), A = (k) => new Float32Array(n * 4 * k);
    const pos = A(3), cor = A(2), siz = A(2), col = A(4), mis = A(3), idx = [];
    const cx = [-1, 1, 1, -1], cy = [-1, -1, 1, 1];
    for (let i = 0; i < n; i++) {
      for (let v = 0; v < 4; v++) { cor[(i * 4 + v) * 2] = cx[v]; cor[(i * 4 + v) * 2 + 1] = cy[v]; }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    const attrs = {
      position: new THREE.BufferAttribute(pos, 3), corner: new THREE.BufferAttribute(cor, 2), size: new THREE.BufferAttribute(siz, 2),
      color: new THREE.BufferAttribute(col, 4), misc: new THREE.BufferAttribute(mis, 3),
    };
    for (const k of Object.keys(attrs)) { if (k !== "corner") attrs[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, attrs[k]); }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: boardTexture() } }, vertexShader: BOARD_VS, fragmentShader: BOARD_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    env.own.push(mat); env.ownG.push(geo);
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = "board";
    const B = {
      mesh, n, dirty: true,
      // quad i: position, size (w,h), colour hex, alpha, kind, additive (1/0), rotation
      set(i, x, y, z, w, h, color, a, kind, add, rot) {
        B.pos(i, x, y, z); B.size(i, w, h); B.tint(i, color); B.alpha(i, a);
        for (let v = 0; v < 4; v++) { const o = (i * 4 + v) * 3; mis[o] = kind || 0; mis[o + 1] = add === undefined ? 1 : add; mis[o + 2] = rot || 0; }
      },
      pos(i, x, y, z) { for (let v = 0; v < 4; v++) { const o = (i * 4 + v) * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; } B.dirty = true; },
      size(i, w, h) { for (let v = 0; v < 4; v++) { const o = (i * 4 + v) * 2; siz[o] = w; siz[o + 1] = h; } B.dirty = true; },
      tint(i, hex) { const c = lin(hex); for (let v = 0; v < 4; v++) { const o = (i * 4 + v) * 4; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; } B.dirty = true; },
      alpha(i, a) { for (let v = 0; v < 4; v++) col[(i * 4 + v) * 4 + 3] = a; B.dirty = true; },
      rot(i, r) { for (let v = 0; v < 4; v++) mis[(i * 4 + v) * 3 + 2] = r; B.dirty = true; },
      // upload changes; hides the whole batch when nothing is visible
      flush() {
        if (!B.dirty) return; B.dirty = false;
        for (const k of ["position", "size", "color", "misc"]) attrs[k].needsUpdate = true;
        let any = false; for (let i = 0; i < n; i++) if (col[i * 16 + 3] > 0.003) { any = true; break; }
        mesh.visible = any;
      },
    };
    return B;
  }

  // pulsing handle ring: lies flat in the local XZ plane (the handle axis is local y)
  function addHint(env, radius, y) {
    const m = new THREE.MeshBasicMaterial({ map: T.ring, color: lin(0xffc24a), depthWrite: false, depthTest: false, transparent: true, opacity: 0.8 });
    env.own.push(m);
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2); env.ownG.push(g);
    const ring = new THREE.Mesh(g, m); ring.rotation.x = -Math.PI / 2; ring.position.y = y; ring.renderOrder = 9;
    env.root.add(ring);
    const st = { on: true, hover: 0, hoverT: 0, base: radius };
    const ud = env.ud;
    ud.hint = true;
    ud.setHint = (on) => { st.on = !!on; ud.hint = st.on; ring.visible = st.on || st.hoverT > 0.02; };
    ud.setHover = (on) => { st.hover = on ? 1 : 0; };
    env.upd((dt, t) => {
      st.hoverT += (st.hover - st.hoverT) * Math.min(1, dt * 10);
      const vis = st.on || st.hoverT > 0.02;
      ring.visible = vis; if (!vis) return;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
      const s = 1 + (st.on ? 0.07 * pulse : 0) + st.hoverT * 0.06;
      ring.scale.set(s, s, s);
      m.opacity = (st.on ? 0.42 + 0.4 * pulse : 0.2) + st.hoverT * 0.4;
    });
    return ring;
  }

  const DIRS = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };

  // ------------------------------------------------------------------------------------------------ atlases (plant cut-outs)
  const atlases = {};   // name -> { tex, rects: {id: [x,y,w,h]}, size: [w,h], names: [...] }
  const ATLAS_NAMES = ["ivy", "vines", "plants", "flowers"];

  function loadAtlas(name) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (a) => { if (!done) { done = true; resolve(a); } };
      try {
        fetch(BASE + name + ".json").then(r => { if (!r.ok) throw new Error("http " + r.status); return r.json(); }).then(json => {
          new THREE.TextureLoader().load(BASE + name + ".webp", (tex) => {
            tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; tex.flipY = true;
            const size = json._size; const rects = {}; const names = [];
            for (const k of Object.keys(json)) if (k !== "_size") { rects[k] = json[k]; names.push(k); }
            fin({ tex, rects, size, names, real: true });
          }, undefined, () => fin(null));
        }).catch(() => fin(null));
      } catch (e) { fin(null); }
      setTimeout(() => fin(null), 8000);
    });
  }

  // procedural fallback atlases: leaves and flowers drawn on canvas, same rect format
  function procAtlas(name) {
    const W = 1024, cw = 256, cols = 4, rows = 2, H = cw * rows, c = canvas(W, H), g = c.getContext("2d");
    const rects = {}, names = [], rnd = mulberry32(name.length * 991 + 7);
    const leaf = (x, y, len, ang, col, wd) => {
      g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(len * 0.5, -len * wd, len, 0); g.quadraticCurveTo(len * 0.5, len * wd, 0, 0); g.fill();
      g.strokeStyle = "rgba(255,255,200,0.25)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.9, 0); g.stroke(); g.restore();
    };
    const greens = ["#2f5a22", "#3f7a2a", "#587f2c", "#7a9a38", "#9bb246"];
    const count = name === "vines" ? 6 : 8;
    for (let i = 0; i < count; i++) {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * cw, nm = { ivy: "ivy-", vines: "vine-", plants: ["pot-fern", "pot-shrub", "pot-succ", "pot-herb", "canopy-1", "canopy-2", "tuft", "fern"][i], flowers: "flower-" }[name];
      const id = typeof nm === "string" && nm.endsWith("-") ? nm + (i + 1) : nm;
      let rw = cw - 8, rh = cw - 8;
      if (name === "vines") { rw = 100; rh = cw - 8; }
      g.save(); g.beginPath(); g.rect(cx + 4, cy + 4, rw, rh); g.clip(); g.translate(cx + 4, cy + 4);
      if (name === "vines") {
        g.strokeStyle = "#5a3d20"; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 0);
        for (let y = 0; y < rh; y += 8) g.lineTo(50 + Math.sin(y * 0.08 + i) * 14, y); g.stroke();
        for (let y = 6; y < rh - 10; y += 14) { const x = 50 + Math.sin(y * 0.08 + i) * 14; leaf(x, y, 22 + rnd() * 10, (rnd() < 0.5 ? 0.5 : Math.PI - 0.5) + rnd() * 0.5, greens[(rnd() * 5) | 0], 0.5); }
      } else if (name === "flowers") {
        g.strokeStyle = "#2f6a2a"; g.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          const x = 60 + k * 60 + rnd() * 20, top = 40 + rnd() * 50; g.beginPath(); g.moveTo(x, rh); g.quadraticCurveTo(x + 10, rh * 0.5, x, top); g.stroke();
          leaf(x, rh - 4, 50, -2.4, "#2f6a2a", 0.3); leaf(x, rh - 4, 50, -0.7, "#3a7a30", 0.3);
          const gr = g.createRadialGradient(x, top, 1, x, top, 30); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, "#6ff3ff"); gr.addColorStop(1, "rgba(80,200,255,0)");
          g.fillStyle = gr; g.beginPath(); g.arc(x, top, 30, 0, TAU); g.fill();
        }
      } else {
        const ox = rw / 2, oy = name === "plants" && i < 4 ? rh * 0.55 : rh * 0.95;
        if (name === "plants" && i < 4) { g.fillStyle = i % 2 ? "#3a8d7d" : "#b5603a"; g.beginPath(); g.moveTo(ox - 50, oy); g.lineTo(ox + 50, oy); g.lineTo(ox + 36, rh - 6); g.lineTo(ox - 36, rh - 6); g.fill(); }
        const n = name === "ivy" ? 46 : 60;
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (rnd() - 0.5) * (name === "ivy" ? 3.1 : 2.4), l = 26 + rnd() * 34;
          const px = ox + (rnd() - 0.5) * (name === "ivy" ? 150 : 60), py = oy - rnd() * (name === "ivy" ? 80 : 30);
          leaf(px, py, l, a, greens[(rnd() * 5) | 0], 0.45);
        }
      }
      g.restore();
      rects[id] = [cx + 4, cy + 4, rw, rh]; names.push(id);
    }
    const tex = ctex(c); tex.flipY = true;
    return { tex, rects, size: [W, H], names, real: false };
  }

  // ------------------------------------------------------------------------------------------------ plant cards
  const WIND = { value: 0 };
  function makeCardMats() {
    const mk = (atlas, unlit, hang) => {
      if (!atlas) return null;
      const o = { map: atlas.tex, alphaTest: unlit ? 0.42 : 0.45, side: THREE.DoubleSide, vertexColors: true };
      const m = unlit ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o);
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = WIND;
        const wf = hang ? "max(0.0, 0.62 - position.y)" : "max(0.0, position.y)";
        sh.vertexShader = "uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>",
          "vec3 transformed = vec3(position); float wf = " + wf + ";" +
          "transformed.x += sin(uWind*1.5 + position.y*2.0 + position.z*3.0 + position.x*2.0)*0.02*wf;" +
          "transformed.z += cos(uWind*1.2 + position.x*3.0 + position.y*1.5)*0.015*wf;");
      };
      m.customProgramCacheKey = () => "dcw" + (hang ? 1 : 0) + (unlit ? 1 : 0);
      own.push(m); return m;
    };
    M.c_ivy = mk(atlases.ivy, false, true); M.c_vines = mk(atlases.vines, false, true);
    M.c_plants = mk(atlases.plants, false, false); M.c_flowers = mk(atlases.flowers, true, false);
  }

  // add a cut-out card from atlas `an` (key c_<an>) to builder b.
  // o: { p:[x,y,z], ry, rx, rz, anchor:'b'|'t'|'c', h, flip, k:[k0,k1] (brightness bottom->top), tint }
  function card(b, an, id, w, o) {
    const at = atlases[an]; if (!at || !at.rects[id]) return;
    const r = at.rects[id], W = at.size[0], H = at.size[1];
    const h = o.h || w * r[3] / r[2];
    const g = new THREE.PlaneGeometry(w, h, 1, 2);
    const uv = g.attributes.uv, pos = g.attributes.position;
    const fr = [];
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i), v = uv.getY(i);
      fr.push(o.flip ? 1 - v : v);
      if (o.flip) v = 1 - v;
      uv.setXY(i, (r[0] + u * r[2]) / W, 1 - (r[1] + (1 - v) * r[3]) / H);
    }
    const dy = o.anchor === "t" ? -h / 2 : o.anchor === "c" ? 0 : h / 2;
    g.translate(0, dy, 0);
    const key = "c_" + an;
    b.add(key, g, { p: o.p, r: [o.rx || 0, o.ry || 0, o.rz || 0], c: o.tint !== undefined ? o.tint : 0xffffff });
    const gg = b.parts[key][b.parts[key].length - 1], col = gg.attributes.color;
    const k0 = o.k ? o.k[0] : 0.6, k1 = o.k ? o.k[1] : 1.05, nIdx = pos.count;
    // after toNonIndexed the vertex order changed: derive the fraction from the stored geometry-local y
    const srcIdx = g.index ? null : null; void srcIdx; void nIdx;
    const gp = gg.attributes.position;
    // brightness from height inside the card: use world-ish y relative to the card via min/max
    let mn = 1e9, mx = -1e9; for (let i = 0; i < gp.count; i++) { const y = gp.getY(i); mn = Math.min(mn, y); mx = Math.max(mx, y); }
    const rngY = Math.max(1e-4, mx - mn);
    for (let i = 0; i < gp.count; i++) {
      let f = (gp.getY(i) - mn) / rngY; if (o.flip) f = 1 - f;
      const k = lerp(k0, k1, f);
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
  }
  // upright cut-out card turned to face the iso camera
  function cross(b, an, id, w, p, ry, o) {
    o = o || {};
    // one billboard facing the iso camera (normal along (1,0,1)): full width on screen, no X-shaped artefacts
    card(b, an, id, w, Object.assign({ p, ry: Math.PI / 4 + (ry % 1 - 0.5) * 0.16, anchor: "b" }, o));
  }

  // ------------------------------------------------------------------------------------------------ registry + frames
  const TYPES = {};
  function def(name, mode, params, fn, opts) { TYPES[name] = Object.assign({ mode, params, build: fn }, opts || {}); }

  function frameFor(d, item) {
    const face = item.face && DIRS[item.face] ? item.face : "+y", n = DIRS[face];
    const Y = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(n[0], n[1], n[2]), q = new THREE.Quaternion();
    const rot = (item.rot || 0) * Math.PI / 180;
    let mode = "floor";
    if (d.mode === "floor") {
      if (face === "-y") q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); else q.setFromUnitVectors(Y, nv);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, rot));
    } else if (face === "+y") { q.setFromAxisAngle(Y, rot); mode = "floor"; }
    else if (face === "-y") { q.setFromAxisAngle(Y, rot); mode = "hang"; }
    else {
      mode = "wall";
      const yaw = { "+z": 0, "+x": Math.PI / 2, "-z": Math.PI, "-x": -Math.PI / 2 }[face];
      q.setFromAxisAngle(Y, yaw);
    }
    return { face, n: nv, q, mode };
  }

  function makeEnv(name, d, item, ctx) {
    const fr = frameFor(d, item), root = new THREE.Group();
    const at = item.at || [0, 0, 0];
    const env = {
      name, item, ctx: ctx || {}, face: fr.face, n: fr.n, q: fr.q, mode: fr.mode, root, ud: root.userData,
      quality: (ctx && ctx.quality) || "high", own: [], ownG: [], upds: [],
      def: d,
      rng: mulberry32(hash3(at[0], at[1], at[2], ((ctx && ctx.seed) | 0) + name.length * 131 + (item.seed | 0))),
      upd(fn) { this.upds.push(fn); },
      seg(n) { return Math.max(6, Math.round(n * (this.quality === "low" ? 0.6 : this.quality === "medium" ? 0.85 : 1))); },
      // world direction -> yaw angle about the local y axis (for rails, pipes, railings)
      yawOf(dirStr) {
        const dv = DIRS[dirStr]; if (!dv) return 0;
        const l = new THREE.Vector3(dv[0], dv[1], dv[2]).applyQuaternion(this.q.clone().invert());
        return Math.atan2(-l.z, l.x);
      },
    };
    root.name = "decor:" + name;
    env.ud.type = name; env.ud.mode = fr.mode;
    return env;
  }
  function placeRoot(env) {
    if (env.def && env.def.world) return;
    const at = env.item.at || [0, 0, 0], n = env.n;
    env.root.position.set(at[0] + 0.5 + 0.5 * n.x, at[1] + 0.5 + 0.5 * n.y, at[2] + 0.5 + 0.5 * n.z);
    env.root.quaternion.copy(env.q);
  }
  function finalizeEnv(env) {
    const ud = env.ud, upds = env.upds;
    ud.update = function (dt, t) { WIND.value = t; for (let i = 0; i < upds.length; i++) upds[i](dt, t); };
    ud.dispose = function () {
      for (const m of env.own) { try { m.dispose(); } catch (e) { /* ignore */ } }
      for (const g of env.ownG) { try { g.dispose(); } catch (e) { /* ignore */ } }
      env.root.traverse(o => { if (o.geometry && !o.userData.sharedGeom) { try { o.geometry.dispose(); } catch (e) { /* ignore */ } } });
    };
  }

  // state ramp helper: smooth lit/unlit transition
  function ramp(init, speed) {
    const s = { t: init ? 1 : 0, v: init ? 1 : 0, speed: speed || 3 };
    s.set = (on, instant) => { s.t = on ? 1 : 0; if (instant) s.v = s.t; };
    s.step = (dt) => { const d = s.t - s.v; if (Math.abs(d) < 1e-4) { s.v = s.t; return false; } s.v += clamp(d, -dt * s.speed, dt * s.speed); return true; };
    return s;
  }
  function flicker(t, ph) { return 1 + 0.07 * Math.sin(t * 9.1 + ph) + 0.05 * Math.sin(t * 23.7 + ph * 2.3) + 0.03 * Math.sin(t * 41 + ph); }

  // ================================================================================================ MECHANISM PARTS
  def("crank", "floor", { hint: "pulsing ring (default true)" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0.2 });
    const S = (n) => env.seg(n);
    // base plate with bolts, bearing housing
    b.tor("metal", 0.47, 0.012, { p: [0, 0.014, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, S(44), 5);   // grab collar (stays after the hint stops)
    b.cyl("metal", 0.28, 0.31, 0.04, S(28), { p: [0, 0.02, 0], c: C.brassDk });
    b.cyl("metal", 0.235, 0.26, 0.035, S(28), { p: [0, 0.0575, 0], c: C.brass });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; b.cyl("metal", 0.02, 0.02, 0.022, 8, { p: [Math.cos(a) * 0.205, 0.085, Math.sin(a) * 0.205], c: C.brassHi }); }
    b.lat("metal", [[0, 0.075], [0.125, 0.075], [0.135, 0.1], [0.11, 0.125], [0.09, 0.14], [0.085, 0.2], [0.105, 0.215], [0.105, 0.245], [0.07, 0.262], [0, 0.262]], { c: C.brass }, S(22));
    b.tor("metal", 0.113, 0.016, { p: [0, 0.105, 0], r: [Math.PI / 2, 0, 0], c: C.patina }, S(22), 6);
    b.finish(W);
    const wheel = new THREE.Group(); wheel.position.y = 0.3; W.add(wheel);
    const wb = new Builder({ ao: 0 });
    wb.tor("metal", 0.34, 0.03, { r: [Math.PI / 2, 0, 0], c: C.brass }, S(44), 8);
    wb.tor("metal", 0.16, 0.02, { r: [Math.PI / 2, 0, 0], c: C.brassDk }, S(28), 6);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, ca = Math.cos(a), sa = Math.sin(a), L = i === 0 ? 0.44 : 0.33;
      wb.rod("metal", [ca * 0.08, 0, sa * 0.08], [ca * L, 0, sa * L], 0.021, 7, C.brass);
      wb.sph("metal", 0.03, { p: [ca * 0.34, 0, sa * 0.34], c: C.brassHi }, 8, 6);
    }
    wb.cyl("metal", 0.11, 0.12, 0.09, S(20), { p: [0, 0, 0], c: C.brassHi });
    wb.sph("metal", 0.07, { p: [0, 0.045, 0], c: C.brass }, 14, 8);
    // wooden grip standing on the end of the long spoke
    wb.cyl("metal", 0.017, 0.017, 0.07, 8, { p: [0.44, 0.03, 0], c: C.ironHi });
    wb.cyl("metal", 0.045, 0.045, 0.02, 12, { p: [0.44, 0.0, 0], c: C.brassDk });
    wb.lat("metal", [[0, 0.02], [0.034, 0.02], [0.044, 0.05], [0.047, 0.11], [0.04, 0.17], [0.03, 0.2], [0, 0.205]], { p: [0.44, 0.0, 0], c: 0xb06e3c }, 14);
    wb.sph("metal", 0.032, { p: [0.44, 0.215, 0], c: C.brassHi }, 10, 8);
    wb.finish(wheel);
    env.ud.spin = (v) => { wheel.rotation.y = -v * Math.PI / 180; };
    env.ud.handleY = 0.3;
    addHint(env, 0.62, 0.05);
  });

  def("wheel", "floor", { hint: "pulsing ring (default true)" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0.25 });
    const S = (n) => env.seg(n);
    b.tor("metal", 0.52, 0.012, { p: [0, 0.014, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, S(44), 5);
    b.lat("matte", [[0.33, 0], [0.33, 0.05], [0.27, 0.09], [0.17, 0.13], [0.15, 0.3], [0.19, 0.34], [0.19, 0.41], [0, 0.41]], { c: C.patina }, S(26));
    b.tor("metal", 0.3, 0.018, { p: [0, 0.07, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, S(30), 6);
    b.tor("metal", 0.165, 0.016, { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, S(24), 6);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; b.cyl("metal", 0.018, 0.018, 0.03, 8, { p: [Math.cos(a) * 0.29, 0.06, Math.sin(a) * 0.29], c: C.brassHi }); }
    b.finish(W);
    const wheel = new THREE.Group(); wheel.position.y = 0.47; W.add(wheel);
    const wb = new Builder({ ao: 0 });
    wb.tor("metal", 0.42, 0.038, { r: [Math.PI / 2, 0, 0], c: C.brassDk }, S(48), 8);
    wb.tor("metal", 0.2, 0.024, { r: [Math.PI / 2, 0, 0], c: C.brass }, S(30), 6);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a);
      wb.rod("metal", [ca * 0.09, 0, sa * 0.09], [ca * 0.4, 0, sa * 0.4], 0.026, 8, C.brass);
      wb.sph("metal", 0.05, { p: [ca * 0.44, 0.012, sa * 0.44], c: C.brassHi }, 10, 8);   // grip knobs on the rim
      wb.sph("metal", 0.03, { p: [ca * 0.2, 0.02, sa * 0.2], c: C.brassHi }, 8, 6);
    }
    wb.cyl("metal", 0.14, 0.16, 0.1, S(20), { p: [0, 0.02, 0], c: C.brass });
    wb.lat("metal", [[0, 0.07], [0.1, 0.07], [0.11, 0.1], [0.07, 0.14], [0.04, 0.17], [0.05, 0.2], [0, 0.21]], { c: C.brassHi }, 16);
    wb.finish(wheel);
    env.ud.spin = (v) => { wheel.rotation.y = -v * Math.PI / 180; };
    env.ud.handleY = 0.47;
    addHint(env, 0.68, 0.06);
  });

  def("lever", "floor", { range: "value span for full travel (default 90)" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0.2 });
    b.tor("metal", 0.36, 0.011, { p: [0, 0.014, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, 36, 5);
    b.box("metal", 0.36, 0.05, 0.26, { p: [0, 0.025, 0], c: C.ironDk });
    b.box("metal", 0.3, 0.03, 0.2, { p: [0, 0.065, 0], c: C.brassDk });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl("metal", 0.016, 0.016, 0.02, 8, { p: [sx * 0.15, 0.09, sz * 0.1], c: C.brassHi });
    // two quadrant plates with a slot between
    const sh = new THREE.Shape(); sh.moveTo(0.24, 0); sh.absarc(0, 0, 0.24, 0, Math.PI, false); sh.lineTo(0.24, 0);
    for (const z of [-0.045, 0.045]) b.add("metal", new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 14 }), { p: [0, 0.08, z - 0.011], c: C.brass });
    for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; b.box("metal", 0.012, 0.035, 0.12, { p: [Math.cos(a) * 0.205, 0.08 + Math.sin(a) * 0.205, 0], r: [0, 0, a], c: C.ironDk }); }
    b.cyl("metal", 0.05, 0.05, 0.14, 14, { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi });
    b.finish(W);
    const arm = new THREE.Group(); arm.position.set(0, 0.08, 0); W.add(arm);
    const ab = new Builder({ ao: 0 });
    ab.cyl("metal", 0.018, 0.022, 0.46, 8, { p: [0, 0.22, 0], c: C.ironHi });
    ab.sph("metal", 0.06, { p: [0, 0.5, 0], c: C.coral }, 14, 10);
    ab.sph("metal", 0.038, { p: [0, -0.1, 0], c: C.brassDk }, 10, 8);
    ab.cyl("metal", 0.03, 0.03, 0.03, 10, { p: [0, 0.4, 0], c: C.brassHi });
    ab.finish(arm);
    const range = P(env.item, "range", 90);
    const set = (v) => { arm.rotation.z = -(clamp(v / range, 0, 1) - 0.5) * 1.35; };
    set(0);
    env.ud.spin = set; env.ud.handleY = 0.55;
    addHint(env, 0.55, 0.05); W.scale.setScalar(1.15);
  });

  def("knob", "floor", {}, (env) => {
    const W = env.root, b = new Builder({ ao: 0.2 });
    b.tor("metal", 0.34, 0.011, { p: [0, 0.014, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, 36, 5);
    b.box("metal", 0.34, 0.05, 0.22, { p: [0, 0.025, 0], c: C.brassDk });
    b.box("metal", 0.26, 0.04, 0.16, { p: [0, 0.07, 0], c: C.brass });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl("metal", 0.015, 0.015, 0.02, 8, { p: [sx * 0.11, 0.1, sz * 0.065], c: C.brassHi });
    b.cyl("metal", 0.05, 0.065, 0.06, 14, { p: [0, 0.12, 0], c: C.brass });
    b.finish(W);
    const k = new THREE.Group(); k.position.y = 0.15; W.add(k);
    const kb = new Builder({ ao: 0 });
    kb.lat("metal", [[0, 0], [0.065, 0], [0.075, 0.03], [0.1, 0.07], [0.13, 0.13], [0.135, 0.19], [0.1, 0.25], [0.05, 0.285], [0, 0.295]], { c: C.brassHi }, env.seg(22));
    for (let i = 0; i < 3; i++) kb.tor("metal", 0.13 - Math.abs(i - 1) * 0.008, 0.012, { p: [0, 0.115 + i * 0.045, 0], r: [Math.PI / 2, 0, 0], c: C.brassDk }, env.seg(22), 6);
    kb.finish(k);
    env.ud.spin = (v) => { k.rotation.y = v * 1.2; };
    env.ud.handleY = 0.3;
    addHint(env, 0.55, 0.05);
  });

  // slider track: runs `len` cells along `dir` (a world direction such as "+x"), starting at this cell
  def("rail", "floor", { len: "cells (3)", dir: "world axis, e.g. '+x'" }, (env) => {
    const len = P(env.item, "len", 3), L = len - 0.1;
    const g = new THREE.Group(); g.rotation.y = env.yawOf(P(env.item, "dir", "+x")); env.root.add(g);
    const b = new Builder({ ao: 0.12 }), x0 = -0.45;
    for (const z of [-0.09, 0.09]) {
      b.box("metal", L, 0.05, 0.06, { p: [x0 + L / 2, 0.05, z], c: C.brass });
      b.box("metal", L, 0.014, 0.04, { p: [x0 + L / 2, 0.082, z], c: C.brassHi });
    }
    b.box("metal", L, 0.012, 0.12, { p: [x0 + L / 2, 0.013, 0], c: C.ironDk });
    b.box("metal", L, 0.03, 0.2, { p: [x0 + L / 2, 0.015, 0], c: C.brassDk });
    const nS = Math.floor(L / 0.5) + 1;
    for (let i = 0; i < nS; i++) {
      const x = x0 + 0.08 + i * ((L - 0.16) / Math.max(1, nS - 1));
      b.box("metal", 0.1, 0.03, 0.3, { p: [x, 0.015, 0], c: C.iron });
      for (const z of [-0.09, 0.09]) b.cyl("metal", 0.017, 0.017, 0.02, 8, { p: [x, 0.09, z], c: C.brassHi });
    }
    for (const sx of [0, 1]) {
      const x = sx ? x0 + L : x0;
      b.box("metal", 0.08, 0.11, 0.26, { p: [x + (sx ? -0.01 : 0.01), 0.055, 0], c: C.brassDk });
      b.box("metal", 0.1, 0.03, 0.28, { p: [x + (sx ? -0.01 : 0.01), 0.125, 0], c: C.brass });
    }
    b.finish(g);
  }, { stat: true });

  // ================================================================================================ LEVEL PARTS
  // chime-stone plate: carved stone slab with a round inset, an orange emissive ring and a small bronze chime on a stone post
  def("plate", "floor", {}, (env) => {
    const W = env.root, b = new Builder({ ao: 0.06 }), S = (n) => env.seg(n);
    const slab = new THREE.Shape(), hw = 0.43, rc = 0.07;
    slab.moveTo(-hw + rc, -hw); slab.lineTo(hw - rc, -hw); slab.quadraticCurveTo(hw, -hw, hw, -hw + rc); slab.lineTo(hw, hw - rc); slab.quadraticCurveTo(hw, hw, hw - rc, hw);
    slab.lineTo(-hw + rc, hw); slab.quadraticCurveTo(-hw, hw, -hw, hw - rc); slab.lineTo(-hw, -hw + rc); slab.quadraticCurveTo(-hw, -hw, -hw + rc, -hw);
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.315, 0, TAU, true); slab.holes.push(hole);
    b.add("matte", new THREE.ExtrudeGeometry(slab, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: S(20) }).rotateX(-Math.PI / 2), { c: 0x5e5668 });
    b.cyl("matte", 0.32, 0.32, 0.01, S(28), { p: [0, 0.01, 0], c: 0x2a2230 });                                  // dark well under the disc
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.box("matte", 0.07, 0.016, 0.07, { p: [Math.cos(a) * 0.38, 0.062, Math.sin(a) * 0.38], r: [0, -a, 0], c: 0xb2a8bc }); }
    // chime post (back corner) with a small bell hanging from a brass arm
    b.cyl("matte", 0.045, 0.06, 0.2, 8, { p: [-0.34, 0.15, -0.34], c: 0x9a90a4 });
    b.cyl("matte", 0.07, 0.07, 0.03, 8, { p: [-0.34, 0.26, -0.34], c: 0xb2a8bc });
    b.rod("metal", [-0.34, 0.25, -0.34], [-0.2, 0.25, -0.2], 0.012, 5, C.brass);
    b.sph("metal", 0.022, { p: [-0.2, 0.25, -0.2], c: C.brassHi }, 6, 5);
    b.finish(W);
    // chime (swings when the plate is pressed)
    const chime = new THREE.Group(); chime.position.set(-0.2, 0.245, -0.2); W.add(chime);
    const cb = new Builder({ ao: 0 });
    cb.lat("metal", [[0, 0], [0.012, 0], [0.02, -0.02], [0.04, -0.07], [0.052, -0.1], [0.048, -0.105], [0.03, -0.09], [0, -0.09]], { c: C.bronze }, 10);
    cb.sph("metal", 0.012, { p: [0, -0.1, 0], c: C.brassHi }, 6, 5);
    cb.finish(chime);
    // sinking stone disc with the sun glyph
    const top = new THREE.Group(); top.position.y = 0.06; W.add(top);
    const dm = new THREE.MeshStandardMaterial({ map: T.plate, emissiveMap: T.plateGlow, emissive: new THREE.Color(1, 0.55, 0.15), emissiveIntensity: 0, metalness: 0.1, roughness: 0.75, envMap: M._envTex, envMapIntensity: 0.5 });
    env.own.push(dm);
    const dgeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, S(36)); env.ownG.push(dgeo);
    const disc = new THREE.Mesh(dgeo, dm); disc.position.y = -0.03; disc.receiveShadow = true; top.add(disc);   // glyph reads from the top cap UVs
    // orange emissive ring in the groove (always faintly lit so plates are recognisable; blazes when pressed)
    const rg = new THREE.TorusGeometry(0.322, 0.024, 6, S(48)); env.ownG.push(rg);
    const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.4, 0.06) }); env.own.push(rm);
    const ring = new THREE.Mesh(rg, rm); ring.rotation.x = Math.PI / 2; ring.position.y = 0.056; W.add(ring);
    const halo = flatGlow(env, 0xff8a30, 1.4, 1.4, 0); halo.position.y = 0.014; W.add(halo);
    const st = ramp(false, 5), ph = env.rng() * TAU; let swing = 0;
    const apply = (t) => {
      const v = smooth(st.v);
      top.position.y = 0.06 - 0.04 * v;
      dm.emissiveIntensity = 0.04 + v * 1.4;
      const k = 0.55 + 0.2 * Math.sin(t * 2 + ph);
      rm.color.setRGB(lerp(1.35 * k, 2.4, v), lerp(0.22 * k, 0.55, v), lerp(0.02 * k, 0.05, v));
      halo.material.opacity = v * 0.45; halo.visible = v > 0.01;
    };
    env.ud.press = (on, instant) => { const was = env.ud.pressed; st.set(on !== false, instant); env.ud.pressed = on !== false; if (on !== false && !was) swing = 0.7; if (instant) apply(0); };
    env.ud.pressed = false;
    env.upd((dt, t) => { st.step(dt); apply(t); swing = Math.max(0, swing - dt * 0.35); chime.rotation.z = Math.sin(t * 9) * swing * 0.5 + Math.sin(t * 1.3 + ph) * 0.03; chime.rotation.x = Math.cos(t * 8) * swing * 0.3; });
    apply(0);
  });

  def("glimmer", "floor", {}, (env) => {
    // 3 draw calls: crystal core, orbiting shards, and one billboard batch (halo, hot core, glints, burst sparks)
    const W = env.root, g = new THREE.Group(); W.add(g);
    const ph = env.rng() * TAU, low = env.quality === "low";
    const coreM = new THREE.MeshStandardMaterial({ color: lin(0xdffcff), emissive: lin(0x7fe6ff), emissiveIntensity: 1.6, metalness: 0.15, roughness: 0.08, transparent: true, opacity: 0.92, flatShading: true, envMap: M._envTex, envMapIntensity: 1.6 });
    env.own.push(coreM);
    const og = new THREE.OctahedronGeometry(0.1, 0); env.ownG.push(og);
    const core = new THREE.Mesh(og, coreM); core.scale.set(0.8, 1.45, 0.8); g.add(core);
    // the three shards merged into one mesh that orbits as a whole
    const sb = new Builder({ ao: 0 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.09, r = 0.2 + i * 0.03;
      sb.add("shard", new THREE.OctahedronGeometry(0.1, 0), { p: [Math.cos(a) * r, (i - 1) * 0.07, Math.sin(a) * r], r: [i, i * 1.7, 0], s: [0.28, 0.5, 0.28] });
    }
    const shardGroup = new THREE.Group(); g.add(shardGroup);
    sb.finish(shardGroup, { shard: coreM }, { shard: { cast: false } });
    // billboards: 0 halo, 1 hot core, 2..4 glints, 5..18 burst sparks
    const N = 5 + (low ? 0 : 0) + 14, B = makeBoard(env, N); g.add(B.mesh);
    B.set(0, 0, 0, 0, 0.95, 0.95, 0x7fe6ff, 0.55, 0, 1); B.set(1, 0, 0, 0, 0.34, 0.34, 0xffffff, 0.9, 0, 1);
    for (let i = 0; i < 3; i++) B.set(2 + i, 0, 0, 0, 0.3, 0.3, i ? 0xffe9a8 : 0xffffff, 0.8, 2, 1);
    const sparks = [];
    for (let i = 0; i < 14; i++) {
      const a = env.rng() * TAU, e = 0.3 + env.rng() * 0.9;
      B.set(5 + i, 0, 0, 0, 0.2, 0.2, i % 3 ? 0xbff4ff : 0xffe9a8, 0, 2, 1);
      sparks.push({ vx: Math.cos(a) * e * 1.1, vz: Math.sin(a) * e * 1.1, vy: 0.5 + env.rng() * 1.1, sz: 0.14 + env.rng() * 0.18 });
    }
    B.flush();
    let bt = -1; const tmp = new THREE.Vector3();
    env.ud.collected = false;
    env.ud.collect = () => { if (env.ud.collected) return; env.ud.collected = true; bt = 0; };
    env.ud.respawn = () => {
      env.ud.collected = false; bt = -1; g.visible = true; core.scale.set(0.8, 1.45, 0.8); B.size(0, 0.95, 0.95);
      for (let i = 5; i < N; i++) B.alpha(i, 0);
    };
    env.upd((dt, t) => {
      g.position.y = 0.55 + Math.sin(t * 1.7 + ph) * 0.07;
      core.rotation.y = t * 1.1 + ph;
      shardGroup.rotation.y = t * 1.5 + ph; shardGroup.rotation.x = Math.sin(t * 1.9) * 0.25;
      for (let i = 0; i < 3; i++) {
        const a = t * 1.5 + ph + i * 2.09, r = (0.2 + i * 0.03) * 1.5;
        const tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7 + ph);
        B.pos(2 + i, Math.cos(a) * r, (i - 1) * 0.1 + Math.sin(t * 1.9 + i * 2) * 0.1 + 0.05, Math.sin(a) * r);
        B.alpha(2 + i, bt >= 0 ? 0 : tw * tw * 0.9); B.rot(2 + i, t * 0.8 + i);
      }
      if (bt >= 0) {
        bt += dt;
        const k = bt / 0.7;
        const s = bt < 0.14 ? 1 + bt / 0.14 * 0.6 : Math.max(0, 1.6 * (1 - (bt - 0.14) / 0.2));
        core.scale.set(0.8 * s, 1.45 * s, 0.8 * s); shardGroup.scale.setScalar(Math.max(0.001, s));
        B.alpha(0, Math.max(0, 0.55 + (bt < 0.14 ? bt * 4 : 0) - bt * 1.2)); B.alpha(1, Math.max(0, 1 - bt * 3));
        const hs = 0.95 + bt * 2.6; B.size(0, hs, hs);
        for (let i = 0; i < 14; i++) {
          const p = sparks[i], q = 5 + i, z = p.sz * (1 - k * 0.5);
          B.pos(q, p.vx * bt, p.vy * bt - 1.1 * bt * bt, p.vz * bt); B.size(q, z, z); B.alpha(q, Math.max(0, 1 - k) * 0.95); B.rot(q, bt * 3);
        }
        if (k >= 1) { bt = -1; g.visible = false; }
      } else if (!env.ud.collected) { B.alpha(0, 0.45 + 0.15 * Math.sin(t * 3 + ph)); shardGroup.scale.setScalar(1); }
      void tmp; B.flush();
    });
  });

  // ---- lantern geometry shared by lantern / streetlamp
  function addLantern(b, oy, s) {
    const Y = (y) => oy + y * s;
    b.lat("metal", [[0, 0], [0.075, 0], [0.09, 0.02], [0.1, 0.045], [0.1, 0.062], [0.088, 0.075], [0, 0.075]].map(p => [p[0] * s, Y(p[1])]), { c: C.iron }, 8);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU, r = 0.097 * s; b.cyl("metal", 0.011 * s, 0.011 * s, 0.24 * s, 5, { p: [Math.cos(a) * r, Y(0.19), Math.sin(a) * r], c: C.ironHi }); }
    b.lat("lamp", [[0.086, 0.072], [0.098, 0.12], [0.1, 0.2], [0.092, 0.27], [0.084, 0.305]].map(p => [p[0] * s, Y(p[1])]), { c: 0xffffff }, 8);
    b.tor("metal", 0.1 * s, 0.012 * s, { p: [0, Y(0.31), 0], r: [Math.PI / 2, 0, 0], c: C.brass }, 16, 5);
    b.lat("metal", [[0.12, 0.3], [0.113, 0.318], [0.078, 0.352], [0.036, 0.388], [0.015, 0.404], [0.022, 0.413], [0, 0.418]].map(p => [p[0] * s, Y(p[1])]), { c: C.ironHi }, 8);
    b.tor("metal", 0.116 * s, 0.01 * s, { p: [0, Y(0.302), 0], r: [Math.PI / 2, 0, 0], c: C.brassDk }, 16, 5);
    b.sph("metal", 0.02 * s, { p: [0, Y(0.425), 0], c: C.brassHi }, 8, 6);
    b.tor("metal", 0.034 * s, 0.0065 * s, { p: [0, Y(0.46), 0], c: C.brass }, 14, 5);
    return Y(0.17);
  }

  // lit/unlit controller shared by lantern and streetlamp
  function lampRig(env, flamePos, size, lampMat, light) {
    let halo;
    if (env.quality === "low") halo = { material: { opacity: 0 }, visible: false };
    else { halo = glowSprite(env, C.lamp, size * 1.15, 0, T.hot); halo.position.copy(flamePos); env.root.add(halo); }
    const core = { material: { opacity: 0 }, visible: true };
    const wash = flatGlow(env, C.lamp, size * 3.4, size * 3.4, 0, true); wash.visible = false; // soft light bleed (kept off; sprites suffice)
    void wash;
    let pl = null;
    if (light) { pl = new THREE.PointLight(C.lamp, 0, 5.5, 2); pl.position.copy(flamePos); env.root.add(pl); }
    const st = ramp(env.item.lit === true, 3), ph = env.rng() * TAU;
    const apply = (t) => {
      const v = smooth(st.v), f = v > 0 ? flicker(t, ph) : 1;
      lampMat.emissiveIntensity = lerp(0.05, 2.6, v) * (v > 0.5 ? f : 1);
      lampMat.emissive.setRGB(lerp(0.35, 1, v), lerp(0.18, 0.46, v), lerp(0.08, 0.12, v));
      lampMat.color.copy(lin(v > 0.01 ? 0xffc06a : 0x5a4030));
      halo.material.opacity = v * 0.5 * f; core.material.opacity = v * 0.85;
      halo.visible = core.visible = v > 0.005;
      if (pl) pl.intensity = v * 2.4 * f;
    };
    env.ud.setLit = (on, instant) => { st.set(on !== false, instant); env.ud.lit = on !== false; if (instant) apply(0); };
    env.ud.lit = env.item.lit === true;
    env.upd((dt, t) => { st.step(dt); if (st.v > 0 || st.t > 0) apply(t); });
    apply(0);
  }
  function lampMaterial(env) {
    const m = new THREE.MeshStandardMaterial({ color: lin(0x5a4030), emissive: new THREE.Color(0.35, 0.18, 0.08), emissiveIntensity: 0.05, roughness: 0.25, metalness: 0.1, envMap: M._envTex, envMapIntensity: 0.9, flatShading: true });
    env.own.push(m); return m;
  }

  // ---- lantern: wall bracket, standing, or hanging
  def("lantern", "wall", { lit: "start lit (false)", light: "real PointLight (false)" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0 }), S = 1.0;
    let oy, flame;
    if (env.mode === "wall") {
      // iron bracket: back plate, arm with scroll, brace; lantern hangs from the arm end
      const zA = 0.3, yA = 0.3;
      b.box("metal", 0.07, 0.2, 0.025, { p: [0, 0.2, 0.0125], c: C.ironDk });
      for (const y of [0.13, 0.27]) b.cyl("metal", 0.012, 0.012, 0.012, 8, { p: [0, y, 0.03], r: [Math.PI / 2, 0, 0], c: C.brassHi });
      b.tube("metal", [[0, yA, 0.02], [0, yA + 0.012, 0.12], [0, yA + 0.01, zA - 0.02]], 0.013, {}, 10, false, 6);
      b.tube("metal", [[0, 0.14, 0.02], [0, 0.18, 0.1], [0, 0.26, 0.2], [0, yA, zA - 0.04]], 0.009, { c: C.ironHi }, 12);
      b.tor("metal", 0.05, 0.008, { p: [0, yA + 0.05, 0.075], c: C.iron }, 16, 5);    // scroll ring
      b.sph("metal", 0.022, { p: [0, yA, zA], c: C.brass }, 8, 6);
      b.tube("metal", [[0, yA - 0.01, zA], [0, yA - 0.05, zA]], 0.005, { c: C.ironHi }, 2);
      oy = yA - 0.05 - 0.46 * S;
      flame = new THREE.Vector3(0, oy + 0.17 * S, zA);
      const lg = new THREE.Group(); lg.position.set(0, oy, zA); W.add(lg);
      const bl = new Builder({ ao: 0 }); addLantern(bl, 0, S);
      const lm = lampMaterial(env);
      bl.finish(lg, { lamp: lm }, { lamp: { cast: false } });
      b.finish(W);
      lampRig(env, flame, 0.9, lm, !!env.item.light);
      return;
    }
    const lm = lampMaterial(env);
    if (env.mode === "hang") {
      b.tube("metal", [[0, 0, 0], [0, -0.1, 0]], 0.006, { c: C.ironHi }, 2);
      b.tor("metal", 0.025, 0.006, { p: [0, -0.02, 0], c: C.brass }, 12, 5);
      b.tor("metal", 0.025, 0.006, { p: [0, -0.07, 0], r: [0, Math.PI / 2, 0], c: C.brass }, 12, 5);
      oy = -0.1 - 0.46 * S;
    } else {
      b.cyl("metal", 0.12, 0.14, 0.04, 8, { p: [0, 0.02, 0], c: C.ironDk });
      b.cyl("metal", 0.09, 0.11, 0.05, 8, { p: [0, 0.065, 0], c: C.iron });
      b.tor("metal", 0.1, 0.01, { p: [0, 0.09, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, 14, 5);
      oy = 0.09;
    }
    const lg = new THREE.Group(); lg.position.set(0, oy, 0); W.add(lg);
    const bl = new Builder({ ao: 0 }); const fp = addLantern(bl, 0, S);
    bl.finish(lg, { lamp: lm }, { lamp: { cast: false } });
    b.finish(W);
    lampRig(env, new THREE.Vector3(0, oy + fp, 0), 0.9, lm, !!env.item.light);
    if (env.mode === "hang") env.upd((dt, t) => { lg.rotation.z = Math.sin(t * 0.9) * 0.03; });
  });

  def("streetlamp", "floor", { lit: "start lit (false)", light: "real PointLight (false)", h: "post height (1.2)" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0.3 }), h = P(env.item, "h", 1.15);
    b.lat("metal", [[0.2, 0], [0.2, 0.05], [0.15, 0.09], [0.11, 0.16], [0.075, 0.24], [0.06, 0.3], [0.05, 0.36], [0.045, h - 0.1], [0.06, h - 0.08], [0.06, h - 0.04], [0.095, h - 0.02], [0.1, h]], { c: C.ironDk }, 14);
    for (const y of [0.36, h * 0.62]) b.tor("metal", 0.055, 0.015, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, 14, 6);
    b.tor("metal", 0.1, 0.014, { p: [0, 0.16, 0], r: [Math.PI / 2, 0, 0], c: C.brassDk }, 16, 6);
    // scroll arms either side
    for (const sx of [-1, 1]) {
      b.tube("metal", [[sx * 0.04, h * 0.62, 0], [sx * 0.13, h * 0.7, 0], [sx * 0.2, h * 0.82, 0], [sx * 0.15, h * 0.92, 0], [sx * 0.09, h * 0.86, 0]], 0.012, { c: C.iron }, 18);
      b.sph("metal", 0.02, { p: [sx * 0.09, h * 0.86, 0], c: C.brassHi }, 8, 6);
    }
    b.cyl("metal", 0.11, 0.1, 0.03, 10, { p: [0, h + 0.015, 0], c: C.iron });
    const lm = lampMaterial(env), lg = new THREE.Group(); lg.position.y = h + 0.03; W.add(lg);
    const bl = new Builder({ ao: 0 }); const S = 1.35; const fp = addLantern(bl, 0, S);
    bl.finish(lg, { lamp: lm }, { lamp: { cast: false } });
    b.finish(W);
    lampRig(env, new THREE.Vector3(0, h + 0.03 + fp, 0), 1.25, lm, !!env.item.light);
  });

  function archShape(w, h, Cls) {
    const s = new Cls(), hw = w / 2;
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, h - hw); s.absarc(0, h - hw, hw, 0, Math.PI, false); s.lineTo(-hw, 0);
    return s;
  }

  def("window", "wall", { lit: "start lit (false)", w: "0.44", h: "0.7" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0 });
    const w = P(env.item, "w", 0.44), h = P(env.item, "h", 0.7), y0 = -0.32, fw = 0.075;
    const frame = archShape(w + fw * 2, h + fw, THREE.Shape);
    frame.holes.push(archShape(w, h, THREE.Path));
    const fg = new THREE.ExtrudeGeometry(frame, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 12 });
    b.add("matte", fg, { p: [0, y0 - 0.0, -0.002], c: C.sandHi });
    b.box("matte", w + 0.2, 0.045, 0.1, { p: [0, y0 - 0.012, 0.05], c: C.sandHi });
    b.box("matte", w + 0.14, 0.02, 0.11, { p: [0, y0 - 0.04, 0.045], c: C.sandDk });
    b.box("matte", 0.08, 0.07, 0.07, { p: [0, y0 + h + 0.065, 0.045], c: C.sandHi });      // keystone
    b.box("metal", 0.018, h * 0.78, 0.02, { p: [0, y0 + h * 0.39, 0.012], c: C.ironDk });
    b.finish(W);
    // pane
    const pg = archShape(w, h, THREE.Shape); const pgeo = new THREE.ShapeGeometry(pg, 10); env.ownG.push(pgeo);
    const pa = pgeo.attributes.position, pu = pgeo.attributes.uv;
    for (let i = 0; i < pa.count; i++) pu.setXY(i, (pa.getX(i) + w / 2) / w, pa.getY(i) / h);
    const pm = new THREE.MeshBasicMaterial({ map: T.pane, color: new THREE.Color(0.05, 0.06, 0.1) }); env.own.push(pm);
    const pane = new THREE.Mesh(pgeo, pm); pane.position.set(0, y0, 0.01); W.add(pane);
    let wash = null;
    if (env.quality !== "low") { wash = flatGlow(env, C.lamp, w * 2.6, h * 1.9, 0, true); wash.position.set(0, y0 + h * 0.5, 0.06); wash.renderOrder = 2; W.add(wash); }
    const st = ramp(env.item.lit === true, 2.5), ph = env.rng() * TAU;
    const apply = (t) => {
      const v = smooth(st.v), f = v > 0 ? 1 + 0.04 * Math.sin(t * 2.3 + ph) : 1;
      const k = lerp(0.0, 1.0, v);
      pm.color.setRGB(lerp(0.05, 1.45 * f, k), lerp(0.06, 1.0 * f, k), lerp(0.1, 0.55 * f, k));
      if (wash) { wash.material.opacity = v * 0.38; wash.visible = v > 0.01; }
    };
    env.ud.setLit = (on, instant) => { st.set(on !== false, instant); env.ud.lit = on !== false; if (instant) apply(0); };
    env.ud.lit = env.item.lit === true;
    env.upd((dt, t) => { st.step(dt); apply(t); });
    apply(0);
  });

  // ---- beacon: brass cage, glass lens, flame core
  def("beacon", "floor", { size: "scale (1)", lit: "start ignited (false)" }, (env) => {
    const S = P(env.item, "size", 1), W = env.root, b = new Builder({ ao: 0.35 });
    const sg = (n) => env.seg(n);
    // stepped plinth
    b.lat("matte", [[0.5, 0], [0.5, 0.05], [0.44, 0.07], [0.44, 0.13], [0.38, 0.16], [0.38, 0.2], [0.33, 0.23], [0.3, 0.27], [0, 0.27]], { c: C.sandHi }, 8);
    b.lat("metal", [[0.4, 0.2], [0.4, 0.215], [0.36, 0.225], [0.36, 0.2]], { c: C.brass }, 8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; b.cyl("metal", 0.02, 0.02, 0.022, 8, { p: [Math.cos(a) * 0.42, 0.13, Math.sin(a) * 0.42], c: C.brassHi }); }
    b.lat("metal", [[0.31, 0.27], [0.31, 0.3], [0.28, 0.325], [0.26, 0.325], [0.26, 0.27]], { c: C.brassDk }, sg(24));
    // cage ribs bulging round the lens
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const pts = [[0.27, 0.32], [0.34, 0.5], [0.385, 0.8], [0.34, 1.1], [0.25, 1.26]].map(p => [ca * p[0], p[1], sa * p[0]]);
      b.tube("metal", pts, 0.019, { c: C.brass }, 14, false, 6);
    }
    b.tor("metal", 0.285, 0.03, { p: [0, 0.325, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, sg(24), 8);
    b.tor("metal", 0.386, 0.022, { p: [0, 0.8, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, sg(28), 8);
    b.tor("metal", 0.255, 0.03, { p: [0, 1.26, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, sg(24), 8);
    // lens: horizontal fresnel ribs inside the cage
    for (let i = -4; i <= 4; i++) { const y = 0.8 + i * 0.075, r = Math.sqrt(Math.max(0.0004, 0.3 * 0.3 - (i * 0.075) * (i * 0.075))) + 0.02; b.tor("metal", r, 0.008, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, sg(24), 5); }
    // roof: onion dome with ring and finial
    b.lat("metal", [[0.3, 1.27], [0.3, 1.3], [0.27, 1.34], [0.3, 1.42], [0.24, 1.55], [0.12, 1.66], [0.035, 1.74], [0.05, 1.77], [0, 1.8]], { c: C.brassDk }, sg(24));
    b.tor("metal", 0.285, 0.016, { p: [0, 1.325, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, sg(24), 6);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.tube("metal", [[Math.cos(a) * 0.29, 1.34, Math.sin(a) * 0.29], [Math.cos(a) * 0.31, 1.42, Math.sin(a) * 0.31], [Math.cos(a) * 0.245, 1.55, Math.sin(a) * 0.245], [Math.cos(a) * 0.12, 1.66, Math.sin(a) * 0.12], [Math.cos(a) * 0.04, 1.74, Math.sin(a) * 0.04]], 0.01, { c: C.brass }, 10, false, 4); }
    b.sph("metal", 0.05, { p: [0, 1.81, 0], c: C.brassHi }, 12, 8);
    b.cyl("metal", 0.01, 0.003, 0.18, 6, { p: [0, 1.93, 0], c: C.brass });
    b.finish(W);

    // glass lens + flame
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.33, sg(24), sg(16)), M.glass); lens.scale.set(1, 1.1, 1); lens.position.y = 0.8; lens.renderOrder = 1; env.ownG.push(lens.geometry);
    const lensM = M.glass.clone(); lensM.emissive = new THREE.Color(1, 0.4, 0.1); lensM.color = lin(0xffd9a0); lensM.emissiveIntensity = 0; env.own.push(lensM); lens.material = lensM; W.add(lens);
    const flameM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.06, 0.03) }); env.own.push(flameM);
    const fg = new THREE.SphereGeometry(0.1, 14, 10); env.ownG.push(fg);
    const core = new THREE.Mesh(fg, flameM); core.scale.set(1, 1.7, 1); core.position.y = 0.78; W.add(core);
    // all glows, the flame and the rotating glints are one billboard batch; both beams are one mesh
    const low = env.quality === "low", NG = 5, B = makeBoard(env, 3 + NG); W.add(B.mesh);
    B.set(0, 0, 0.8, 0, 3, 3, 0xff9a4a, 0, 0, 1); B.set(1, 0, 0.8, 0, 1.2, 1.2, C.lamp, 0, 1, 1); B.set(2, 0, 0.82, 0, 0.34, 0.56, 0xffc070, 0, 4, 1);
    for (let i = 0; i < NG; i++) B.set(3 + i, 0, 0.8, 0, 0.4, 0.4, i % 2 ? 0xffe9b0 : 0xffffff, 0, 2, 1);
    const bgA = new THREE.PlaneGeometry(4.2, 0.55).rotateX(-Math.PI / 2), bgB = new THREE.PlaneGeometry(2.52, 0.55).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    const bgM = THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries ? THREE.BufferGeometryUtils.mergeBufferGeometries([bgA, bgB], false) : bgA;
    env.ownG.push(bgM);
    const beamM = new THREE.MeshBasicMaterial({ map: T.beam, color: lin(0xffc070), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, side: THREE.DoubleSide }); env.own.push(beamM);
    const beam = new THREE.Mesh(bgM, beamM); beam.position.y = 0.8; beam.renderOrder = 2; W.add(beam);
    const pl = new THREE.PointLight(C.lamp, 0, 9, 2); pl.position.set(0, 0.9, 0.2); W.add(pl);
    const st = ramp(env.item.lit === true, 1.0), ph = env.rng() * TAU;
    const hot = new THREE.Color(1.7, 0.62, 0.12), ember = new THREE.Color(0.2, 0.06, 0.03);
    const apply = (t) => {
      const v = smooth(st.v), f = v > 0 ? flicker(t, ph) : 1;
      const em = 0.1 + 0.05 * Math.sin(t * 1.5 + ph);   // unlit: faint ember hint
      flameM.color.copy(ember).lerp(hot, v).multiplyScalar(v > 0.5 ? f : 1);
      lensM.emissiveIntensity = v * 0.5 * f; lensM.opacity = lerp(0.3, 0.16, v); lensM.envMapIntensity = lerp(1.8, 0.7, v);
      B.alpha(2, v); B.size(2, 0.46 * (0.9 + 0.1 * f) * (0.6 + 0.4 * v), 0.74 * f * (0.6 + 0.5 * v));
      const hs = lerp(0.6, 1.25, v); B.alpha(1, v * 0.5 * f + (1 - v) * em * 0.5); B.size(1, hs, hs);
      const bs = lerp(1.2, 4.2, v) * (0.97 + 0.03 * f); B.alpha(0, low ? 0 : v * 0.42); B.size(0, bs, bs);
      beamM.opacity = v * 0.6; beam.visible = v > 0.02;
      pl.intensity = v * 3.4 * f;
      for (let i = 0; i < NG; i++) {
        const a = t * 0.5 + i * TAU / NG, r = 0.36, tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1), q = 3 + i, sz = 0.28 + 0.24 * tw;
        B.pos(q, Math.cos(a) * r, 0.8 + Math.sin(t * 0.9 + i * 1.7) * 0.2, Math.sin(a) * r);
        B.alpha(q, low ? 0 : v * (0.35 + 0.65 * tw)); B.rot(q, t * 0.6 + i); B.size(q, sz, sz);
      }
      beam.rotation.y = t * 0.7; B.flush();
    };
    env.ud.ignite = (instant) => { st.set(true, instant === true); env.ud.ignited = true; if (instant === true) apply(0); };
    env.ud.extinguish = () => { st.set(false, true); env.ud.ignited = false; apply(0); };
    env.ud.setLit = (on, instant) => { st.set(on !== false, instant); env.ud.ignited = on !== false; if (instant) apply(0); };
    env.ud.ignited = env.item.lit === true;
    env.upd((dt, t) => { st.step(dt); apply(t); });
    apply(0);
    if (S !== 1) W.scale.setScalar(S);
  });

  // ================================================================================================ MACHINERY
  function gearGeom(r, teeth, th, thick, spokes) {
    const s = new THREE.Shape(), n = teeth * 4;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, ph = i % 4, rad = (ph === 1 || ph === 2) ? r + th : r;
      const aa = a + ((ph === 1) ? -0.012 : (ph === 2) ? 0.012 : 0);
      const x = Math.cos(aa) * rad, y = Math.sin(aa) * rad;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    const hubR = r * 0.2, ri = hubR * 1.55, ro = r * 0.8;
    for (let k = 0; k < spokes; k++) {
      const a0 = k / spokes * TAU + 0.12, a1 = (k + 1) / spokes * TAU - 0.12, p = new THREE.Path();
      p.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri); p.absarc(0, 0, ro, a0, a1, false); p.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri); p.absarc(0, 0, ri, a1, a0, true);
      s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.15, bevelSize: thick * 0.15, bevelSegments: 1, curveSegments: 5 });
    g.translate(0, 0, -thick / 2); g.rotateX(-Math.PI / 2);
    return g;
  }

  def("gear", "floor", { r: "radius (0.5)", teeth: "auto", ratio: "spin multiplier (1; negative reverses)", idle: "rad/s turning on its own (0)", tint: "brass|patina|iron" }, (env) => {
    const r = P(env.item, "r", 0.5), teeth = P(env.item, "teeth", Math.max(8, Math.round(r * 30))), tint = P(env.item, "tint", "brass");
    const W = env.root, g = new THREE.Group(); g.position.y = 0.09; W.add(g);
    const body = tint === "iron" ? C.iron : tint === "patina" ? C.patina : C.brass, hub = tint === "brass" ? C.patina : C.brass;
    const b = new Builder({ ao: 0 });
    b.add("metal", gearGeom(r, teeth, r * 0.17, 0.07, 5), { c: body });
    b.cyl("metal", r * 0.2, r * 0.22, 0.1, env.seg(20), { c: hub });
    b.cyl("metal", r * 0.1, r * 0.1, 0.16, 10, { p: [0, 0.03, 0], c: C.brassHi });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; b.cyl("metal", 0.015, 0.015, 0.04, 6, { p: [Math.cos(a) * r * 0.16, 0.06, Math.sin(a) * r * 0.16], c: C.brassHi }); }
    b.tor("metal", r * 0.83, 0.014, { p: [0, 0.035, 0], r: [Math.PI / 2, 0, 0], c: body === C.brass ? C.brassDk : C.brass }, env.seg(40), 5);
    b.finish(g);
    // fixed axle stub + mount on the surface
    const m = new Builder({ ao: 0 }); m.cyl("metal", r * 0.07, r * 0.09, 0.09, 10, { p: [0, 0.045, 0], c: C.ironDk }); m.finish(W);
    const ratio = P(env.item, "ratio", 1), idle = P(env.item, "idle", 0); let a0 = env.rng() * TAU, v = 0, ia = 0;
    const set = () => { g.rotation.y = a0 - (v * Math.PI / 180) * ratio - ia; };
    env.ud.spin = (val) => { v = val; set(); };
    if (idle) env.upd((dt) => { ia += dt * idle; set(); });
    set();
  });

  def("pipe", "floor", { len: "cells (1)", dir: "'+x' ... world axis", path: "optional local points [[x,y,z]..]", r: "radius (0.07)" }, (env) => {
    const rad = P(env.item, "r", 0.07);
    const g = new THREE.Group(); g.rotation.y = env.yawOf(P(env.item, "dir", "+x")); env.root.add(g);
    const b = new Builder({ ao: 0.2 });
    let pts = env.item.path;
    if (!pts) { const L = P(env.item, "len", 1); pts = [[-0.5, rad + 0.03, 0], [L - 0.5, rad + 0.03, 0]]; }
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B2 = pts[i + 1];
      b.rod("metal", A, B2, rad, env.seg(12), C.patina);
      const len = Math.hypot(B2[0] - A[0], B2[1] - A[1], B2[2] - A[2]), n = Math.max(1, Math.round(len / 0.5));
      for (let k = 0; k <= n; k++) {      // flanges and bolts every half cell
        const t = k / n, p = [lerp(A[0], B2[0], t), lerp(A[1], B2[1], t), lerp(A[2], B2[2], t)];
        const d = new THREE.Vector3(B2[0] - A[0], B2[1] - A[1], B2[2] - A[2]).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        if (k === 0 || k === n || k === Math.round(n / 2)) b.add("metal", new THREE.CylinderGeometry(rad * 1.3, rad * 1.3, 0.035, 14), { p, q, c: C.brass });
      }
    }
    for (let i = 1; i < pts.length - 1; i++) b.sph("metal", rad * 1.18, { p: pts[i], c: C.patina }, 12, 8);
    for (let i = 0; i < pts.length; i += pts.length - 1) b.sph("metal", rad * 0.1, { p: pts[i], c: C.brass }, 4, 3);
    // little pressure gauge on the first pipe
    const m = pts[Math.min(1, pts.length - 1)], mid = [(pts[0][0] + m[0]) / 2, pts[0][1] + rad, (pts[0][2] + m[2]) / 2];
    b.cyl("metal", 0.025, 0.03, 0.05, 8, { p: [mid[0], mid[1] + 0.025, mid[2]], c: C.brassDk });
    b.cyl("metal", 0.06, 0.06, 0.03, 14, { p: [mid[0], mid[1] + 0.07, mid[2]], c: C.brass });
    b.finish(g);
    const gm = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), M.dial); gm.rotation.x = -Math.PI / 2; gm.position.set(mid[0], mid[1] + 0.0855, mid[2]); env.ownG.push(gm.geometry); g.add(gm);
  }, { stat: true });

  def("clock", "wall", { r: "radius (0.3)" }, (env) => {
    const r = P(env.item, "r", 0.3), W = env.root, b = new Builder({ ao: 0 });
    let zc = 0.07, yc = 0;
    if (env.mode !== "wall") {            // standing / hanging: a short brass stand carries the face
      yc = env.mode === "hang" ? -r - 0.2 : r + 0.22; zc = 0;
      if (env.mode === "floor") { b.lat("metal", [[0.17, 0], [0.17, 0.04], [0.1, 0.09], [0.05, 0.14], [0.05, 0.2], [0, 0.2]], { c: C.brassDk }, 14); b.cyl("metal", 0.04, 0.04, 0.12, 8, { p: [0, 0.22, 0], c: C.brass }); }
      else b.rod("metal", [0, 0, 0], [0, yc + r, 0], 0.012, 6, C.brassDk);
    } else { b.cyl("metal", 0.06, 0.07, 0.06, 10, { p: [0, 0, 0.03], r: [Math.PI / 2, 0, 0], c: C.brassDk }); }
    b.tor("metal", r, 0.035, { p: [0, yc, zc + 0.012], c: C.brass }, env.seg(36), 8);
    b.tor("metal", r * 0.93, 0.012, { p: [0, yc, zc + 0.004], c: C.brassHi }, env.seg(36), 5);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.sph("metal", 0.03, { p: [Math.cos(a) * (r + 0.02), yc + Math.sin(a) * (r + 0.02), zc + 0.012], c: C.brassHi }, 8, 6); }
    b.cyl("metal", r * 0.98, r * 0.98, 0.012, env.seg(36), { p: [0, yc, zc - 0.005], r: [Math.PI / 2, 0, 0], c: C.brassDk });
    b.finish(W);
    const dg = new THREE.CircleGeometry(r * 0.93, env.seg(36)); env.ownG.push(dg);
    const dial = new THREE.Mesh(dg, M.dial); dial.position.set(0, yc, zc + 0.002); W.add(dial);
    const mkHand = (len, wd, col) => {
      const hg = new THREE.Group(); hg.position.set(0, yc, zc + 0.012); const hb = new Builder({ ao: 0 });
      hb.add("metal", new THREE.BoxGeometry(wd, len, 0.008), { p: [0, len * 0.44, 0], c: col });
      hb.add("metal", new THREE.CylinderGeometry(wd * 1.6, wd * 1.6, 0.01, 8), { r: [Math.PI / 2, 0, 0], c: C.brassHi });
      hb.finish(hg); W.add(hg); return hg;
    };
    const mh = mkHand(r * 0.78, 0.012, C.ironDk), hh = mkHand(r * 0.52, 0.02, C.ironDk); mh.position.z += 0.004; hh.position.z += 0.0;
    const ph = env.rng() * TAU;
    env.upd((dt, t) => { mh.rotation.z = -(t * 0.35 + ph); hh.rotation.z = -(t * 0.35 / 12 + ph * 0.3); });
  });

  // ================================================================================================ ARCHITECTURE
  // railing along one edge of the cell top: side "+x" | "-x" | "+z" | "-z" (default "-z")
  def("railing", "floor", { side: "edge of the cell (-z)", style: "brass|iron" }, (env) => {
    const side = P(env.item, "side", "-z"), iron = P(env.item, "style", "brass") === "iron";
    const g = new THREE.Group(); env.root.add(g);
    const sv = DIRS[side] || DIRS["-z"], inset = 0.07;
    // build along local x, then orient: local +x runs along the edge
    const along = (Math.abs(sv[0]) > 0) ? Math.PI / 2 : 0;   // edge normal x => run along z
    g.rotation.y = along; g.position.set(sv[0] * (0.5 - inset), 0, sv[2] * (0.5 - inset));
    const b = new Builder({ ao: 0.16 }), col = iron ? C.iron : C.brass, hi = iron ? C.ironHi : C.brassHi, H = 0.32;
    b.box("metal", 1.0, 0.03, 0.07, { p: [0, 0.015, 0], c: iron ? C.ironDk : C.brassDk });          // base rail
    b.cyl("metal", 0.022, 0.022, 1.0, 8, { p: [0, H, 0], r: [0, 0, Math.PI / 2], c: col });          // top rail
    b.cyl("metal", 0.012, 0.012, 1.0, 6, { p: [0, 0.12, 0], r: [0, 0, Math.PI / 2], c: col });       // lower rail
    for (const x of [-0.5, 0, 0.5]) {
      const sc = x === 0 ? 0.8 : 1;
      b.lat("metal", [[0.04 * sc, 0.03], [0.034 * sc, 0.06], [0.026 * sc, 0.1], [0.03 * sc, H - 0.03], [0.04 * sc, H], [0.026 * sc, H + 0.02]], { p: [x, 0, 0], c: col }, 10);
      b.sph("metal", 0.036 * sc, { p: [x, H + 0.05, 0], c: hi }, 10, 8);
    }
    for (let i = 0; i < 8; i++) { const x = -0.43 + i * 0.123; b.cyl("metal", 0.01, 0.01, H - 0.05, 5, { p: [x, 0.03 + (H - 0.05) / 2, 0], c: C.ironHi }); b.sph("metal", 0.016, { p: [x, H - 0.015, 0], c: hi }, 6, 5); }
    b.finish(g);
  }, { stat: true });

  def("arch", "floor", { w: "span (1)", h: "height (1.15)", ivy: "unused" }, (env) => {
    const w = P(env.item, "w", 1), h = P(env.item, "h", 1.15), d = 0.22, W = env.root;
    const g = new THREE.Group(); W.add(g);
    const b = new Builder({ ao: 0.3 });
    const colx = w / 2 - 0.1, ch = h - w / 2 + 0.02;
    for (const sx of [-1, 1]) {
      b.lat("matte", [[0.12, 0], [0.12, 0.06], [0.085, 0.08], [0.07, 0.14], [0.062, ch * 0.7], [0.07, ch - 0.1], [0.09, ch - 0.07], [0.1, ch - 0.04], [0.13, ch - 0.03], [0.13, ch + 0.0]], { p: [sx * colx, 0, 0], c: C.sandHi }, 12);
      b.tor("matte", 0.075, 0.014, { p: [sx * colx, ch * 0.45, 0], r: [Math.PI / 2, 0, 0], c: C.sandDk }, 12, 5);
    }
    // semicircular arch ring
    const R = w / 2 - 0.0, ro = R + 0.02, ri = R - 0.14, sh = new THREE.Shape();
    sh.moveTo(ro, 0); sh.absarc(0, 0, ro, 0, Math.PI, false); sh.lineTo(-ri, 0); sh.absarc(0, 0, ri, Math.PI, 0, true); sh.lineTo(ro, 0);
    b.add("matte", new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1, curveSegments: 20 }), { p: [0, ch + 0.0, -d / 2], c: C.sand });
    b.box("matte", 0.13, 0.17, d + 0.04, { p: [0, ch + R - 0.07, 0], c: C.sandHi });                  // keystone
    b.box("matte", w + 0.06, 0.05, d + 0.06, { p: [0, ch + R + 0.045, 0], c: C.sandHi });             // cap slab (planting ledge)
    for (const sx of [-1, 1]) b.box("matte", 0.28, 0.05, d + 0.04, { p: [sx * colx, ch + 0.01, 0], c: C.sandHi });
    for (const sx of [-1, 1]) b.box("matte", 0.3, 0.06, d + 0.08, { p: [sx * colx, 0.03, 0], c: C.sandDk });
    b.finish(g);
    g.position.y = 0;
  }, { stat: true });

  // copper / verdigris lantern-dome: stone drum, low ribbed dome, a brass-caged lantern cupola and a finial
  def("dome", "floor", { r: "radius scale (1)" }, (env) => {
    const s = P(env.item, "r", 1), W = env.root, b = new Builder({ ao: 0.2 }), S = (n) => env.seg(n);
    b.lat("matte", [[0.47, 0], [0.47, 0.08], [0.43, 0.1], [0.43, 0.3], [0.46, 0.32], [0.46, 0.36], [0, 0.36]], { c: C.sand }, 16);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; b.box("matte", 0.1, 0.17, 0.05, { p: [Math.cos(a) * 0.435, 0.2, Math.sin(a) * 0.435], r: [0, -a, 0], c: C.sandDk }); }
    // shallow hemispherical cap in weathered copper with verdigris
    const prof = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 0.5; prof.push([Math.cos(a) * 0.5 + (i === 0 ? -0.02 : 0), 0.36 + Math.sin(a) * 0.36]); }
    b.lat("matte", prof, { c: 0x6fa08a }, S(28));
    b.lat("matte", [[0.5, 0.355], [0.52, 0.37], [0.51, 0.42], [0.495, 0.43]], { c: C.copper }, S(28));                // copper eave
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.tube("metal", prof.slice(0, 11).map(p => [Math.cos(a) * (p[0] + 0.012), p[1] + 0.006, Math.sin(a) * (p[0] + 0.012)]), 0.013, { c: C.brass }, 12, false, 4); }
    // cupola: brass cage with a small glowing-glass look (dark glass) and a copper roof
    const y0 = 0.72;
    b.tor("metal", 0.17, 0.018, { p: [0, y0, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, S(20), 6);
    b.tor("metal", 0.15, 0.016, { p: [0, y0 + 0.26, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, S(20), 6);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; b.rod("metal", [Math.cos(a) * 0.165, y0, Math.sin(a) * 0.165], [Math.cos(a) * 0.15, y0 + 0.26, Math.sin(a) * 0.15], 0.012, 5, C.brassHi); }
    b.lat("metal", [[0.12, y0 + 0.02], [0.1, y0 + 0.14], [0.12, y0 + 0.25], [0, y0 + 0.25]], { c: 0x4a3a30 }, 10);       // dark inner core seen through the cage
    b.lat("matte", [[0.2, y0 + 0.26], [0.19, y0 + 0.29], [0.13, y0 + 0.34], [0.06, y0 + 0.41], [0.03, y0 + 0.46], [0, y0 + 0.48]], { c: C.copper }, S(20));
    b.tor("metal", 0.2, 0.014, { p: [0, y0 + 0.27, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, S(20), 5);
    b.sph("metal", 0.04, { p: [0, y0 + 0.5, 0], c: C.brassHi }, 10, 8); b.cyl("metal", 0.01, 0.003, 0.2, 6, { p: [0, y0 + 0.62, 0], c: C.brass });
    b.finish(W);
    W.scale.setScalar(s);
  }, { stat: true });

  def("finial", "floor", { s: "scale (1)" }, (env) => {
    const s = P(env.item, "s", 1), b = new Builder({ ao: 0.2 });
    b.lat("metal", [[0.12, 0], [0.12, 0.04], [0.08, 0.07], [0.07, 0.12], [0.1, 0.15], [0.1, 0.18], [0.055, 0.22], [0.03, 0.3], [0.07, 0.36], [0.09, 0.42], [0.07, 0.48], [0.03, 0.52], [0.04, 0.56], [0.03, 0.62], [0.008, 0.9]], { c: C.brass }, 14);
    b.tor("metal", 0.1, 0.012, { p: [0, 0.165, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, 14, 5);
    b.sph("metal", 0.05, { p: [0, 0.64, 0], c: C.brassHi }, 12, 8);
    b.finish(env.root); env.root.scale.setScalar(s);
  }, { stat: true });

  def("chimney", "floor", { h: "height (0.9)", smoke: "puffs (true)" }, (env) => {
    const h = P(env.item, "h", 0.9), W = env.root, b = new Builder({ ao: 0.3 });
    b.box("matte", 0.52, 0.07, 0.52, { p: [0, 0.035, 0], c: C.sandDk });
    b.box("matte", 0.4, h, 0.4, { p: [0, 0.07 + h / 2, 0], c: C.brick });
    for (let i = 0; i < Math.floor(h / 0.1); i++) b.box("matte", 0.415, 0.014, 0.415, { p: [0, 0.14 + i * 0.1, 0], c: C.brickDk });
    b.box("matte", 0.5, 0.05, 0.5, { p: [0, 0.07 + h + 0.025, 0], c: C.sandHi });
    b.box("matte", 0.56, 0.05, 0.56, { p: [0, 0.07 + h + 0.075, 0], c: C.sandHi });
    b.box("matte", 0.3, 0.02, 0.3, { p: [0, 0.07 + h + 0.105, 0], c: C.ironDk });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box("metal", 0.06, 0.07, 0.06, { p: [x * 0.24, 0.07 + h + 0.14, z * 0.24], c: C.brassDk });
    b.tor("metal", 0.21, 0.014, { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0], c: C.iron }, 4, 5);
    b.finish(W);
    if (P(env.item, "smoke", true) && env.quality !== "low") {
      const SB = makeBoard(env, 5); W.add(SB.mesh);
      for (let i = 0; i < 5; i++) SB.set(i, 0, 0, 0, 0.3, 0.3, 0xffffff, 0, 3, 0);
      const top = 0.07 + h + 0.15;
      env.upd((dt, t) => {
        for (let i = 0; i < 5; i++) {
          const o = i / 5, k = (t * 0.16 + o) % 1, z = 0.16 + k * 0.55;
          SB.pos(i, Math.sin(k * 5 + o * 9) * 0.06 + k * 0.18, top + k * 1.2, Math.cos(k * 4 + o * 7) * 0.05 + k * 0.1);
          SB.size(i, z, z); SB.alpha(i, Math.sin(Math.min(1, k * 1.1) * Math.PI) * 0.35);
        }
        SB.flush();
      });
    }
  });

  def("bell", "floor", { ring: "call userData.ring() to swing it" }, (env) => {
    const W = env.root, b = new Builder({ ao: 0.25 });
    for (const sx of [-1, 1]) {
      b.lat("metal", [[0.07, 0], [0.07, 0.04], [0.045, 0.07], [0.04, 0.8], [0.055, 0.84], [0.05, 0.88]], { p: [sx * 0.28, 0, 0], c: C.ironDk }, 8);
      b.sph("metal", 0.045, { p: [sx * 0.28, 0.9, 0], c: C.brassHi }, 10, 8);
      b.rod("metal", [sx * 0.28, 0.12, 0.0], [sx * 0.1, 0.78, 0], 0.016, 5, C.iron);
    }
    b.cyl("metal", 0.03, 0.03, 0.66, 8, { p: [0, 0.82, 0], r: [0, 0, Math.PI / 2], c: C.brassDk });
    b.lat("metal", [[0.4, 0.88], [0.3, 0.96], [0.16, 1.02], [0.04, 1.06], [0.0, 1.08]].map(p => [p[0] * 0.8, p[1]]), { c: C.ironDk }, 4);
    b.finish(W);
    const sw = new THREE.Group(); sw.position.y = 0.82; W.add(sw);
    const sb = new Builder({ ao: 0 });
    sb.lat("metal", [[0, 0], [0.03, 0], [0.035, -0.04], [0.06, -0.06], [0.07, -0.13], [0.09, -0.2], [0.13, -0.27], [0.17, -0.32], [0.185, -0.34], [0.165, -0.355], [0.14, -0.35], [0.14, -0.34], [0.11, -0.3], [0.08, -0.2], [0.06, -0.1], [0.04, -0.06], [0, -0.06]], { c: C.bronze }, env.seg(22));
    sb.tor("metal", 0.095, 0.01, { p: [0, -0.18, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, 18, 5);
    sb.tor("metal", 0.16, 0.012, { p: [0, -0.32, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, 20, 5);
    sb.rod("metal", [0, -0.06, 0], [0, -0.3, 0], 0.01, 5, C.ironDk); sb.sph("metal", 0.025, { p: [0, -0.31, 0], c: C.iron }, 8, 6);
    sb.finish(sw);
    let amp = 0.05, ph = env.rng() * TAU;
    env.ud.ring = () => { amp = 0.5; };
    env.upd((dt, t) => { amp = Math.max(0.05, amp - dt * 0.18); sw.rotation.z = Math.sin(t * 3.4 + ph) * amp; });
  });

  // ---- banner (cloth sways in the vertex shader)
  const bannerMats = {};
  function bannerMaterial(colorName) {
    if (bannerMats[colorName]) return bannerMats[colorName];
    const m = new THREE.MeshStandardMaterial({ map: clothTexture(colorName), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.9, metalness: 0, envMap: M._envTex, envMapIntensity: 0.3 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = WIND;
      sh.vertexShader = "uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "vec3 transformed = vec3(position); float f = clamp(1.0 - uv.y, 0.0, 1.0); float ph = modelMatrix[3].x*1.7 + modelMatrix[3].z*2.3;" +
        "transformed.z += (sin(uWind*1.7 + f*3.2 + ph)*0.05 + sin(uWind*3.3 + position.x*6.0 + ph)*0.012)*f*f*1.4 + f*0.01;" +
        "transformed.x += sin(uWind*1.2 + f*2.0 + ph)*0.02*f;" +
        "transformed.y -= (sin(uWind*1.7 + f*3.2 + ph)*0.05)*f*f*0.2;");
    };
    m.customProgramCacheKey = () => "dcbanner";
    own.push(m); bannerMats[colorName] = m; return m;
  }
  def("banner", "wall", { color: "crimson|teal|plum|gold|indigo", w: "0.5", h: "0.9" }, (env) => {
    const w = P(env.item, "w", 0.5), h = P(env.item, "h", 0.9), W = env.root, b = new Builder({ ao: 0 });
    let yTop, z;
    if (env.mode === "wall") {
      yTop = 0.4; z = 0.11;
      for (const sx of [-1, 1]) { b.rod("metal", [sx * (w / 2 - 0.02), yTop + 0.01, 0.0], [sx * (w / 2 - 0.02), yTop + 0.01, z], 0.011, 5, C.brassDk); b.cyl("metal", 0.025, 0.025, 0.015, 8, { p: [sx * (w / 2 - 0.02), yTop + 0.01, 0.007], r: [Math.PI / 2, 0, 0], c: C.brass }); }
    } else {
      z = 0; yTop = env.mode === "hang" ? -0.08 : 1.2;
      if (env.mode === "floor") { b.lat("metal", [[0.13, 0], [0.13, 0.04], [0.06, 0.08], [0.03, 0.15], [0.025, yTop + 0.02]], { c: C.ironDk }, 10); b.sph("metal", 0.04, { p: [0, yTop + 0.06, 0], c: C.brassHi }, 10, 8); }
      else b.rod("metal", [0, 0, 0], [0, yTop + 0.02, 0], 0.01, 5, C.iron);
    }
    b.cyl("metal", 0.014, 0.014, w + 0.1, 8, { p: [0, yTop + 0.01, z], r: [0, 0, Math.PI / 2], c: C.brass });
    for (const sx of [-1, 1]) b.sph("metal", 0.026, { p: [sx * (w / 2 + 0.06), yTop + 0.01, z], c: C.brassHi }, 8, 6);
    b.finish(W);
    const geo = new THREE.PlaneGeometry(w, h, 6, 14); geo.translate(0, -h / 2, 0); env.ownG.push(geo);
    const cloth = new THREE.Mesh(geo, bannerMaterial(P(env.item, "color", "crimson"))); cloth.position.set(0, yTop, z + 0.012); cloth.castShadow = true; cloth.receiveShadow = true;
    W.add(cloth);
  });

  // ---- waterfall: scrolling shader on a curved strip, foam at the base. wall mode: spills from the top edge of the face.
  def("waterfall", "wall", { len: "fall height in cells (6)", w: "width (0.5)" }, (env) => {
    const len = P(env.item, "len", 6), w = P(env.item, "w", 0.5), W = env.root;
    const lipY = 0.47, b = new Builder({ ao: 0 });
    b.box("matte", w + 0.16, 0.08, 0.26, { p: [0, lipY - 0.03, 0.09], c: C.sandDk });
    b.box("matte", w + 0.2, 0.04, 0.3, { p: [0, lipY - 0.07, 0.1], c: C.sand });
    for (const sx of [-1, 1]) b.box("matte", 0.05, 0.1, 0.3, { p: [sx * (w / 2 + 0.1), lipY, 0.1], c: C.sandHi });
    b.finish(W);
    const mk = (ww, speed, seed, alpha) => {
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uLen: { value: len }, uSpeed: { value: speed }, uSeed: { value: seed }, uAlpha: { value: alpha } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: "uniform float uTime, uLen, uSpeed, uSeed, uAlpha; varying vec2 vUv;" +
          "float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }" +
          "float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }" +
          "void main(){ float y = (1.0 - vUv.y) * uLen; float x = vUv.x;" +
          " float s1 = n(vec2(x*11.0+uSeed, y*0.9 + uTime*uSpeed)); float s2 = n(vec2(x*27.0+uSeed*2.0, y*0.5 + uTime*uSpeed*1.7)); float s3 = n(vec2(x*5.0+uSeed, y*0.25 + uTime*uSpeed*0.6));" +
          " float streak = smoothstep(0.3, 0.85, s1*0.5 + s2*0.4 + s3*0.35);" +
          " float edge = smoothstep(0.0, 0.14, x) * smoothstep(1.0, 0.86, x);" +
          " float bottom = smoothstep(0.0, 1.4, (vUv.y)*uLen);" +
          " float top = smoothstep(0.0, 0.05, 1.0 - vUv.y) * 0.5 + 0.5;" +
          " vec3 deep = vec3(0.30,0.44,0.66), lite = vec3(0.74,0.82,0.94);" +
          " vec3 col = mix(deep, lite, streak*0.85 + 0.1);" +
          " col = mix(col, vec3(1.0,0.82,0.7), 0.12);" +
          " float a = (0.22 + 0.45*streak) * edge * bottom * top * uAlpha;" +
          " gl_FragColor = vec4(col, a); }",
      });
      env.own.push(m);
      const g = new THREE.PlaneGeometry(ww, len, 4, Math.max(8, Math.round(len * 5))); env.ownG.push(g);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const d = lipY - (p.getY(i) + len / 2 + (lipY - len)) ; // distance below the lip (0 at the top)
        void d;
      }
      // y runs from +len/2 (top) to -len/2; place top at lipY and bend outward like a falling stream
      for (let i = 0; i < p.count; i++) {
        const dist = len / 2 - p.getY(i);          // 0 at lip
        const z = 0.2 * Math.sqrt(clamp(dist / 1.2, 0, 1)) + 0.04;
        const wf = 1 + 1.1 * Math.pow(clamp(dist / len, 0, 1), 1.4);   // the sheet fans out toward the bottom
        p.setXYZ(i, p.getX(i) * wf, lipY - dist, z);
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; mesh.frustumCulled = false; return mesh;
    };
    const a = mk(w, 3.2, 0.0, 1.0), c = mk(w * 0.8, 4.4, 7.3, 0.7); c.position.z = 0.03;
    W.add(a, c);
    // foam and spray at the base (also at the lip)
    const base = lipY - len, low = env.quality === "low";
    // spray: 6 foam puffs + mist glow where the water meets the clouds, plus a lip glow: one billboard batch
    const NP = 6, FB = makeBoard(env, NP + 2); W.add(FB.mesh); FB.mesh.renderOrder = 6;
    for (let i = 0; i < NP; i++) FB.set(i, 0, base, 0.27, 0.6, 0.6, 0xe8f2ff, 0, 3, 0);
    FB.set(NP, 0, base + 0.15, 0.25, 2.4, 1.2, 0xa9c8f0, 0.2, 0, 1); FB.set(NP + 1, 0, lipY - 0.02, 0.12, 0.45, 0.45, 0xdde8ff, 0.3, 0, 1);
    env.upd((dt, t) => {
      a.material.uniforms.uTime.value = t; c.material.uniforms.uTime.value = t;
      for (let i = 0; i < NP; i++) {
        const o = i / NP, k = (t * 0.4 + o) % 1, z = 0.7 + k * 1.3;
        FB.pos(i, (o - 0.5) * w * 2.6 + Math.sin(t * 0.8 + o * 7) * 0.12, base + 0.02 + k * 0.7, 0.3 + k * 0.15);
        FB.size(i, z, z * 0.85); FB.alpha(i, low ? 0 : Math.sin(k * Math.PI) * 0.5);
      }
      FB.alpha(NP, low ? 0 : 0.18 + 0.05 * Math.sin(t * 2.1)); FB.flush();
    });
  });

  // ================================================================================================ PLANTS
  function atlasNames(an, prefix) { const a = atlases[an]; return a ? a.names.filter(n => n.indexOf(prefix) === 0) : []; }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];

  def("ivy", "wall", { w: "width (1)", h: "height (1)", density: "1", bloom: "glowing flowers among the leaves (0.3)" }, (env) => {
    const w = P(env.item, "w", 1), h = P(env.item, "h", 1), dn = P(env.item, "density", 1), bloom = P(env.item, "bloom", 0.3), rng = env.rng;
    const b = new Builder({ ao: 0 }), names = atlasNames("ivy", "ivy-"); if (!names.length) return;
    const n = Math.max(3, Math.round(w * h * 5.5 * dn + 2)), flat = env.mode !== "wall";
    for (let i = 0; i < n; i++) {
      const id = pick(names, rng), r = atlases.ivy.rects[id], asp = r[3] / r[2], tall = asp > 1.2;
      const cw = (tall ? 0.42 : 0.5) + rng() * 0.3, x = (rng() - 0.5) * w * 0.95, zl = 0.012 + i * 0.0035;
      const y = tall ? h / 2 - rng() * 0.12 : h / 2 - Math.pow(rng(), 1.5) * h * 0.92;
      const o = { anchor: tall ? "t" : "c", ry: 0, rz: (rng() - 0.5) * (tall ? 0.16 : 0.7), rx: flat ? 0 : (rng() * 0.28), k: [0.55, 1.1], tint: rng() < 0.3 ? 0xe8f0c0 : 0xffffff };
      if (flat) { o.rx = -Math.PI / 2; o.rz = 0; o.ry = (rng() - 0.5) * 3; card(b, "ivy", id, cw, Object.assign(o, { p: [x, zl, y * 0.9] })); }
      else card(b, "ivy", id, cw, Object.assign(o, { p: [x, y, zl] }));
    }
    const fl = atlasNames("flowers", "flower-");
    if (fl.length && bloom > 0) {
      const nf = Math.round(n * bloom * 0.8);
      for (let i = 0; i < nf; i++) {
        const id = pick(fl, rng), x = (rng() - 0.5) * w * 0.85, y = h / 2 - 0.1 - rng() * h * 0.6, fw = 0.2 + rng() * 0.12;
        card(b, "flowers", id, fw, flat ? { p: [x, 0.09, y * 0.9], rx: -Math.PI / 2, anchor: "c", k: [1, 1] } : { p: [x, y, 0.1 + rng() * 0.02], anchor: "c", rz: (rng() - 0.5) * 0.5, k: [1, 1] });
      }
    }
    b.finish(env.root, null, { c_ivy: { cast: false }, c_flowers: { cast: false } });
  });

  def("vines", "wall", { w: "width (1)", len: "strand length (1.5)", count: "strands" }, (env) => {
    const w = P(env.item, "w", 1), len = P(env.item, "len", 1.5), rng = env.rng, b = new Builder({ ao: 0 }), names = atlasNames("vines", "vine-");
    if (!names.length) return;
    const cnt = P(env.item, "count", Math.max(2, Math.round(w * 3)));
    for (let i = 0; i < cnt; i++) {
      const id = pick(names, rng), r = atlases.vines.rects[id], asp = r[3] / r[2], hh = len * (0.7 + rng() * 0.5), ww = hh / asp;
      const x = ((i + 0.5) / cnt - 0.5) * w + (rng() - 0.5) * 0.15;
      if (env.mode === "wall") card(b, "vines", id, ww, { p: [x, 0.5 + 0.01, 0.02 + i * 0.006], anchor: "t", h: hh, rz: (rng() - 0.5) * 0.1, k: [0.55, 1.08] });
      else if (env.mode === "hang") { card(b, "vines", id, ww, { p: [x, 0, (rng() - 0.5) * 0.3], anchor: "t", h: hh, ry: 0, k: [0.6, 1.1] }); card(b, "vines", id, ww, { p: [x, 0, (rng() - 0.5) * 0.3], anchor: "t", h: hh, ry: Math.PI / 2, k: [0.6, 1.1] }); }
      else { cross(b, "vines", id, ww, [x, 0, (rng() - 0.5) * 0.4], rng() * 0.6, { h: hh * 0.7, flip: true, k: [0.6, 1.1] }); }
    }
    b.finish(env.root, null, { c_vines: { cast: false } });
  });

  def("flowers", "floor", { count: "clusters (5)", spread: "radius (0.32)", glow: "halo sprites (true)" }, (env) => {
    const rng = env.rng, b = new Builder({ ao: 0 }), names = atlasNames("flowers", "flower-"); if (!names.length) return;
    const cnt = P(env.item, "count", 5), sp = P(env.item, "spread", 0.32), halos = [];
    for (let i = 0; i < cnt; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng()) * sp, x = Math.cos(a) * rr, z = Math.sin(a) * rr, id = pick(names, rng), w = 0.3 + rng() * 0.22;
      cross(b, "flowers", id, w, [x, 0, z], rng() * 1.5, { k: [0.8, 1.15] });
      halos.push([x, 0.18 + rng() * 0.12, z]);
    }
    b.finish(env.root, null, { c_flowers: { cast: false } });
    if (P(env.item, "glow", true) && env.quality !== "low" && env.quality !== "medium") {
      const FB = makeBoard(env, 2); env.root.add(FB.mesh);
      FB.set(0, 0, 0.2, 0, sp * 3.2 + 0.4, sp * 3.2 + 0.4, 0x6ff3ff, 0.32, 0, 1);
      FB.set(1, halos[0][0], halos[0][1] + 0.12, halos[0][2], 0.5, 0.5, 0x9cf8ff, 0.5, 2, 1);
      env.upd((dt, t) => {
        FB.alpha(0, 0.26 + 0.1 * Math.sin(t * 1.3 + env.root.position.x)); FB.alpha(1, 0.4 + 0.4 * Math.sin(t * 2.3 + env.root.position.z * 2)); FB.rot(1, t * 0.4); FB.flush();
      });
    }
  });

  def("plant", "floor", { variant: "fern|shrub|succ|herb|tuft|fern2 or index", s: "scale (1)" }, (env) => {
    const at = atlases.plants; if (!at) return;
    const list = ["pot-fern", "pot-shrub", "pot-succ", "pot-herb", "tuft", "fern"], v = env.item.variant;
    let id = typeof v === "number" ? list[v % list.length] : (typeof v === "string" ? (list.find(n => n.indexOf(v) >= 0) || list[0]) : list[Math.floor(env.rng() * 4)]);
    if (!at.rects[id]) id = at.names[0];
    const s = P(env.item, "s", 1), b = new Builder({ ao: 0 }), pot = id.indexOf("pot-") === 0;
    cross(b, "plants", id, (pot ? 0.62 : 0.8) * s, [0, 0, 0], 0.0, { k: [0.7, 1.12] });
    b.finish(env.root, null, { c_plants: { cast: false } });
  });

  // tapered tube along a curve (trunks, branches)
  function sweep(pts, r0, r1, seg, rad) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, "catmullrom", 0.5);
    const pos = [], idx = [], up = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, p = curve.getPoint(t), tg = curve.getTangent(t).normalize();
      const nx = new THREE.Vector3().crossVectors(tg, up); if (nx.lengthSq() < 1e-4) nx.set(1, 0, 0); nx.normalize();
      const ny = new THREE.Vector3().crossVectors(tg, nx).normalize(), r = lerp(r0, r1, Math.pow(t, 0.8)) * (1 + (i === 0 ? 0.25 : 0));
      for (let j = 0; j < rad; j++) { const a = j / rad * TAU; pos.push(p.x + (nx.x * Math.cos(a) + ny.x * Math.sin(a)) * r, p.y + (nx.y * Math.cos(a) + ny.y * Math.sin(a)) * r, p.z + (nx.z * Math.cos(a) + ny.z * Math.sin(a)) * r); }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b2 = i * rad + (j + 1) % rad, c = (i + 1) * rad + j, d = (i + 1) * rad + (j + 1) % rad; idx.push(a, c, b2, b2, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  def("tree", "floor", { h: "height (1.8)", s: "scale (1)" }, (env) => {
    const h = P(env.item, "h", 1.8), s = P(env.item, "s", 1), rng = env.rng, b = new Builder({ ao: 0.3 }), W = env.root;
    const lean = (rng() - 0.5) * 0.16;
    b.lat("matte", [[0.2, 0], [0.16, 0.05], [0.1, 0.14], [0.085, 0.22], [0, 0.22]], { c: C.woodDk }, 10);
    b.add("matte", sweep([[0, 0.15, 0], [lean * 0.5, h * 0.3, 0.02], [lean, h * 0.55, 0], [lean * 1.3, h * 0.72, -0.02]], 0.09, 0.045, 10, 8), { c: C.wood });
    const crowns = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU + rng(), L = 0.3 + rng() * 0.12, p0 = [lean * 1.1, h * (0.5 + i * 0.07), 0], p1 = [lean + Math.cos(a) * L, h * (0.72 + i * 0.04), Math.sin(a) * L];
      b.add("matte", sweep([p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 0.05, (p0[2] + p1[2]) / 2], p1], 0.035, 0.015, 6, 6), { c: C.wood });
      crowns.push(p1);
    }
    const canopy = atlasNames("plants", "canopy-"), tuft = atlasNames("plants", "tuft");
    if (canopy.length) {
      const place = (p, w2, ry) => cross(b, "plants", pick(canopy, rng), w2, [p[0], p[1] - w2 * 0.42, p[2]], ry, { k: [0.65, 1.15] });
      place([lean * 1.3, h * 0.88, 0], 1.1, rng()); for (const c of crowns) place([c[0], c[1] + 0.1, c[2]], 0.7 + rng() * 0.25, rng() * 2);
    }
    if (tuft.length) cross(b, "plants", tuft[0], 0.7, [0, 0, 0], 0.4, { k: [0.7, 1.1] });
    b.finish(W, null, { c_plants: { cast: false } });
    if (s !== 1) W.scale.setScalar(s);
  });

  // ================================================================================================ REVIEW ADDITIONS
  // helpers for world-placed types (strut, chain, keel): the root sits at the origin / its own anchor, not on a face
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  function basisQuat(x, y, z) { const m = new THREE.Matrix4().makeBasis(x, y, z), q = new THREE.Quaternion(); q.setFromRotationMatrix(m); return q; }

  // strut: brass truss (default) or stone arch-strut between two world points
  def("strut", "floor", { from: "[x,y,z]", to: "[x,y,z]", style: "truss|arch (truss)" }, (env) => {
    const A = V3(env.item.from || [0, 0, 0]), B2 = V3(env.item.to || [1, 1, 0]), d = B2.clone().sub(A), L = d.length(), u = d.clone().normalize();
    let side = new THREE.Vector3().crossVectors(u, new THREE.Vector3(0, 1, 0)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    const up = new THREE.Vector3().crossVectors(side, u).normalize();
    const b = new Builder({ ao: 0 }), style = P(env.item, "style", "truss");
    const pt = (t, o) => [A.x + d.x * t + up.x * o, A.y + d.y * t + up.y * o, A.z + d.z * t + up.z * o];
    if (style === "arch") {
      const bow = Math.min(0.7, L * 0.2), n = 12, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n, o = Math.sin(t * Math.PI) * bow; pts.push(pt(t, o)); }
      b.add("matte", sweep(pts, 0.17, 0.17, 24, 10), { c: C.sand });
      for (const t of [0, 0.5, 1]) { const p = pt(t, Math.sin(t * Math.PI) * bow); b.sph("metal", 0.13, { p, c: C.brass }, 12, 8); b.sph("metal", 0.05, { p: [p[0], p[1] + 0.12, p[2]], c: C.brassHi }, 8, 6); }
      for (let i = 1; i < 6; i++) { const t = i / 6, p = pt(t, Math.sin(t * Math.PI) * bow); b.tor("metal", 0.18, 0.016, { p, q: basisQuat(side, up, u).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)), c: C.brassDk }, 14, 5); }
    } else {
      const h = 0.16, n = Math.max(2, Math.round(L / 0.34));
      for (const o of [h, -h]) b.rod("metal", pt(0, o), pt(1, o), 0.024, 8, C.brass);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        b.rod("metal", pt(t, -h), pt(t, h), 0.016, 6, C.brassDk);
        if (i < n) b.rod("metal", pt(t, i % 2 ? h : -h), pt((i + 1) / n, i % 2 ? -h : h), 0.014, 6, C.brass);
        b.sph("metal", 0.034, { p: pt(t, h), c: C.brassHi }, 8, 6); b.sph("metal", 0.03, { p: pt(t, -h), c: C.brassHi }, 8, 6);
      }
      for (const t of [0, 1]) {   // end plates with bolts
        const p = pt(t, 0), q = basisQuat(side, up, u);
        b.box("metal", 0.3, 0.42, 0.06, { p, q, c: C.brassDk });
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const v = new THREE.Vector3(sx * 0.1, sy * 0.15, 0.04).applyQuaternion(q); b.cyl("metal", 0.025, 0.025, 0.03, 8, { p: [p[0] + v.x, p[1] + v.y, p[2] + v.z], q, c: C.brassHi }); }
      }
    }
    b.finish(env.root);
  }, { world: true });

  // chain: hanging iron chain between two world points (slight sag)
  def("chain", "floor", { from: "[x,y,z]", to: "[x,y,z]", sag: "0.05 of length" }, (env) => {
    const A = V3(env.item.from || [0, 3, 0]), B2 = V3(env.item.to || [0, 0, 0]), d = B2.clone().sub(A), L = d.length(), u = d.clone().normalize();
    const b = new Builder({ ao: 0 }), sag = P(env.item, "sag", 0.05) * L, link = 0.075, n = Math.max(2, Math.round(L / link));
    const ref = Math.abs(u.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const s1 = new THREE.Vector3().crossVectors(u, ref).normalize(), s2 = new THREE.Vector3().crossVectors(u, s1).normalize();
    const pos = (t) => new THREE.Vector3().copy(A).addScaledVector(d, t).addScaledVector(new THREE.Vector3(0, -1, 0), Math.sin(t * Math.PI) * sag);
    const g0 = new THREE.TorusGeometry(0.03, 0.0105, 5, 12);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = pos(t), tg = pos(Math.min(1, t + 0.01)).sub(pos(Math.max(0, t - 0.01))).normalize();
      const a = i % 2 ? s1 : s2, z = new THREE.Vector3().crossVectors(tg, a).normalize(), a2 = new THREE.Vector3().crossVectors(z, tg);
      b.add("metal", g0.clone(), { p: [p.x, p.y, p.z], q: basisQuat(tg, a2, z), s: [1.35, 1, 1], c: i % 5 === 0 ? C.ironHi : C.iron });
    }
    g0.dispose();
    for (const [P0, sgn] of [[A, 1], [B2, -1]]) {   // end rings and shackle plates
      b.tor("metal", 0.06, 0.016, { p: [P0.x, P0.y + 0.0, P0.z], c: C.brass }, 14, 6);
      b.cyl("metal", 0.05, 0.05, 0.04, 10, { p: [P0.x, P0.y + 0.035 * sgn, P0.z], c: C.brassDk });
    }
    b.finish(env.root);
  }, { world: true });

  // keel: the spire's underside. Footprint (w x d cells) starts at cell `at` and hangs below its bottom face.
  def("keel", "floor", { w: "cells (2)", d: "cells (2)", depth: "total drop in cells (3)" }, (env) => {
    // Tapering underside: dark weathered stone rings stepping inward (no horizontal surface visible from above),
    // brass bands, ribs, a gear cluster on the +x / +z faces and a long brass pendant. Footprint starts at cell `at`.
    const w = P(env.item, "w", 2), dd = P(env.item, "d", 2), depth = Math.max(1.5, P(env.item, "depth", 3)), at = env.item.at || [0, 0, 0];
    env.root.position.set(at[0] + w / 2, at[1], at[2] + dd / 2);
    const b = new Builder({ ao: 0.0 });
    const hx0 = Math.max(0.3, w / 2 - 0.15), hz0 = Math.max(0.3, dd / 2 - 0.15);       // inset: never wider than the footprint
    const mn = Math.min(hx0, hz0), tipY = -Math.min(depth * 0.8, Math.max(1.0, mn * 1.7, Math.max(hx0, hz0) * 0.55)), n = 5, rh = -tipY * 0.13, tip = Math.max(0.06, mn * 0.2);
    const hxAt = (y) => lerp(hx0, tip, Math.min(1, y / tipY)), hzAt = (y) => lerp(hz0, tip, Math.min(1, y / tipY));
    // frustum with independent half-extents at the top and the bottom (open top: nothing horizontal shows from above)
    const frus = (key, ty, by, y0, c, grow) => {
      const g = new THREE.CylinderGeometry(1.4142, 1.4142, 1, 4, 1, true).rotateY(Math.PI / 4), pa = g.attributes.position;
      const tx = hxAt(ty) + grow, tz = hzAt(ty) + grow, bx = hxAt(by) + grow * 1.7, bz = hzAt(by) + grow * 1.7;
      for (let i = 0; i < pa.count; i++) { const top = pa.getY(i) > 0; pa.setXYZ(i, pa.getX(i) * (top ? tx : bx), top ? ty - y0 : by - y0, pa.getZ(i) * (top ? tz : bz)); }
      return b.add(key, g, { p: [0, y0, 0], c });
    };
    const stone = [0x75606a, 0x87707a, 0x6a5662];
    let y = 0;
    for (let j = 0; j < n; j++) {
      const yb = y - rh;
      frus("matte", y, yb, 0, stone[j % 3], 0);                                      // sloped course
      frus("metal", yb + 0.05, yb - 0.01, 0, j % 2 ? C.brassDk : C.brass, 0.03);     // brass band, flared lip
      const cx = hxAt(yb) * 1.0 + 0.03, cz = hzAt(yb) * 1.0 + 0.03, nn = Math.max(2, Math.round(Math.min(cx, cz) * 2 / 0.45));
      for (let i = 0; i < nn; i++) {
        const u = ((i + 0.5) / nn * 2 - 1);
        b.box("matte", 0.1, 0.12, 0.07, { p: [u * cx * 0.9, yb - 0.05, cz], c: 0x8c7480 });
        b.box("matte", 0.07, 0.12, 0.1, { p: [cx, yb - 0.05, u * cz * 0.9], c: 0x8c7480 });
      }
      y = yb - 0.01;
    }
    // body down to the tip
    frus("matte", y, tipY, 0, 0x5a4a56, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // brass ribs from the footprint corners to the tip
      const x0 = sx * hx0, z0 = sz * hz0;
      b.tube("metal", [[x0, -0.02, z0], [x0 * 0.78, tipY * 0.35, z0 * 0.78], [x0 * 0.35, tipY * 0.75, z0 * 0.35], [0, tipY, 0]], 0.03, { c: C.brass }, 16, false, 5);
    }
    for (const t of [-0.5, 0, 0.5]) {                        // mid-face ribs on the visible sides
      b.tube("metal", [[hx0, -0.02, t * hz0], [hx0 * 0.78, tipY * 0.35, t * hz0 * 0.7], [hx0 * 0.3, tipY * 0.75, t * hz0 * 0.3], [0, tipY, 0]], 0.022, { c: C.brassDk }, 14, false, 5);
      b.tube("metal", [[t * hx0, -0.02, hz0], [t * hx0 * 0.7, tipY * 0.35, hz0 * 0.78], [t * hx0 * 0.3, tipY * 0.75, hz0 * 0.3], [0, tipY, 0]], 0.022, { c: C.brassDk }, 14, false, 5);
    }
    // gear cluster hanging on the +z and +x faces
    const gs = clamp(mn * 0.55, 0.3, 0.7), gyc = tipY * 0.3;
    const zf = hzAt(gyc + gs) + 0.1, xf = hxAt(gyc + gs) + 0.1;
    b.add("metal", gearGeom(gs, 16, gs * 0.17, 0.08, 6), { p: [-hx0 * 0.3, gyc, zf], r: [Math.PI / 2, 0.2, 0], c: C.brass });
    b.add("metal", gearGeom(gs * 0.6, 10, gs * 0.12, 0.08, 5), { p: [-hx0 * 0.3 + gs * 1.38, gyc - gs * 0.35, zf], r: [Math.PI / 2, 0.5, 0], c: C.patina });
    b.add("metal", gearGeom(gs * 0.85, 14, gs * 0.15, 0.08, 6), { p: [xf, gyc - 0.05, -hz0 * 0.25], r: [0, 0, -Math.PI / 2], c: C.copper });
    b.add("metal", gearGeom(gs * 0.55, 9, gs * 0.11, 0.08, 5), { p: [xf, gyc - gs * 0.4, -hz0 * 0.25 + gs * 1.28], r: [0, 0, -Math.PI / 2], c: C.brassDk });
    for (const q of [[-hx0 * 0.3, gyc, zf + 0.06], [-hx0 * 0.3 + gs * 1.38, gyc - gs * 0.35, zf + 0.06]]) b.cyl("metal", 0.06, 0.06, 0.1, 10, { p: q, r: [Math.PI / 2, 0, 0], c: C.brassHi });
    for (const q of [[xf + 0.06, gyc - 0.05, -hz0 * 0.25], [xf + 0.06, gyc - gs * 0.4, -hz0 * 0.25 + gs * 1.28]]) b.cyl("metal", 0.06, 0.06, 0.1, 10, { p: q, r: [0, 0, -Math.PI / 2], c: C.brassHi });
    // long brass pendant
    const Lp = Math.max(0.8, depth + tipY + 0.6);
    const prof = [[0.0, 0], [0.06, -0.02], [0.1, -0.08], [0.05, -0.16], [0.05, -0.34], [0.13, -0.42], [0.16, -0.55], [0.12, -0.68], [0.065, -0.78], [0.065, -1.1], [0.11, -1.17], [0.075, -1.27], [0.04, -1.45], [0.04, -1.8], [0.012, -2.5]].map(p => [p[0] * 1.35, p[1] * (Lp / 2.5)]);
    b.lat("metal", prof, { p: [0, tipY + 0.05, 0], c: C.brass }, 14);
    b.tor("metal", 0.17, 0.02, { p: [0, tipY - 0.5 * (Lp / 2.5), 0], r: [Math.PI / 2, 0, 0], c: C.patina }, 16, 6);
    b.sph("metal", 0.05, { p: [0, tipY + 0.05 - Lp, 0], c: C.brassHi }, 10, 8);
    b.finish(env.root);
  }, { world: true });

  // hinge: barrel on an x/z rotor's pivot face. axis "x" | "z" (world axis the barrel runs along)
  def("hinge", "floor", { axis: "'x' | 'z'" }, (env) => {
    const g = new THREE.Group(); g.rotation.y = env.yawOf(P(env.item, "axis", "x") === "z" ? "+z" : "+x"); env.root.add(g);
    const b = new Builder({ ao: 0.15 }), r = 0.1, L = 0.9;
    b.cyl("metal", r, r, L, 14, { p: [0, r + 0.03, 0], r: [0, 0, Math.PI / 2], c: C.brass });
    for (const x of [-0.36, 0, 0.36]) b.tor("metal", r + 0.012, 0.016, { p: [x, r + 0.03, 0], r: [0, Math.PI / 2, 0], c: C.brassDk }, 14, 6);
    for (const sx of [-1, 1]) {
      b.sph("metal", r * 1.05, { p: [sx * L / 2, r + 0.03, 0], c: C.brassHi }, 10, 8);
      b.box("metal", 0.2, 0.05, 0.3, { p: [sx * 0.33, 0.025, 0], c: C.iron });
      b.box("metal", 0.1, 0.1, 0.07, { p: [sx * 0.33, 0.07, 0.0], c: C.ironHi });
      for (const sz of [-1, 1]) b.cyl("metal", 0.02, 0.02, 0.03, 8, { p: [sx * 0.33, 0.06, sz * 0.12], c: C.brassHi });
    }
    b.cyl("metal", 0.03, 0.03, L * 1.05, 8, { p: [0, r + 0.03, 0], r: [0, 0, Math.PI / 2], c: C.ironDk });
    b.finish(g);
  }, { stat: true });

  // corbel: carved bracket (wall faces: sits at the top of the face, under an overhang)
  def("corbel", "wall", {}, (env) => {
    const b = new Builder({ ao: 0 });
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.5); sh.lineTo(0.22, 0.5); sh.lineTo(0.22, 0.44); sh.lineTo(0.17, 0.42); sh.quadraticCurveTo(0.13, 0.32, 0.1, 0.22); sh.quadraticCurveTo(0.07, 0.1, 0.02, 0.0); sh.lineTo(0, 0.0); sh.lineTo(0, 0.5);
    const depth = 0.3;
    for (const [sc, c, dx] of [[1, C.sandHi, 0]]) b.add("matte", new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 1, curveSegments: 8 }).translate(0, 0, -depth / 2).rotateY(-Math.PI / 2), { p: [dx, 0, 0], s: sc, c });
    b.box("matte", 0.36, 0.05, 0.28, { p: [0, 0.475, 0.12], c: C.sand });
    for (let i = -1; i <= 1; i++) b.box("matte", 0.06, 0.06, 0.05, { p: [i * 0.11, 0.425, 0.235], c: C.sandHi });
    b.tor("matte", 0.06, 0.014, { p: [0, 0.3, 0.17], r: [0, Math.PI / 2, 0], c: C.sand }, 12, 5);       // volute
    b.sph("metal", 0.035, { p: [0, 0.05, 0.03], c: C.brass }, 8, 6);
    b.finish(env.root);
  }, { stat: true });

  // dial: large turntable clock-dial; spin(value) turns the hands (value in degrees)
  def("dial", "floor", { r: "radius (1.4)" }, (env) => {
    const r = P(env.item, "r", 1.4), W = env.root, b = new Builder({ ao: 0 });
    b.cyl("metal", r + 0.06, r + 0.08, 0.05, env.seg(48), { p: [0, 0.025, 0], c: C.brassDk });
    b.tor("metal", r + 0.03, 0.035, { p: [0, 0.06, 0], r: [Math.PI / 2, 0, 0], c: C.brass }, env.seg(60), 8);
    b.tor("metal", r * 0.62, 0.012, { p: [0, 0.056, 0], r: [Math.PI / 2, 0, 0], c: C.brassHi }, env.seg(48), 5);
    for (let i = 0; i < 12; i++) {   // raised brass hour pips; numerals live in the texture
      const a = i / 12 * TAU, rr = r * 0.9; b.box("metal", 0.1 * r, 0.03, 0.04 * r, { p: [Math.cos(a) * rr, 0.07, Math.sin(a) * rr], r: [0, -a, 0], c: C.brassHi });
    }
    b.finish(W);
    const dm = new THREE.MeshStandardMaterial({ map: dialFaceTexture(), metalness: 0.2, roughness: 0.55, envMap: M._envTex, envMapIntensity: 0.6 }); env.own.push(dm);
    const dg = new THREE.CircleGeometry(r, env.seg(60)); env.ownG.push(dg);
    const disc = new THREE.Mesh(dg, dm); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.052; disc.receiveShadow = true; W.add(disc);
    const mk = (len, wd, col, y) => {
      const g = new THREE.Group(); g.position.y = y; const hb = new Builder({ ao: 0 });
      hb.add("metal", new THREE.BoxGeometry(wd, 0.02, len), { p: [0, 0, len * 0.38], c: col });
      hb.add("metal", new THREE.ConeGeometry(wd * 1.3, wd * 3, 3).rotateX(Math.PI / 2), { p: [0, 0, len * 0.38 + len * 0.5 + wd], c: col });
      hb.add("metal", new THREE.CylinderGeometry(wd * 2, wd * 2, 0.025, 12), { c: C.brassHi });
      hb.finish(g); W.add(g); return g;
    };
    const big = mk(r * 0.82, 0.05 * r, C.brass, 0.085), small = mk(r * 0.55, 0.075 * r, C.brassDk, 0.1);
    env.ud.spin = (v) => { big.rotation.y = -v * Math.PI / 180; small.rotation.y = -v * Math.PI / 180 / 12; };
    env.ud.spin(0);
  });
  let DIAL_TEX = null;
  function dialFaceTexture() {
    if (DIAL_TEX) return DIAL_TEX;
    const S = 512, c = canvas(S, S), g = c.getContext("2d"), m = S / 2;
    const gr = g.createRadialGradient(m, m, 20, m, m, m); gr.addColorStop(0, "#2e3a66"); gr.addColorStop(1, "#1a2147");
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, m, 0, TAU); g.fill();
    g.strokeStyle = "#c8963e"; g.fillStyle = "#e8b556"; g.lineCap = "round";
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, big = i % 5 === 0; g.lineWidth = big ? 6 : 2.5; g.beginPath(); g.moveTo(m + Math.cos(a) * m * (big ? 0.72 : 0.8), m + Math.sin(a) * m * (big ? 0.72 : 0.8)); g.lineTo(m + Math.cos(a) * m * 0.96, m + Math.sin(a) * m * 0.96); g.stroke(); }
    g.font = "bold 54px serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const rom = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU - Math.PI / 2; g.save(); g.translate(m + Math.cos(a) * m * 0.6, m + Math.sin(a) * m * 0.6); g.rotate(a + Math.PI / 2); g.fillText(rom[i], 0, 0); g.restore(); }
    g.lineWidth = 4; g.beginPath(); g.arc(m, m, m * 0.34, 0, TAU); g.stroke();
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(m + Math.cos(a) * m * 0.12, m + Math.sin(a) * m * 0.12); g.lineTo(m + Math.cos(a) * m * (i % 2 ? 0.24 : 0.31), m + Math.sin(a) * m * (i % 2 ? 0.24 : 0.31)); g.stroke(); }
    DIAL_TEX = ctex(c); own.push(DIAL_TEX); return DIAL_TEX;
  }

  // ================================================================================================ public API
  const STATIC = {};
  function build(item, ctx) {
    if (!THREE || !item) return null;
    const d = TYPES[item.type]; if (!d) { warn("unknown decor type", item.type); return null; }
    try {
      ctx = ctx || {};
      if (d.stat) {
        const key = item.type + JSON.stringify([item.face, item.rot, item.side, item.dir, item.len, item.w, item.h, item.r, item.s, item.style, item.path, item.axis]) + (ctx.quality || "");
        let tpl = STATIC[key];
        if (!tpl) {
          const env = makeEnv(item.type, d, item, ctx); d.build(env); finalizeEnv(env); tpl = STATIC[key] = { root: env.root, q: env.q.clone(), n: env.n.clone() };
          env.root.traverse(o => { if (o.geometry) o.userData.sharedGeom = true; });
        }
        const root = tpl.root.clone(true);
        const at = item.at || [0, 0, 0];
        root.position.set(at[0] + 0.5 + 0.5 * tpl.n.x, at[1] + 0.5 + 0.5 * tpl.n.y, at[2] + 0.5 + 0.5 * tpl.n.z); root.quaternion.copy(tpl.q);
        root.userData = { type: item.type, mode: tpl.root.userData.mode, update: function () { }, dispose: function () { } };
        return root;
      }
      const env = makeEnv(item.type, d, item, ctx);
      d.build(env); finalizeEnv(env); placeRoot(env);
      return env.root;
    } catch (e) { warn("build failed for", item.type, e); return null; }
  }

  const Decor = {
    ready: false, atlases,
    types: {},
    init(three, rend) {
      THREE = three || window.THREE; renderer = rend || null;
      return new Promise((resolve) => {
        try {
          makeTextures(); if (renderer) makeEnv0(); makeMaterials();
        } catch (e) { warn("init failed", e); }
        Promise.all(ATLAS_NAMES.map(loadAtlas)).then((list) => {
          ATLAS_NAMES.forEach((n, i) => { atlases[n] = list[i] || procAtlas(n); });
          makeCardMats(); ready = Decor.ready = true; resolve();
        }).catch((e) => { warn("atlas load failed", e); ready = Decor.ready = true; resolve(); });
      });
    },
    build,
    update(dt, t) { WIND.value = t; },
    dispose(obj) { if (obj && obj.userData && obj.userData.dispose) obj.userData.dispose(); },
    disposeShared() { for (const k in STATIC) { STATIC[k].root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); delete STATIC[k]; } },
  };
  function makeEnv0() { makeEnvMap(); }
  for (const k of Object.keys(TYPES)) Decor.types[k] = { mode: TYPES[k].mode, params: TYPES[k].params };
  window.Decor = Decor;
})();
