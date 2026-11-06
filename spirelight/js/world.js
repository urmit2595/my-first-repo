// SPIRELIGHT world: painted sky, cloud sea, atmosphere, light rig (design.md 7.4).
// Everything behind the diorama is a screen-space layer (full-screen triangle, no depth). Nothing here depends on
// world depth/height, so it never tints the diorama by position (design.md section 2).
(function () {
  "use strict";

  const THEMES = ["dusk", "night", "aurora", "dawn"];
  let BASE = "assets/sky/";
  try {
    const cs = document.currentScript;
    if (cs && cs.src) BASE = cs.src.replace(/js\/world\.js.*$/, "") + "assets/sky/";
  } catch (e) { /* keep default */ }

  // ---- theme data ---------------------------------------------------------------------------------------------
  // colours are sRGB hex values (the backdrop shaders write display colours directly, untouched by tone mapping).
  const DATA = {
    dusk: {
      skyTop: 0x1d1b45, skyMid: 0x5a3f86, skyLow: 0xff9a6a, gain: 1.0,
      sunUv: [0.03, 0.54], focusX: 0.25,
      cloudLit: 0xffa05e, cloudMid: 0xd46f86, cloudShadow: 0x4a3278, cloudRim: 0xffd2a0, cloudCover: 0.44,
      sunCol: 0xffa050, glare: 0.75, rays: 0.55, stars: 0.35, aurora: 0, mist: 0.10, mistCol: 0xb5668f,
      puff: 0xffb48a, bird: 0x2a1a3c, wisp: 0xffd9a0, birds: 1,
      keyCol: 0xffb272, keyI: 1.4, keyDir: [-0.42, 0.52, 0.74], hemiSky: 0x8a90e0, hemiGround: 0x6b3d62, hemiI: 0.85,
      rimCol: 0x6fa6ff, rimI: 0.55, rimDir: [0.7, 0.35, -0.5], exposure: 1.05,
    },
    night: {
      skyTop: 0x080a26, skyMid: 0x1a1f55, skyLow: 0x2a5f78, gain: 1.0,
      sunUv: [0.935, 0.92], focusX: 0.72,
      cloudLit: 0x7fd6d0, cloudMid: 0x3f6f98, cloudShadow: 0x1c1f5a, cloudRim: 0xcff6ff, cloudCover: 0.44,
      sunCol: 0xaedcff, glare: 0.5, rays: 0.16, stars: 1.0, aurora: 0, mist: 0.10, mistCol: 0x24407a,
      puff: 0x6fa6c8, bird: 0x0a0f2c, wisp: 0x9ff4ff, birds: 0,
      keyCol: 0xa9c8ff, keyI: 1.1, keyDir: [0.55, 0.6, 0.3], hemiSky: 0x5a74d0, hemiGround: 0x3a2f6e, hemiI: 1.0,
      rimCol: 0xffa064, rimI: 0.5, rimDir: [-0.6, 0.3, 0.55], exposure: 1.15,
    },
    aurora: {
      skyTop: 0x050d24, skyMid: 0x123a4e, skyLow: 0x1d6a66, gain: 1.0,
      sunUv: [0.5, 0.2], focusX: 0.5,
      cloudLit: 0x7be8c8, cloudMid: 0x3c7a9a, cloudShadow: 0x1a1f58, cloudRim: 0xc8ffe8, cloudCover: 0.46,
      sunCol: 0x78ffd0, glare: 0.0, rays: 0.0, stars: 0.85, aurora: 0.45, mist: 0.10, mistCol: 0x1b4a6a,
      puff: 0x5ab5b0, bird: 0x07142a, wisp: 0xb6ffd8, birds: 0,
      keyCol: 0xb8f0e0, keyI: 1.05, keyDir: [-0.25, 0.7, 0.62], hemiSky: 0x58b8c0, hemiGround: 0x4a2f78, hemiI: 1.0,
      rimCol: 0xc07aff, rimI: 0.65, rimDir: [0.7, 0.3, -0.5], exposure: 1.12,
    },
    dawn: {
      skyTop: 0x6f93d0, skyMid: 0xc6a4c8, skyLow: 0xffc08a, gain: 1.0,
      sunUv: [0.935, 0.17], focusX: 0.7,
      cloudLit: 0xffd2a0, cloudMid: 0xf0a2a2, cloudShadow: 0x7c78b4, cloudRim: 0xfff0d0, cloudCover: 0.44,
      sunCol: 0xffc88a, glare: 0.7, rays: 0.5, stars: 0, aurora: 0, mist: 0.08, mistCol: 0xe6a6b0,
      puff: 0xffcfb0, bird: 0x5a3f68, wisp: 0xfff0c8, birds: 1,
      keyCol: 0xffc78f, keyI: 1.5, keyDir: [0.72, 0.5, 0.2], hemiSky: 0x9ab4ee, hemiGround: 0x9a6a78, hemiI: 0.95,
      rimCol: 0xa8c4ff, rimI: 0.5, rimDir: [-0.7, 0.35, 0.45], exposure: 1.0,
    },
  };

  const NUM_KEYS = ["gain", "glare", "rays", "stars", "aurora", "mist", "cloudCover", "keyI", "hemiI", "rimI", "exposure"];
  const COL_KEYS = ["skyTop", "skyMid", "skyLow", "cloudLit", "cloudMid", "cloudShadow", "cloudRim", "sunCol", "mistCol",
    "puff", "bird", "wisp", "keyCol", "hemiSky", "hemiGround", "rimCol"];

  // ---- shaders ------------------------------------------------------------------------------------------------
  const VS_FULL = "varying vec2 vN; void main(){ vN = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  const NOISE = [
    "float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    "float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ float n = vnoise(p);",
    "  s += a * mix(n, 1.0 - abs(2.0 * n - 1.0), 0.55); p = p * 2.05 + vec2(17.1, 9.2); a *= 0.47; } return s * 0.95; }",
  ].join("\n");

  const FS_BACKDROP = [
    "precision highp float; varying vec2 vN;",
    "uniform sampler2D uTexA, uTexB; uniform float uHasA, uHasB, uMix, uGain, uImgAspect, uAspect, uZoom, uFocusX;",
    "uniform vec2 uDrift; uniform vec3 uTop, uMid, uLow;",
    "vec2 cover(vec2 n){ vec2 uv = n * 0.5 + 0.5; float s = uAspect, ia = uImgAspect;",
    "  if (s > ia) uv.y = (uv.y - 0.5) * (ia / s) + 0.5; else uv.x = (uv.x - 0.5) * (s / ia) + 0.5 + (uFocusX - 0.5) * (1.0 - s / ia);",
    "  return (uv - 0.5) / uZoom + 0.5 + uDrift; }",
    "void main(){",
    "  vec2 uv = cover(vN); float y = vN.y * 0.5 + 0.5;",
    "  vec3 g = mix(uLow, uMid, smoothstep(0.0, 0.5, y)); g = mix(g, uTop, smoothstep(0.45, 1.0, y));",
    "  vec3 a = texture2D(uTexA, uv).rgb, b = texture2D(uTexB, uv).rgb;",
    "  a = mix(g, a, uHasA); b = mix(g, b, uHasB);",
    "  gl_FragColor = vec4(mix(a, b, uMix) * uGain, 1.0); }",
  ].join("\n");

  const FS_CLOUD = [
    "precision highp float; varying vec2 vN;",
    "uniform float uTime, uAspect, uHorizon, uCover; uniform vec2 uSunDir;",
    "uniform vec3 uLit, uMidC, uShadow, uRim;",
    NOISE,
    // one cloud layer: returns premultiplied colour in rgb, coverage in a
    "vec4 layer(vec2 sp, float hz, float scale, float speed, float seed, float rise, float haze){",
    "  vec2 uv = vec2(sp.x * scale + uTime * speed + seed, sp.y * scale * 1.0);",
    "  float d = fbm(uv);",
    "  float f = d + (hz - sp.y) * rise;",
    "  float thr = uCover;",
    "  float a = smoothstep(thr - 0.02, thr + 0.035, f);",
    "  if (a <= 0.001) return vec4(0.0);",
    "  float d2 = fbm(uv + uSunDir * 0.28);",
    "  float lit = smoothstep(-0.07, 0.11, d - d2);",
    "  float shade = smoothstep(0.0, 0.6, f - thr);",
    "  float rim = 1.0 - smoothstep(0.0, 0.12, f - thr);",
    "  vec3 c = mix(uMidC, uShadow, shade * 0.85 * (1.0 - lit * 0.5));",
    "  c = mix(c, uLit, lit * (1.0 - shade * 0.55));",
    "  c *= 0.82 + 0.36 * d;",
    "  c += uRim * rim * (0.25 + 0.5 * lit);",
    "  c = mix(c, uMidC * 0.9 + uLit * 0.1, haze);",
    "  return vec4(c * a, a); }",
    "void main(){",
    "  float k = 1.0 / min(uAspect, 1.0);",
    "  vec2 sp = vec2(vN.x * uAspect, vN.y) * k; float hz = uHorizon * k;",
    "  vec4 acc = vec4(0.0);",
    "  vec4 l;",
    "  l = layer(sp, hz + 0.22 * k, 1.0, 0.004, 3.0, 1.0, 0.45); acc = acc * (1.0 - l.a) + l;",
    "  l = layer(sp, hz + 0.06 * k, 1.6, 0.0075, 11.0, 0.8, 0.2); acc = acc * (1.0 - l.a) + l;",
    "  l = layer(sp, hz - 0.14 * k, 2.4, 0.012, 27.0, 0.7, 0.0); acc = acc * (1.0 - l.a) + l;",
    "  if (acc.a < 0.002) discard;",
    "  gl_FragColor = vec4(acc.rgb / acc.a, acc.a); }",
  ].join("\n");

  const FS_RAYS = [
    "precision highp float; varying vec2 vN;",
    "uniform float uTime, uAspect, uGlare, uRays; uniform vec2 uSun; uniform vec3 uCol;",
    NOISE,
    "void main(){",
    "  vec2 sp = vec2(vN.x * uAspect, vN.y); vec2 sun = vec2(uSun.x * uAspect, uSun.y);",
    "  vec2 d = sp - sun; float r = length(d); float ang = atan(d.y, d.x);",
    "  float rays = vnoise(vec2(ang * 7.0, uTime * 0.04)) * 0.7 + vnoise(vec2(ang * 19.0 + 3.0, -uTime * 0.07)) * 0.5;",
    "  rays = smoothstep(0.45, 1.05, rays);",
    "  float fall = exp(-r * 1.15) * smoothstep(0.0, 0.18, r);",
    "  float glare = exp(-r * 4.0) * 0.8 + exp(-r * 1.3) * 0.25 + exp(-r * 14.0) * 0.9;",
    "  vec3 c = uCol * (rays * fall * uRays * 0.8 + glare * uGlare);",
    "  gl_FragColor = vec4(c, 1.0); }",
  ].join("\n");

  const FS_AURORA = [
    "precision highp float; varying vec2 vN;",
    "uniform float uTime, uAspect, uAmt;",
    NOISE,
    "float ribbon(vec2 sp, float c0, float amp, float seed, float w){",
    "  float x = sp.x * 0.9 + seed;",
    "  float c = c0 + amp * sin(x * 1.3 + uTime * 0.08 + 2.0 * vnoise(vec2(x * 0.8, uTime * 0.03 + seed)));",
    "  float dy = sp.y - c;",
    "  float edge = smoothstep(0.0, w * 0.35, dy) * 0.0 + exp(-pow(max(dy, 0.0) / (w * 0.5), 2.0));",
    "  float below = exp(-max(-dy, 0.0) * 1.8) * smoothstep(-0.02, 0.02, -dy + 0.001);",
    "  float streak = 0.55 + 0.45 * vnoise(vec2(x * 22.0, uTime * 0.25 + seed));",
    "  return (edge * 0.5 + below * 0.8) * streak * smoothstep(-0.25, 0.1, dy + 0.3); }",
    "void main(){",
    "  vec2 sp = vec2(vN.x * uAspect, vN.y) / min(uAspect, 1.0);",
    "  float a = ribbon(sp, 0.42, 0.14, 1.0, 0.5) * 0.9 + ribbon(sp, 0.68, 0.1, 7.0, 0.4) * 0.6;",
    "  a *= smoothstep(-0.2, 0.5, vN.y);",
    "  vec3 g = vec3(0.25, 1.0, 0.62), v = vec3(0.6, 0.3, 1.0);",
    "  vec3 c = mix(g, v, smoothstep(0.35, 0.95, vN.y));",
    "  gl_FragColor = vec4(c * a * uAmt, 1.0); }",
  ].join("\n");

  const FS_MIST = [
    "precision highp float; varying vec2 vN; uniform float uAmt; uniform vec3 uCol;",
    "void main(){ float a = uAmt * smoothstep(-0.55, -1.0, vN.y); gl_FragColor = vec4(uCol, a); }",
  ].join("\n");

  const VS_STARS = [
    "attribute float aSeed; attribute float aSize; uniform float uTime, uAmt, uAspect, uPx, uK; varying float vA;",
    "void main(){",
    "  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 2.2) + aSeed * 40.0);",
    "  float vis = smoothstep(aSeed - 0.05, aSeed + 0.02, uAmt);",
    "  vA = tw * vis; gl_PointSize = aSize * uPx; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  ].join("\n");
  const FS_STARS = [
    "precision highp float; varying float vA; uniform vec3 uCol;",
    "void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float a = pow(max(1.0 - r, 0.0), 1.8);",
    "  gl_FragColor = vec4(uCol, a * vA); }",
  ].join("\n");

  const VS_SPRITE = [
    "attribute vec2 aUv; attribute vec4 aInfo; varying vec2 vUv; varying vec4 vInfo; // x type, y alpha, z seed, w phase",
    "void main(){ vUv = aUv; vInfo = aInfo; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  ].join("\n");
  const FS_SPRITE = [
    "precision highp float; varying vec2 vUv; varying vec4 vInfo;",
    "uniform float uTime; uniform vec3 uPuff, uBird, uWisp, uLitC; uniform vec2 uSunDir; uniform float uBirdsOn;",
    NOISE,
    "void main(){",
    "  vec2 p = vUv * 2.0 - 1.0; float type = vInfo.x;",
    "  if (type < 0.5) {",
    // puff: a lumpy blob lit from the sun side
    "    float r = length(p * vec2(0.85, 1.35));",
    "    float n = fbm(p * 2.2 + vInfo.z * 13.0);",
    "    float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7);",
    "    float lit = clamp(0.5 + dot(normalize(p + 1e-4), uSunDir) * 0.5 + (n - 0.5) * 0.6, 0.0, 1.0);",
    "    vec3 c = mix(uPuff * 0.55, uPuff * 1.15 + uLitC * 0.15, lit);",
    "    gl_FragColor = vec4(c, a * vInfo.y);",
    "  } else if (type < 1.5) {",
    // bird: two flapping wing strokes
    "    float fl = sin(uTime * 7.0 + vInfo.w) * 0.5;",
    "    float wing = abs(p.x); float yy = p.y + 0.15 - wing * (0.55 + fl) * 0.9;",
    "    float a = smoothstep(0.18, 0.0, abs(yy)) * smoothstep(1.0, 0.7, wing) * (1.0 - wing * 0.35);",
    "    a = max(a, smoothstep(0.2, 0.0, length(p * vec2(1.6, 1.0))) * 0.8);",
    "    gl_FragColor = vec4(uBird, a * vInfo.y);",
    "  } else {",
    // wisp: soft glowing mote with a short trail to the right (it travels leftwards)
    "    float tr = smoothstep(0.0, 1.0, (p.x + 1.0) * 0.5);",
    "    vec2 q = vec2(p.x + 0.55, p.y * 2.4);",
    "    float core = exp(-dot(q, q) * 14.0) + exp(-dot(vec2(p.x + 0.55 - 0.3 * 0.0, p.y), vec2(p.x + 0.55, p.y)) * 3.5) * 0.25;",
    "    float trail = exp(-abs(p.y) * 14.0) * smoothstep(1.0, -0.5, p.x) * smoothstep(-1.0, -0.4, p.x) * 0.0;",
    "    float tw = 0.7 + 0.3 * sin(uTime * 3.0 + vInfo.w);",
    "    float a = min(1.0, core * tw);",
    "    float t2 = exp(-pow(p.y * 5.0, 2.0)) * smoothstep(-0.5, 0.9, p.x) * smoothstep(1.0, 0.2, p.x) * 0.5;",
    "    gl_FragColor = vec4(uWisp, min(1.0, a + t2 * tw) * vInfo.y);",
    "  } }",
  ].join("\n");

  // ---- module -------------------------------------------------------------------------------------------------
  const World = {
    themes: THEMES.slice(),
    lights: null,
    theme: null,
    exposure: 1.05,
    base: BASE,
    ready: false,
    reducedMotion: false,
    data: DATA,
  };
  window.World = World;

  let T = null, renderer = null, scene = null, camera = null;
  let root = null;
  const S = {}; // internal state
  const tmpV2 = { x: 0, y: 0 };

  function makeCur() {
    const o = {};
    for (const k of NUM_KEYS) o[k] = 0;
    for (const k of COL_KEYS) o[k] = new T.Color(0);
    o.sunUv = new T.Vector2(); o.keyDir = new T.Vector3(); o.rimDir = new T.Vector3();
    o.focusX = 0.5; o.birds = 0;
    return o;
  }
  const _c = [];
  function setTarget(name) {
    const d = DATA[name], tg = S.target;
    for (const k of NUM_KEYS) tg[k] = d[k];
    for (const k of COL_KEYS) tg[k].setHex(d[k]);
    tg.sunUv.set(d.sunUv[0], d.sunUv[1]);
    tg.keyDir.set(d.keyDir[0], d.keyDir[1], d.keyDir[2]).normalize();
    tg.rimDir.set(d.rimDir[0], d.rimDir[1], d.rimDir[2]).normalize();
    tg.focusX = d.focusX; tg.birds = d.birds;
  }
  function approach(k) {
    const c = S.cur, tg = S.target;
    for (const n of NUM_KEYS) c[n] += (tg[n] - c[n]) * k;
    for (const n of COL_KEYS) c[n].lerp(tg[n], k);
    c.sunUv.lerp(tg.sunUv, k);
    c.keyDir.lerp(tg.keyDir, k).normalize();
    c.rimDir.lerp(tg.rimDir, k).normalize();
    c.focusX += (tg.focusX - c.focusX) * k; c.birds += (tg.birds - c.birds) * k;
  }

  function fullMesh(mat, order) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const m = new T.Mesh(g, mat);
    m.frustumCulled = false; m.renderOrder = order; m.matrixAutoUpdate = false;
    return m;
  }
  function blend(mat, mode) {
    mat.depthTest = false; mat.depthWrite = false; mat.toneMapped = false; mat.fog = false;
    if (mode === "add") { mat.blending = T.AdditiveBlending; }
    else if (mode === "alpha") {
      mat.blending = T.CustomBlending; mat.blendEquation = T.AddEquation;
      mat.blendSrc = T.SrcAlphaFactor; mat.blendDst = T.OneMinusSrcAlphaFactor;
      mat.blendSrcAlpha = T.OneFactor; mat.blendDstAlpha = T.OneMinusSrcAlphaFactor;
    } else { mat.blending = T.NoBlending; }
    return mat;
  }

  // painting uv -> NDC (inverse of the cover mapping in FS_BACKDROP)
  function uvToNdc(u, v, out) {
    const s = S.aspect, ia = S.imgAspect;
    let x = (u - 0.5 - S.drift.x) * S.zoom + 0.5, y = (v - 0.5 - S.drift.y) * S.zoom + 0.5;
    if (s > ia) { y = (y - 0.5) / (ia / s) + 0.5; }
    else { x = (x - 0.5 - (S.cur.focusX - 0.5) * (1 - s / ia)) / (s / ia) + 0.5; }
    out.x = x * 2 - 1; out.y = y * 2 - 1;
  }

  function buildSprites() {
    const N = S.nPuff + S.nFly, n = N * 4;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), info = new Float32Array(n * 4);
    const idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) {
      const v = i * 4;
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], v * 2);
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("aUv", new T.BufferAttribute(uv, 2));
    g.setAttribute("aInfo", new T.BufferAttribute(info, 4));
    g.setIndex(new T.BufferAttribute(idx, 1));
    S.spriteGeo = g;
    S.sprites = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    S.rnd = rnd;
    for (let i = 0; i < S.nPuff; i++) {
      const far = i < S.nPuff / 2;
      S.sprites.push({
        type: 0, x: rnd() * 3 - 1.5, y: far ? -0.25 + rnd() * 0.6 : -0.6 + rnd() * 0.5,
        h: far ? 0.07 + rnd() * 0.06 : 0.13 + rnd() * 0.1, ratio: 2.6 + rnd() * 1.6,
        vx: -(far ? 0.004 : 0.009) * (0.7 + rnd() * 0.6), alpha: far ? 0.4 : 0.55, seed: rnd(), phase: 0, life: 0,
      });
    }
    for (let i = 0; i < S.nFly; i++) S.sprites.push({ type: 1, x: 9, y: 0, h: 0.02, ratio: 1.6, vx: 0, alpha: 0, seed: rnd(), phase: rnd() * 6, life: 0, off: true });
    S.flockTimer = 4 + rnd() * 5;
  }

  function spawnFlock(kind) {
    const n = S.nPuff, base = 0.1 + S.rnd() * 0.55, dir = S.rnd() < 0.5 ? -1 : 1;
    const speed = 0.06 + S.rnd() * 0.04, x0 = (dir < 0 ? 1 : -1) * (S.aspect * 1.0 + 0.2);
    for (let i = 0; i < S.nFly; i++) {
      const s = S.sprites[n + i];
      s.type = kind; s.off = false; s.life = 1;
      s.x = x0 - dir * i * 0.07 * S.aspect * (0.8 + S.rnd() * 0.4); s.y = base + (S.rnd() - 0.5) * 0.08 + i * 0.012;
      s.h = kind === 1 ? 0.018 + S.rnd() * 0.008 : 0.016 + S.rnd() * 0.008; s.ratio = kind === 1 ? 2.2 : 3.0;
      s.vx = dir * speed * (kind === 1 ? 1 : 0.7); s.alpha = kind === 1 ? 0.75 : 0.9; s.phase = S.rnd() * 6;
    }
  }

  function updateSprites(dt) {
    const a = S.aspect, n = S.sprites.length, P = S.spriteGeo.attributes.position.array, I = S.spriteGeo.attributes.aInfo.array;
    const cull = a + 1.0;
    for (let i = 0; i < n; i++) {
      const s = S.sprites[i];
      if (s.type === 0) {
        s.x += s.vx * dt;
        const hw = s.h * s.ratio / a;
        if (s.x < -cull - hw) s.x = cull + hw;
      } else if (!s.off) {
        s.x += s.vx * dt;
        s.y += Math.sin(S.time * 1.3 + s.phase) * 0.0004;
        if (Math.abs(s.x) > a + 0.5) { s.off = true; }
      }
      const hw = s.off ? 0 : s.h * s.ratio / a, hh = s.off ? 0 : s.h;
      const x = s.off ? 9 : s.x * 1 / a * a; // s.x is in NDC-x units already
      const o = i * 12, sx = s.type === 0 || true ? s.x : x;
      // vertices: bl, br, tr, tl
      P[o] = sx - hw; P[o + 1] = s.y - hh; P[o + 2] = 0;
      P[o + 3] = sx + hw; P[o + 4] = s.y - hh; P[o + 5] = 0;
      P[o + 6] = sx + hw; P[o + 7] = s.y + hh; P[o + 8] = 0;
      P[o + 9] = sx - hw; P[o + 10] = s.y + hh; P[o + 11] = 0;
      const q = i * 16, al = s.off ? 0 : s.alpha * (s.type === 0 ? 1 : 1);
      for (let k = 0; k < 4; k++) { I[q + k * 4] = s.type; I[q + k * 4 + 1] = al; I[q + k * 4 + 2] = s.seed; I[q + k * 4 + 3] = s.phase; }
    }
    S.spriteGeo.attributes.position.needsUpdate = true;
    S.spriteGeo.attributes.aInfo.needsUpdate = true;
    // flock scheduling
    if (!World.reducedMotion) {
      S.flockTimer -= dt;
      if (S.flockTimer <= 0) {
        const free = S.sprites[S.nPuff].off;
        const kind = S.cur.birds > 0.5 ? 1 : 2;
        if (free) spawnFlock(kind);
        S.flockTimer = 9 + S.rnd() * 14;
      }
    }
  }

  function buildStars() {
    const N = 360, pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
    let sd = 99;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rnd() * 2 - 1; pos[i * 3 + 1] = -0.1 + Math.pow(rnd(), 0.8) * 1.1; pos[i * 3 + 2] = 0;
      seed[i] = rnd(); size[i] = 1.2 + Math.pow(rnd(), 4) * 4.5;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new T.BufferAttribute(seed, 1));
    g.setAttribute("aSize", new T.BufferAttribute(size, 1));
    return g;
  }

  function loadTexture(name) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (t) => { if (!done) { done = true; resolve(t); } };
      try {
        new T.TextureLoader().load(BASE_URL(name), (t) => {
          t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false;
          t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.encoding = T.LinearEncoding;
          fin(t);
        }, undefined, () => fin(null));
      } catch (e) { fin(null); }
      setTimeout(() => fin(null), 15000);
    });
  }
  function BASE_URL(name) { return World.base + "sky-" + name + ".webp"; }

  World.init = function (THREE, rend, scn, cam) {
    try {
      T = THREE; renderer = rend; scene = scn; camera = cam;
      try { World.reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { /* */ }
      S.cur = makeCur(); S.target = makeCur();
      S.time = 0; S.aspect = 1.6; S.imgAspect = 2048 / 1152; S.zoom = 1.06; S.drift = new T.Vector2();
      S.textures = {}; S.texFrom = null; S.texTo = null; S.mix = 1; S.sunNdc = new T.Vector2(); S.horizon = -0.3; S.horizonT = -0.3;
      S.bounds = null; S.nPuff = 12; S.nFly = 4; S.themeSet = false; S.sunDirScreen = new T.Vector2(-1, 0.2);
      S.corner = new T.Vector3(); S.tmpM = new T.Matrix4(); S.tmpV = new T.Vector3(); S.tmpV2 = new T.Vector3();
      S.tmpM2 = new T.Matrix4(); S.pxRatio = 1;

      root = new T.Group(); root.name = "world-sky"; scene.add(root);

      const U = T.UniformsUtils;
      // backdrop
      S.uBack = {
        uTexA: { value: null }, uTexB: { value: null }, uHasA: { value: 0 }, uHasB: { value: 0 }, uMix: { value: 1 }, uGain: { value: 1 },
        uImgAspect: { value: S.imgAspect }, uAspect: { value: 1.6 }, uZoom: { value: S.zoom }, uFocusX: { value: 0.5 },
        uDrift: { value: S.drift }, uTop: { value: S.cur.skyTop }, uMid: { value: S.cur.skyMid }, uLow: { value: S.cur.skyLow },
      };
      const mBack = blend(new T.ShaderMaterial({ uniforms: S.uBack, vertexShader: VS_FULL, fragmentShader: FS_BACKDROP }), "none");
      root.add(fullMesh(mBack, -1000));
      S.mBack = mBack;

      // stars
      S.uStars = { uTime: { value: 0 }, uAmt: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 1 }, uK: { value: 1 }, uCol: { value: new T.Color(0xfff4e0) } };
      const mStars = blend(new T.ShaderMaterial({ uniforms: S.uStars, vertexShader: VS_STARS, fragmentShader: FS_STARS, transparent: false }), "add");
      const pts = new T.Points(buildStars(), mStars); pts.frustumCulled = false; pts.renderOrder = -990; root.add(pts);

      // aurora curtains
      S.uAur = { uTime: { value: 0 }, uAspect: { value: 1 }, uAmt: { value: 0 } };
      const mAur = blend(new T.ShaderMaterial({ uniforms: S.uAur, vertexShader: VS_FULL, fragmentShader: FS_AURORA }), "add");
      S.meshAur = fullMesh(mAur, -985); root.add(S.meshAur);

      // sun glare and god rays
      S.uRays = { uTime: { value: 0 }, uAspect: { value: 1 }, uGlare: { value: 0 }, uRays: { value: 0 }, uSun: { value: S.sunNdc }, uCol: { value: S.cur.sunCol } };
      const mRays = blend(new T.ShaderMaterial({ uniforms: S.uRays, vertexShader: VS_FULL, fragmentShader: FS_RAYS }), "add");
      S.meshRays = fullMesh(mRays, -980); root.add(S.meshRays);

      // far sprites: puffs, birds, wisps
      buildSprites();
      S.uSprite = {
        uTime: { value: 0 }, uPuff: { value: S.cur.puff }, uBird: { value: S.cur.bird }, uWisp: { value: S.cur.wisp },
        uLitC: { value: S.cur.cloudLit }, uSunDir: { value: S.sunDirScreen }, uBirdsOn: { value: 1 },
      };
      const mSp = blend(new T.ShaderMaterial({ uniforms: S.uSprite, vertexShader: VS_SPRITE, fragmentShader: FS_SPRITE }), "alpha");
      const sprites = new T.Mesh(S.spriteGeo, mSp); sprites.frustumCulled = false; sprites.renderOrder = -970; root.add(sprites);

      // cloud sea
      S.uCloud = {
        uTime: { value: 0 }, uAspect: { value: 1 }, uHorizon: { value: S.horizon }, uCover: { value: 0.5 }, uSunDir: { value: S.sunDirScreen },
        uLit: { value: S.cur.cloudLit }, uMidC: { value: S.cur.cloudMid }, uShadow: { value: S.cur.cloudShadow }, uRim: { value: S.cur.cloudRim },
      };
      const mCloud = blend(new T.ShaderMaterial({ uniforms: S.uCloud, vertexShader: VS_FULL, fragmentShader: FS_CLOUD }), "alpha");
      root.add(fullMesh(mCloud, -960));

      // very light screen-space haze over the lowest part of the screen (screen y only)
      S.uMist = { uAmt: { value: 0 }, uCol: { value: S.cur.mistCol } };
      const mMist = blend(new T.ShaderMaterial({ uniforms: S.uMist, vertexShader: VS_FULL, fragmentShader: FS_MIST, transparent: true }), "alpha");
      root.add(fullMesh(mMist, 1000));

      // light rig
      const key = new T.DirectionalLight(0xffb272, 2.5);
      key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
      const sc = key.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 0.5; sc.far = 120;
      const hemi = new T.HemisphereLight(0x8a90e0, 0x6b3d62, 0.85);
      const rim = new T.DirectionalLight(0x6fa6ff, 0.5); rim.castShadow = false;
      scene.add(key, key.target, hemi, rim, rim.target);
      World.lights = { key, hemi, rim };
      S.lightCenter = new T.Vector3(3, 3, 3); S.lightRadius = 8;

      World.setTheme("dusk", true);
      World.fit({ min: [0, 0, 0], max: [6, 6, 6] });

      // textures load in the background; the procedural gradient stands in until they arrive
      const jobs = THEMES.map((n) => loadTexture(n).then((t) => {
        S.textures[n] = t;
        if (t && t.image && t.image.width) S.imgAspect = t.image.width / t.image.height;
        applyTextures(false);
      }));
      World.ready = true;
      return Promise.all(jobs).then(() => { applyTextures(true); }).catch(() => {});
    } catch (e) {
      console.error("World.init failed", e);
      return Promise.resolve();
    }
  };

  function applyTextures(instant) {
    if (!S.uBack) return;
    const name = World.theme, t = S.textures[name] || null;
    if (instant || !S.fading) {
      S.texFrom = t; S.texTo = t; S.mix = 1;
      S.uBack.uTexA.value = t; S.uBack.uHasA.value = t ? 1 : 0;
      S.uBack.uTexB.value = t; S.uBack.uHasB.value = t ? 1 : 0;
      S.uBack.uMix.value = 1;
    } else {
      S.uBack.uTexB.value = t; S.uBack.uHasB.value = t ? 1 : 0;
    }
    S.uBack.uImgAspect.value = S.imgAspect;
  }

  World.setTheme = function (name, instant) {
    try {
      if (!DATA[name]) name = "dusk";
      const first = !S.themeSet;
      const prev = World.theme;
      World.theme = name; S.themeSet = true;
      setTarget(name);
      if (first || instant === true) {
        approach(1);
        S.fading = false;
        applyTextures(true);
      } else if (prev !== name) {
        // crossfade the painting from what is currently shown
        S.uBack.uTexA.value = S.uBack.uTexB.value; S.uBack.uHasA.value = S.uBack.uHasB.value;
        S.fading = true; S.mix = 0; S.uBack.uMix.value = 0;
        const t = S.textures[name] || null;
        S.uBack.uTexB.value = t; S.uBack.uHasB.value = t ? 1 : 0;
      }
      World.exposure = DATA[name].exposure;
      if (renderer && instant === "apply") renderer.toneMappingExposure = World.exposure;
      if (S.lastBounds) World.fit(S.lastBounds);
      World.colors = DATA[name];
    } catch (e) { console.error(e); }
  };

  // Aim the shadow camera tightly around the level bounds; the cloud sea's top follows the level on screen.
  // bounds = { min:[x,y,z], max:[x,y,z] } in cell coordinates (max is the last occupied cell: the box spans max+1).
  World.fit = function (bounds) {
    try {
      if (!bounds || !World.lights) return;
      S.lastBounds = bounds;
      const mn = bounds.min, mx = bounds.max;
      const x0 = mn[0], y0 = mn[1], z0 = mn[2], x1 = mx[0] + 1, y1 = mx[1] + 1, z1 = mx[2] + 1;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      const rad = 0.5 * Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) + (z1 - z0) * (z1 - z0));
      S.lightCenter.set(cx, cy, cz); S.lightRadius = rad;
      S.fitBox = [x0, y0, z0, x1, y1, z1];
      aimLights(true);
    } catch (e) { console.error(e); }
  };

  function aimLights(snap) {
    const L = World.lights, c = S.cur, ctr = S.lightCenter, dist = S.lightRadius * 2 + 20;
    L.key.color.copy(c.keyCol); L.key.intensity = c.keyI;
    L.key.target.position.copy(ctr);
    L.key.position.copy(ctr).addScaledVector(c.keyDir, dist);
    L.key.target.updateMatrixWorld(); L.key.updateMatrixWorld();
    L.rim.color.copy(c.rimCol); L.rim.intensity = c.rimI;
    L.rim.target.position.copy(ctr); L.rim.position.copy(ctr).addScaledVector(c.rimDir, dist);
    L.rim.target.updateMatrixWorld(); L.rim.updateMatrixWorld();
    L.hemi.color.copy(c.hemiSky); L.hemi.groundColor.copy(c.hemiGround); L.hemi.intensity = c.hemiI;
    if (!snap || !S.fitBox) return;
    // fit the shadow frustum to the 8 box corners in light eye space
    const m = S.tmpM.lookAt(L.key.position, ctr, T.Object3D.DefaultUp); // rotation: eye -> world
    const inv = S.tmpM2.copy(m).invert();
    const b = S.fitBox, v = S.tmpV;
    let l = 1e9, r = -1e9, bt = 1e9, tp = -1e9, zn = 1e9, zf = -1e9;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]).sub(L.key.position);
      // lookAt() builds rotation only; apply its transpose to express the offset in eye space
      const e = inv.elements, x = v.x, y = v.y, z = v.z;
      const ex = e[0] * x + e[4] * y + e[8] * z, ey = e[1] * x + e[5] * y + e[9] * z, ez = e[2] * x + e[6] * y + e[10] * z;
      if (ex < l) l = ex; if (ex > r) r = ex; if (ey < bt) bt = ey; if (ey > tp) tp = ey;
      if (ez < zn) zn = ez; if (ez > zf) zf = ez;
    }
    const pad = 0.6, sc = L.key.shadow.camera;
    sc.left = l - pad; sc.right = r + pad; sc.bottom = bt - pad; sc.top = tp + pad;
    sc.near = Math.max(0.1, -zf - 4); sc.far = -zn + 4;
    sc.updateProjectionMatrix();
    const size = Math.max(r - l, tp - bt);
    L.key.shadow.mapSize.x = L.key.shadow.mapSize.y = (L.key.shadow.mapSize.x || 2048);
    L.key.shadow.bias = -0.0004; L.key.shadow.normalBias = 0.02 + size * 0.0008;
  }

  World.update = function (dt, t) {
    if (!World.ready) return;
    try {
      dt = Math.min(dt || 0.016, 0.1);
      const rm = World.reducedMotion ? 0.25 : 1;
      S.time += dt * rm;
      const c = S.cur;
      approach(1 - Math.exp(-dt * 2.2));

      // screen size
      renderer.getSize(tmpV2);
      const w = Math.max(1, tmpV2.x), h = Math.max(1, tmpV2.y);
      S.aspect = w / h; S.pxRatio = renderer.getPixelRatio();

      // crossfade
      if (S.fading) {
        S.mix = Math.min(1, S.mix + dt / 1.4);
        S.uBack.uMix.value = S.mix * S.mix * (3 - 2 * S.mix);
        if (S.mix >= 1) { S.fading = false; applyTextures(true); }
      }

      // painting drift: slow, subtle
      const tm = S.time;
      S.drift.set(Math.sin(tm * 0.021) * 0.0075 + Math.sin(tm * 0.047) * 0.002, Math.cos(tm * 0.017) * 0.005);
      const U = S.uBack;
      U.uAspect.value = S.aspect; U.uGain.value = c.gain; U.uFocusX.value = c.focusX;

      // sun / moon on screen, glued to the painting
      uvToNdc(c.sunUv.x, c.sunUv.y, S.sunNdc);
      const lim = S.aspect < 1 ? 1.25 : 1.3;
      if (S.sunNdc.x < -lim) S.sunNdc.x = -lim; if (S.sunNdc.x > lim) S.sunNdc.x = lim;
      if (S.sunNdc.y < -1.2) S.sunNdc.y = -1.2; if (S.sunNdc.y > 1.2) S.sunNdc.y = 1.2;
      // direction from screen centre toward the sun, for cloud lighting
      let dx = S.sunNdc.x * S.aspect, dy = S.sunNdc.y + 0.15; const dl = Math.sqrt(dx * dx + dy * dy) || 1;
      S.sunDirScreen.set(dx / dl, dy / dl);
      // keep the light coming from above-ish so cloud tops catch it
      if (S.sunDirScreen.y < 0.25) { S.sunDirScreen.y = 0.25; S.sunDirScreen.normalize(); }

      // cloud horizon follows the level's lowest point on screen
      if (S.fitBox) {
        camera.updateMatrixWorld();
        const b = S.fitBox, v = S.corner; let lo = 1e9;
        for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]).project(camera);
          if (v.y < lo) lo = v.y;
        }
        S.horizonT = Math.max(-0.5, Math.min(0.05, lo + 0.45));
      }
      S.horizon += (S.horizonT - S.horizon) * (1 - Math.exp(-dt * 3));

      // push uniforms
      const k = S.uCloud;
      k.uTime.value = tm; k.uAspect.value = S.aspect; k.uHorizon.value = S.horizon; k.uCover.value = c.cloudCover;
      const st = S.uStars;
      st.uTime.value = tm; st.uAmt.value = c.stars; st.uAspect.value = S.aspect; st.uPx.value = S.pxRatio * Math.min(1.4, Math.max(0.7, h / 720));
      const au = S.uAur; au.uTime.value = tm; au.uAspect.value = S.aspect; au.uAmt.value = c.aurora;
      S.meshAur.visible = c.aurora > 0.01;
      const ra = S.uRays; ra.uTime.value = tm; ra.uAspect.value = S.aspect; ra.uGlare.value = c.glare; ra.uRays.value = c.rays;
      S.meshRays.visible = c.glare + c.rays > 0.01;
      S.uSprite.uTime.value = tm;
      S.uMist.uAmt.value = c.mist;
      updateSprites(dt * rm);
      aimLights(false);
    } catch (e) { /* never break the frame loop */ }
  };

  World.dispose = function () {
    try {
      if (root) {
        root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        scene.remove(root);
      }
      if (World.lights) { scene.remove(World.lights.key, World.lights.key.target, World.lights.hemi, World.lights.rim, World.lights.rim.target); }
      for (const n in S.textures) if (S.textures[n]) S.textures[n].dispose();
    } catch (e) { /* */ }
    World.ready = false;
  };
})();
