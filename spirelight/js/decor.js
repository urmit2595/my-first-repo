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
    // soft ring (mechanism hint), drawn in the XY plane of a flat plane
    c = canvas(256, 256); g = c.getContext("2d");
    gr = g.createRadialGradient(128, 128, 70, 128, 128, 126);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.55, "rgba(255,255,255,0.55)"); gr.addColorStop(0.72, "rgba(255,255,255,1)");
    gr.addColorStop(0.86, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); T.ring = ctex(c);
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
      gr.addColorStop(0, "#e8b556"); gr.addColorStop(0.7, "#c8963e"); gr.addColorStop(1, "#8c6428");
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    const ink = glow ? "#ffb347" : "#5a3a14", ink2 = glow ? "#fff0b0" : "#3b2410";
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = ink; g.lineWidth = 6;
    g.beginPath(); g.arc(m, m, m * 0.9, 0, TAU); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(m, m, m * 0.8, 0, TAU); g.stroke();
    // rays: alternating long triangles and short ones
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU, long = i % 2 === 0, r0 = m * 0.4, r1 = m * (long ? 0.74 : 0.6), w = long ? 0.11 : 0.07;
      g.fillStyle = long ? ink2 : ink;
      g.beginPath(); g.moveTo(m + Math.cos(a - w) * r0, m + Math.sin(a - w) * r0); g.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1);
      g.lineTo(m + Math.cos(a + w) * r0, m + Math.sin(a + w) * r0); g.closePath(); g.fill();
    }
    g.fillStyle = ink2; g.beginPath(); g.arc(m, m, m * 0.34, 0, TAU); g.fill();
    g.fillStyle = glow ? "#ffffff" : "#c8963e"; g.beginPath(); g.arc(m, m, m * 0.27, 0, TAU); g.fill();
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
  function makeEnv() {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const sc = new THREE.Scene();
      const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
        fragmentShader: "varying vec3 vP; void main(){ float h = vP.y;" +
          "vec3 top = vec3(0.16,0.17,0.42), mid = vec3(0.55,0.35,0.62), hor = vec3(1.0,0.62,0.38), low = vec3(0.28,0.18,0.3);" +
          "vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.25,0.9,h)), smoothstep(0.0,0.35,h)) : mix(hor, low, smoothstep(0.0,-0.5,h));" +
          "float sun = pow(max(dot(vP, normalize(vec3(-0.55,0.45,0.7))),0.), 24.); c += vec3(2.4,1.5,0.7)*sun;" +
          "float sun2 = pow(max(dot(vP, normalize(vec3(0.7,0.2,-0.5))),0.), 8.); c += vec3(0.25,0.35,0.7)*sun2;" +
          "gl_FragColor = vec4(c,1.); }",
      }));
      sc.add(sky);
      const rt = pm.fromScene(sc, 0.02);
      M._envTex = rt.texture; pm.dispose();
      sky.geometry.dispose(); sky.material.dispose();
    } catch (e) { warn("env map failed", e); M._envTex = null; }
  }

  function makeMaterials() {
    const env = M._envTex;
    M.metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.34, envMap: env, envMapIntensity: 1.25 });
    if (!env) { M.metal.metalness = 0.55; M.metal.roughness = 0.45; }
    M.matte = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.78, envMap: env, envMapIntensity: 0.5, bumpMap: T.noise, bumpScale: 0.6 });
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

  // pulsing handle ring: lies flat in the local XZ plane (the handle axis is local y)
  function addHint(env, radius, y) {
    const m = new THREE.MeshBasicMaterial({ map: T.ring, color: lin(0xffd27a), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.8 });
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
