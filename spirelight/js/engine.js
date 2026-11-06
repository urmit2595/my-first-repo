/* SPIRELIGHT engine (design.md sections 6, 7.6, 8). Owns canvas, frame loop, input, walking, mechanisms. */
(function () {
  "use strict";
  var SQ2 = Math.SQRT2, SQ6 = Math.sqrt(6), DEG = Math.PI / 180;
  var KEY = "spirelight-v1";
  var qs = new URLSearchParams(location.search);
  var TEST = qs.has("test"), DEBUG = qs.has("debug");
  var TS = TEST ? 3 : 1; // sim speed in test mode

  var Game = { ready: false, state: "loading", levels: [], levelIndex: -1, level: null, geom: null, groups: {}, decor: [],
    hero: null, time: 0, dt: 0, reducedMotion: false, quality: "high", THREE: null,
    insets: { top: 72, bottom: 96, side: 14 }, test: TEST, paused: false, timeScale: TEST ? 3 : 1 };
  window.Game = Game;

  // ------------------------------------------------------------------ bus
  var listeners = {};
  Game.bus = {
    on: function (e, f) { (listeners[e] = listeners[e] || []).push(f); },
    off: function (e, f) { var l = listeners[e]; if (!l) return; var i = l.indexOf(f); if (i >= 0) l.splice(i, 1); },
    emit: function (e, d) {
      var l = listeners[e]; if (!l) return;
      l.slice().forEach(function (f) { try { f(d || {}); } catch (err) { console.error("bus " + e, err); } });
    }
  };
  function emit(e, d) { Game.bus.emit(e, d); }

  // ------------------------------------------------------------------ save
  var DEFAULT_SAVE = function () { return { unlocked: 1, done: {}, sound: true, music: true, quality: "auto" }; };
  Game.save = DEFAULT_SAVE();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) { var o = JSON.parse(raw); if (o && typeof o === "object") Object.assign(Game.save, o); }
  } catch (e) {}
  Game.saveNow = function () { try { localStorage.setItem(KEY, JSON.stringify(Game.save)); } catch (e) {} };

  // ------------------------------------------------------------------ state
  var THREE, renderer, scene, camera, composer, root, canvas;
  var mods = { blocks: false, decor: false, world: false, hero: false };
  var levelRoot, heroPivot, heroApi, fallbackLights = null, fbBg = null;
  var gradePass, fxaaPass, bloomPass, renderPass, sceneStats = { calls: 0, tris: 0 };
  var cam = { cx: 0, cy: 0, H: 12, base: 12, zoomK: 1, bw: 0, bh: 0, bx: 0, by: 0, w: 1, h: 1, a: 1, introT: 0, hasView: false, view: null };
  var tierDef = {
    high: { shadow: 2048, bloom: true, fxaa: true, pr: 2, msaa: false },
    medium: { shadow: 1024, bloom: true, fxaa: false, pr: 1.5, msaa: true },
    low: { shadow: 0, bloom: false, fxaa: false, pr: 1, msaa: true }
  };
  var heroW = { moves: [], cur: null, dest: null, waiters: [], pos: null, yaw: Math.PI / 4, targetYaw: Math.PI / 4,
    tile: null, speed: 0, offset: 0, bumpT: 0, riding: null, refPos: null, refYaw: 0, anim: "" };
  var lock = { input: false, goalT: -1, goalPhase: 0, glimmers: 0, plateOn: null, used: {} };
  var drag = null, hoverG = null;
  var rings = [], ripples = [], debugCv = null, debugEdges = [];
  var pending = []; // mech animations waiting for hero idle
  var fpsAvg = 60, fpsAcc = 0, fpsN = 0, fpsT = 0, lastGood = 0;
  var tmpV = null, tmpV2 = null, tmpV3 = null;
  var decorUpdaters = [];

  function safe(fn, label) { try { return fn(); } catch (e) { console.warn("[engine] " + (label || "") + " failed:", e); return undefined; } }
  function withTimeout(p, ms) { return Promise.race([Promise.resolve(p), new Promise(function (r) { setTimeout(function () { r("timeout"); }, ms); })]); }

  // ------------------------------------------------------------------ projection helpers
  function toSXY(x, y, z, out) { out.x = (x - z) / SQ2; out.y = (-x + 2 * y - z) / SQ6; return out; }
  var _sxy = { x: 0, y: 0 };
  function worldToScreen(p, out) {
    toSXY(p[0], p[1], p[2], _sxy);
    var nx = (_sxy.x - cam.cx) / (cam.H * cam.a / 2), ny = (_sxy.y - cam.cy) / (cam.H / 2);
    out = out || {};
    out.x = (nx + 1) / 2 * cam.w; out.y = (1 - ny) / 2 * cam.h;
    return out;
  }
  Game.worldToScreen = function (p) { return worldToScreen(p, {}); };
  function screenToPQ(x, y, out) {
    var nx = x / cam.w * 2 - 1, ny = -(y / cam.h * 2 - 1);
    var sx = cam.cx + nx * cam.H * cam.a / 2, sy = cam.cy + ny * cam.H / 2;
    out.p = (SQ2 * sx - SQ6 * sy) / 2; out.q = (-SQ2 * sx - SQ6 * sy) / 2;
    return out;
  }
  function pxPerUnit() { return cam.h / cam.H; }

  // ------------------------------------------------------------------ init
  Game.init = async function (opts) {
    THREE = window.THREE; Game.THREE = THREE;
    canvas = opts.canvas; root = opts.root; Game.root = root; Game.ui = opts.ui;
    tmpV = new THREE.Vector3(); tmpV2 = new THREE.Vector3(); tmpV3 = new THREE.Vector3();
    var mm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
    Game.reducedMotion = !!(mm && mm.matches);
    if (mm && mm.addEventListener) mm.addEventListener("change", function (e) { Game.reducedMotion = e.matches; });

    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: "high-performance", alpha: false });
    } catch (e) { throw new Error("WebGL is not available on this device."); }
    Game.renderer = renderer;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;

    scene = new THREE.Scene(); Game.scene = scene;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 500); Game.camera = camera;
    camera.up.set(0, 1, 0);
    camera.position.set(50, 50, 50); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();

    levelRoot = new THREE.Group(); levelRoot.name = "level"; scene.add(levelRoot);
    heroPivot = new THREE.Group(); heroPivot.name = "heroPivot"; scene.add(heroPivot);
    heroW.pos = heroPivot.position;

    // module init (each may fail: fallbacks cover)
    var inits = [];
    if (window.Blocks && Blocks.init) inits.push(withTimeout(safe(function () { return Blocks.init(THREE, renderer); }, "Blocks.init"), 10000).then(function (r) { mods.blocks = r !== "timeout" && !!Blocks.build; }, function () { mods.blocks = false; }));
    if (window.Decor && Decor.init) inits.push(withTimeout(safe(function () { return Decor.init(THREE, renderer); }, "Decor.init"), 10000).then(function (r) { mods.decor = r !== "timeout" && !!Decor.build; }, function () { mods.decor = false; }));
    if (window.World && World.init) inits.push(withTimeout(safe(function () { return World.init(THREE, renderer, scene, camera); }, "World.init"), 10000).then(function (r) { mods.world = r !== "timeout"; }, function () { mods.world = false; }));
    await Promise.all(inits);
    // verify mods actually usable
    if (window.Blocks && !mods.blocks && Blocks.build) mods.blocks = false;
    mods.hero = !!(window.Hero && Hero.create);
    if (!mods.world) buildFallbackWorld();

    // hero
    var h = null;
    if (mods.hero) h = safe(function () { return Hero.create(THREE, {}); }, "Hero.create");
    if (!h || !h.object3D) { h = fallbackHero(); mods.hero = false; }
    heroApi = h;
    heroPivot.add(h.object3D);
    h.onStep = function () { emit("footstep", { tile: heroW.tile }); };
    Game.hero = { object3D: heroPivot, tile: null, walking: false, api: heroApi };

    buildPost();
    buildRingAssets();
    Game.levels = (window.LEVELS || []).filter(function (l) { return l.id !== "title"; });
    if (!Game.levels.length) throw new Error("No levels found.");
    Game.titleLevel = (window.LEVELS || []).filter(function (l) { return l.id === "title"; })[0] || Game.levels[0];

    // quality
    var qp = qs.get("quality");
    var want = qp && tierDef[qp] ? qp : (Game.save.quality || "auto");
    if (qp && tierDef[qp]) Game.save.quality = qp;
    Game.setQuality(want, true);

    setupInput();
    if (DEBUG) setupDebug();
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", function () { lastT = 0; fpsReset(); });
    lastT = 0;
    requestAnimationFrame(frame);
    Game.ready = true;
    return true;
  };

  Game.start = function () {
    var n = parseInt(qs.get("level"), 10);
    if (n >= 1 && n <= Game.levels.length) Game.startLevel(n - 1); else Game.showTitle();
  };

  // ------------------------------------------------------------------ fallbacks
  function buildFallbackWorld() {
    var c = document.createElement("canvas"); c.width = 4; c.height = 256;
    var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#1d1b45"); gr.addColorStop(0.5, "#7b4b8f"); gr.addColorStop(1, "#ff9a6a");
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    var tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding;
    scene.background = tx; fbBg = tx;
    var key = new THREE.DirectionalLight(0xffd2a0, 1.7);
    key.castShadow = true; key.shadow.bias = -0.0006;
    var hemi = new THREE.HemisphereLight(0xb9c7ff, 0x5a3a52, 0.6);
    scene.add(key, key.target, hemi);
    fallbackLights = { key: key, hemi: hemi };
    Game.fallbackLights = fallbackLights;
  }
  function keyLight() { return (window.World && mods.world && World.lights && World.lights.key) || (fallbackLights && fallbackLights.key); }

  function fallbackHero() {
    var g = new THREE.Group();
    var m = new THREE.MeshStandardMaterial({ color: 0xc8963e, metalness: 0.7, roughness: 0.4 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 12), m); body.position.y = 0.3; body.castShadow = true;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa040, emissiveIntensity: 1.5 }));
    head.position.y = 0.68;
    var light = new THREE.PointLight(0xffb35a, 1.2, 5, 2); light.position.y = 0.68;
    g.add(body, head, light);
    var api = { object3D: g, light: light, setAnim: function () {}, update: function () {}, setGlow: function (k) { light.intensity = 1.2 * k; }, onStep: null };
    return api;
  }

  var STYLE_COL = { sandstone: 0xd0955c, brick: 0xb06a4a, marble: 0xe8e0d8, darkstone: 0x4a4258, brass: 0xc8963e, copper: 0x4fa597,
    slate: 0x3b3d5c, wood: 0x8a6038, column: 0xd9c8a8, hedge: 0x4f7a2e };
  function fallbackBuild(group, ctx) {
    var o = new THREE.Group(), byStyle = {}, tops = [];
    group.blocks.forEach(function (b) {
      var c = b.cell;
      if (b.kind === "stair") {
        var sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1, 0); sh.lineTo(1, 1); sh.closePath();
        var gg = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); gg.translate(-0.5, -0.5, -0.5);
        var rot = { "+x": 0, "-x": Math.PI, "+z": -Math.PI / 2, "-z": Math.PI / 2 }[b.up] || 0;
        gg.rotateY(rot); gg.translate(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
        var m = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: STYLE_COL[b.style] || 0xd0955c, roughness: 0.9 }));
        m.castShadow = m.receiveShadow = true; o.add(m); return;
      }
      var s = b.kind === "veil" ? (b.style || "column") : (b.style || "sandstone");
      var geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
      (byStyle[s] = byStyle[s] || []).push(geo);
      if (b.kind === "cube" && b.walk !== false && !ctx.occupied(c[0], c[1] + 1, c[2])) {
        var pg = new THREE.PlaneGeometry(0.92, 0.92); pg.rotateX(-Math.PI / 2); pg.translate(c[0] + 0.5, c[1] + 1.003, c[2] + 0.5); tops.push(pg);
      }
    });
    var BGU = THREE.BufferGeometryUtils;
    function addMerged(list, mat) {
      if (!list.length) return;
      var g = BGU && BGU.mergeBufferGeometries ? BGU.mergeBufferGeometries(list) : list[0];
      var m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; o.add(m);
    }
    Object.keys(byStyle).forEach(function (s) { addMerged(byStyle[s], new THREE.MeshStandardMaterial({ color: STYLE_COL[s] || 0xd0955c, roughness: 0.85 })); });
    addMerged(tops, new THREE.MeshStandardMaterial({ color: 0xefe2c6, roughness: 0.7 }));
    return o;
  }

  var FACES = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
  function fallbackDecor(item) {
    var t = item.type, g = new THREE.Group(), f = FACES[item.face || "+y"] || FACES["+y"];
    var at = item.at;
    g.position.set(at[0] + 0.5 + f[0] * 0.5, at[1] + 0.5 + f[1] * 0.5, at[2] + 0.5 + f[2] * 0.5);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(f[0], f[1], f[2]));
    var brass = new THREE.MeshStandardMaterial({ color: 0xc8963e, metalness: 0.7, roughness: 0.4 });
    function glow(c, k) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k }); }
    var u = g.userData;
    if (t === "crank" || t === "wheel" || t === "lever") {
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12), brass); hub.position.y = 0.1;
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), brass); bar.position.y = 0.25;
      var knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brass); knob.position.set(0.25, 0.25, 0);
      var spinner = new THREE.Group(); spinner.add(bar, knob); g.add(hub, spinner);
      u.spin = function (v) { spinner.rotation.y = -v * DEG; };
    } else if (t === "knob") {
      var k = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), brass); k.position.y = 0.18; g.add(k);
    } else if (t === "plate") {
      var pl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x4fa597, metalness: 0.6, roughness: 0.5 }));
      pl.position.y = 0.03; g.add(pl);
      u.press = function (on) { pl.position.y = on ? 0.01 : 0.03; };
    } else if (t === "glimmer") {
      var gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow(0x6ff3ff, 2.2)); gm.position.y = 0.55; g.add(gm);
      u.update = function (dt, tt) { gm.rotation.y = tt * 2; gm.position.y = 0.55 + Math.sin(tt * 2.2) * 0.06; };
      u.collect = function () { g.visible = false; };
    } else if (t === "beacon") {
      var bm = glow(0x553322, 0.2);
      var bb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), bm); bb.position.y = 0.6;
      var bl = new THREE.PointLight(0xffb35a, 0, 12, 2); bl.position.y = 0.6; g.add(bb, bl);
      u.ignite = function () { bm.color.set(0xffd98a); bm.emissive.set(0xffa040); bm.emissiveIntensity = 3; bl.intensity = 2.5; };
    } else return null;
    return g;
  }

  // ------------------------------------------------------------------ post-processing
  var GradeShader = {
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.34 }, grain: { value: 0.03 }, res: { value: null } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: [
      "uniform sampler2D tDiffuse; uniform float time, vig, grain; uniform vec2 res; varying vec2 vUv;",
      "float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }",
      "vec3 enc(vec3 c){ c=max(c,vec3(0.)); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-.055, step(.0031308,c)); }",
      "void main(){",
      " vec3 c=texture2D(tDiffuse,vUv).rgb;",
      " float l=dot(c,vec3(.2126,.7152,.0722));",
      " c*=mix(vec3(.93,.98,1.08), vec3(1.07,1.0,.90), smoothstep(.04,.65,l));",
      " c=mix(vec3(l),c,1.1);",
      " vec2 d=(vUv-.5)*vec2(res.x/res.y,1.)*.78; float v=1.-vig*smoothstep(.28,.95,length(d)*1.2); c*=v;",
      " c=enc(c);",
      " c+=(hash(vUv*res+fract(time)*37.)-.5)*grain;",
      " gl_FragColor=vec4(c,1.); }"
    ].join("\n")
  };

  function buildPost() {
    var tier = tierDef[Game.quality] || tierDef.high;
    var pr = Math.min(window.devicePixelRatio || 1, tier.pr);
    renderer.setPixelRatio(pr);
    var w = Math.max(2, Math.floor(root.clientWidth || innerWidth)), h = Math.max(2, Math.floor(root.clientHeight || innerHeight));
    renderer.setSize(w, h, false);
    if (composer) { try { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); } catch (e) {} }
    var rt = null;
    if (tier.msaa && renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
      try { rt = new THREE.WebGLMultisampleRenderTarget(w * pr, h * pr, { format: THREE.RGBAFormat }); rt.samples = 4; } catch (e) { rt = null; }
    }
    composer = rt ? new THREE.EffectComposer(renderer, rt) : new THREE.EffectComposer(renderer);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    Game.composer = composer;
    renderPass = new THREE.RenderPass(scene, camera);
    var origRender = renderPass.render;
    renderPass.render = function () {
      origRender.apply(renderPass, arguments);
      sceneStats.calls = renderer.info.render.calls; sceneStats.tris = renderer.info.render.triangles;
    };
    composer.addPass(renderPass);
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.55, 0.86);
    bloomPass.enabled = tier.bloom;
    composer.addPass(bloomPass);
    GradeShader.uniforms.res.value = new THREE.Vector2(w * pr, h * pr);
    gradePass = new THREE.ShaderPass(GradeShader);
    gradePass.uniforms.res.value.set(w * pr, h * pr);
    composer.addPass(gradePass);
    fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    fxaaPass.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    fxaaPass.enabled = tier.fxaa;
    composer.addPass(fxaaPass);
    gradePass.renderToScreen = !tier.fxaa; fxaaPass.renderToScreen = tier.fxaa;
    // disabled passes must not break renderToScreen: handled in render()
  }

  // ------------------------------------------------------------------ quality
  Game.setQuality = function (q, silent) {
    if (q !== "auto" && !tierDef[q]) q = "auto";
    Game.save.quality = q;
    var eff = q === "auto" ? (Game.quality && Game.autoOn ? Game.quality : "high") : q;
    Game.autoOn = q === "auto";
    applyTier(eff, silent);
    if (!silent) Game.saveNow();
  };
  function applyTier(eff, silent) {
    var changed = Game.quality !== eff;
    Game.quality = eff;
    var tier = tierDef[eff];
    if (composer) { buildPost(); resize(); }
    var k = keyLight();
    if (k) {
      renderer.shadowMap.enabled = tier.shadow > 0;
      k.castShadow = tier.shadow > 0;
      if (tier.shadow > 0 && k.shadow.mapSize.x !== tier.shadow) {
        k.shadow.mapSize.set(tier.shadow, tier.shadow);
        if (k.shadow.map) { k.shadow.map.dispose(); k.shadow.map = null; }
      }
      scene.traverse(function (o) { if (o.material) { var m = o.material; (Array.isArray(m) ? m : [m]).forEach(function (mm) { mm.needsUpdate = true; }); } });
    }
    fpsReset();
    if (changed && !silent) emit("quality", { level: eff });
  }
  function fpsReset() { fpsAcc = 0; fpsN = 0; fpsT = 0; lastGood = Game.time; }

  // ------------------------------------------------------------------ resize + camera
  function resize() {
    if (!renderer || !root) return;
    var w = Math.max(2, Math.floor(root.clientWidth || innerWidth)), h = Math.max(2, Math.floor(root.clientHeight || innerHeight));
    if (w === cam.w && h === cam.h && cam.sized) return;
    cam.sized = true; cam.w = w; cam.h = h; cam.a = w / h;
    var pr = renderer.getPixelRatio();
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(pr); composer.setSize(w, h);
      if (fxaaPass) fxaaPass.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      if (gradePass) gradePass.uniforms.res.value.set(w * pr, h * pr);
    }
    if (debugCv) { debugCv.width = w; debugCv.height = h; }
    fitCamera();
  }
  Game.resize = function () { cam.sized = false; resize(); };

  var fitBox = null;
  function computeFitBox() {
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    function add(x, y, z, ex, ey) {
      var sx = (x - z) / SQ2, sy = (-x + 2 * y - z) / SQ6;
      if (sx - ex < minX) minX = sx - ex; if (sx + ex > maxX) maxX = sx + ex;
      if (sy - ey < minY) minY = sy - ey; if (sy + ey > maxY) maxY = sy + ey;
    }
    var out = [0, 0, 0];
    Object.keys(Game.groups).forEach(function (id) {
      var g = Game.groups[id];
      var vals = g.kind === "static" ? [0] : g.values;
      vals.forEach(function (v) {
        g.cells.forEach(function (c) { mechPointArr(g, v, c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, out); add(out[0], out[1], out[2], 0.7071, 0.8165); });
      });
    });
    (Game.level.decor || []).forEach(function (d) {
      var gr = Game.groups[d.group || "base"], at = d.at, v = gr && gr.kind !== "static" ? gr.values[0] : 0;
      mechPointArr(gr || Game.groups.base, v, at[0] + 0.5, at[1] + 0.5, at[2] + 0.5, out);
      var tall = d.type === "beacon" || d.type === "dome" || d.type === "finial" || d.type === "streetlamp" || d.type === "tree" ? 1.6 : 0.6;
      add(out[0], out[1], out[2], 0.5, 0.5 + tall * 0.5);
    });
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function fitCamera() {
    if (!Game.level || !fitBox) { cam.H = 14; cam.base = 14; positionCamera(); return; }
    var L = Game.level, ins = Game.insets, bw = fitBox.maxX - fitBox.minX, bh = fitBox.maxY - fitBox.minY;
    var landscape = cam.a >= 1;
    var top = ins.top, bot = ins.bottom, side = ins.side;
    var availW = Math.max(60, cam.w - 2 * side), availH = Math.max(60, cam.h - top - bot);
    var s = Math.max(bw * 1.1 / availW, bh * 1.1 / availH); // world units per px
    var H = Math.max(s * cam.h, 6);
    var cx = (fitBox.minX + fitBox.maxX) / 2, cy = (fitBox.minY + fitBox.maxY) / 2 + (top - bot) / 2 * (H / cam.h);
    if (L.view && L.view.center) {
      var c = L.view.center; toSXY(c[0], c[1], c[2], _sxy); cx = _sxy.x; cy = _sxy.y;
      var vh = L.view.height || 14;
      H = vh * Math.max(1, (16 / 9) / cam.a);
    }
    cam.base = H; cam.cx0 = cx; cam.cy0 = cy;
    positionCamera();
  }

  function positionCamera() {
    var k = cam.zoomK;
    cam.H = cam.base * k;
    var cx = (cam.cx0 || 0) + (cam.dx || 0), cy = (cam.cy0 || 0) + (cam.dy || 0);
    cam.cx = cx; cam.cy = cy;
    camera.left = -cam.H * cam.a / 2; camera.right = cam.H * cam.a / 2; camera.top = cam.H / 2; camera.bottom = -cam.H / 2;
    camera.updateProjectionMatrix();
    var p = (SQ2 * cx - SQ6 * cy) / 2, q = (-SQ2 * cx - SQ6 * cy) / 2;
    camera.position.set(p + 50, 50, q + 50);
    camera.lookAt(p, 0, q);
    camera.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ mechanism math
  function mechPointArr(g, v, x, y, z, out) {
    if (!g || g.kind === "static") { out[0] = x; out[1] = y; out[2] = z; return out; }
    if (g.kind === "slider") {
      out[0] = x; out[1] = y; out[2] = z; out[{ x: 0, y: 1, z: 2 }[g.axis]] += v; return out;
    }
    var P = g.pivot, c = Math.cos(v * DEG), s = Math.sin(v * DEG), dx = x - P[0], dy = y - P[1], dz = z - P[2];
    if (g.axis === "y") { out[0] = c * dx + s * dz + P[0]; out[1] = y; out[2] = -s * dx + c * dz + P[2]; }
    else if (g.axis === "x") { out[0] = x; out[1] = c * dy - s * dz + P[1]; out[2] = s * dy + c * dz + P[2]; }
    else { out[0] = c * dx - s * dy + P[0]; out[1] = s * dx + c * dy + P[1]; out[2] = z; }
    return out;
  }
  var _mp = [0, 0, 0];
  function handleRefWorld(g, v, out) {
    var h = g.handle, r = h.ref;
    if (h.on === "self") mechPointArr(g, v, r[0], r[1], r[2], out); else { out[0] = r[0]; out[1] = r[1]; out[2] = r[2]; }
    return out;
  }
  var _sc = { x: 0, y: 0 }, _sc2 = { x: 0, y: 0 };
  function tangent(g, refPt, out) {
    var e = g.kind === "rotor" ? 1 : 0.05, a = [0, 0, 0], b = [0, 0, 0];
    mechPointArr(g, g.cur + e, refPt[0], refPt[1], refPt[2], a); mechPointArr(g, g.cur - e, refPt[0], refPt[1], refPt[2], b);
    worldToScreen(a, _sc); worldToScreen(b, _sc2);
    out.x = (_sc.x - _sc2.x) / (2 * e); out.y = (_sc.y - _sc2.y) / (2 * e);
    return out;
  }

  function applyGroup(g) {
    if (g.kind === "static") return;
    var P = g.pivot;
    if (g.kind === "rotor") {
      g.pivotNode.position.set(P[0], P[1], P[2]);
      g.pivotNode.rotation.set(0, 0, 0); g.pivotNode.rotation[g.axis] = g.cur * DEG;
    } else {
      g.pivotNode.rotation.set(0, 0, 0);
      g.pivotNode.position.set(0, 0, 0); g.pivotNode.position[g.axis] = g.cur;
    }
    g.pivotNode.updateMatrixWorld(true);
  }

  // allowed range for rotors: arc unwrapped
  function rotorRange(g, around) {
    var vs = g.values.slice().sort(function (a, b) { return a - b; });
    if (vs.length >= 4) return null;
    if (vs.length === 1) return { lo: vs[0], hi: vs[0] };
    var bestGap = -1, bi = 0;
    for (var i = 0; i < vs.length; i++) {
      var nx = i + 1 < vs.length ? vs[i + 1] : vs[0] + 360, gap = nx - vs[i];
      if (gap > bestGap) { bestGap = gap; bi = i; }
    }
    var lo = vs[(bi + 1) % vs.length], hi = lo + 360 - bestGap;
    while (around < lo - 180) { lo -= 360; hi -= 360; }
    while (around > hi + 180) { lo += 360; hi += 360; }
    return { lo: lo, hi: hi };
  }
  function soft(x, lo, hi, unit) {
    if (x < lo) return lo - unit * Math.tanh((lo - x) / unit);
    if (x > hi) return hi + unit * Math.tanh((x - hi) / unit);
    return x;
  }
  function nearestAllowed(g, cur) {
    var best = null, bd = 1e9;
    g.values.forEach(function (v) {
      if (g.kind === "rotor") {
        var d = ((cur - v) % 360 + 540) % 360 - 180; // signed cur - v
        if (Math.abs(d) < bd) { bd = Math.abs(d); best = cur - d; }
      } else if (Math.abs(cur - v) < bd) { bd = Math.abs(cur - v); best = v; }
    });
    return best;
  }
  function normVal(g, v) { return g.kind === "rotor" ? ((Math.round(v) % 360) + 360) % 360 : Math.round(v * 1000) / 1000; }

  // ------------------------------------------------------------------ level loading
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function expandBlocks(gd) {
    var map = new Map();
    (gd.blocks || []).forEach(function (b) {
      var style = b.style || "sandstone", kind = b.kind === "veil" ? "veil" : "cube";
      function put(x, y, z, o) { map.set(x + "," + y + "," + z, Object.assign({ cell: [x, y, z], style: style, walk: kind === "veil" ? false : b.walk !== false, kind: kind, up: null, id: undefined }, o || {})); }
      if (b.box) {
        var a = b.box, x0 = Math.min(a[0], a[3]), x1 = Math.max(a[0], a[3]), y0 = Math.min(a[1], a[4]), y1 = Math.max(a[1], a[4]), z0 = Math.min(a[2], a[5]), z1 = Math.max(a[2], a[5]);
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) put(x, y, z);
      } else if (b.at) put(b.at[0], b.at[1], b.at[2], { id: b.id });
      else if (b.stair) put(b.stair[0], b.stair[1], b.stair[2], { kind: "stair", up: b.up, id: b.id });
    });
    return Array.from(map.values());
  }

  var fxRoot = null, ringGeo = null, ringMat = null;
  function buildRingAssets() {
    fxRoot = new THREE.Group(); fxRoot.name = "fx"; scene.add(fxRoot);
    ringGeo = new THREE.RingGeometry(0.40, 0.48, 48);
    ringMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  }
  function makeRing(scale) {
    var m = new THREE.Mesh(ringGeo, ringMat.clone()); m.renderOrder = 999; m.scale.setScalar(scale || 1); m.frustumCulled = false; fxRoot.add(m); return m;
  }

  function disposeLevel() {
    for (var i = levelRoot.children.length - 1; i >= 0; i--) {
      var c = levelRoot.children[i]; levelRoot.remove(c);
      if (window.Decor && Decor.dispose) { try { Decor.dispose(c); } catch (e) {} }
      if (window.Blocks && Blocks.disposeObject) { try { Blocks.disposeObject(c); } catch (e) {} }
      c.traverse(function (o) { if (o.geometry) { try { o.geometry.dispose(); } catch (e) {} } });
    }
    for (var j = fxRoot.children.length - 1; j >= 0; j--) { var r = fxRoot.children[j]; fxRoot.remove(r); if (r.material) r.material.dispose(); }
    rings = []; ripples = []; pending = []; drag = null; decorUpdaters = []; Game.decor = []; Game.groups = {};
  }

  function decorWorldPos(entry, target) {
    var it = entry.item, f = FACES[it.face || "+y"] || FACES["+y"], v = target || new THREE.Vector3();
    var node = entry.node;
    v.set(it.at[0] + 0.5 + f[0] * 0.5, it.at[1] + 0.5 + f[1] * 0.5, it.at[2] + 0.5 + f[2] * 0.5);
    if (entry.beacon) {
      if (!entry.bb) { entry.object3D.updateWorldMatrix(true, true); entry.bb = new THREE.Box3().setFromObject(entry.object3D); }
      // beacon flame: centre of the decor's box, taken in reference space at load
      v.set(entry.flame[0], entry.flame[1], entry.flame[2]);
    }
    if (node) { node.updateWorldMatrix(true, false); node.localToWorld(v); }
    return v;
  }

  function loadLevel(def) {
    disposeLevel();
    var w = SpireGeom.load(def); Game.geom = w; Game.level = def;
    var theme = def.theme || "dusk";
    lock.input = false; lock.goalT = -1; lock.goalPhase = 0; lock.glimmers = 0; lock.used = {};
    var hasPlates = {}; w.plates.forEach(function (p) { hasPlates[p.tile] = p; });
    heroW.moves = []; heroW.cur = null; heroW.dest = null; heroW.riding = null; heroW.waiters.forEach(function (r) { r({ ok: false }); }); heroW.waiters = [];
    heroW.offset = 0; heroW.crossK = 0; heroW.resume = null;

    // groups
    var gmap = {};
    w.groups.forEach(function (gm) { gmap[gm.id] = gm; });
    var order = (def.groups || []).map(function (gd) { return gd.id; });
    order.forEach(function (id) {
      var gd = def.groups.filter(function (x) { return x.id === id; })[0], gm = gmap[id] || { id: id, kind: "static" };
      var kind = gm.kind || "static";
      var g = { id: id, def: gd, kind: kind, axis: gm.axis || null, pivot: kind === "rotor" ? (gm.pivot || (gd.rotor && gd.rotor.pivot) || [0, 0, 0]).slice() : [0, 0, 0],
        values: (gm.values || [0]).slice(), value: gm.value || 0, cur: gm.value || 0, vel: 0, target: 0, state: "idle", moving: false,
        blocks: expandBlocks(gd), pivotNode: new THREE.Group(), contentNode: new THREE.Group(), handle: null, riding: false,
        used: false, tickIdx: 0, resolvers: [], dir: 1, gears: [] };
      g.cells = g.blocks.map(function (b) { return b.cell; });
      g.pivotNode.name = "pivot:" + id; g.contentNode.name = "content:" + id;
      g.contentNode.position.set(-g.pivot[0], -g.pivot[1], -g.pivot[2]);
      if (kind === "rotor") g.pivotNode.position.set(g.pivot[0], g.pivot[1], g.pivot[2]);
      g.pivotNode.add(g.contentNode); levelRoot.add(g.pivotNode);
      Game.groups[id] = g;
    });
    // block meshes
    order.forEach(function (id) {
      var g = Game.groups[id], occ = new Set();
      g.blocks.forEach(function (b) { occ.add(b.cell.join(",")); });
      var ctx = { occupied: function (x, y, z) { return occ.has(x + "," + y + "," + z); }, theme: theme, quality: Game.quality, seed: hashStr(def.id + ":" + id) };
      var obj = null;
      if (mods.blocks) obj = safe(function () { return Blocks.build({ id: id, blocks: g.blocks }, ctx); }, "Blocks.build");
      if (!obj) obj = safe(function () { return fallbackBuild({ id: id, blocks: g.blocks }, ctx); }, "fallbackBuild");
      if (obj) {
        obj.traverse(function (o) { if (o.isMesh && !o.userData.noShadow && !o.castShadow && !o.receiveShadow) { o.castShadow = true; o.receiveShadow = true; } });
        g.contentNode.add(obj);
      }
    });
    // decor
    function buildDecor(item, g, extra) {
      var ctx = { theme: theme, quality: Game.quality, seed: hashStr(def.id + ":" + item.type + ":" + item.at.join(",")) };
      var obj = null;
      if (mods.decor) obj = safe(function () { return Decor.build(item, ctx); }, "Decor.build " + item.type);
      if (!obj) obj = safe(function () { return fallbackDecor(item); }, "fallbackDecor");
      if (!obj) return null;
      g.contentNode.add(obj);
      safe(function () {
        var bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3());
        if (Math.max(sz.x, sz.y, sz.z) < 0.5) obj.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
      }, "shadow cull");
      var entry = Object.assign({ item: item, object3D: obj, node: g.contentNode, group: g.id }, extra || {});
      entry.worldPos = function (target) { return decorWorldPos(entry, target); };
      Game.decor.push(entry);
      if (obj.userData && typeof obj.userData.update === "function") decorUpdaters.push(obj.userData);
      return entry;
    }
    var glimOf = {}, plateOf = {}, beacon = null;
    (def.decor || []).forEach(function (d) {
      var g = Game.groups[d.group || "base"] || Game.groups.base;
      var item = Object.assign({}, d, { face: d.face || "+y", rot: d.rot || 0 });
      var e = buildDecor(item, g);
      if (e && d.type === "beacon") { e.beacon = true; beacon = beacon || e; }
      if (e && d.type === "gear") g.gears.push(e.object3D);
    });
    // beacon flame position (reference space): box centre of decor object
    Game.decor.forEach(function (e) {
      if (!e.beacon) return;
      e.object3D.updateWorldMatrix(true, true);
      var bb = new THREE.Box3().setFromObject(e.object3D), c = bb.getCenter(new THREE.Vector3());
      var inv = e.node.worldToLocal(c.clone());
      // fall back to a point above the cell if the box is empty
      if (!isFinite(inv.x) || bb.isEmpty()) inv.set(e.item.at[0] + 0.5, e.item.at[1] + 1.2, e.item.at[2] + 0.5);
      e.flame = [inv.x, inv.y, inv.z];
    });
    w.plates.forEach(function (p) {
      var wk = w.walkable(p.tile), g = Game.groups[wk.group] || Game.groups.base;
      var e = buildDecor({ type: "plate", at: wk.ref.slice(), face: "+y", rot: 0 }, g, { plate: p.tile });
      if (e) plateOf[p.tile] = e;
    });
    w.glimmers.forEach(function (tid) {
      var wk = w.walkable(tid), g = Game.groups[wk.group] || Game.groups.base;
      var e = buildDecor({ type: "glimmer", at: wk.ref.slice(), face: "+y", rot: 0 }, g, { glimmer: tid });
      if (e) glimOf[tid] = e;
    });
    // handles
    order.forEach(function (id) {
      var g = Game.groups[id], hd = g.def.handle;
      if (!hd || g.kind === "static") return;
      var on = hd.on === "base" ? "base" : "self", pg = on === "self" ? g : Game.groups.base;
      var f = FACES[hd.face || "+y"] || FACES["+y"];
      var item = { type: hd.type || (g.kind === "rotor" ? "crank" : "knob"), at: hd.at.slice(), face: hd.face || "+y", rot: hd.rot || 0, axis: g.axis, mech: g.kind };
      var e = buildDecor(item, pg, { handleOf: id });
      g.handle = { def: hd, on: on, obj: e ? e.object3D : null, ref: [hd.at[0] + 0.5 + f[0] * 0.6, hd.at[1] + 0.5 + f[1] * 0.6, hd.at[2] + 0.5 + f[2] * 0.6], ring: makeRing(1) };
      // reference block for dragging: farthest from the pivot axis
      var best = null, bd = -1;
      g.cells.forEach(function (c) {
        var dx = c[0] + 0.5 - g.pivot[0], dy = c[1] + 0.5 - g.pivot[1], dz = c[2] + 0.5 - g.pivot[2];
        if (g.axis === "x") dx = 0; else if (g.axis === "y") dy = 0; else if (g.axis === "z") dz = 0;
        var d = dx * dx + dy * dy + dz * dz; if (d > bd) { bd = d; best = c; }
      });
      g.blockRef = best ? [best[0] + 0.5, best[1] + 0.5, best[2] + 0.5] : [0, 0, 0];
    });
    Game.plateOf = plateOf; Game.glimOf = glimOf;
    Object.keys(Game.groups).forEach(function (id) { applyGroup(Game.groups[id]); });
    levelRoot.updateMatrixWorld(true);

    // world / camera
    if (window.World && mods.world) {
      safe(function () { World.setTheme(theme, true); }, "World.setTheme");
      safe(function () { if (World.exposure) renderer.toneMappingExposure = World.exposure; }, "exposure");
      safe(function () { if (window.Blocks && Blocks.useSceneEnvironment && scene.environment) Blocks.useSceneEnvironment(scene.environment); }, "Blocks env");
      safe(function () { var b = w.bounds(); World.fit({ min: b.min, max: [b.max[0] - 1, b.max[1] - 1, b.max[2] - 1] }); }, "World.fit");
    }
    fitFallbackLights(w.bounds());
    fitBox = computeFitBox();
    cam.zoomK = (Game.reducedMotion || TEST) ? 1 : 1.14; cam.introT = 0;
    fitCamera();

    // hero
    var st = w.walkable(w.startId);
    heroW.tile = w.startId; heroW.plateTile = null;
    heroW.pos.set(st.stand[0], st.stand[1], st.stand[2]);
    heroW.yaw = heroW.targetYaw = Math.PI / 4;
    heroPivot.position.copy(heroW.pos); heroPivot.rotation.y = heroW.yaw;
    setAnim("idle"); safe(function () { heroApi.setGlow && heroApi.setGlow(1); });
    Game.hero.tile = heroW.tile; Game.hero.walking = false;
    buildDebugEdges();
    return w;
  }

  function fitFallbackLights(b) {
    if (!fallbackLights) return;
    var cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    var R = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * 0.9 + 4;
    var k = fallbackLights.key;
    k.position.set(cx - 12, cy + 20, cz + 8); k.target.position.set(cx, cy, cz);
    var s = k.shadow.camera; s.left = -R; s.right = R; s.top = R; s.bottom = -R; s.near = 0.5; s.far = 100; s.updateProjectionMatrix();
  }

  function setAnim(n) { if (heroW.anim === n) return; heroW.anim = n; safe(function () { heroApi.setAnim(n); }, "setAnim"); }

  // ------------------------------------------------------------------ public level control
  Game.showTitle = function () {
    try {
      var def = Game.titleLevel; loadLevel(def);
    } catch (e) { console.error(e); }
    Game.levelIndex = -1; Game.state = "title"; Game.paused = false; lock.input = true;
    emit("title", {});
  };
  Game.startLevel = function (i) {
    i = Math.max(0, Math.min(Game.levels.length - 1, i | 0));
    loadLevel(Game.levels[i]);
    Game.levelIndex = i; Game.state = "play"; Game.paused = false; lock.input = false;
    emit("levelStart", { index: i, level: Game.level });
  };
  Game.restart = function () {
    if (Game.levelIndex < 0) return;
    var i = Game.levelIndex; loadLevel(Game.levels[i]);
    Game.state = "play"; Game.paused = false; lock.input = false;
    emit("restart", { index: i });
  };
  Game.nextLevel = function () {
    if (Game.levelIndex + 1 < Game.levels.length) Game.startLevel(Game.levelIndex + 1); else Game.showTitle();
  };
  Game.pause = function (b) {
    b = !!b;
    if (b && Game.state !== "play") return;
    if (!b && Game.state !== "paused") return;
    Game.paused = b; Game.state = b ? "paused" : "play";
    emit("pause", { paused: b });
  };

  // ------------------------------------------------------------------ walking
  function walkableOf(id) { return Game.geom.walkable(id); }
  function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  function truncateToStand() {
    // finish the move toward the next stand point, drop the rest; returns the tile that will be stood on
    var m = heroW.moves;
    if (!heroW.cur && !m.length) return heroW.tile;
    if (heroW.cur && heroW.cur.stand) { heroW.moves = []; return heroW.cur.tile; }
    var keep = [];
    for (var i = 0; i < m.length; i++) { keep.push(m[i]); if (m[i].stand) { heroW.moves = keep; return m[i].tile; } }
    heroW.moves = keep; return heroW.tile;
  }

  function buildMoves(path) {
    var moves = [], prev = path[0].id, w = Game.geom;
    for (var i = 1; i < path.length; i++) {
      var e = path[i], wk = w.walkable(e.id), pk = w.walkable(prev);
      moves.push({ kind: "a", to: v3(e.from3), jump: v3(e.to3), newTile: e.id, fromTile: prev, k: e.k, stairs: pk.kind === "stair" });
      moves.push({ kind: "b", to: v3(wk.stand), stand: true, tile: e.id, stairs: wk.kind === "stair", k: e.k });
      prev = e.id;
      if (isActivePlate(e.id)) break;
    }
    return moves;
  }
  function plateDef(tile) { var ps = Game.geom.plates; for (var i = 0; i < ps.length; i++) if (ps[i].tile === tile) return ps[i]; return null; }
  function isActivePlate(tile) { var p = plateDef(tile); return !!p && !(p.once && lock.used[tile]); }

  function walkTo(destId) {
    // returns Promise<{ok}> ; assumes caller checked reachability
    var anchor = truncateToStand();
    var path = anchor === destId ? [{ id: anchor }] : Game.geom.path(anchor, destId);
    if (!path) return Promise.resolve({ ok: false });
    var moves = buildMoves(path);
    heroW.dest = destId;
    if (!moves.length && !heroW.cur) { return Promise.resolve({ ok: true }); }
    var pts = [[heroW.pos.x, heroW.pos.y, heroW.pos.z]];
    for (var i = 1; i < path.length; i++) { var s = walkableOf(path[i].id).stand; pts.push([s[0], s[1], s[2]]); }
    heroW.moves = heroW.moves.concat(moves);
    emit("path", { points: pts });
    Game.hero.walking = true;
    return new Promise(function (res) { heroW.waiters.push(res); });
  }

  function stopHero() {
    heroW.cur = null; heroW.moves = []; Game.hero.walking = false;
    if (Game.state === "play" && !lock.goalPhase) setAnim("idle");
    var tile = heroW.tile;
    var ws = heroW.waiters; heroW.waiters = [];
    if (!heroW.resume) heroW.dest = null;
    emit("heroStop", { tile: tile });
    ws.forEach(function (r) { r({ ok: true, tile: tile }); });
  }

  function leaveTile(oldTile) {
    if (lock.plateOn && lock.plateOn === oldTile) {
      var e = Game.plateOf[oldTile]; if (e && e.object3D.userData.press) safe(function () { e.object3D.userData.press(false); });
      lock.plateOn = null;
    }
  }

  function arrive(tile) {
    var w = Game.geom, wk = walkableOf(tile);
    // glimmer
    var ge = Game.glimOf[tile];
    if (ge && !ge.got) {
      ge.got = true; lock.glimmers++;
      safe(function () { ge.object3D.userData.collect && ge.object3D.userData.collect(); });
      emit("glimmer", { tile: tile, count: lock.glimmers, total: w.glimmers.length, pos: ge.worldPos().toArray() });
    }
    if (tile === w.goalId && Game.state === "play" && !heroW.moves.length) { startGoal(); return true; }
    var p = plateDef(tile);
    if (p) {
      var e = Game.plateOf[tile]; if (e && e.object3D.userData.press) safe(function () { e.object3D.userData.press(true); });
      lock.plateOn = tile;
      if (!(p.once && lock.used[tile])) {
        lock.used[tile] = true;
        emit("plate", { tile: tile, group: p.group, pos: e ? e.worldPos().toArray() : wk.stand.slice() });
        var g = Game.groups[p.group], target;
        target = p.to !== undefined ? unwrapTo(g, p.to) : stepTarget(g);
        heroW.moves = []; // plates truncate
        requestMech(g, target, null, true);
      }
    }
    return false;
  }

  function startGoal() {
    lock.input = true; lock.goalPhase = 1; lock.goalT = 0; heroW.moves = []; heroW.cur = null;
    emit("goal", { index: Game.levelIndex });
    var b = null; Game.decor.forEach(function (e) { if (e.beacon && !b) b = e; });
    if (b) { var bp = b.worldPos(); var dx = bp.x - heroW.pos.x, dz = bp.z - heroW.pos.z; if (Math.abs(dx) + Math.abs(dz) > 0.2) heroW.targetYaw = Math.atan2(dx, dz); }
    else heroW.targetYaw = Math.PI / 4;
    setAnim("celebrate"); safe(function () { heroApi.setGlow && heroApi.setGlow(1.6); });
  }

  function unwrapTo(g, v) {
    if (g.kind !== "rotor") return v;
    var d = ((v - g.cur) % 360 + 540) % 360 - 180; return g.cur + d;
  }
  function stepTarget(g) {
    // tap on a handle: next allowed value (rotors wrap, 2-value mechanisms ping-pong)
    var vs = g.values.slice().sort(function (a, b) { return a - b; }), n = vs.length;
    if (g.kind === "rotor") {
      var cur = nearestAllowed(g, g.cur), curN = ((Math.round(cur) % 360) + 360) % 360;
      if (n >= 3) { var best = 361; vs.forEach(function (v) { var d = ((v - curN) % 360 + 360) % 360; if (d > 0 && d < best) best = d; }); return cur + best; }
      var other = vs[0] === curN ? vs[1] : vs[0], d2 = ((other - curN) % 360 + 540) % 360 - 180;
      return cur + d2;
    }
    var i = vs.indexOf(g.value); if (i < 0) i = 0;
    if (i === n - 1) g.dir = -1; else if (i === 0) g.dir = 1;
    return vs[Math.max(0, Math.min(n - 1, i + g.dir))];
  }
  // ------------------------------------------------------------------ mechanisms
  function heroOnGroup(g) { return !!heroW.tile && walkableOf(heroW.tile) && walkableOf(heroW.tile).group === g.id; }
  function isLocked(g) { return g.kind === "rotor" && g.axis !== "y" && heroOnGroup(g); }
  function anyMoving() { for (var id in Game.groups) if (Game.groups[id].state !== "idle") return true; return pending.length > 0; }
  function heroBusy() { return !!heroW.cur || heroW.moves.length > 0; }

  function beginRide(g) {
    if (g.riding || !heroOnGroup(g)) return;
    if (!(g.kind === "slider" || (g.kind === "rotor" && g.axis === "y"))) return;
    applyGroup(g);
    var local = g.contentNode.worldToLocal(heroW.pos.clone());
    heroW.refPos = local; heroW.refYaw = heroW.yaw - (g.kind === "rotor" ? g.cur * DEG : 0);
    g.riding = true; heroW.riding = g; setAnim("ride");
  }
  function endRide(g) {
    if (!g.riding) return;
    g.riding = false; heroW.riding = null;
    var wk = walkableOf(heroW.tile);
    heroW.pos.set(wk.stand[0], wk.stand[1], wk.stand[2]);
    setAnim("idle");
  }

  // request a mechanism move to an (unwrapped) target; waits for hero to settle at a stand point
  function requestMech(g, target, resolve, fromPlate) {
    if (isLocked(g)) { emit("mechLocked", { id: g.id }); wiggle(g); if (resolve) resolve(false); return; }
    pending.push({ g: g, target: target, resolve: resolve });
    if (heroBusy()) { if (!heroW.resume) heroW.resume = heroW.dest; truncateToStand(); }
  }
  function wiggle(g) { g.wig = 1; }

  function beginSpring(g, target, resolve) {
    g.target = target; g.state = "spring"; g.moving = true;
    if (resolve) g.resolvers.push(resolve);
    beginRide(g);
  }

  function snapSettle(g) {
    var nv = normVal(g, g.target);
    g.cur = g.kind === "rotor" ? nv : nv; g.vel = 0; g.state = "idle"; g.moving = false;
    applyGroup(g);
    var changed = nv !== g.value;
    g.value = nv; Game.geom.setValue(g.id, nv); Game.geom.compute();
    endRide(g);
    buildDebugEdges();
    var pos = handlePosOf(g);
    emit("mechSnap", { id: g.id, value: nv, pos: pos });
    var rs = g.resolvers; g.resolvers = []; rs.forEach(function (r) { r(true); });
    // resume interrupted walk
    if (heroW.resume && !anyMoving() && !heroBusy()) {
      var d = heroW.resume; heroW.resume = null;
      if (d && d !== heroW.tile && Game.state === "play") { var path = Game.geom.path(heroW.tile, d); if (path) walkTo(d); }
    }
  }

  function handlePosOf(g) {
    var out = [0, 0, 0];
    return mechPointForHandle(g);
  }
  function mechPointForHandle(g) {
    var o = [0, 0, 0];
    if (g.handle) { handleRefWorld(g, g.cur, o); return o; }
    var c = g.blockRef || (g.cells[0] ? [g.cells[0][0] + 0.5, g.cells[0][1] + 1, g.cells[0][2] + 0.5] : g.pivot);
    return mechPointArr(g, g.cur, c[0], c[1], c[2], o);
  }

  function tickMech(g, dt) {
    if (g.state === "spring") {
      var w = 18, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, x = g.cur, v = g.vel, t = g.target;
      for (var i = 0; i < n; i++) { var acc = w * w * (t - x) - 2 * w * v; v += acc * h; x += v * h; }
      g.vel = v; g.cur = x;
      var eps = g.kind === "rotor" ? 0.15 : 0.003, ve = g.kind === "rotor" ? 3 : 0.03;
      if (Math.abs(x - t) < eps && Math.abs(v) < ve) { applyGroup(g); snapSettle(g); return; }
    } else if (g.state === "drag" && g.wig) { g.wig = 0; }
    if (g.state !== "idle") {
      var prev = g.prevCur === undefined ? g.cur : g.prevCur; g.prevCur = g.cur;
      applyGroup(g);
      var step = g.kind === "rotor" ? 15 : 0.25, ti = Math.floor(g.cur / step + 1e-6);
      if (ti !== g.tickIdx) { g.tickIdx = ti; emit("mechTick", { id: g.id, pos: mechPointForHandle(g) }); }
      emit("mechMove", { id: g.id, value: g.cur, delta: g.cur - prev });
      if (g.handle && g.handle.obj && g.handle.obj.userData.spin) safe(function () { g.handle.obj.userData.spin(g.cur); });
      g.gears.forEach(function (o) { if (o.userData && o.userData.spin) safe(function () { o.userData.spin(g.cur); }); });
    }
  }

  // ------------------------------------------------------------------ input
  var tapCand = null;
  function inputOK() { return Game.state === "play" && !lock.input && !Game.paused; }
  function localXY(e) { var r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function hitHandle(x, y) {
    var best = null, bd = 36 * 36, o = [0, 0, 0];
    for (var id in Game.groups) {
      var g = Game.groups[id]; if (!g.handle) continue;
      handleRefWorld(g, g.cur, o); worldToScreen(o, _sc);
      var d = (_sc.x - x) * (_sc.x - x) + (_sc.y - y) * (_sc.y - y);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  function setupInput() {
    canvas.addEventListener("pointerdown", function (e) { safe(function () { onDown(e); }, "pointerdown"); });
    canvas.addEventListener("pointermove", function (e) { safe(function () { onMove(e); }, "pointermove"); });
    canvas.addEventListener("pointerup", function (e) { safe(function () { onUp(e); }, "pointerup"); });
    canvas.addEventListener("pointercancel", function (e) { safe(function () { onUp(e, true); }, "pointercancel"); });
    canvas.addEventListener("pointerleave", function () { hoverG = null; });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  function onDown(e) {
    if (!inputOK() || e.button > 0) return;
    var p = localXY(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
    var g = hitHandle(p.x, p.y);
    if (g) { grab(g, p, e.pointerId); return; }
    if (anyMoving()) return;
    tapCand = { x: p.x, y: p.y, id: e.pointerId };
  }

  function grab(g, p, id) {
    g.used = true;
    emit("mechGrab", { id: g.id, kind: g.kind });
    drag = { g: g, id: id, sx: p.x, sy: p.y, lx: p.x, ly: p.y, travel: 0, raw: g.cur, started: false, locked: isLocked(g), wasSpring: g.state === "spring" };
    if (g.state === "spring") { g.state = "drag"; g.moving = true; }
    if (heroBusy()) { if (!heroW.resume) heroW.resume = heroW.dest; truncateToStand(); }
    if (drag.locked) { emit("mechLocked", { id: g.id }); }
  }

  var _T = { x: 0, y: 0 };
  function dragRef(g) {
    if (g.handle && g.handle.on === "self") {
      tangent(g, g.handle.ref, _T);
      var mag = Math.hypot(_T.x, _T.y);
      if (mag > (g.kind === "rotor" ? 0.6 : 8)) return g.handle.ref;
    }
    return g.blockRef || (g.cells[0] ? [g.cells[0][0] + 0.5, g.cells[0][1] + 0.5, g.cells[0][2] + 0.5] : [0, 0, 0]);
  }

  function onMove(e) {
    var p = localXY(e);
    if (drag && e.pointerId === drag.id) {
      var g = drag.g, dx = p.x - drag.lx, dy = p.y - drag.ly;
      drag.lx = p.x; drag.ly = p.y; drag.travel = Math.max(drag.travel, Math.hypot(p.x - drag.sx, p.y - drag.sy));
      if (drag.travel < 6) return;
      if (drag.locked) { var amt = Math.min(1, drag.travel / 60); g.cur = g.value + (g.kind === "rotor" ? 4 : 0.06) * Math.tanh(amt * 2) * (g.dir || 1); g.state = "drag"; g.moving = true; applyGroup(g); return; }
      if (heroBusy()) return; // wait for the hero to settle
      if (!drag.started) { drag.started = true; drag.raw = g.cur; g.state = "drag"; g.moving = true; beginRide(g); }
      tangent(g, dragRef(g), _T);
      var den = _T.x * _T.x + _T.y * _T.y; if (den < 1e-6) return;
      drag.raw += (dx * _T.x + dy * _T.y) / den;
      if (g.kind === "rotor") { var rg = rotorRange(g, g.value); g.cur = rg ? soft(drag.raw, rg.lo, rg.hi, 12) : drag.raw; }
      else { var lo = Math.min.apply(null, g.values), hi = Math.max.apply(null, g.values); g.cur = soft(drag.raw, lo, hi, 0.25); }
      return;
    }
    if (e.pointerType === "mouse" && !drag) { hoverG = inputOK() ? hitHandle(p.x, p.y) : null; canvas.style.cursor = hoverG ? "grab" : ""; }
    if (tapCand && e.pointerId === tapCand.id && Math.hypot(p.x - tapCand.x, p.y - tapCand.y) > 14) tapCand = null;
  }

  function onUp(e, cancel) {
    var p = localXY(e);
    if (drag && e.pointerId === drag.id) {
      var d = drag, g = d.g; drag = null;
      if (d.locked) { g.target = g.value; g.state = "spring"; g.moving = true; return; }
      if (d.travel < 6 && !cancel) {
        if (anyMoving() && g.state !== "drag") return;
        g.state = "idle"; g.moving = false;
        var t = stepTarget(g);
        requestMech(g, t, null);
      } else {
        var tgt = d.started ? (g.kind === "rotor" ? nearestAllowed(g, g.cur) : nearestAllowed(g, g.cur)) : g.value;
        if (g.kind === "rotor" && d.started) { var rg = rotorRange(g, g.value); if (rg) { tgt = Math.max(rg.lo, Math.min(rg.hi, tgt)); } }
        if (!d.started) { g.state = "idle"; g.moving = false; return; }
        beginSpring(g, tgt, null);
      }
      return;
    }
    if (tapCand && e.pointerId === tapCand.id && !cancel) {
      var tc = tapCand; tapCand = null;
      if (Math.hypot(p.x - tc.x, p.y - tc.y) <= 14) doTap(p.x, p.y);
    }
    tapCand = null;
  }

  var _pq = { p: 0, q: 0 };
  function doTap(x, y) {
    var w = Game.geom; screenToPQ(x, y, _pq);
    var id = w.pick(_pq.p, _pq.q), hit = w.raycast(_pq.p, _pq.q);
    var reach = false, path = null;
    if (id && id !== heroW.tile) { var anchor = peekAnchor(); path = id === anchor ? [{ id: id }] : w.path(anchor, id); reach = !!path; }
    var pos = id ? walkableOf(id).stand.slice() : null;
    emit("tap", { x: x, y: y, tile: id, reachable: reach, pos: pos });
    var rp = hit ? [_pq.p + hit.t, hit.t, _pq.q + hit.t] : [_pq.p + heroW.pos.y, heroW.pos.y, _pq.q + heroW.pos.y];
    if (id && id === heroW.tile && !heroBusy()) { spawnRipple(pos, 0xffd98a, 0.8); return; }
    if (reach) { spawnRipple(pos, 0xffd98a, 0.9); walkTo(id); }
    else { spawnRipple(id ? pos : rp, 0xff8a7a, 1); bump(); }
  }
  function peekAnchor() {
    if (heroW.cur && heroW.cur.stand) return heroW.cur.tile;
    for (var i = 0; i < heroW.moves.length; i++) if (heroW.moves[i].stand) return heroW.moves[i].tile;
    return heroW.tile;
  }
  function bump() { if (!heroBusy() && !heroW.riding) { setAnim("bump"); heroW.bumpT = 0.7; } }

  function spawnRipple(pos, color, scale) {
    if (!pos) return;
    var m = null;
    for (var i = 0; i < ripples.length; i++) if (!ripples[i].mesh.visible) { m = ripples[i]; break; }
    if (!m) { m = { mesh: makeRing(1), t: 0 }; ripples.push(m); }
    m.mesh.visible = true; m.t = 0; m.scale = scale; m.mesh.position.set(pos[0], pos[1] + 0.05, pos[2]); m.mesh.material.color.setHex(color);
  }

  // ------------------------------------------------------------------ test API
  Game.tapTile = function (id) {
    return waitIdle().then(function () {
      if (Game.state !== "play" || lock.input) return { ok: false };
      var w = Game.geom, wk = w.walkable(id); if (!wk) return { ok: false };
      var reach = id === heroW.tile || !!w.path(heroW.tile, id);
      emit("tap", { x: 0, y: 0, tile: wk.id, reachable: reach, pos: wk.stand.slice() });
      if (!reach) { bump(); return { ok: false }; }
      if (wk.id === heroW.tile) return { ok: true };
      return walkTo(wk.id).then(function (r) { return waitIdle().then(function () { return r; }); });
    });
  };
  Game.setMech = function (id, value) {
    return waitIdle().then(function () {
      var g = Game.groups[id]; if (!g || g.kind === "static" || g.values.indexOf(value) < 0) return false;
      return new Promise(function (res) { requestMech(g, g.kind === "rotor" ? unwrapTo(g, value) : value, res); });
    });
  };
  function waitIdle() {
    return new Promise(function (res) {
      (function chk() { if (!anyMoving() && !heroBusy() && !heroW.resume) res(); else setTimeout(chk, 16); })();
    });
  }
  Game.runSolution = async function (i) {
    var t0 = performance.now();
    if (i !== undefined && i !== null) Game.startLevel(i);
    var sol = Game.level.solution || [], ok = true, why = "";
    var done = false, off = function () { Game.bus.off("levelComplete", f); }, f = function () { done = true; };
    Game.bus.on("levelComplete", f);
    for (var k = 0; k < sol.length; k++) {
      var a = sol[k], r;
      if (a[0] === "walk") r = await Game.tapTile(a[1]); else r = await Game.setMech(a[1], a[2]);
      if (a[0] === "walk" ? !(r && r.ok) : !r) { ok = false; why = "step " + k + " " + JSON.stringify(a) + " failed"; break; }
    }
    if (ok) { var tmo = performance.now() + 60000; while (!done && performance.now() < tmo) await new Promise(function (r2) { setTimeout(r2, 30); }); if (!done) { ok = false; why = "level did not complete"; } }
    off();
    return { ok: ok, ms: Math.round(performance.now() - t0), why: why };
  };
  Game.handleScreen = function (id) { var g = Game.groups[id]; if (!g || !g.handle) return null; var o = [0, 0, 0]; handleRefWorld(g, g.cur, o); return worldToScreen(o, {}); };
  Game.heroScreen = function () { return worldToScreen([heroW.pos.x, heroW.pos.y + 0.4, heroW.pos.z], {}); };
  Game.debug = function () {
    var gv = {}; for (var id in Game.groups) gv[id] = Game.groups[id].value;
    var reach = []; try { if (Game.geom) reach = Array.from(Game.geom.reachable(heroW.tile)); } catch (e) {}
    return { state: Game.state, level: Game.level && Game.level.id, heroTile: heroW.tile, reachable: reach, groups: gv, calls: sceneStats.calls, tris: sceneStats.tris, fps: Math.round(fpsAvg), quality: Game.quality, mods: mods };
  };

  // ------------------------------------------------------------------ debug overlay
  function setupDebug() {
    debugCv = document.createElement("canvas"); debugCv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5";
    root.insertBefore(debugCv, Game.ui || null);
  }
  function refStand(wk) { return wk.kind === "stair" ? [wk.ref[0] + 0.5, wk.ref[1] + 0.5, wk.ref[2] + 0.5] : [wk.ref[0] + 0.5, wk.ref[1] + 1, wk.ref[2] + 0.5]; }
  function buildDebugEdges() {
    if (!DEBUG || !Game.geom) return;
    var w = Game.geom; debugEdges = [];
    w.walkables.forEach(function (wk) {
      if (!wk.standable) return;
      w.neighbors(wk.id).forEach(function (n) { if (wk.id < n.to) debugEdges.push({ a: wk.id, b: n.to, k: n.k }); });
    });
  }
  function dbgPos(id, out) {
    var wk = walkableOf(id), g = Game.groups[wk.group], r = refStand(wk);
    mechPointArr(g, g.cur, r[0], r[1], r[2], out); return out;
  }
  function drawDebug() {
    if (!debugCv || !Game.geom) return;
    var c = debugCv.getContext("2d"), a = [0, 0, 0], b = [0, 0, 0], s1 = { x: 0, y: 0 }, s2 = { x: 0, y: 0 };
    c.clearRect(0, 0, debugCv.width, debugCv.height);
    c.lineWidth = 2;
    debugEdges.forEach(function (e) {
      dbgPos(e.a, a); dbgPos(e.b, b); worldToScreen(a, s1); worldToScreen(b, s2);
      c.strokeStyle = e.k ? "#ff3df0" : "#3dff9a"; c.setLineDash(e.k ? [6, 5] : []);
      c.beginPath(); c.moveTo(s1.x, s1.y); c.lineTo(s2.x, s2.y); c.stroke();
    });
    c.setLineDash([]); c.font = "10px monospace"; c.textAlign = "center";
    Game.geom.walkables.forEach(function (wk) {
      dbgPos(wk.id, a); worldToScreen(a, s1);
      c.fillStyle = wk.standable ? (wk.id === heroW.tile ? "#ffe34a" : "#fff") : "#888";
      c.beginPath(); c.arc(s1.x, s1.y, 3, 0, 7); c.fill();
      var lab = wk.alias || wk.id.replace(/^[^:]*:/, ""); c.fillStyle = "#000a"; c.fillRect(s1.x - 22, s1.y + 5, 44, 11); c.fillStyle = "#fff"; c.fillText(lab, s1.x, s1.y + 14);
    });
    c.strokeStyle = "#ffb35a"; for (var id in Game.groups) { var g = Game.groups[id]; if (!g.handle) continue; handleRefWorld(g, g.cur, a); worldToScreen(a, s1); c.beginPath(); c.arc(s1.x, s1.y, 36, 0, 7); c.stroke(); }
  }

  // ------------------------------------------------------------------ frame loop
  var lastT = 0;
  function normAng(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  function updateHero(dt) {
    var pos = heroW.pos, moving = false, speedNow = 0, stairs = false;
    if (heroW.riding) {
      var g = heroW.riding; g.contentNode.updateWorldMatrix(true, false);
      tmpV.copy(heroW.refPos); g.contentNode.localToWorld(tmpV); pos.copy(tmpV);
      var ny = g.kind === "rotor" ? g.cur * DEG : 0; heroW.yaw = heroW.targetYaw = heroW.refYaw + ny;
    } else if (!lock.goalPhase || true) {
      var remain = dt;
      while (remain > 1e-6) {
        if (!heroW.cur) { if (!heroW.moves.length) break; heroW.cur = heroW.moves.shift(); if (heroW.cur.kind === "a") { leaveTile(heroW.tile); } }
        var m = heroW.cur, sp = 2.4 * (m.stairs ? 0.75 : 1);
        tmpV.copy(m.to).sub(pos); var dist = tmpV.length();
        var hx = tmpV.x, hz = tmpV.z; if (hx * hx + hz * hz > 1e-6) heroW.targetYaw = Math.atan2(hx, hz);
        moving = true; stairs = m.stairs; speedNow = sp;
        if (dist <= sp * remain + 1e-6) {
          remain -= dist / sp; pos.copy(m.to); heroW.cur = null;
          if (m.jump) {
            var from = heroW.tile; pos.copy(m.jump); heroW.crossK = m.k;
            heroW.tile = m.newTile; Game.hero.tile = heroW.tile;
            emit("heroStep", { from: from, to: m.newTile, k: m.k, at: [m.to.x, m.to.y, m.to.z] });
          }
          if (m.stand) {
            heroW.crossK = 0;
            if (arrive(m.tile)) { moving = false; stopHero(); break; }
            if (!heroW.moves.length) { moving = false; stopHero(); break; }
          }
        } else { tmpV.multiplyScalar(1 / dist); pos.addScaledVector(tmpV, sp * remain); remain = 0; }
      }
    }
    // facing
    var da = normAng(heroW.targetYaw - heroW.yaw), mx = 13 * dt; // 90 deg per 0.12 s
    if (!heroW.riding) heroW.yaw += Math.abs(da) <= mx ? da : Math.sign(da) * mx;
    // animation state
    if (!lock.goalPhase && !heroW.riding) {
      if (moving || heroBusy()) setAnim(stairs ? "climb" : "walk");
      else if (heroW.bumpT > 0) { heroW.bumpT -= dt; if (heroW.bumpT <= 0) setAnim("idle"); }
      else if (heroW.anim === "walk" || heroW.anim === "climb") setAnim("idle");
    }
    Game.hero.walking = heroBusy();
    // anti-clipping offset during impossible-join crossings
    var want = 0;
    if (heroW.crossK && !heroW.riding || (heroW.cur && heroW.cur.kind === "a" && heroW.cur.k)) {
      var w = Game.geom;
      for (var i = 0; i < 3; i++) {
        var dy = [0.05, 0.4, 0.8][i], X = pos.x, Y = pos.y + dy, Z = pos.z, r = w.raycast(X - Y, Z - Y);
        if (r && r.kind !== "veil" && r.t > Y + 0.02) want = Math.max(want, r.t - Y + 0.03);
      }
      want = Math.min(0.3, want);
    }
    heroW.offset += (want - heroW.offset) * Math.min(1, dt * 14);
    heroPivot.position.copy(pos);
    if (heroW.offset > 1e-3) heroPivot.position.addScalar(heroW.offset);
    heroPivot.rotation.y = heroW.yaw;
    safe(function () { heroApi.update(dt, Game.time, { speed: moving ? speedNow : 0, grounded: true }); }, "hero.update");
  }

  function updateGoal(dt) {
    if (!lock.goalPhase) return;
    lock.goalT += dt;
    var t1 = TEST ? 0.9 : 0.9, t2 = TEST ? 3.6 : 3.6;
    if (lock.goalPhase === 1 && lock.goalT >= t1) {
      lock.goalPhase = 2;
      var b = null; Game.decor.forEach(function (e) { if (e.beacon && !b) b = e; });
      var pos = b ? b.worldPos().toArray() : [heroW.pos.x, heroW.pos.y + 2, heroW.pos.z];
      if (b) safe(function () { b.object3D.userData.ignite && b.object3D.userData.ignite(); }, "ignite");
      emit("beacon", { index: Game.levelIndex, pos: pos });
    }
    if (lock.goalPhase === 2 && lock.goalT >= t2) {
      lock.goalPhase = 3;
      var i = Game.levelIndex, id = Game.level.id, total = Game.geom.glimmers.length;
      var prev = Game.save.done[id] && Game.save.done[id].glimmers || 0;
      Game.save.done[id] = { glimmers: Math.max(prev, lock.glimmers) };
      Game.save.unlocked = Math.max(Game.save.unlocked || 1, Math.min(Game.levels.length, i + 2));
      Game.saveNow();
      Game.state = "complete";
      emit("levelComplete", { index: i, glimmers: lock.glimmers, total: total, next: i + 1 < Game.levels.length ? i + 1 : null });
    }
  }

  function updateFX(dt, rdt) {
    var t = Game.time, o = [0, 0, 0];
    // handle hint rings
    for (var id in Game.groups) {
      var g = Game.groups[id]; if (!g.handle) continue;
      var r = g.handle.ring, vis = Game.state === "play" && !lock.input;
      if (!vis) { r.visible = false; continue; }
      handleRefWorld(g, g.cur, o); r.position.set(o[0], o[1], o[2]); r.quaternion.copy(camera.quaternion);
      var hov = (hoverG === g) || (drag && drag.g === g), pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
      var base = g.used ? 0 : 0.25 + 0.4 * pulse; if (hov) base = 0.85;
      if (g.handle.obj && g.handle.obj.userData) {
        var ud = g.handle.obj.userData;
        if (ud.setHover && g.hov !== hov) { g.hov = hov; safe(function () { ud.setHover(hov); }); }
        if (ud.setHint && g.used && !g.hintOff) { g.hintOff = true; safe(function () { ud.setHint(false); }); }
      }
      r.visible = base > 0.01; r.material.opacity = base; r.scale.setScalar(1 + (g.used ? 0 : 0.12 * pulse) + (hov ? 0.12 : 0));
    }
    for (var i = 0; i < ripples.length; i++) {
      var rp = ripples[i]; if (!rp.mesh.visible) continue;
      rp.t += rdt; var k = rp.t / 0.6; if (k >= 1) { rp.mesh.visible = false; continue; }
      rp.mesh.quaternion.copy(camera.quaternion); rp.mesh.scale.setScalar((0.35 + k * 1.1) * rp.scale); rp.mesh.material.opacity = (1 - k) * 0.8;
    }
  }

  var errCount = { world: 0, blocks: 0 };
  function frame(ms) {
    requestAnimationFrame(frame);
    if (!Game.ready) return;
    var rdt = lastT ? Math.min(TEST ? 0.1 : 0.05, (ms - lastT) / 1000) : 0.016; lastT = ms;
    var dt = rdt * Game.timeScale;
    Game.dt = rdt; Game.time += rdt;
    // fps tracking
    if (ms && rdt > 0) { fpsAvg += (Math.min(120, 1 / rdt) - fpsAvg) * 0.05; }
    if (Game.autoOn && !TEST && !navigator.webdriver && Game.state !== "loading") {
      fpsT += rdt; fpsN++;
      if (fpsT >= 3) { var f = fpsN / fpsT; fpsT = 0; fpsN = 0; if (f < 45 && Game.time - lastGood > 1) { var nx = Game.quality === "high" ? "medium" : Game.quality === "medium" ? "low" : null; if (nx) { applyTier(nx); } } }
    }
    var sim = Game.state === "play" || Game.state === "complete" || Game.state === "title";
    var run = sim && !Game.paused;
    if (run && Game.geom) {
      if (Game.state !== "title") {
        // pending mech requests start when the hero is idle
        if (pending.length && !heroBusy()) { var pr = pending.shift(); beginSpring(pr.g, pr.target, pr.resolve); }
        for (var id in Game.groups) { var g = Game.groups[id]; if (g.kind !== "static") tickMech(g, dt); }
        if (drag && !drag.started && drag.travel >= 6 && !drag.locked && !heroBusy()) { /* started on next move */ }
        updateHero(dt);
        updateGoal(dt);
      } else {
        updateHero(dt);
      }
    }
    // camera
    if (cam.zoomK > 1) { cam.introT += rdt; var k = Math.min(1, cam.introT / 1.6); cam.zoomK = 1 + 0.14 * Math.pow(1 - k, 3); if (k >= 1) cam.zoomK = 1; }
    if (!Game.reducedMotion) { cam.dx = Math.sin(Game.time * 0.17) * 0.05; cam.dy = Math.cos(Game.time * 0.13) * 0.04; } else { cam.dx = 0; cam.dy = 0; }
    positionCamera();
    // modules
    if (mods.world && errCount.world < 3) { try { World.update(rdt, Game.time); } catch (e) { errCount.world++; console.warn("World.update", e); } }
    if (mods.blocks && errCount.blocks < 3 && window.Blocks && Blocks.update) { try { Blocks.update(rdt, Game.time); } catch (e) { errCount.blocks++; console.warn("Blocks.update", e); } }
    for (var i = 0; i < decorUpdaters.length; i++) { try { decorUpdaters[i].update(rdt, Game.time); } catch (e) { decorUpdaters.splice(i, 1); i--; } }
    updateFX(dt, rdt);
    if (gradePass) gradePass.uniforms.time.value = Game.time;
    if (DEBUG) drawDebug();
    renderer.info.reset();
    composer.render(rdt);
  }
})();
