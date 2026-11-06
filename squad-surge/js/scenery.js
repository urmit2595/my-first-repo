"use strict";
// Scenery: renderer colour pipeline, lights, shadows, sky/backdrop, ground/water, road, curbs, sidewalks, buildings, props.
// See design/overhaul.md sections 3, 5, 6. Public API: setup(ctx), preload(theme) -> Promise, build(theme, length), update(dt).
window.Scenery = (() => {
  let C = null, T = null;
  const BASE = "assets/env/";
  const cache = { common: null, kits: {} };
  const S = { sky: null, back: null, sun: null, hemi: null, envRT: null, pmrem: null, time: 0, water: null, cfg: null, K: null, themeId: null, shadowOn: true };
  const D_BACK = 300;

  // ------------------------------------------------------------------ per-theme look
  const ROWS = {
    town: { front: 11, depth: [6.5, 9], scale: [0.95, 1.18], roof: "gable", lot: 0.12, alley: 0.1, lotW: [8, 15], hvar: true },
    ruins: { front: 11.4, depth: [6, 8], scale: [0.62, 0.78], roof: "flat", lot: 0.2, alley: 0.1, lotW: [8, 16], hvar: true, ragged: true },
    arena: { front: 11.6, depth: [4, 4], scale: [1, 1], roof: "stand", lot: 0, alley: 0, lotW: [8, 8], pick: [0, 0, 0, 1] },
    desert: { front: 14.5, depth: [5, 7], scale: [0.9, 1.25], roof: "flat", lot: 0.8, alley: 0, lotW: [30, 80], hvar: false },
    pier: { front: 8.4, depth: [3.2, 3.6], scale: [0.9, 1.1], roof: "gable", lot: 0.93, alley: 0, lotW: [40, 90], hvar: false, shed: true },
  };
  const CFG = {
    town: { exposure: 1.05, fog: [48, 210], sun: [0xffd29c, 2.0], sunPos: [-7, 18, -4], hemi: [0xbfd2ff, 0xd9a874, 1.0], tint: 0xffffff, rows: "town", walk: [1.4, 4.2], curb: [10, 18], far: null, lotStep: null, ground: 0x8a9a4a, sand: false,
      env: [0x7da6ff, 0xffd2a0, 0xb98a5c, 0xffc070], plain: 0.82 },
    ruins: { exposure: 1.05, fog: [34, 160], sun: [0xffc896, 1.5], sunPos: [-7, 18, -4], hemi: [0xb9b5b0, 0x8a7766, 0.95], tint: 0xe6dccf, rows: "ruins", walk: [2.2, 5.5], curb: [12, 22], far: [55, 110, 28, 70], lotStep: null, ground: 0x7a6d5e,
      env: [0x8d9db0, 0xe0b790, 0x7a6552, 0xffb070], plain: 0.72 },
    bridge: { exposure: 1.1, fog: [60, 240], sun: [0xfff1dc, 2.2], sunPos: [-7, 18, -4], hemi: [0xc8e4ff, 0x9bb5c8, 0.9], tint: 0xffffff, rows: null, walk: [5, 12], curb: [14, 20], far: [90, 170, 40, 95], lotStep: null, water: { y: -13, deep: 0x1568b0, shallow: [0.30, 0.74, 0.95] }, remapLot: true,
      env: [0x5fa8f5, 0xdcefff, 0x8fb5d0, 0xfff0d0], plain: 0.9 },
    pier: { exposure: 1.08, fog: [52, 220], sun: [0xfff0d4, 2.0], sunPos: [-7, 18, -4], hemi: [0xcdeaf5, 0xb3a58f, 0.9], tint: 0xffffff, rows: "pier", walk: [3.4, 7.5], curb: [9, 15], far: null, lotStep: null, water: { y: -3.3, deep: 0x12859d, shallow: [0.33, 0.82, 0.86] }, remapLot: true,
      env: [0x72c9e0, 0xf0ffff, 0xa09078, 0xffeed0], plain: 0.8 },
    desert: { exposure: 1.05, fog: [46, 200], sun: [0xffc084, 2.2], sunPos: [-7, 17, -4], hemi: [0xffe3b8, 0xd9a068, 0.85], tint: 0xffffff, rows: "desert", walk: [9, 22], curb: [28, 55], far: [70, 140, 55, 110], lotStep: [7, 16], ground: 0xe8a550, sand: true,
      env: [0xffa86a, 0xffe2b0, 0xd9a068, 0xffc070], plain: 0.85 },
    arena: { exposure: 0.95, walkTone: 0.32, fog: [40, 175], sun: [0xe9f1ff, 1.8], sunPos: [-4, 20, -3], hemi: [0x5d72b0, 0x2b3458, 0.6], tint: 0xa7b4e0, rows: "arena", walk: [3.5, 8], curb: [16, 28], far: [50, 70, 20, 28], lotStep: null, ground: 0x6a7080, remapLot: true,
      env: [0x16224a, 0x3b4c82, 0x24304f, 0xe8f0ff], plain: 0.7 },
  };

  // ------------------------------------------------------------------ helpers
  const loadImg = url => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => { console.warn("scenery: could not load", url); res(null); }; i.src = url; });
  const loadJson = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const lin = hex => new T.Color(hex).convertSRGBToLinear();
  const hexOf = s => (typeof s === "string" ? parseInt(s.replace("#", ""), 16) : s);
  function mkTex(src, { srgb = true, repeat = true } = {}) {
    const t = new T.Texture(src); t.encoding = srgb ? T.sRGBEncoding : T.LinearEncoding;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = Math.min(8, C.renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true; return t;
  }
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  function srand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const hashStr = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

  // procedural fallbacks (only used when art is missing)
  function procCanvas(kind, base) {
    const c = mkCanvas(256, 256), x = c.getContext("2d"), r = srand(hashStr(kind));
    const b = new T.Color(base || 0x808080), css = (m = 1) => `rgb(${Math.min(255, b.r * 255 * m) | 0},${Math.min(255, b.g * 255 * m) | 0},${Math.min(255, b.b * 255 * m) | 0})`;
    x.fillStyle = css(); x.fillRect(0, 0, 256, 256);
    if (kind === "deck") { for (let i = 0; i < 8; i++) { x.fillStyle = css(0.85 + r() * 0.3); x.fillRect(0, i * 32, 256, 30); } }
    else if (kind === "cobble") { for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { x.fillStyle = css(0.8 + r() * 0.35); x.fillRect(i * 43 + (j % 2) * 21, j * 32 + 2, 40, 28); } }
    else if (kind === "roof") { for (let j = 0; j < 8; j++) { x.fillStyle = css(0.8 + (j % 2) * 0.2); x.fillRect(0, j * 32, 256, 28); } }
    else if (kind === "concrete") { x.strokeStyle = css(0.7); x.lineWidth = 3; x.strokeRect(0, 0, 256, 256); x.strokeRect(0, 0, 128, 128); x.strokeRect(128, 128, 128, 128); }
    for (let i = 0; i < 900; i++) { x.fillStyle = css(0.75 + r() * 0.5); x.globalAlpha = 0.35; x.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3); }
    x.globalAlpha = 1; return c;
  }
  function wornPaint() {
    const c = mkCanvas(64, 128), x = c.getContext("2d"), r = srand(5);
    x.fillStyle = "#f4f1e6"; x.fillRect(0, 0, 64, 128);
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 380; i++) { x.globalAlpha = 0.4 + r() * 0.6; x.fillRect(r() * 64, r() * 128, 1 + r() * 4, 1 + r() * 6); }
    for (let i = 0; i < 40; i++) { x.globalAlpha = 0.5; x.fillRect(r() * 64, r() * 128, 6 + r() * 10, 1 + r() * 2); }
    x.globalAlpha = 1; x.fillRect(0, 0, 64, 2); x.fillRect(0, 126, 64, 2);
    return c;
  }
  function curbCanvas() {
    const c = mkCanvas(256, 64), x = c.getContext("2d"), r = srand(11);
    x.fillStyle = "#f1be2a"; x.fillRect(0, 0, 128, 64); x.fillStyle = "#34343a"; x.fillRect(128, 0, 128, 64);
    for (let i = 0; i < 700; i++) { x.fillStyle = r() < 0.5 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.1)"; x.fillRect(r() * 256, r() * 64, 2 + r() * 3, 2 + r() * 3); }
    x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(126, 0, 4, 64); x.fillRect(254, 0, 2, 64); x.fillRect(0, 0, 2, 64);
    return c;
  }
  function blobTex() {
    const c = mkCanvas(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(20,12,10,.5)"); g.addColorStop(0.55, "rgba(20,12,10,.28)"); g.addColorStop(1, "rgba(20,12,10,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  }

  // ------------------------------------------------------------------ geometry batch
  class Batch {
    constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.v = 0; }
    quad(P, UV, col, hint) { // P: 4 points [x,y,z] counter-clockwise seen from outside; UV: 4 [u,v]; col: Color or [Color x4]
      let a = P[0], b = P[1], d = P[3];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { P = [P[0], P[3], P[2], P[1]]; UV = [UV[0], UV[3], UV[2], UV[1]]; if (Array.isArray(col)) col = [col[0], col[3], col[2], col[1]]; nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 4; k++) {
        this.p.push(P[k][0], P[k][1], P[k][2]); this.n.push(nx, ny, nz); this.u.push(UV[k][0], UV[k][1]);
        const cc = Array.isArray(col) ? col[k] : col; this.c.push(cc.r, cc.g, cc.b);
      }
      const o = this.v; this.i.push(o, o + 1, o + 2, o, o + 2, o + 3); this.v += 4;
    }
    tri(P, UV, col, hint) {
      let a = P[0], b = P[1], d = P[2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { P = [P[0], P[2], P[1]]; UV = [UV[0], UV[2], UV[1]]; nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) { this.p.push(P[k][0], P[k][1], P[k][2]); this.n.push(nx, ny, nz); this.u.push(UV[k][0], UV[k][1]); this.c.push(col.r, col.g, col.b); }
      const o = this.v; this.i.push(o, o + 1, o + 2); this.v += 3;
    }
    // axis aligned box, world-space tiled uv (tile) or a fixed uv point (fix) for atlas colour cells. top colour may differ.
    box(x0, x1, y0, y1, z0, z1, col, o = {}) {
      const tile = o.tile || 1, fx = o.fix, top = o.top || col, bot = o.bot || col;
      const U = (a, b) => (fx ? fx : [a / tile, b / tile]);
      const cv = (cb, ct) => [cb, cb, ct, ct];
      if (!o.noTop) this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1)], top, [0, 1, 0]);
      this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)], cv(bot, col), [0, 0, 1]);
      this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)], cv(bot, col), [0, 0, -1]);
      this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)], cv(bot, col), [-1, 0, 0]);
      this.quad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)], cv(bot, col), [1, 0, 0]);
    }
    cyl(x, z, r, y0, y1, col, seg = 8, fix) {
      for (let k = 0; k < seg; k++) {
        const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
        this.quad([[x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x + Math.cos(a1) * r, y1, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y1, z + Math.sin(a0) * r]],
          fix ? [fix, fix, fix, fix] : [[0, 0], [1, 0], [1, 1], [0, 1]], col, [Math.cos(am), 0, Math.sin(am)]);
      }
    }
    // thin beam between two points (square section)
    beam(a, b, w, col, fix) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
      let ux = dx / L, uy = dy / L, uz = dz / L;
      // pick a perpendicular pair
      let sx = 0, sy = 1, sz = 0; if (Math.abs(uy) > 0.9) { sx = 1; sy = 0; }
      let px = uy * sz - uz * sy, py = uz * sx - ux * sz, pz = ux * sy - uy * sx; const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
      let qx = uy * pz - uz * py, qy = uz * px - ux * pz, qz = ux * py - uy * px;
      const h = w / 2, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const pts = (end) => c.map(([i, j]) => [end[0] + (px * i + qx * j) * h, end[1] + (py * i + qy * j) * h, end[2] + (pz * i + qz * j) * h]);
      const A = pts(a), B = pts(b), uv = [fix, fix, fix, fix];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4, mx = (c[k][0] + c[k2][0]) * px / 2 + (c[k][1] + c[k2][1]) * qx / 2, my = (c[k][0] + c[k2][0]) * py / 2 + (c[k][1] + c[k2][1]) * qy / 2, mz = (c[k][0] + c[k2][0]) * pz / 2 + (c[k][1] + c[k2][1]) * qz / 2;
        this.quad([A[k], A[k2], B[k2], B[k]], uv, col, [mx, my, mz]);
      }
    }
    get empty() { return this.v === 0; }
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(this.u, 2)); g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.v > 65000 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1));
      g.computeBoundingSphere(); g.computeBoundingBox(); return g;
    }
  }

  // ------------------------------------------------------------------ assets
  async function preloadCommon() {
    if (cache.common) return cache.common;
    const K = cache.common = { road: null, decals: null, decalJson: null, paint: null, curb: null, blob: null };
    const [road, dec, dj] = await Promise.all([loadImg(BASE + "common/road.jpg"), loadImg(BASE + "common/decals.png"), loadJson(BASE + "common/decals.json")]);
    K.roadImg = road; K.decalImg = dec; K.decalJson = dj;
    K.build = () => {
      if (!K.road) K.road = mkTex(road || procCanvas("asphalt", 0x55565c));
      if (!K.decals && dec) { K.decals = mkTex(dec, { repeat: false }); }
      if (!K.paint) K.paint = mkTex(wornPaint(), { repeat: true });
      if (!K.curb) K.curb = mkTex(curbCanvas(), { repeat: true });
      if (!K.blob) { K.blob = mkTex(blobTex(), { srgb: false, repeat: false }); }
    };
    return K;
  }

  function avgBottom(img) { // average colour of the lowest rows of the backdrop (the haze band)
    const c = mkCanvas(32, 8), x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, img.height * 0.9, img.width, img.height * 0.1, 0, 0, 32, 8);
    const d = x.getImageData(0, 0, 32, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; return ((r / n | 0) << 16) | ((g / n | 0) << 8) | (b / n | 0);
  }

  function packFacades(list, white) { // shelf-pack the facade images into one atlas canvas; cell 0 is a white swatch
    const MAXW = 2048, PAD = 4, out = [];
    const items = list.map(f => { const s = Math.min(1, 512 / Math.max(f.img.width, f.img.height)); return { f, w: Math.round(f.img.width * s), h: Math.round(f.img.height * s) }; });
    let x = 12, y = 0, rowH = 12; const place = [];
    for (const it of items) { if (x + it.w + PAD > MAXW) { x = 0; y += rowH + PAD; rowH = 0; } place.push([x + PAD / 2, y + PAD / 2]); x += it.w + PAD; rowH = Math.max(rowH, it.h + PAD); }
    const H = Math.min(2048, Math.max(16, y + rowH)), c = mkCanvas(MAXW, H), cx = c.getContext("2d", { willReadFrequently: true });
    cx.fillStyle = "#fff"; cx.fillRect(0, 0, 10, 10);
    items.forEach((it, i) => {
      const [px, py] = place[i]; cx.drawImage(it.f.img, px, py, it.w, it.h);
      const d = cx.getImageData(px, py + it.h * 0.15, it.w, it.h * 0.7).data; let r = 0, g = 0, b = 0, n = 0;
      for (let k = 0; k < d.length; k += 16) if (d[k + 3] > 200) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
      n = n || 1;
      out.push({ w: it.f.w, h: it.f.h, name: it.f.file, avg: new T.Color(((r / n | 0) << 16) | ((g / n | 0) << 8) | (b / n | 0)), u0: (px + 1) / MAXW, u1: (px + it.w - 1) / MAXW, v0: 1 - (py + it.h - 1) / H, v1: 1 - (py + 1) / H });
    });
    return { canvas: c, cells: out, white: [5 / MAXW, 1 - 5 / H] };
  }

  const preloading = {};
  function preload(theme) {
    const id = theme.id;
    if (preloading[id]) return preloading[id];
    return preloading[id] = (async () => {
      try {
        await preloadCommon();
        const dir = BASE + id + "/";
        const kit = (await loadJson(dir + "kit.json")) || {};
        const bj = await loadJson(dir + "backdrop.json");
        const K = { id, kit, tex: {}, tile: {}, imgs: {}, back: null, facs: [], props: null };
        const jobs = [];
        for (const [name, d] of Object.entries(kit.textures || {})) { K.tile[name] = d.tile || 6; jobs.push(loadImg(dir + d.file).then(i => { K.imgs[name] = i; })); }
        let backImg = null;
        if (bj && bj.file) jobs.push(loadImg(dir + bj.file).then(i => { backImg = i; }));
        const facImgs = (kit.facades || []).map(f => ({ ...f, img: null })); facImgs.forEach(f => jobs.push(loadImg(dir + f.file).then(i => { f.img = i; })));
        let atlasImg = null; const pr = kit.props;
        if (pr && pr.atlas) jobs.push(loadImg(dir + pr.atlas).then(i => { atlasImg = i; }));
        await Promise.all(jobs);
        K.bj = bj; K.backImg = backImg; K.atlasImg = atlasImg;
        K.haze = backImg ? avgBottom(backImg) : (bj && bj.haze ? hexOf(bj.haze) : (theme.fog || 0xcccccc));
        K.horizon = (bj && bj.horizon) || 0.5;
        const fl = facImgs.filter(f => f.img);
        K.facList = fl;
        if (pr && atlasImg && pr.items) {
          K.items = pr.items.filter(i => i.rect);
        } else K.items = [];
        K.make = () => { // GPU-side objects, (re)created on demand after a dispose
          if (K.made) return; K.made = true;
          for (const [name, img] of Object.entries(K.imgs)) K.tex[name] = mkTex(img || procCanvas(name === "deck" ? "deck" : name === "roof" ? "roof" : name === "sidewalk" ? "cobble" : "ground", name === "roof" ? 0xc0603a : 0x909090));
          if (backImg) { const t = mkTex(backImg, { srgb: false, repeat: false }); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; K.back = { tex: t, aspect: backImg.width / backImg.height }; }
          if (fl.length) { const p = packFacades(fl, true); K.facs = p.cells; K.facTex = mkTex(p.canvas, { repeat: false }); K.white = p.white; K.facTex.wrapS = K.facTex.wrapT = T.ClampToEdgeWrapping; }
          if (atlasImg) { const t = mkTex(atlasImg, { srgb: false, repeat: false }); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; K.atlasTex = t; }
        };
        cache.kits[id] = K; return K;
      } catch (e) { console.warn("scenery preload failed", id, e); return null; }
    })();
  }
  function disposeKit(K) {
    if (!K || !K.made) return;
    for (const t of Object.values(K.tex)) t.dispose(); K.tex = {};
    if (K.back) K.back.tex.dispose(); if (K.facTex) K.facTex.dispose(); if (K.atlasTex) K.atlasTex.dispose();
    K.back = null; K.facTex = null; K.atlasTex = null; K.facs = []; K.made = false;
  }

  // ------------------------------------------------------------------ setup
  function setup(ctx) {
    C = ctx; T = ctx.THREE;
    const { renderer, scene } = C;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    S.hemi = new T.HemisphereLight(0xffffff, 0x888888, 0.8); scene.add(S.hemi);
    const sun = S.sun = new T.DirectionalLight(0xffffff, 1.5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 130;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);
    S.pmrem = new T.PMREMGenerator(renderer);
    // sky: gradient dome with sun glow, raw sRGB output
    S.skyMat = new T.ShaderMaterial({
      uniforms: { top: { value: new T.Color() }, bot: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 0, -1) }, sunCol: { value: new T.Color() } },
      vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vD; void main(){ vec3 d = normalize(vD); float t = smoothstep(-0.02, 0.55, d.y); vec3 c = mix(bot, top, t); float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.5); gl_FragColor = vec4(c, 1.0); }",
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false });
    S.sky = new T.Mesh(new T.SphereBufferGeometry(350, 24, 12), S.skyMat); S.sky.frustumCulled = false; S.sky.renderOrder = -10; scene.add(S.sky);
    // backdrop: far plane showing the theme's panorama; the image row `horizon` sits on the camera's horizon
    S.backMat = new T.ShaderMaterial({
      uniforms: { map: { value: null }, planeSize: { value: new T.Vector2(1, 1) }, imgSize: { value: new T.Vector2(1, 1) }, hz: { value: 0.5 }, uOff: { value: 0 }, tint: { value: new T.Color(1, 1, 1) } },
      vertexShader: "uniform vec2 planeSize; uniform vec2 imgSize; uniform float hz; uniform float uOff; varying vec2 vUv; void main(){ vec2 p = position.xy * planeSize; vUv = vec2(0.5 + p.x / imgSize.x + uOff, (1.0 - hz) + p.y / imgSize.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform sampler2D map; uniform vec3 tint; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(map, clamp(vUv, 0.003, 0.997)).rgb * tint, 1.0); }",
      depthWrite: false, fog: false });
    S.back = new T.Mesh(new T.PlaneBufferGeometry(1, 1), S.backMat); S.back.frustumCulled = false; S.back.renderOrder = -9; S.back.visible = false; scene.add(S.back);
  }

  function makeEnv(cfg) {
    const e = cfg.env, sc = new T.Scene();
    const m = new T.ShaderMaterial({
      uniforms: { top: { value: lin(e[0]) }, mid: { value: lin(e[1]) }, bot: { value: lin(e[2]) }, sun: { value: lin(e[3]) }, sd: { value: new T.Vector3(...cfg.sunPos).normalize() } },
      vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun; uniform vec3 sd; varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = d.y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, d.y)) : mix(mid, bot, smoothstep(0.0, 0.5, -d.y)); float s = max(dot(d, sd), 0.0); c += sun * (pow(s, 12.0) * 1.2 + pow(s, 200.0) * 25.0); gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }",
      side: T.BackSide });
    sc.add(new T.Mesh(new T.SphereBufferGeometry(10, 32, 16), m));
    const rt = S.pmrem.fromScene(sc, 0.02);
    sc.children[0].geometry.dispose(); m.dispose();
    if (S.envRT) S.envRT.dispose(); S.envRT = rt; C.scene.environment = rt.texture;
  }

  // ------------------------------------------------------------------ water
  function makeWater(cfg, w, d) {
    const wc = cfg.water;
    const m = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { time: { value: 0 }, deep: { value: new T.Color(wc.deep) }, shallow: { value: new T.Vector3(...wc.shallow) }, sunDir: { value: new T.Vector3(...cfg.sunPos).normalize() }, skyCol: { value: new T.Color(cfg.env[0]) } }]),
      fog: true,
      vertexShader: "varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}",
      fragmentShader: `uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 sunDir; uniform vec3 skyCol; varying vec3 vW;
      #include <fog_pars_fragment>
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vW.xz; float t = time;
        vec2 g = vec2(0.0);
        g += vec2(cos(p.x * 0.35 + t * 0.9) * 0.35, 0.0) + vec2(0.0, cos(p.y * 0.28 - t * 0.7) * 0.28);
        g += vec2(cos(dot(p, vec2(0.7, 0.4)) * 0.9 + t * 1.6), cos(dot(p, vec2(0.7, 0.4)) * 0.9 + t * 1.6) * 0.5) * 0.22;
        g += vec2(cos(dot(p, vec2(-0.4, 0.9)) * 1.7 - t * 2.1)) * 0.14;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float band = 0.5 + 0.5 * sin(p.x * 0.18 + sin(p.y * 0.07 + t * 0.2) * 2.0);
        vec3 col = mix(deep, shallow, 0.35 + 0.4 * band);
        col = mix(col, skyCol, fr * 0.35);
        float foam = smoothstep(0.9, 1.0, sin(dot(p, vec2(0.5, 0.86)) * 1.3 + t * 1.1 + sin(p.x * 0.4) * 1.5));
        col += vec3(0.5, 0.6, 0.65) * foam * 0.18;
        vec3 hv = normalize(sunDir + v);
        float sp = pow(max(dot(n, hv), 0.0), 220.0);
        vec2 cell = floor(p * 2.2); float r = h21(cell + floor(t * 1.5)); float spark = step(0.965, r) * smoothstep(0.0, 0.5, fract(t * 1.5 + r * 7.0)) * (1.0 - smoothstep(0.5, 1.0, fract(t * 1.5 + r * 7.0)));
        col += vec3(1.0, 0.97, 0.85) * (sp * 1.6 + spark * 0.9);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }` });
    const g = new T.PlaneBufferGeometry(w, d); g.rotateX(-Math.PI / 2);
    const mesh = new T.Mesh(g, m); S.water = m; return mesh;
  }

  // ------------------------------------------------------------------ build
  function clearWorld() {
    const { world } = C;
    const geos = new Set(), mats = new Set();
    world.traverse(o => { if (o.geometry) geos.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); });
    while (world.children.length) world.remove(world.children[0]);
    geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
    S.water = null;
  }

  function build(theme, length) {
    const cfg = CFG[theme.id] || CFG.town, K = cache.kits[theme.id] || null, CM = cache.common;
    S.cfg = cfg; S.K = K; S.themeId = theme.id;
    clearWorld();
    for (const [id, k] of Object.entries(cache.kits)) if (id !== theme.id) disposeKit(k);
    if (K) K.make(); if (CM) CM.build();
    const { renderer, scene, world, ROAD } = C;
    const rnd = srand(length * 131 + hashStr(theme.id));
    const R = (a, b) => a + rnd() * (b - a);
    const Z0 = 48, Z1 = -length - 270, span = Z0 - Z1, zc = (Z0 + Z1) / 2;
    const id = theme.id, hasWater = !!cfg.water;

    // light, fog, sky, exposure ------------------------------------------------
    renderer.toneMappingExposure = cfg.exposure;
    S.hemi.color.set(cfg.hemi[0]).convertSRGBToLinear(); S.hemi.groundColor.set(cfg.hemi[1]).convertSRGBToLinear(); S.hemi.intensity = cfg.hemi[2];
    S.sun.color.set(cfg.sun[0]).convertSRGBToLinear(); S.sun.intensity = cfg.sun[1];
    const haze = K ? K.haze : (theme.fog || 0xcccccc);
    scene.fog = new T.Fog(haze, cfg.fog[0], cfg.fog[1]); scene.background = new T.Color(haze);
    C.setSpriteTint(cfg.tint);
    S.skyMat.uniforms.top.value.set(theme.sky[0]); S.skyMat.uniforms.bot.value.set(theme.sky[1]);
    S.skyMat.uniforms.sunDir.value.set(...cfg.sunPos).normalize(); S.skyMat.uniforms.sunCol.value.set(cfg.sun[0]).multiplyScalar(0.8);
    if (K && K.back) { S.backMat.uniforms.map.value = K.back.tex; S.back.visible = true; S.backAspect = K.back.aspect; S.hz = K.horizon; S.backMat.uniforms.hz.value = K.horizon; }
    else S.back.visible = false;
    makeEnv(cfg);

    // materials --------------------------------------------------------------
    const L = (o) => new T.MeshLambertMaterial(o);
    const tex = (n, fallbackKind, fallbackCol) => (K && K.tex[n]) || (K && K.tex.sidewalk && n === "deck" ? K.tex.sidewalk : (CM[`_f_${id}_${n}`] ||= mkTex(procCanvas(fallbackKind, fallbackCol))));
    const tile = (n, d) => (K && K.tile[n]) || d;
    const white = new T.Color(1, 1, 1);
    const isPier = id === "pier", isBridge = id === "bridge";

    // ground / water -------------------------------------------------------------
    if (hasWater) {
      const w = makeWater(cfg, 700, span + 40); w.position.set(0, cfg.water.y, zc); world.add(w);
    } else {
      const gt = tex("ground", "ground", cfg.ground), gTile = tile("ground", 10), b = new Batch();
      const x0 = -170, x1 = 170;
      b.quad([[x0, -0.03, Z0], [x1, -0.03, Z0], [x1, -0.03, Z1], [x0, -0.03, Z1]], [[x0 / gTile, Z0 / gTile], [x1 / gTile, Z0 / gTile], [x1 / gTile, Z1 / gTile], [x0 / gTile, Z1 / gTile]], white, [0, 1, 0]);
      const m = new T.Mesh(b.geometry(), L({ map: gt, vertexColors: true, color: id === "ruins" ? lin(0xcfc4b8) : white })); m.receiveShadow = true; world.add(m);
    }

    // road --------------------------------------------------------------------
    const roadTex = isPier ? tex("deck", "deck", 0x7a5a3a) : (CM.road);
    const rTile = isPier ? tile("deck", 3) * 2 : 7;
    {
      const b = new Batch(), x0 = -ROAD, x1 = ROAD, y = 0;
      const uv = (x, z) => (isPier ? [z / rTile, x / rTile] : [x / rTile, z / rTile]);
      b.quad([[x0, y, Z0], [x1, y, Z0], [x1, y, Z1], [x0, y, Z1]], [uv(x0, Z0), uv(x1, Z0), uv(x1, Z1), uv(x0, Z1)], white, [0, 1, 0]);
      const m = new T.Mesh(b.geometry(), L({ map: roadTex, vertexColors: true, color: isPier ? lin(0xcfb8a0) : new T.Color(0.72, 0.68, 0.66) })); m.receiveShadow = true; world.add(m);
    }
    // curbs (yellow/black hazard stripes) ------------------------------------------
    {
      const b = new Batch(), cuv = (z, v) => [z / 2, v];
      for (const s of [-1, 1]) {
        const xi = s * ROAD, xc = s * (ROAD + 0.08), xo = s * (ROAD + 0.62), yt = 0.3, yc = 0.23;
        const side = (xa, ya, xb, yb, h) => b.quad([[xa, ya, Z0], [xa, ya, Z1], [xb, yb, Z1], [xb, yb, Z0]], [cuv(Z0, 0), cuv(Z1, 0), cuv(Z1, 1), cuv(Z0, 1)], white, h);
        side(xi, 0, xi, yc, [-s, 0, 0]); side(xi, yc, xc, yt, [-s, 1, 0]); side(xc, yt, xo, yt, [0, 1, 0]); side(xo, yt, xo, 0.15, [s, 0, 0]);
      }
      const m = new T.Mesh(b.geometry(), L({ map: CM.curb, vertexColors: true })); m.receiveShadow = true; m.castShadow = true; world.add(m);
    }
    // sidewalks -------------------------------------------------------------------
    {
      const sw = isPier ? tex("deck", "deck", 0x7a5a3a) : tex("sidewalk", "concrete", 0xa0a0a8), st = isPier ? tile("deck", 3) * 1.3 : tile("sidewalk", 4);
      const b = new Batch(), yt = 0.2, xi = ROAD + 0.62, xo = 11.0, yb = hasWater ? -1.3 : -0.05;
      const wt = cfg.walkTone || (id === "ruins" ? 0.85 : 1), sh = new T.Color(wt, wt, wt);
      for (const s of [-1, 1]) {
        const xa = s * xi, xb = s * xo, uv = (x, z) => (isPier ? [z / st, x / st] : [x / st, z / st]);
        b.quad([[xa, yt, Z0], [xb, yt, Z0], [xb, yt, Z1], [xa, yt, Z1]], [uv(xa, Z0), uv(xb, Z0), uv(xb, Z1), uv(xa, Z1)], white, [0, 1, 0]);
        const dark = new T.Color(0.55, 0.55, 0.55);
        b.quad([[xb, yb, Z0], [xb, yb, Z1], [xb, yt, Z1], [xb, yt, Z0]], [[Z0 / st, yb / st], [Z1 / st, yb / st], [Z1 / st, yt / st], [Z0 / st, yt / st]], [dark, dark, white, white], [s, 0, 0]);
      }
      const m = new T.Mesh(b.geometry(), L({ map: sw, vertexColors: true, color: sh })); m.receiveShadow = true; world.add(m);
      if (hasWater) { // under-deck fascia
        const fb = new Batch(), steel = lin(isPier ? 0x5a4026 : 0x59657a), dk = lin(isPier ? 0x3a281a : 0x39414f);
        for (const s of [-1, 1]) fb.box(s * (xo - 0.05), s * (xo + 0.0), yb - 0.2, 0.2, Z1, Z0, steel, { bot: dk, noTop: true, fix: [0.5, 0.5] });
        const fm = new T.Mesh(fb.geometry(), L({ vertexColors: true })); world.add(fm);
      }
    }
    // road markings -----------------------------------------------------------------
    {
      const b = new Batch(), y = 0.022, r2 = srand(length * 17 + 3);
      for (let z = Z0 - 1; z > Z1; z -= 5) { // dashed centre line
        const l = 2.3, w = 0.22, v0 = r2() * 0.8;
        b.quad([[-w / 2, y, z], [w / 2, y, z], [w / 2, y, z - l], [-w / 2, y, z - l]], [[0, v0], [1, v0], [1, v0 + 0.2], [0, v0 + 0.2]], white, [0, 1, 0]);
      }
      for (const s of [-1, 1]) for (let z = Z0; z > Z1; z -= 9) { // thin edge lines, broken here and there
        if (r2() < 0.07) continue;
        const w = 0.13, x = s * (ROAD - 0.45), l = 8.8, v0 = r2() * 0.8;
        b.quad([[x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y, z - l], [x - w / 2, y, z - l]], [[0, v0], [1, v0], [1, v0 + 0.2], [0, v0 + 0.2]], white, [0, 1, 0]);
      }
      const m = new T.Mesh(b.geometry(), L({ map: CM.paint, alphaTest: 0.4, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.receiveShadow = true; world.add(m);
    }
    // road decals -------------------------------------------------------------------
    if (CM.decals && CM.decalJson) {
      const dj = CM.decalJson, sz = dj._size || [CM.decalImg.width, CM.decalImg.height], names = Object.keys(dj).filter(k => k[0] !== "_");
      const W = { "crack-branch": 2.8, "crack-long": 3, drain: 1.0, manhole: 1.15, skid: 1.5, "skid-b": 1.9, pothole: 1.5, patch: 2.3, oil: 1.7 };
      const wt = { "crack-branch": 3, "crack-long": 3, drain: 0.6, manhole: 0.7, skid: 1.5, "skid-b": 1.5, pothole: 0.8, patch: 2, oil: 1.2 };
      const tot = names.reduce((a, n) => a + (wt[n] || 1), 0), b = new Batch(), r3 = srand(length * 29 + 7), y = 0.012;
      for (let z = Z0 - 6; z > Z1 + 40; z -= 6 + r3() * 7) {
        let q = r3() * tot, nm = names[0]; for (const n of names) { q -= wt[n] || 1; if (q <= 0) { nm = n; break; } }
        const [rx, ry, rw, rh] = dj[nm], w = W[nm] || 1.6, h = w * rh / rw;
        let x = (r3() * 2 - 1) * (ROAD - 1.1), ang = nm === "drain" ? 0 : (nm.startsWith("skid") || nm.startsWith("crack")) ? (r3() - 0.5) * 0.7 : r3() * Math.PI * 2;
        if (nm === "drain") x = (r3() < 0.5 ? -1 : 1) * (ROAD - 0.75);
        const u0 = (rx + 2) / sz[0], u1 = (rx + rw - 2) / sz[0], v1 = 1 - (ry + 2) / sz[1], v0 = 1 - (ry + rh - 2) / sz[1], ca = Math.cos(ang), sa = Math.sin(ang);
        const pt = (lx, lz) => [x + lx * ca - lz * sa, y, z + lx * sa + lz * ca];
        b.quad([pt(-w / 2, h / 2), pt(w / 2, h / 2), pt(w / 2, -h / 2), pt(-w / 2, -h / 2)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], white, [0, 1, 0]);
      }
      const m = new T.Mesh(b.geometry(), L({ map: CM.decals, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.receiveShadow = true; m.renderOrder = 1; world.add(m);
    }

    // buildings -----------------------------------------------------------------------
    const occ = []; // z ranges occupied by buildings, per side
    const rowCfg = cfg.rows ? ROWS[cfg.rows] : null;
    if (rowCfg && K && K.facs.length) buildRows(rowCfg, K, rnd, occ, Z0, Z1, tex);
    else if (rowCfg && !(K && K.facs.length)) buildFallbackRows(rowCfg, rnd, occ, Z0, Z1);

    // theme extras ----------------------------------------------------------------------
    if (isBridge) bridgeExtras(rnd, Z0, Z1, length);
    if (isPier) pierExtras(rnd, Z0, Z1, tex);
    if (id === "desert") mesas(rnd, Z0, Z1);
    if (id === "arena") arenaExtras(Z0, Z1);

    // props ------------------------------------------------------------------------------
    if (K && K.atlasTex && K.items.length) buildProps(cfg, K, rnd, occ, Z0, Z1, hasWater ? cfg.water.y : 0);

    // sun shadows follow squad
    S.sun.position.set(...cfg.sunPos).multiplyScalar(4.2);
    S.lastSunZ = 1e9; updateSun();
    S.sun.shadow.needsUpdate = true;
  }

  // ------------------------------------------------------------------ buildings
  function buildRows(R, K, rnd, occ, Z0, Z1, tex) {
    const { world } = C, chunks = new Map();
    const white = new T.Color(1, 1, 1);
    const chunk = z => { const k = Math.floor((Z0 - z) / 90); let c = chunks.get(k); if (!c) chunks.set(k, c = { f: new Batch(), r: new Batch() }); return c; };
    const wfix = K.white, cells = K.facs;
    const plainCol = (c, k) => new T.Color(c.r * k, c.g * k, c.b * k).convertSRGBToLinear();
    const wallK = S.cfg.plain;
    const rr = (a, b) => a + rnd() * (b - a);
    const rt = tex ? (K.tex.roof || null) : null, rtile = (K.tile.roof || 3);
    for (const side of [-1, 1]) {
      let z = Z0 + 6 - rnd() * 6, prev = -1;
      while (z > Z1) {
        const r = rnd();
        if (r < R.lot) { const w = rr(R.lotW[0], R.lotW[1]); occ.push({ side, z0: z, z1: z - w, kind: "lot" }); z -= w; continue; }
        if (r < R.lot + R.alley) { const w = rr(3, 4.6); occ.push({ side, z0: z, z1: z - w, kind: "alley" }); z -= w; continue; }
        let fi = R.pick ? R.pick[Math.floor(rnd() * R.pick.length)] % cells.length : Math.floor(rnd() * cells.length);
        if (R.shed) fi = 0;
        if (fi === prev && cells.length > 1) fi = (fi + 1) % cells.length;
        prev = fi;
        const f = cells[fi], sc = rr(R.scale[0], R.scale[1]), w = f.w * sc, h = f.h * sc * (R.hvar ? rr(0.94, 1.12) : 1), depth = rr(R.depth[0], R.depth[1]);
        const z0 = z, z1 = z - w, xf = side * (R.front + (R.hvar ? rnd() * 0.5 : 0)), xb = xf + side * depth, ch = chunk(z0 - w / 2);
        const avg = f.avg, wall = plainCol(avg, wallK), wallLo = plainCol(avg, wallK * 0.7), roofCol = plainCol(avg, wallK * 0.55);
        // road-facing wall with the facade texture (u grows to the viewer's right as seen from the road)
        const zl = side < 0 ? z0 : z1, zr = side < 0 ? z1 : z0;
        const hTop = R.ragged ? h * 0.97 : h;
        ch.f.quad([[xf, 0, zl], [xf, 0, zr], [xf, h, zr], [xf, h, zl]], [[f.u0, f.v0], [f.u1, f.v0], [f.u1, f.v1], [f.u0, f.v1]], white, [-side, 0, 0]);
        ch.f.quad([[xf, 0, z0], [xb, 0, z0], [xb, hTop, z0], [xf, hTop, z0]], [wfix, wfix, wfix, wfix], [wallLo, wallLo, wall, wall], [0, 0, 1]);
        ch.f.quad([[xf, 0, z1], [xb, 0, z1], [xb, hTop, z1], [xf, hTop, z1]], [wfix, wfix, wfix, wfix], [wallLo, wallLo, wall, wall], [0, 0, -1]);
        if (R.roof === "gable") {
          const rise = depth * 0.3 + 0.4, xm = (xf + xb) / 2, ov = side * 0.35, yb = hTop - 0.15;
          const frontEdge = xf - ov, backEdge = xb + ov, rl = Math.hypot(xm - frontEdge, rise) / rtile;
          const rb = rt ? ch.r : ch.f;
          const U = (a, b) => (rt ? [a, b] : wfix);
          rb.quad([[frontEdge, yb, z0 + 0.25], [xm, hTop + rise, z0 + 0.25], [xm, hTop + rise, z1 - 0.25], [frontEdge, yb, z1 - 0.25]], [U((z0 + 0.25) / rtile, 0), U((z0 + 0.25) / rtile, rl), U((z1 - 0.25) / rtile, rl), U((z1 - 0.25) / rtile, 0)], rt ? white : roofCol, [-side * 0.5, 1, 0]);
          rb.quad([[xm, hTop + rise, z0 + 0.25], [backEdge, yb, z0 + 0.25], [backEdge, yb, z1 - 0.25], [xm, hTop + rise, z1 - 0.25]], [U((z0 + 0.25) / rtile, rl), U((z0 + 0.25) / rtile, 0), U((z1 - 0.25) / rtile, 0), U((z1 - 0.25) / rtile, rl)], rt ? white : roofCol, [side * 0.5, 1, 0]);
          ch.f.tri([[xf, hTop, z0], [xb, hTop, z0], [xm, hTop + rise, z0]], [wfix, wfix, wfix], wall, [0, 0, 1]);
          ch.f.tri([[xf, hTop, z1], [xb, hTop, z1], [xm, hTop + rise, z1]], [wfix, wfix, wfix], wall, [0, 0, -1]);
          ch.f.box(Math.min(xm - 0.35, xm + 0.35), Math.max(xm - 0.35, xm + 0.35) + 0, hTop + rise * 0.3, hTop + rise + 1.1, z0 - w * (0.2 + rnd() * 0.5), z0 - w * (0.2 + rnd() * 0.5) - 0.7, plainCol(new T.Color(0.75, 0.42, 0.3), 1), { fix: wfix });
        } else {
          const roofC = plainCol(avg, wallK * 0.55), pc = plainCol(avg, wallK * 0.9), t = 0.3, ph = 0.45;
          ch.f.box(Math.min(xf, xb), Math.max(xf, xb), hTop - 0.4, hTop, z1, z0, roofC, { fix: wfix, top: roofC });
          ch.f.box(Math.min(xf, xf + side * t), Math.max(xf, xf + side * t), hTop, hTop + ph, z1, z0, pc, { fix: wfix });
          ch.f.box(Math.min(xf, xb), Math.max(xf, xb), hTop, hTop + ph, z0 - t, z0, pc, { fix: wfix });
          ch.f.box(Math.min(xf, xb), Math.max(xf, xb), hTop, hTop + ph, z1, z1 + t, pc, { fix: wfix });
          if (rnd() < 0.5) { const cx = xf + side * depth * 0.55, cz = z0 - w * (0.25 + 0.4 * rnd()); ch.f.box(Math.min(cx, cx + 1.3), Math.max(cx, cx + 1.3), hTop, hTop + 0.9 + rnd() * 0.7, cz - 1.1, cz, plainCol(avg, wallK * 0.6), { fix: wfix }); }
          if (R.roof === "stand") { // second, taller tier behind the front tier
            const x2 = xb, x3 = xb + side * 5.5, hh = hTop + 3.2, sc2 = plainCol(new T.Color(0.16, 0.2, 0.34), 1);
            ch.f.box(Math.min(x2, x3), Math.max(x2, x3), 0, hh, z1, z0, sc2, { fix: wfix, top: plainCol(new T.Color(0.25, 0.3, 0.45), 1) });
          }
        }
        occ.push({ side, z0, z1, kind: R.shed ? "shed" : "bld" });
        z -= w + (R.roof === "stand" ? 0 : 0.05);
      }
    }
    const fm = new T.MeshLambertMaterial({ map: K.facTex, vertexColors: true, alphaTest: 0.5, emissive: new T.Color(1, 1, 1), emissiveMap: K.facTex, emissiveIntensity: S.themeId === "arena" ? 0.35 : 0.42 });
    fm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif"); };
    const rm = new T.MeshLambertMaterial({ map: rt, vertexColors: true });
    for (const c of chunks.values()) {
      const m = new T.Mesh(c.f.geometry(), fm); m.castShadow = true; world.add(m);
      if (!c.r.empty) { const m2 = new T.Mesh(c.r.geometry(), rm); m2.castShadow = true; world.add(m2); }
    }
  }
  function buildFallbackRows() { /* every theme ships facades; nothing to build without art */ }

  // ------------------------------------------------------------------ theme extras
  function bridgeExtras(rnd, Z0, Z1, length) {
    const { world } = C, red = lin(0xd24a32), redD = lin(0xa23624), fix = [0.5, 0.5], tw = new Batch(), cb = new Batch(), rl = new Batch();
    const spacing = 60, towerH = 34, topY = 31, sag = 3.0;
    const zs = []; for (let z = -20; z > Z1; z -= spacing) zs.push(z);
    zs.unshift(-20 + spacing);
    for (const z of zs) {
      for (const s of [-1, 1]) {
        const x = s * 11.8;
        tw.box(x - 0.9, x + 0.9, 0, towerH, z - 1, z + 1, red, { bot: redD, fix, top: lin(0xf06a4a) });
        tw.box(x - 1.15, x + 1.15, 0, 1.4, z - 1.25, z + 1.25, redD, { fix });
      }
      for (const y of [25.5, 30]) tw.box(-11.8, 11.8, y, y + 1.3, z - 0.8, z + 0.8, red, { fix, bot: redD });
      for (const s of [-1, 1]) tw.box(s * 11.8 - 1.1, s * 11.8 + 1.1, towerH, towerH + 0.6, z - 1.2, z + 1.2, redD, { fix });
    }
    // cables and hangers between consecutive towers
    for (let i = 0; i + 1 < zs.length; i++) {
      const za = zs[i], zb = zs[i + 1];
      for (const s of [-1, 1]) {
        const x = s * 11.8; let prev = null;
        for (let k = 0; k <= 16; k++) {
          const t = k / 16, z = za + (zb - za) * t, y = 5 + (topY - 5) * Math.pow(2 * t - 1, 2), p = [x, y, z];
          if (prev) cb.beam(prev, p, 0.24, red, fix); prev = p;
          if (k > 0 && k < 16 && k % 1 === 0) cb.beam([x, y, z], [x, 1.1, z], 0.07, lin(0xe8e2d8), fix);
        }
      }
    }
    for (const s of [-1, 1]) { // guard rail: posts and two rails
      const x = s * 10.75;
      for (let z = Z0; z > Z1; z -= 3) rl.box(x - 0.1, x + 0.1, 0.2, 1.1, z - 0.1, z + 0.1, lin(0xe9edf2), { fix });
      for (const y of [0.55, 1.0]) rl.box(x - 0.07, x + 0.07, y, y + 0.12, Z1, Z0, lin(0xdfe6ee), { fix });
      rl.box(x - 0.22, x + 0.22, 0.2, 0.42, Z1, Z0, lin(0xa8b3c2), { fix });
    }
    for (const b of [tw, cb, rl]) { const m = new T.Mesh(b.geometry(), new T.MeshLambertMaterial({ vertexColors: true })); m.castShadow = b !== cb; world.add(m); }
  }
  function pierExtras(rnd, Z0, Z1, tex) {
    const { world } = C, b = new Batch(), fix = [0.5, 0.5], wood = lin(0x6e4c30), woodD = lin(0x3b2a1c), rope = lin(0xd9c79a);
    for (const s of [-1, 1]) {
      const x = s * 10.85;
      for (let z = Z0; z > Z1; z -= 5) { b.cyl(x, z, 0.28, -3.8, 0.2, woodD, 8, fix); b.box(x - 0.2, x + 0.2, 0.2, 1.15, z - 0.2, z + 0.2, wood, { fix, top: lin(0x8a6440) }); }
      for (let z = Z0; z > Z1; z -= 2.5) b.cyl(s * 11.6, z + 1.2, 0.34, -4.4, -0.3, woodD, 8, fix);
      for (const y of [0.55, 0.95]) b.box(x - 0.05, x + 0.05, y, y + 0.1, Z1, Z0, rope, { fix });
    }
    const m = new T.Mesh(b.geometry(), new T.MeshLambertMaterial({ vertexColors: true })); m.castShadow = true; world.add(m);
  }
  function mesas(rnd, Z0, Z1) {
    const { world } = C, b = new Batch(), fix = [0.5, 0.5];
    const bands = [0xc25a2c, 0xd9783c, 0xb04a26, 0xe08a48].map(lin);
    for (const s of [-1, 1]) for (let z = Z0 - 20 - rnd() * 30; z > Z1; z -= 70 + rnd() * 90) {
      const x = s * (62 + rnd() * 50), w = 16 + rnd() * 14, d = 14 + rnd() * 12, tiers = 3, h = 7 + rnd() * 8;
      for (let t = 0; t < tiers; t++) { const k = 1 - t * 0.16, th = h * (t === 0 ? 0.5 : 0.28); const y0 = t === 0 ? 0 : h * (0.5 + (t - 1) * 0.28);
        b.box(x - w * k / 2, x + w * k / 2, y0, y0 + th, z - d * k / 2, z + d * k / 2, bands[(t + (rnd() * 4 | 0)) % 4], { fix, bot: bands[2], top: lin(0xe7a060) }); }
    }
    const m = new T.Mesh(b.geometry(), new T.MeshLambertMaterial({ vertexColors: true })); world.add(m);
  }
  function arenaExtras(Z0, Z1) { /* stands come from buildRows; floodlight towers are props */ }

  // ------------------------------------------------------------------ props (one instanced mesh per atlas)
  function buildProps(cfg, K, rnd, occ, Z0, Z1, waterY) {
    const { world } = C, items = K.items, aw = K.atlasImg.width, ah = K.atlasImg.height;
    const rr = (a, b) => a + rnd() * (b - a);
    const zoneOf = it => (it.zone === "lot" && cfg.remapLot ? "walk" : it.zone);
    const by = {}; for (const it of items) (by[zoneOf(it)] ||= []).push(it);
    const pick = list => { let t = 0; for (const i of list) t += i.weight || 1; let q = rnd() * t; for (const i of list) { q -= i.weight || 1; if (q <= 0) return i; } return list[0]; };
    const list = [], blobs = [];
    const blocked = (side, z, w) => occ.some(o => o.side === side && o.kind !== "lot" && o.kind !== "alley" && z < o.z0 + w / 2 && z > o.z1 - w / 2);
    const inGap = (side, z) => occ.some(o => o.side === side && (o.kind === "lot" || o.kind === "alley") && z <= o.z0 && z >= o.z1);
    const add = (it, x, y, z, ground = true, sink = 0) => {
      const h = it.h * rr(0.92, 1.1), w = h * it.rect[2] / it.rect[3], flip = it.flip !== false && rnd() < 0.5 ? 1 : 0;
      list.push({ it, x, y: y - sink * h, z, w, h, flip });
      if (ground) blobs.push({ x: x + h * 0.14 + w * 0.05, y: y + 0.03, z: z + h * 0.08, l: Math.max(w * 0.8, h * 0.5), wd: Math.max(w * 0.4, 0.5) });
    };
    const useBuildings = !!cfg.rows && cfg.rows !== "desert" && cfg.rows !== "pier";
    for (const side of [-1, 1]) {
      if (by.curb) for (let z = Z0 - rr(0, 10); z > Z1 + 10; z -= rr(cfg.curb[0], cfg.curb[1])) { const it = pick(by.curb); if (!blocked(side, z, 1.5)) add(it, side * rr(7.15, 7.9), 0.2, z); }
      if (by.walk) for (let z = Z0 - rr(0, 4); z > Z1 + 10;) {
        const it = pick(by.walk), h = it.h, w = h * it.rect[2] / it.rect[3];
        if (!blocked(side, z, w)) { const xr = it.h > 3 ? [8.9, 9.6] : [8.25, 10.1]; add(it, side * rr(xr[0], xr[1]), 0.2, z); }
        z -= Math.max(w * 0.7, 0.8) + rr(cfg.walk[0], cfg.walk[1]);
      }
      if (by.lot) {
        if (useBuildings) { for (const o of occ) if (o.side === side && (o.kind === "lot" || o.kind === "alley")) { const len = o.z0 - o.z1, n = Math.max(1, Math.round(len / 7)); for (let k = 0; k < n; k++) add(pick(by.lot), side * rr(12.5, 20), 0, o.z0 - (k + rnd() * 0.8) * len / n); } }
        else if (cfg.lotStep) for (let z = Z0 - rr(0, 8); z > Z1 + 10; z -= rr(cfg.lotStep[0], cfg.lotStep[1])) { const it = pick(by.lot); if (!blocked(side, z, 4)) add(it, side * rr(12.5, 40), 0, z); }
      }
      if (by.far && cfg.far) for (let z = Z0 - rr(0, 50); z > Z1 + 20; z -= rr(cfg.far[0], cfg.far[1])) add(pick(by.far), side * rr(cfg.far[2], cfg.far[3]), 0, z);
      if (by.water && cfg.water) for (let z = Z0 - rr(0, 30); z > Z1 + 20; z -= rr(16, 38)) add(pick(by.water), side * rr(15, 62), waterY, z, false, 0.12);
    }
    if (!list.length) return;
    // instanced billboards: bottom anchored, alpha tested, fogged, raw sRGB like the sprites
    const n = list.length, base = new T.PlaneBufferGeometry(1, 1); base.translate(0, 0.5, 0);
    const g = new T.InstancedBufferGeometry(); g.index = base.index; g.setAttribute("position", base.attributes.position); g.setAttribute("uv", base.attributes.uv);
    const off = new Float32Array(n * 3), size = new Float32Array(n * 2), rect = new Float32Array(n * 4), flip = new Float32Array(n);
    list.forEach((p, i) => {
      const [x, y, w, h] = p.it.rect; off.set([p.x, p.y, p.z], i * 3); size.set([p.w, p.h], i * 2); flip[i] = p.flip;
      rect.set([(x + 1) / aw, 1 - (y + h - 1) / ah, (w - 2) / aw, (h - 2) / ah], i * 4);
    });
    g.setAttribute("aOff", new T.InstancedBufferAttribute(off, 3)); g.setAttribute("aSize", new T.InstancedBufferAttribute(size, 2));
    g.setAttribute("aRect", new T.InstancedBufferAttribute(rect, 4)); g.setAttribute("aFlip", new T.InstancedBufferAttribute(flip, 1)); g.instanceCount = n;
    const mat = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { tint: { value: new T.Color(1, 1, 1) } }]), fog: true,
      vertexShader: `attribute vec3 aOff; attribute vec2 aSize; attribute vec4 aRect; attribute float aFlip; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){ vec4 mvPosition = modelViewMatrix * vec4(aOff, 1.0); mvPosition.xy += position.xy * aSize; gl_Position = projectionMatrix * mvPosition;
          float u = aFlip > 0.5 ? 1.0 - uv.x : uv.x; vUv = aRect.xy + vec2(u, uv.y) * aRect.zw;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard; gl_FragColor = vec4(t.rgb * tint, 1.0);
          #include <fog_fragment>
        }` });
    mat.uniforms.map = { value: K.atlasTex }; mat.uniforms.tint.value.set(cfg.tint === 0xffffff ? 0xffffff : cfg.tint);
    mat.uniforms.tint.value.multiplyScalar(0.97);
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1; world.add(mesh);
    // soft blob shadows on the ground
    const bs = new T.InstancedMesh(new T.PlaneBufferGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: cache.common.blob, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), blobs.length);
    const m4 = new T.Matrix4(); blobs.forEach((b, i) => { m4.makeScale(b.l, 1, b.wd); m4.setPosition(b.x, b.y, b.z); bs.setMatrixAt(i, m4); });
    bs.instanceMatrix.needsUpdate = true; bs.frustumCulled = false; bs.renderOrder = 0; world.add(bs);
  }

  // ------------------------------------------------------------------ per frame
  function updateSun() {
    const L = C.L, cfg = S.cfg; if (!cfg || !S.sun) return;
    const sx = L ? L.sx : 0, sz = L ? L.sz : 0, tx = sx * 0.4, tz = sz - 8;
    S.sun.target.position.set(tx, 0, tz);
    S.sun.position.set(tx + cfg.sunPos[0] * 4.2, cfg.sunPos[1] * 4.2, tz + cfg.sunPos[2] * 4.2);
    S.sun.target.updateMatrixWorld();
  }
  function update(dt) {
    if (!S.cfg) return;
    S.time += dt; if (S.water) S.water.uniforms.time.value = S.time;
    updateSun();
    const cam = C.camera;
    S.sky.position.copy(cam.position);
    if (S.back.visible) {
      const th = Math.tan(cam.fov * Math.PI / 360), visH = 2 * D_BACK * th, visW = visH * cam.aspect;
      const Wi = Math.max(visW * 1.15, visH * 0.9), Hi = Wi / S.backAspect, yh = cam.position.y - D_BACK * 0.02;
      const u = S.backMat.uniforms; u.planeSize.value.set(Math.max(visW, visH) * 1.9, visH * 2.4); u.imgSize.value.set(Wi, Hi); u.uOff.value = cam.position.x * 0.0015;
      S.back.scale.set(u.planeSize.value.x, u.planeSize.value.y, 1); S.back.position.set(cam.position.x, yh, cam.position.z - D_BACK);
    }
  }

  return { setup, preload, build, update };
})();
