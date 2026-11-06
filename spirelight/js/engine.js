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
    insets: { top: 72, bottom: 96, side: 14 }, test: TEST, paused: false };
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
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.34 }, grain: { value: 0.03 }, res: { value: new (window.THREE ? THREE.Vector2 : Object)(1280, 720) } },
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
