(function () {
  "use strict";

  // The public object is available even without THREE, a scene, or WebAudio.
  var G = null, T = null, root = null, ready = false, raf = 0, bindings = [];
  var MAX = 1500, STRIDE = 20, budget = MAX, factor = 1, low = false;
  var pool = new Float32Array(MAX * STRIDE), kind = new Uint8Array(MAX);
  var serial = new Float64Array(MAX), sequence = 0, carry = 0;
  // Record: xyz, velocity xyz, rgb, size, alpha, age, life, delay, base xyz, phase, blend, gravity.
  var glow, dust, ringMesh, texture, ringData = new Float32Array(24 * 10);
  var a, b, c, matrix, rotation, scale, colour, ray, ndc, plane;
  var min = [-3, 0, -3], max = [7, 5, 7], theme = "dusk";
  var clock = 0, ambientClock = 0, last = 0, gameTime = NaN, poll = 0, step = 0;
  var paused = false, frameId = 0, moveFrame = -1, petalAt = 7;
  var shafts = null, flash = null, sway = null, flashAt = -100;
  var cascade = [], cascadeIndex = 0, cascadeAt = -100, moteNext = 0;
  var beaconPoint = [0, 0, 0], live = 0, ringCount = 0, ambientCount = 0;
  var GOLD = 0xffd98a, BRASS = 0xffd27a, TEAL = 0x8ff5ee, SAND = 0xd9b68b;
  var EMPTY = {};
  var ctx = null, unlocked = false, sfxBus, musicBus, master, compressor, sfxSend, musicSend;
  var noiseBuffer, voices = [], bed = false, nextChord = 0, nextNote = 0, chord = 0, note = 2;
  var audioTheme = "", musicTarget = -1, sfxTarget = -1, dipUntil = 0;
  var played = { click: 0, footstep: 0, tick: 0, snap: 0, locked: 0, plate: 0,
    glimmer: 0, tk: 0, beacon: 0, complete: 0 };
  var lastStep = -100, lastTick = -100;
  var scales = { dusk: [62, 64, 66, 69, 71], night: [57, 60, 62, 64, 67],
    aurora: [64, 66, 68, 71, 73], dawn: [67, 69, 71, 74, 76] };
  var progression = [0, -3, 5, 7], melody = [0, 2, 3, 4, 2, 5];

  function report(e) {
    // Test pages opt into diagnostics; a broken optional effect stays quiet in the game.
    try { if (window.__fxReportError) window.__fxReportError(e); } catch (_) {}
  }
  function guarded(fn) {
    return function (data) { try { fn(data || EMPTY); } catch (e) { report(e); } };
  }
  function readPoint(p, out) {
    if (!p) return false;
    var x = p.x !== undefined ? p.x : p[0];
    var y = p.y !== undefined ? p.y : p[1];
    var z = p.z !== undefined ? p.z : p[2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
    out.set(x, y, z); return true;
  }
  function point(value, out) {
    if (typeof value !== "string") return false;
    if (!G.geom || typeof G.geom.walkable !== "function") return false;
    var w = G.geom.walkable(value);
    if (!w || !readPoint(w.stand, out)) return false;
    if (typeof G.geom.transform !== "function" || w.group == null) return true;
    try {
      var tr = G.geom.transform(w.group), r = tr && tr.R;
      if (!r || r.length !== 9 || !readPoint(tr.pivot, b) || !readPoint(tr.offset, c)) return true;
      var x = out.x - b.x, y = out.y - b.y, z = out.z - b.z;
      out.set(r[0] * x + r[1] * y + r[2] * z + b.x + c.x,
        r[3] * x + r[4] * y + r[5] * z + b.y + c.y,
        r[6] * x + r[7] * y + r[8] * z + b.z + c.z);
    } catch (e) { report(e); }
    return true;
  }
  function decorPoint(d, out) {
    try {
      if (d && typeof d.worldPos === "function") {
        out.copy(d.worldPos(out)); return true;
      }
      if (d && d.object3D && d.object3D.getWorldPosition) {
        d.object3D.getWorldPosition(out); return true;
      }
    } catch (e) { report(e); }
    return false;
  }
  function handlePoint(id, out) {
    var g = G.groups && G.groups[id];
    var obj = g && ((g.handle && g.handle.object3D) || g.pivotNode);
    if (!obj || !obj.getWorldPosition) return false;
    obj.getWorldPosition(out); return true;
  }
  function heroPoint(out) {
    var obj = G.hero && G.hero.object3D;
    if (!obj || !obj.getWorldPosition) return false;
    obj.getWorldPosition(out); return true;
  }
  function tapPoint(d, out) {
    if (readPoint(d.pos, out)) return true;
    if (d.tile != null && point(d.tile, out)) return true;
    if (!G.camera || !G.root || !Number.isFinite(d.x) || !Number.isFinite(d.y)) return false;
    // Event coordinates are CSS pixels within root, per the Game contract.
    var rect = G.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    ndc.set(d.x / rect.width * 2 - 1, 1 - d.y / rect.height * 2);
    ray.setFromCamera(ndc, G.camera);
    return !!ray.ray.intersectPlane(plane, out);
  }
  function scaled(n) {
    carry += n * factor;
    var count = Math.floor(carry + 1e-6); carry -= count; return count;
  }
  function slot() {
    var oldest = Infinity, found = -1;
    for (var i = 0; i < budget; i++) {
      if (!kind[i]) return i;
      if (kind[i] === 1 && serial[i] < oldest) { oldest = serial[i]; found = i; }
    }
    return found;
  }
  function particle(p, rgb, size, opacity, life, vx, vy, vz, blend, delay, type, gravity) {
    var i = slot(); if (i < 0) return;
    var j = i * STRIDE;
    kind[i] = type || 1; serial[i] = ++sequence;
    pool[j] = pool[j + 14] = p.x; pool[j + 1] = pool[j + 15] = p.y; pool[j + 2] = pool[j + 16] = p.z;
    pool[j + 3] = vx; pool[j + 4] = vy; pool[j + 5] = vz;
    pool[j + 6] = ((rgb >> 16) & 255) / 255; pool[j + 7] = ((rgb >> 8) & 255) / 255;
    pool[j + 8] = (rgb & 255) / 255; pool[j + 9] = size; pool[j + 10] = opacity;
    pool[j + 11] = 0; pool[j + 12] = life; pool[j + 13] = delay || 0;
    pool[j + 17] = Math.random() * Math.PI * 2; pool[j + 18] = blend || 0; pool[j + 19] = gravity || 0;
  }
  function burst(p, count, rgb, life, speed, blend, size) {
    count = scaled(count);
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      particle(p, rgb, size || (blend ? 0.027 : 0.018), blend ? 0.32 : 0.85,
        life * (0.8 + Math.random() * 0.4), Math.cos(angle) * v * 0.7,
        v, Math.sin(angle) * v * 0.7, blend, 0, 1, blend ? 0.2 : 0.1);
    }
  }
  function ring(p, rgb, end, duration, brightness) {
    var chosen = 0, oldest = -1;
    for (var i = 0; i < 24; i++) {
      var j = i * 10;
      if (!ringData[j + 4]) { chosen = i; break; }
      if (ringData[j + 3] > oldest) { oldest = ringData[j + 3]; chosen = i; }
    }
    var k = chosen * 10;
    ringData[k] = p.x; ringData[k + 1] = p.y + 0.02; ringData[k + 2] = p.z;
    ringData[k + 3] = 0; ringData[k + 4] = duration; ringData[k + 5] = end;
    ringData[k + 6] = ((rgb >> 16) & 255) / 255; ringData[k + 7] = ((rgb >> 8) & 255) / 255;
    ringData[k + 8] = (rgb & 255) / 255; ringData[k + 9] = brightness == null ? 0.65 : brightness;
  }
  function makePoints(blend) {
    var geo = new T.BufferGeometry();
    var data = { position: new Float32Array(MAX * 3), color: new Float32Array(MAX * 3),
      size: new Float32Array(MAX), alpha: new Float32Array(MAX) };
    Object.keys(data).forEach(function (key) {
      geo.setAttribute(key, new T.BufferAttribute(data[key], key === "position" || key === "color" ? 3 : 1)
        .setUsage(T.DynamicDrawUsage));
    });
    geo.setDrawRange(0, 0);
    var mat = new T.ShaderMaterial({
      uniforms: { uScale: { value: 360 }, uMap: { value: texture } },
      vertexShader: "attribute float size; attribute float alpha; varying vec3 vColor; varying float vAlpha; uniform float uScale; void main(){vColor=color;vAlpha=alpha;gl_PointSize=size*uScale;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "uniform sampler2D uMap; varying vec3 vColor; varying float vAlpha; void main(){float a=texture2D(uMap,gl_PointCoord).a*vAlpha;if(a<0.003)discard;gl_FragColor=vec4(vColor,a);}",
      vertexColors: true, transparent: true, blending: blend, depthWrite: false, depthTest: true,
      toneMapped: false
    });
    var obj = new T.Points(geo, mat); obj.frustumCulled = false; obj.name = "FX particles"; root.add(obj);
    return { object: obj, geometry: geo, material: mat, data: data, count: 0 };
  }
  function resize() {
    try {
      if (!glow || !G.renderer || !G.renderer.domElement) return;
      var s = Math.max(180, Math.min(1400, G.renderer.domElement.height / 2 * (window.devicePixelRatio || 1)));
      glow.material.uniforms.uScale.value = dust.material.uniforms.uScale.value = s;
      positionShafts();
    } catch (e) { report(e); }
  }
  function positionShafts() {
    if (!shafts) return;
    var light = null;
    G.scene.traverse(function (obj) { if (!light && obj.isDirectionalLight && obj.castShadow) light = obj; });
    var x = 10, y = 0;
    if (light && G.camera) {
      light.getWorldPosition(a); a.project(G.camera);
      x = Math.max(0, Math.min(100, (a.x + 1) * 50)); y = Math.max(0, Math.min(30, (1 - a.y) * 50));
    }
    var tint = theme === "night" ? "#85baff" : theme === "aurora" ? "#69ffe3" : "#ffd08a";
    var second = theme === "aurora" ? "#b895ff" : tint;
    shafts.style.background = "repeating-conic-gradient(from 100deg at " + x + "% " + y + "%,transparent 0deg 13deg," + tint + " 15deg,transparent 19deg 29deg," + second + " 30deg,transparent 33deg 44deg)";
    shafts.style.opacity = theme === "night" ? "0.06" : "0.09";
    shafts.style.display = G.reducedMotion || low ? "none" : "block";
  }
  function overlay() {
    if (!G.root || !G.root.appendChild) return;
    shafts = document.createElement("div"); flash = document.createElement("div");
    shafts.setAttribute("aria-hidden", "true"); flash.setAttribute("aria-hidden", "true");
    shafts.className = "fx-shafts"; flash.className = "fx-flash";
    shafts.style.cssText = "position:absolute;inset:-15%;pointer-events:none;mix-blend-mode:screen;opacity:.09;overflow:hidden";
    flash.style.cssText = "position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;background:radial-gradient(#fff3c4cc,#ffb35a33 60%,transparent)";
    var ui = G.ui && G.ui.parentNode === G.root ? G.ui : null;
    G.root.insertBefore(shafts, ui); G.root.insertBefore(flash, ui);
    if (shafts.animate) sway = shafts.animate([{ transform: "rotate(-2deg)" }, { transform: "rotate(2deg)" }],
      { duration: 24000, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
    positionShafts();
  }
  function clearTransient(all) {
    for (var i = 0; i < MAX; i++) if (all || kind[i] === 1) kind[i] = 0;
    ringData.fill(0); cascade.length = 0; cascadeIndex = 0; cascadeAt = flashAt = -100;
    if (flash) flash.style.opacity = "0";
    step = 0; moveFrame = -1;
  }
  function bounds(defaults) {
    min[0] = min[2] = -3; min[1] = 0; max[0] = max[2] = 7; max[1] = 5;
    if (defaults || !G.geom || typeof G.geom.bounds !== "function") return;
    try {
      var box = G.geom.bounds();
      if (box && readPoint(box.min, a) && readPoint(box.max, b)) {
        min[0] = a.x - 0.5; min[1] = a.y; min[2] = a.z - 0.5;
        max[0] = Math.max(a.x + 1, b.x + 0.5); max[1] = Math.max(a.y + 2, b.y + 1);
        max[2] = Math.max(a.z + 1, b.z + 0.5);
      }
    } catch (e) { report(e); }
  }
  function randomPoint(out) {
    out.set(min[0] + Math.random() * (max[0] - min[0]), min[1] + Math.random() * (max[1] - min[1]),
      min[2] + Math.random() * (max[2] - min[2]));
  }
  function rebuild(defaults) {
    clearTransient(true); carry = 0;
    factor = (G.reducedMotion ? 0.5 : 1) * (low ? 0.5 : 1); budget = Math.floor(MAX * factor);
    bounds(defaults);
    for (var i = 0; i < Math.floor(18 * factor); i++) {
      randomPoint(a); particle(a, i % 3 ? TEAL : GOLD, 0.021, 0.8, 0, 0, 0, 0, 0, 0, 2);
    }
    for (var j = 0; j < Math.floor(60 * factor); j++) {
      randomPoint(a); particle(a, SAND, 0.009, 0.32, 0, 0, 0, 0, 1, 0, 3);
    }
    petalAt = ambientClock + 6 + Math.random() * 4;
    if (root.parent !== G.scene) G.scene.add(root);
    positionShafts(); resize();
  }
  function changeTheme(name) { theme = scales[name] ? name : "dusk"; }
  function beacon(d) {
    var found = readPoint(d.pos, a), decor = G.decor || [];
    if (!found) {
      for (var i = 0; i < decor.length; i++) {
        if (decor[i].item && decor[i].item.type === "beacon" && decorPoint(decor[i], a)) { found = true; break; }
      }
    }
    sound("beacon"); if (!found) return;
    beaconPoint[0] = a.x; beaconPoint[1] = a.y; beaconPoint[2] = a.z;
    cascade.length = 0;
    for (var k = 0; k < decor.length; k++) {
      if (decor[k].item && decor[k].item.type === "beacon") continue;
      var obj = decor[k].object3D;
      if (obj && obj.userData && typeof obj.userData.setLit === "function" && decorPoint(decor[k], b)) {
        cascade.push({ decor: decor[k], distance: b.distanceToSquared(a), at: 0 });
      }
    }
    cascade.sort(function (x, y) { return x.distance - y.distance; });
    for (var n = 0; n < cascade.length; n++) cascade[n].at = 2 * n / Math.max(1, cascade.length - 1);
    cascadeIndex = 0; cascadeAt = flashAt = clock; moteNext = 0;
  }
  function cascadeFrame() {
    var elapsed = clock - cascadeAt;
    while (cascadeIndex < cascade.length && elapsed >= cascade[cascadeIndex].at) {
      var entry = cascade[cascadeIndex++], obj = entry.decor.object3D;
      try { obj.userData.setLit(true, false); } catch (e) { report(e); }
      if (decorPoint(entry.decor, a)) {
        burst(a, 5, GOLD, 0.8, 0.45, 0);
        if (cascadeIndex % 3 === 1) ring(a, GOLD, 0.65, 0.55, 0.35);
      }
    }
    if (cascadeAt >= 0 && elapsed <= 1.55) {
      while (moteNext < 120 && elapsed >= moteNext * 1.5 / 120) {
        a.set(beaconPoint[0] + (Math.random() - 0.5) * 0.5, beaconPoint[1], beaconPoint[2] + (Math.random() - 0.5) * 0.5);
        burst(a, 1, moteNext % 3 ? GOLD : BRASS, 2.4, 0.7, 0, 0.02); moteNext++;
      }
    }
    if (flash) {
      var f = clock - flashAt;
      flash.style.opacity = f < 0 || f > 1.45 ? "0" : String(f < 0.25 ? f / 0.25 : (1.45 - f) / 1.2);
    }
  }
  function path(d) {
    var pts = d.points; if (!pts || pts.length < 2) return;
    var offset = 0, order = 0;
    for (var i = 1; i < pts.length && order < budget; i++) {
      if (!readPoint(pts[i - 1], a) || !readPoint(pts[i], b)) continue;
      var length = a.distanceTo(b); if (!length) continue;
      for (; offset <= length && order < budget; offset += 0.3) {
        c.copy(a).lerp(b, offset / length); c.y += 0.035;
        if (scaled(1)) particle(c, 0xffedc7, 0.014, 0.8, 1.2, 0, 0.025, 0, 0, order * 0.035);
        order++;
      }
      offset -= length;
    }
  }
  function heroStep(d) {
    sound("footstep"); step++;
    if (step % 3 === 0 && heroPoint(a)) burst(a, 5, SAND, 0.5, 0.3, 1, 0.03);
    if (Number.isFinite(d.k) && d.k !== 0) {
      if (!readPoint(d.at, a) && !point(d.from, a) && !heroPoint(a)) return;
      burst(a, 8, TEAL, 0.4, 0.5, 0); ring(a, TEAL, 0.6, 0.4, 0.45);
    }
  }
  function mechanism(name, d) {
    if (name === "mechTick") sound("tick");
    if (name === "mechSnap") sound("snap");
    if (name === "mechLocked") sound("locked");
    var positioned = readPoint(d.pos, a);
    if (!positioned && !handlePoint(d.id, a)) return;
    if (name === "mechGrab") burst(a, 3, BRASS, 0.45, 0.45, 0);
    if (name === "mechMove") {
      if (moveFrame === frameId) return; moveFrame = frameId;
      burst(a, 1, BRASS, 0.28, 0.3, 0, 0.012); burst(a, 1, SAND, 0.35, 0.2, 1, 0.018);
    }
    if (name === "mechTick") { burst(a, 3, SAND, 0.35, 0.25, 1); burst(a, 1, BRASS, 0.3, 0.6, 0); }
    if (name === "mechSnap") {
      burst(a, 10, BRASS, 0.65, 0.8, 0); burst(a, 7, SAND, 0.6, 0.4, 1);
      var g = G.groups && G.groups[d.id];
      if (!positioned && g && g.pivotNode && g.pivotNode.getWorldPosition) g.pivotNode.getWorldPosition(a);
      ring(a, GOLD, 1, 0.65, 0.5);
    }
    if (name === "mechLocked") burst(a, 4, 0xa38e7b, 0.4, 0.2, 1);
  }
  function plate(d) {
    sound("plate"); if (!readPoint(d.pos, a) && !point(d.tile, a)) return;
    ring(a, 0xffbd68, 1.5, 0.8, 0.6);
    var count = scaled(16);
    for (var i = 0; i < count; i++) {
      var angle = i / count * Math.PI * 2;
      c.set(a.x + Math.cos(angle) * 0.25, a.y + 0.025, a.z + Math.sin(angle) * 0.25);
      particle(c, SAND, 0.025, 0.35, 0.65, Math.cos(angle) * 0.5, 0.12, Math.sin(angle) * 0.5, 1);
    }
  }
  function complete() {
    sound("complete");
    for (var i = 0, n = scaled(60); i < n; i++) {
      randomPoint(a); particle(a, i % 3 ? BRASS : GOLD, 0.016, 0.8, 4,
        (Math.random() - 0.5) * 0.15, 0.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.15);
    }
  }
  function bind(name, fn) {
    if (!G.bus || typeof G.bus.on !== "function") return;
    var handler = guarded(fn); bindings.push({ name: name, handler: handler }); G.bus.on(name, handler);
  }
  function events() {
    bind("tap", function (d) {
      if (d.reachable === false) sound("tk");
      if (tapPoint(d, a)) ring(a, d.reachable === false ? 0xff6b6b : GOLD,
        d.reachable === false ? 0.8 : 1.1, d.reachable === false ? 0.42 : 0.6, d.reachable === false ? 0.35 : 0.65);
    });
    bind("path", path); bind("heroStep", heroStep);
    ["mechGrab", "mechMove", "mechTick", "mechSnap", "mechLocked"].forEach(function (name) {
      bind(name, function (d) { mechanism(name, d); });
    });
    bind("plate", plate);
    bind("glimmer", function (d) {
      sound("glimmer");
      if (readPoint(d.pos, a) || point(d.tile, a)) burst(a, 20, TEAL, 1.6, 1.4, 0, 0.023);
    });
    bind("beacon", beacon); bind("levelComplete", complete);
    bind("restart", function () { clearTransient(false); });
    bind("levelStart", function (d) {
      paused = false; changeTheme(d.level && d.level.theme || G.level && G.level.theme); rebuild(false); resetBed();
    });
    bind("title", function () { paused = false; changeTheme("dusk"); rebuild(true); resetBed(); });
    bind("pause", function (d) { paused = !!d.paused; poll = 0; });
    bind("quality", function (d) { low = d.level === "low"; rebuild(G.state === "title"); });
  }

  // Audio sources are tracked in reusable slots; cancellation includes future notes and wind/LFOs.
  function frequency(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function scaleNote(index) {
    var s = scales[theme], octave = Math.floor(index / 5), n = ((index % 5) + 5) % 5;
    return frequency(s[n] + octave * 12);
  }
  function track(source, nodes, end, music) {
    for (var i = 0; i < voices.length; i++) {
      if (!voices[i].source) {
        voices[i].source = source; voices[i].nodes = nodes; voices[i].end = end; voices[i].music = music; return;
      }
    }
    // This is a hard ceiling, even under hostile event spam.
    try { source.stop(); source.disconnect(); for (var j = 0; j < nodes.length; j++) nodes[j].disconnect(); } catch (e) { report(e); }
  }
  function cleanVoices(musicOnly, all) {
    if (!ctx) return;
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (v.source && (all || musicOnly && v.music || v.end < ctx.currentTime)) {
        try {
          v.source.stop(); v.source.disconnect();
          for (var j = 0; j < v.nodes.length; j++) v.nodes[j].disconnect();
        } catch (e) { report(e); }
        v.source = null; v.nodes = null;
      }
    }
  }
  function route(node, music, wet) {
    node.connect(music ? musicBus : sfxBus);
    if (wet) node.connect(music ? musicSend : sfxSend);
  }
  function tone(hz, at, duration, gain, type, music, wet, endHz, attack, filterHz, detune) {
    var source = ctx.createOscillator(), env = ctx.createGain(), filter = null;
    source.type = type || "sine"; source.frequency.setValueAtTime(hz, at);
    if (endHz) source.frequency.exponentialRampToValueAtTime(endHz, at + duration);
    source.detune.value = detune || 0;
    env.gain.setValueAtTime(0.00001, at);
    env.gain.linearRampToValueAtTime(gain, at + (attack || 0.004));
    if (attack >= 1) {
      env.gain.setValueAtTime(gain, at + duration - 3);
      env.gain.linearRampToValueAtTime(0.00001, at + duration);
    } else env.gain.exponentialRampToValueAtTime(0.00001, at + duration);
    source.connect(env);
    if (filterHz) {
      filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = filterHz;
      env.connect(filter); route(filter, music, wet);
    } else route(env, music, wet);
    source.start(at); source.stop(at + duration + 0.03);
    track(source, filter ? [env, filter] : [env], at + duration + 0.05, music);
  }
  function noise(at, duration, gain, hz, endHz) {
    var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), env = ctx.createGain();
    src.buffer = noiseBuffer; filter.type = "lowpass"; filter.frequency.setValueAtTime(hz, at);
    if (endHz) filter.frequency.exponentialRampToValueAtTime(endHz, at + duration);
    env.gain.setValueAtTime(0.00001, at); env.gain.linearRampToValueAtTime(gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.00001, at + duration);
    src.connect(filter); filter.connect(env); route(env, false, false);
    src.start(at); src.stop(at + duration + 0.02); track(src, [filter, env], at + duration + 0.03, false);
  }
  function boxNote(hz, at, gain, music) {
    tone(hz, at, 2.5, gain, "sine", music, true);
    tone(hz * 4, at, 1.7, gain * 0.075, "sine", music, true);
  }
  function bell(hz, at) {
    var carrier = ctx.createOscillator(), mod = ctx.createOscillator(), index = ctx.createGain(), env = ctx.createGain();
    carrier.frequency.value = hz * 3.5; mod.frequency.value = hz;
    index.gain.setValueAtTime(hz * 4, at); index.gain.linearRampToValueAtTime(0, at + 0.9);
    env.gain.setValueAtTime(0.00001, at); env.gain.linearRampToValueAtTime(0.09, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.00001, at + 1.3);
    mod.connect(index); index.connect(carrier.frequency); carrier.connect(env); route(env, false, true);
    mod.start(at); carrier.start(at); mod.stop(at + 0.92); carrier.stop(at + 1.32);
    track(mod, [index], at + 0.94, false); track(carrier, [env], at + 1.34, false);
  }
  function sound(name) {
    try {
      if (!Object.prototype.hasOwnProperty.call(played, name)) return;
      // Count requests, including locked, muted and rate-limited calls; playback still needs a gesture.
      played[name]++;
      if (!G || !unlocked || !ctx || ctx.state !== "running" || G.save && G.save.sound === false) return;
      var now = ctx.currentTime;
      if (name === "footstep" && now - lastStep < 0.08 || name === "tick" && now - lastTick < 0.03) return;
      if (name === "footstep") lastStep = now;
      if (name === "tick") lastTick = now;
      var at = now + 0.005;
      if (name === "click") tone(1600, at, 0.025, 0.08);
      else if (name === "footstep") {
        tone(1800 * (0.94 + Math.random() * 0.12), at, 0.025, 0.065); noise(at, 0.012, 0.022, 3500);
      } else if (name === "tick") { tone(2500, at, 0.015, 0.07); noise(at, 0.012, 0.025, 5000); }
      else if (name === "snap") { tone(90, at, 0.2, 0.2, "sine", false, false, 48); noise(at, 0.16, 0.1, 600); }
      else if (name === "locked") noise(at, 0.12, 0.22, 200);
      else if (name === "plate") { noise(at, 0.13, 0.12, 280); tone(180, at, 0.24, 0.13); tone(270, at + 0.025, 0.5, 0.075, "sine", false, true); }
      else if (name === "tk") tone(900, at, 0.04, 0.065, "sine", false, false, 380);
      else if (name === "glimmer") { bell(scaleNote(0), at); bell(scaleNote(2), at + 0.18); }
      else if (name === "beacon") {
        for (var i = 0; i < 4; i++) {
          var hz = scaleNote(i);
          tone(hz / 2, at + i * 0.16, 3.5, 0.065, "triangle", false, true, hz * 0.505, 1.2, 1000);
          boxNote(hz * 4, at + 0.9 + i * 0.19, 0.018, false);
        }
        noise(at, 2, 0.06, 250, 4000); boxNote(scaleNote(0), at + 1.9, 0.12, false);
      } else if (name === "complete") {
        dipUntil = now + 4.5; poll = 0;
        for (var k = 0; k < melody.length; k++) boxNote(scaleNote(melody[k]), at + k * 0.65, 0.12, false);
      }
    } catch (e) { report(e); }
  }
  function makeAudio() {
    var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
    ctx = new Audio();
    sfxBus = ctx.createGain(); musicBus = ctx.createGain(); master = ctx.createGain(); compressor = ctx.createDynamicsCompressor();
    master.gain.value = 0.2; sfxBus.gain.value = G.save && G.save.sound === false ? 0 : 1;
    musicBus.gain.value = 0;
    compressor.threshold.value = -20; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = 0.008; compressor.release.value = 0.25;
    sfxBus.connect(compressor); musicBus.connect(compressor); compressor.connect(master); master.connect(ctx.destination);
    var impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.5), ctx.sampleRate);
    for (var channel = 0; channel < 2; channel++) {
      var data = impulse.getChannelData(channel), tail = 0;
      for (var i = 0; i < data.length; i++) {
        var t = i / data.length;
        tail += ((Math.random() * 2 - 1) - tail) * (0.32 * (1 - t) + 0.015);
        data[i] = tail * Math.pow(1 - t, 3) * 0.7;
      }
    }
    var sfxVerb = ctx.createConvolver(), musicVerb = ctx.createConvolver();
    sfxVerb.buffer = musicVerb.buffer = impulse;
    sfxSend = ctx.createGain(); musicSend = ctx.createGain(); sfxSend.gain.value = 0.2; musicSend.gain.value = 0.35;
    sfxSend.connect(sfxVerb); sfxVerb.connect(sfxBus); musicSend.connect(musicVerb); musicVerb.connect(musicBus);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    var noiseData = noiseBuffer.getChannelData(0);
    for (var n = 0; n < noiseData.length; n++) noiseData[n] = Math.random() * 2 - 1;
    for (var v = 0; v < 256; v++) voices.push({ source: null, nodes: null, end: 0, music: false });
  }
  function unlock() {
    try {
      if (!G) return;
      unlocked = true; if (!ctx) makeAudio();
      poll = 0;
      if (ctx && ctx.state === "suspended") {
        return ctx.resume().then(function () { audioFrame(); }, report);
      }
      audioFrame();
    } catch (e) { report(e); }
  }
  function wind() {
    var source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), env = ctx.createGain();
    var lfo = ctx.createOscillator(), depth = ctx.createGain();
    source.buffer = noiseBuffer; source.loop = true; filter.type = "bandpass"; filter.frequency.value = 400; filter.Q.value = 0.7;
    env.gain.value = 0.035; lfo.frequency.value = 0.055; depth.gain.value = 0.015;
    lfo.connect(depth); depth.connect(env.gain); source.connect(filter); filter.connect(env); route(env, true, false);
    source.start(); lfo.start(); track(source, [filter, env], Infinity, true); track(lfo, [depth], Infinity, true);
  }
  function fade(param, value, duration) {
    var now = ctx.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { var current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.linearRampToValueAtTime(value, now + duration);
  }
  function resetBed() {
    try { cleanVoices(true, false); bed = false; audioTheme = ""; poll = 0; } catch (e) { report(e); }
  }
  function audioFrame() {
    try {
      if (!ctx || ctx.state !== "running") return;
      cleanVoices(false, false);
      var now = ctx.currentTime, save = G.save || EMPTY;
      var active = G.state === "title" || G.state === "play" || G.state === "paused";
      var enabled = save.music !== false;
      if (!active || audioTheme && audioTheme !== theme) resetBed();
      var target = active && enabled ? (G.state === "paused" || paused ? 0.14 : now < dipUntil ? 0.15 : 0.5) : 0;
      if (target !== musicTarget) { fade(musicBus.gain, target, 0.8); musicTarget = target; }
      var sfx = save.sound === false ? 0 : 1;
      if (sfx !== sfxTarget) { fade(sfxBus.gain, sfx, 0.025); sfxTarget = sfx; }
      if (!active) return;
      if (!enabled) {
        // Let the 0.8 s bus fade finish before cancelling the sustained sources.
        if (musicBus.gain.value < 0.0001) resetBed();
        return;
      }
      if (!bed) { bed = true; audioTheme = theme; chord = 0; nextChord = now; nextNote = now + 4; wind(); }
      if (now >= nextChord) {
        var base = scales[theme][0] - 24 + progression[chord % 4], minor = theme === "night";
        for (var i = 0; i < 3; i++) {
          var interval = i === 0 ? 0 : i === 1 ? (chord % 4 === 1 || minor && chord % 4 === 0 ? 3 : 4) : 7;
          tone(frequency(base + interval), now + 0.01, 15, 0.14, "triangle", true, true, 0, 2, 900, (i - 1) * 5);
        }
        chord++; nextChord = now + 12;
      }
      if (now >= nextNote) {
        var next = note + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.85 ? 1 : 2);
        if (next < 0 || next > 9) next = note + (next < 0 ? 1 : -1);
        note = next; boxNote(scaleNote(note), now + 0.01, 0.18, true); nextNote = now + 4 + Math.random() * 3;
      }
    } catch (e) { report(e); }
  }

  function particlesFrame(dt, ambientDt, active) {
    glow.count = dust.count = live = ambientCount = 0;
    for (var i = 0; i < budget; i++) {
      var type = kind[i]; if (!type) continue;
      var j = i * STRIDE, alpha = pool[j + 10], age;
      if (type === 1) {
        if (pool[j + 13] > 0) { pool[j + 13] -= dt; live++; continue; }
        pool[j + 11] += dt; age = pool[j + 11];
        if (age >= pool[j + 12]) { kind[i] = 0; continue; }
        pool[j] += pool[j + 3] * dt; pool[j + 1] += pool[j + 4] * dt; pool[j + 2] += pool[j + 5] * dt;
        pool[j + 4] -= pool[j + 19] * dt;
        alpha *= Math.min(1, age / 0.07) * Math.pow(1 - age / pool[j + 12], 1.3);
      } else {
        ambientCount++;
        var phase = pool[j + 17], t = ambientClock;
        if (type === 2) {
          pool[j] = pool[j + 14] + Math.sin(t * 0.22 + phase) * 0.5;
          pool[j + 1] = pool[j + 15] + Math.sin(t * 0.29 + phase * 2) * 0.3;
          pool[j + 2] = pool[j + 16] + Math.cos(t * 0.17 + phase) * 0.5;
          alpha *= 0.12 + 0.88 * Math.pow((Math.sin(t * 0.85 + phase) + 1) / 2, 2);
        } else {
          pool[j] = pool[j + 14] + Math.sin(t * 0.09 + phase) * 0.35;
          pool[j + 1] += ambientDt * 0.045;
          if (pool[j + 1] > max[1]) pool[j + 1] = min[1];
        }
        if (!active) alpha = 0;
      }
      live++;
      var batch = pool[j + 18] ? dust : glow, k = batch.count++, out = batch.data, q = k * 3;
      out.position[q] = pool[j]; out.position[q + 1] = pool[j + 1]; out.position[q + 2] = pool[j + 2];
      out.color[q] = pool[j + 6]; out.color[q + 1] = pool[j + 7]; out.color[q + 2] = pool[j + 8];
      out.size[k] = pool[j + 9]; out.alpha[k] = alpha;
    }
    upload(glow); upload(dust);
  }
  function upload(batch) {
    batch.geometry.setDrawRange(0, batch.count);
    var attrs = batch.geometry.attributes;
    attrs.position.needsUpdate = attrs.color.needsUpdate = attrs.size.needsUpdate = attrs.alpha.needsUpdate = true;
  }
  function ringsFrame(dt) {
    ringCount = 0;
    for (var i = 0; i < 24; i++) {
      var j = i * 10, duration = ringData[j + 4];
      if (!duration) continue;
      ringData[j + 3] += dt;
      var progress = ringData[j + 3] / duration;
      if (progress >= 1) { ringData[j + 4] = 0; continue; }
      // RingGeometry has radius one; the requested tile sizes are diameters.
      var radius = (0.3 + (ringData[j + 5] - 0.3) * progress) * 0.5;
      a.set(ringData[j], ringData[j + 1], ringData[j + 2]); scale.set(radius, radius, radius);
      matrix.compose(a, rotation, scale); ringMesh.setMatrixAt(ringCount, matrix);
      var fadeOut = (1 - progress) * ringData[j + 9];
      colour.setRGB(ringData[j + 6] * fadeOut, ringData[j + 7] * fadeOut * (1 - progress * 0.15),
        ringData[j + 8] * fadeOut * (1 - progress * 0.5));
      ringMesh.setColorAt(ringCount++, colour);
    }
    ringMesh.count = ringCount; ringMesh.instanceMatrix.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
  }
  function frame(now) {
    try {
      var dt = last ? Math.max(0, Math.min(0.05, (now - last) / 1000)) : 0; last = now;
      if (Number.isFinite(G.time)) {
        var delta = G.time - gameTime;
        if (Number.isFinite(delta) && delta > 0) dt = Math.min(0.05, delta);
        gameTime = G.time;
      }
      var freeze = paused || G.state === "paused", transientDt = freeze ? 0 : dt;
      var ambientDt = dt * (freeze ? 0.2 : 1), active = G.state === "title" || G.state === "play" || freeze;
      clock += transientDt; ambientClock += ambientDt; frameId++;
      if (sway) sway.playbackRate = freeze ? 0.2 : 1;
      if (active && ambientClock >= petalAt) {
        randomPoint(a); a.y = max[1];
        for (var i = 0, n = scaled(1); i < n; i++) particle(a, 0xf3c9d6, 0.017, 0.25, 8, 0.06, -0.2, 0.03, 1);
        petalAt = ambientClock + 6 + Math.random() * 4;
      }
      if (transientDt > 0) cascadeFrame();
      particlesFrame(transientDt, ambientDt, active); ringsFrame(transientDt);
      poll -= dt;
      if (poll <= 0) {
        poll = 0.25;
        var wantedFactor = (G.reducedMotion ? 0.5 : 1) * (low ? 0.5 : 1);
        if (wantedFactor !== factor) rebuild(G.state === "title");
        audioFrame();
      }
    } catch (e) { report(e); }
    try { raf = window.requestAnimationFrame(frame); } catch (e) { report(e); }
  }
  function detach() {
    if (!G) return;
    if (G.bus && G.bus.off) for (var i = 0; i < bindings.length; i++) G.bus.off(bindings[i].name, bindings[i].handler);
    bindings.length = 0;
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointerdown", unlock, true); window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("touchend", unlock, true);
    if (raf) window.cancelAnimationFrame(raf);
    if (root) {
      if (root.parent) root.parent.remove(root);
      if (glow) { glow.geometry.dispose(); glow.material.dispose(); }
      if (dust) { dust.geometry.dispose(); dust.material.dispose(); }
      if (ringMesh) { ringMesh.geometry.dispose(); ringMesh.material.dispose(); }
      if (texture) texture.dispose();
    }
    if (sway) sway.cancel();
    if (shafts) shafts.remove(); if (flash) flash.remove();
    resetBed(); ready = false;
  }
  function setup(game) {
    try {
      if (!game || ready && G === game) return;
      if (G) detach(); G = game; T = G.THREE || window.THREE;
      // Audio and event safety do not depend on the optional visual layer.
      window.addEventListener("pointerdown", unlock, true); window.addEventListener("keydown", unlock, true);
      window.addEventListener("touchend", unlock, true);
      if (!T || !G.scene) return;
      a = new T.Vector3(); b = new T.Vector3(); c = new T.Vector3(); scale = new T.Vector3();
      matrix = new T.Matrix4(); rotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
      colour = new T.Color(); ray = new T.Raycaster(); ndc = new T.Vector2(); plane = new T.Plane(new T.Vector3(0, 1, 0), -1);
      root = new T.Group(); root.name = "Spirelight FX"; G.scene.add(root);
      var canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
      var draw = canvas.getContext("2d"), gradient = draw.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)"); gradient.addColorStop(0.18, "rgba(255,255,255,.85)");
      gradient.addColorStop(0.5, "rgba(255,255,255,.2)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
      draw.fillStyle = gradient; draw.fillRect(0, 0, 64, 64); texture = new T.CanvasTexture(canvas);
      glow = makePoints(T.AdditiveBlending); dust = makePoints(T.NormalBlending);
      ringMesh = new T.InstancedMesh(new T.RingGeometry(0.91, 1, 48), new T.MeshBasicMaterial({
        color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthTest: true, depthWrite: false,
        side: T.DoubleSide, toneMapped: false }), 24);
      ringMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); ringMesh.count = 0; ringMesh.frustumCulled = false;
      ringMesh.name = "FX ripples"; root.add(ringMesh);
      low = G.quality === "low"; changeTheme(G.state === "title" ? "dusk" : G.level && G.level.theme);
      overlay(); rebuild(G.state === "title"); events(); window.addEventListener("resize", resize);
      clock = ambientClock = last = 0; gameTime = NaN; ready = true;
      raf = window.requestAnimationFrame(frame);
    } catch (e) { report(e); }
  }
  function debug() {
    var count = 0, ambient = 0, rings = 0;
    for (var i = 0; i < budget; i++) { if (kind[i]) count++; if (kind[i] > 1) ambient++; }
    for (var j = 0; j < 24; j++) if (ringData[j * 10 + 4]) rings++;
    return { live: count, poolSize: budget, drawCalls: ready ? 3 : 0, rings: rings,
      audio: ctx ? ctx.state : "locked", played: Object.assign({}, played),
      music: { running: bed, theme: theme, gain: ctx ? musicBus.gain.value : 0 }, ambient: ambient };
  }
  window.FX = { setup: setup, sound: sound, unlock: unlock, debug: debug };
})();
