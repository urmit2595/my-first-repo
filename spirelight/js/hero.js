/* Wick — procedural lantern automaton. three.js r128, no add-ons or assets. */
(function () {
  "use strict";
  var ANIMS = ["idle", "walk", "climb", "celebrate", "bump", "ride", "wave"];
  function create(THREE, opts) {
    opts = opts || {};
    var low = opts.quality === "low", high = opts.quality === "high";
    var radial = low ? 12 : (high ? 28 : 22);
    var geometries = [], materials = [], textures = [], batches = [], disposed = false;
    var root = new THREE.Group(); root.name = "Wick";
    function geo(g) { geometries.push(g); return g; }
    function mat(m) { materials.push(m); return m; }
    function texture(canvas, color) {
      var tx = new THREE.CanvasTexture(canvas);
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      if (color) tx.encoding = THREE.sRGBEncoding;
      textures.push(tx); return tx;
    }
    function canvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
    // Seeded surface wear: creation and frozen frames are reproducible.
    var seed = 1731;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    var metalCanvas = canvas(256, 256), mc = metalCanvas.getContext("2d");
    mc.fillStyle = "#eed39b"; mc.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 11000; i++) {
      var x = random() * 256, y = random() * 256;
      mc.fillStyle = random() < 0.5 ? "rgba(64,40,20,.09)" : "rgba(255,244,187,.15)";
      mc.fillRect(x, y, 0.4 + random() * 1.6, 0.4 + random());
    }
    for (i = 0; i < 130; i++) {
      x = random() * 256; y = random() * 256;
      var grad = mc.createRadialGradient(x, y, 0, x, y, 2 + random() * 6);
      grad.addColorStop(0, "rgba(37,108,93,.55)"); grad.addColorStop(1, "rgba(48,109,88,0)");
      mc.fillStyle = grad; mc.fillRect(x - 9, y - 9, 18, 18);
    }
    var metalMap = texture(metalCanvas, true);
    var grainMap = texture(metalCanvas, false);
    // A small procedural reflection studio gives brass readable PBR highlights even
    // in scenes with no environment map. It belongs to this instance, not the scene.
    var faces = [];
    for (i = 0; i < 6; i++) {
      var c = canvas(64, 64), ctx = c.getContext("2d");
      var sky = ctx.createLinearGradient(0, 0, 0, 64);
      sky.addColorStop(0, i === 2 ? "#fff0ce" : "#9cabc3");
      sky.addColorStop(0.48, "#716c68"); sky.addColorStop(0.55, "#302935"); sky.addColorStop(1, "#403144");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 64, 64);
      var strip = ctx.createLinearGradient(0, 0, 64, 0);
      strip.addColorStop(0, "rgba(255,235,196,0)"); strip.addColorStop(0.3, "rgba(255,235,196,.05)");
      strip.addColorStop(0.42, "rgba(255,240,210,.95)"); strip.addColorStop(0.58, "rgba(255,240,210,.95)");
      strip.addColorStop(0.7, "rgba(255,235,196,0)"); strip.addColorStop(1, "rgba(255,235,196,0)");
      ctx.fillStyle = strip; ctx.fillRect(0, 3, 64, 47); faces.push(c);
    }
    var env = new THREE.CubeTexture(faces); env.encoding = THREE.sRGBEncoding; env.needsUpdate = true; textures.push(env);
    var brass = mat(new THREE.MeshStandardMaterial({ color: 0xc8963e, metalness: 0.9, roughness: 0.38,
      map: metalMap, bumpMap: grainMap, bumpScale: 0.0011, envMap: env, envMapIntensity: 1.15 }));
    var dark = mat(new THREE.MeshStandardMaterial({ color: 0x473b2c, metalness: 0.65, roughness: 0.47, envMap: env }));
    var knitCanvas = canvas(128, 128), kc = knitCanvas.getContext("2d");
    kc.fillStyle = "#747474"; kc.fillRect(0, 0, 128, 128);
    kc.lineCap = "round";
    for (y = -8; y < 136; y += 8) for (x = -8; x < 136; x += 8) {
      kc.strokeStyle = "#343434"; kc.lineWidth = 3.8;
      kc.beginPath(); kc.moveTo(x - 2, y); kc.lineTo(x + 1, y + 5); kc.lineTo(x + 4, y); kc.stroke();
      kc.strokeStyle = "#c2c2c2"; kc.lineWidth = 1.5;
      kc.beginPath(); kc.moveTo(x - 2, y); kc.lineTo(x + 1, y + 4); kc.lineTo(x + 4, y); kc.stroke();
    }
    var knit = texture(knitCanvas, false); knit.repeat.set(2, 1);
    var scarfMat = mat(new THREE.MeshStandardMaterial({ color: 0x2f8f8c, roughness: 0.94,
      bumpMap: knit, bumpScale: 0.0035, side: THREE.DoubleSide }));
    var glassMat = mat(new THREE.MeshPhysicalMaterial({ color: 0xffe3ae, metalness: 0, roughness: 0.08,
      transparent: true, opacity: low ? 0.045 : 0.13, depthWrite: false, envMap: env,
      envMapIntensity: 0.8, clearcoat: 1, clearcoatRoughness: 0.06 }));
    var eyeMat = mat(new THREE.MeshBasicMaterial({ color: 0x4a210b, toneMapped: false }));
    var flameMat = mat(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    var coreMat = mat(new THREE.MeshBasicMaterial({ color: 0xfff2a1, toneMapped: false }));
    var tipMat = mat(new THREE.MeshBasicMaterial({ color: 0xff8b20, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    var sphere = geo(new THREE.SphereGeometry(1, radial, low ? 8 : 14));
    var cylinder = geo(new THREE.CylinderGeometry(1, 1, 1, radial));
    var torus = geo(new THREE.TorusGeometry(1, 0.12, low ? 5 : 8, radial));
    var transform = new THREE.Object3D();
    function group(parent, name, px, py, pz) {
      var g = new THREE.Group(); g.name = name; g.position.set(px || 0, py || 0, pz || 0); parent.add(g); return g;
    }
    // Merge all static fittings sharing a joint/material, without BufferGeometryUtils.
    function part(parent, g, material, px, py, pz, sx, sy, sz, rx, ry, rz) {
      transform.position.set(px || 0, py || 0, pz || 0);
      transform.rotation.set(rx || 0, ry || 0, rz || 0);
      transform.scale.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
      transform.updateMatrix();
      var copy = g.index ? g.toNonIndexed() : g.clone(); copy.applyMatrix4(transform.matrix);
      var batch = null;
      for (var k = 0; k < batches.length; k++) if (batches[k].parent === parent && batches[k].material === material) batch = batches[k];
      if (!batch) { batch = { parent: parent, material: material, parts: [] }; batches.push(batch); }
      batch.parts.push(copy);
    }
    function ball(p, xx, yy, zz, sx, sy, sz, material) { part(p, sphere, material || brass, xx, yy, zz, sx, sy || sx, sz || sx); }
    function rod(p, xx, yy, zz, radius, len, rx, rz, material) {
      part(p, cylinder, material || brass, xx, yy, zz, radius, len, radius, rx || 0, 0, rz || 0);
    }
    function ring(p, xx, yy, zz, radius, rx, material, sy) {
      part(p, torus, material || brass, xx, yy, zz, radius, sy || radius, radius, rx || 0);
    }
    function lathe(points) { return geo(new THREE.LatheGeometry(points.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), radial)); }
    var hips = group(root, "hips", 0, 0.225, 0);
    var torso = group(hips, "torso");
    var egg = lathe([[0,0],[0.055,0.008],[0.089,0.029],[0.108,0.063],[0.116,0.105],
      [0.112,0.148],[0.097,0.194],[0.071,0.22],[0,0.226]]);
    part(torso, egg, brass);
    ring(torso, 0, 0.057, 0, 0.105, Math.PI / 2);
    // Three fine longitudinal seams, expressed as curved brass wires.
    for (i = 0; i < 6; i++) {
      var angle = i * Math.PI / 3, seam = [];
      for (var j = 1; j < 8; j++) {
        var pp = [[0,0],[0.055,0.008],[0.089,0.029],[0.108,0.063],[0.116,0.105],[0.112,0.148],[0.097,0.194],[0.071,0.22]][j];
        seam.push(new THREE.Vector3(Math.sin(angle) * (pp[0] + 0.001), pp[1], Math.cos(angle) * (pp[0] + 0.001)));
      }
      var wire = geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 12, 0.0018, 4, false)); part(torso, wire, dark);
      for (j = 0; j < 3; j++) {
        var yy = 0.055 + j * 0.065, rr = j === 1 ? 0.116 : 0.104;
        ball(torso, Math.sin(angle + 0.2) * rr, yy, Math.cos(angle + 0.2) * rr, 0.0065);
      }
    }
    // Cream pressure dial, including tiny printed ticks and a moving needle.
    var dialCanvas = canvas(256, 256), dc = dialCanvas.getContext("2d");
    dc.fillStyle = "#f3e5bd"; dc.fillRect(0, 0, 256, 256);
    dc.strokeStyle = "#655037"; dc.lineWidth = 3;
    dc.beginPath(); dc.arc(128, 128, 111, 0, Math.PI * 2); dc.stroke();
    for (i = 0; i < 28; i++) {
      var a = -Math.PI * 1.2 + i * Math.PI * 1.4 / 27;
      dc.lineWidth = i % 3 ? 2 : 4; dc.beginPath();
      dc.moveTo(128 + Math.sin(a) * 98, 128 - Math.cos(a) * 98);
      dc.lineTo(128 + Math.sin(a) * (i % 3 ? 88 : 77), 128 - Math.cos(a) * (i % 3 ? 88 : 77)); dc.stroke();
    }
    dc.fillStyle = "#736044"; dc.font = "bold 19px Georgia"; dc.textAlign = "center";
    dc.fillText("LUMEN", 128, 167); dc.font = "14px Georgia"; dc.fillText("0       5       10", 128, 77);
    var dialMat = mat(new THREE.MeshStandardMaterial({ map: texture(dialCanvas, true), roughness: 0.63, metalness: 0.08 }));
    var gauge = group(torso, "chest gauge", 0, 0.151, 0.106); gauge.rotation.x = -0.16;
    rod(gauge, 0, 0, 0, 0.042, 0.014, Math.PI / 2);
    ring(gauge, 0, 0, 0.011, 0.037, 0);
    part(gauge, geo(new THREE.CircleGeometry(0.033, radial)), dialMat, 0, 0, 0.013);
    var needle = group(gauge, "gauge needle", 0, 0, 0.014);
    rod(needle, 0, 0.009, 0, 0.0016, 0.031, 0, 0, dark); ball(needle, 0, 0, 0.001, 0.0033, 0.0033, 0.002, dark);
    var key = group(torso, "key", 0, 0.13, -0.135);
    rod(key, 0, 0, -0.014, 0.012, 0.065, Math.PI / 2);
    ball(key, 0, 0, -0.052, 0.017, 0.019, 0.01);
    ring(key, -0.031, 0.012, -0.053, 0.025, 0, brass, 0.03);
    ring(key, 0.031, 0.012, -0.053, 0.025, 0, brass, 0.03);
    rod(key, 0, 0.005, -0.053, 0.01, 0.06, 0, Math.PI / 2);
    // Chunky stacked knit collar and a side knot.
    ring(torso, 0, 0.244, 0, 0.085, Math.PI / 2, scarfMat);
    ring(torso, 0, 0.227, 0, 0.088, Math.PI / 2, scarfMat);
    // Additional wool volume under the fine torus ridges.
    ball(torso, 0, 0.237, 0, 0.098, 0.026, 0.083, scarfMat);
    ball(torso, -0.09, 0.238, 0.056, 0.03, 0.028, 0.03, scarfMat);
    var head = group(torso, "head", 0, 0.272, 0);
    var globe = lathe([[0.082,0.008],[0.109,0.035],[0.134,0.082],[0.142,0.132],
      [0.131,0.182],[0.106,0.222],[0.092,0.24]]);
    var glass = new THREE.Mesh(globe, glassMat); glass.name = "lantern glass"; glass.renderOrder = 3; head.add(glass);
    rod(head, 0, 0.009, 0, 0.091, 0.014);
    ring(head, 0, 0.017, 0, 0.087, Math.PI / 2);
    rod(head, 0, 0.242, 0, 0.112, 0.012);
    ring(head, 0, 0.244, 0, 0.109, Math.PI / 2);
    var dome = lathe([[0.108,0.248],[0.102,0.258],[0.087,0.272],[0.065,0.283],[0.036,0.29],[0,0.293]]);
    part(head, dome, brass);
    rod(head, 0, 0.298, 0, 0.023, 0.012);
    ball(head, 0, 0.31, 0, 0.014);
    ring(head, 0, 0.339, 0, 0.032, 0);
    for (i = 0; i < 4; i++) {
      angle = Math.PI / 4 + i * Math.PI / 2;
      var ribs = [];
      for (j = 0; j < 7; j++) {
        var h = 0.016 + j * 0.037, radius = 0.087 + Math.sin(j / 6 * Math.PI) * 0.055;
        ribs.push(new THREE.Vector3(Math.sin(angle) * radius, h, Math.cos(angle) * radius));
      }
      part(head, geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribs), low ? 8 : 16, 0.006, 6, false)), brass);
    }
    for (i = 0; i < 12; i++) {
      angle = i * Math.PI / 6;
      ball(head, Math.sin(angle) * 0.102, 0.255, Math.cos(angle) * 0.102, 0.0045);
      ball(head, Math.sin(angle) * 0.088, 0.012, Math.cos(angle) * 0.088, 0.0045);
    }
    var flame = group(head, "living flame", 0, 0.022, 0);
    var flameShape = lathe([[0,0],[0.039,0.008],[0.063,0.03],[0.07,0.063],[0.061,0.094],
      [0.042,0.125],[0.025,0.153],[0.018,0.177],[0.009,0.198],[0,0.218]]);
    var fp = flameShape.attributes.position, colors = new Float32Array(fp.count * 3), color = new THREE.Color();
    for (i = 0; i < fp.count; i++) {
      var fy = fp.getY(i), bend = Math.max(0, (fy - 0.1) / 0.118);
      fp.setX(i, fp.getX(i) + Math.sin(bend * 5.8) * 0.019 * bend);
      color.setRGB(1, 0.88 - fy * 2.8, 0.22 - fy * 0.85);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    flameShape.setAttribute("color", new THREE.BufferAttribute(colors, 3)); flameShape.computeVertexNormals();
    var outer = new THREE.Mesh(flameShape, flameMat); flame.add(outer);
    var core = new THREE.Mesh(flameShape, coreMat); core.scale.set(0.63, 0.63, 0.52); core.position.set(0, 0.004, 0.038); flame.add(core);
    var tongue = new THREE.Mesh(flameShape, tipMat); tongue.scale.set(0.48, 0.76, 0.5); tongue.position.set(-0.025, 0.01, -0.013); flame.add(tongue);
    var eyes = group(flame, "eyes", 0, 0.067, 0.071);
    ball(eyes, -0.023, 0, 0, 0.0063, 0.014, 0.0048, eyeMat);
    ball(eyes, 0.023, 0, 0, 0.0063, 0.014, 0.0048, eyeMat);
    var light = new THREE.PointLight(0xffb35a, 1.2, 4, 2); light.name = "Wick flame light";
    light.castShadow = false; root.add(light);
    var halo = null;
    if (!low) {
      var hc = canvas(128, 128), hctx = hc.getContext("2d"), hg = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      hg.addColorStop(0, "rgba(255,205,100,.35)"); hg.addColorStop(0.24, "rgba(255,153,40,.16)");
      hg.addColorStop(0.55, "rgba(255,120,20,.045)"); hg.addColorStop(1, "rgba(255,100,0,0)");
      hctx.fillStyle = hg; hctx.fillRect(0, 0, 128, 128);
      halo = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: texture(hc, true), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.65, toneMapped: false })));
      halo.position.y = 0.13; halo.scale.set(0.47, 0.47, 1); head.add(halo);
    }
    var shoulders = [], elbows = [], legHips = [], knees = [];
    for (i = 0; i < 2; i++) {
      var sign = i === 0 ? 1 : -1, side = i === 0 ? "L" : "R";
      var sh = group(torso, "shoulder." + side, sign * 0.12, 0.193, 0); shoulders.push(sh);
      ball(sh, 0, 0, 0, 0.025, 0.028, 0.025);
      rod(sh, 0, -0.044, 0, 0.011, 0.072);
      ring(sh, 0, -0.025, 0, 0.013, Math.PI / 2);
      var el = group(sh, "elbow." + side, 0, -0.084, 0); elbows.push(el);
      ball(el, 0, 0, 0, 0.018);
      rod(el, 0, -0.035, 0, 0.0105, 0.059);
      ball(el, 0, -0.069, 0, 0.014);
      rod(el, 0, -0.065, 0, 0.02, 0.012);
      ball(el, 0, -0.088, 0.003, 0.018, 0.022, 0.014);
      for (j = 0; j < 3; j++) ball(el, (j - 1) * 0.011, -0.108, 0.008, 0.0065, 0.014, 0.008);
      ball(el, -sign * 0.022, -0.088, 0.01, 0.008, 0.015, 0.009);
      var hip = group(hips, "hip." + side, sign * 0.054, 0, 0); legHips.push(hip);
      ball(hip, 0, 0, 0, 0.023); rod(hip, 0, -0.043, 0, 0.0115, 0.069);
      var knee = group(hip, "knee." + side, 0, -0.085, 0); knees.push(knee);
      ball(knee, 0, 0, 0, 0.019); rod(knee, 0, -0.036, 0, 0.012, 0.06);
      ball(knee, 0, -0.071, 0, 0.019);
      rod(knee, 0, -0.075, 0, 0.026, 0.012);
      ball(knee, 0, -0.105, 0.017, 0.038, 0.028, 0.057);
      ball(knee, 0, -0.129, 0.018, 0.04, 0.008, 0.058, dark);
      ring(knee, 0, -0.085, 0, 0.023, Math.PI / 2);
    }
    batches.forEach(function (b) {
      var count = 0; b.parts.forEach(function (g) { count += g.attributes.position.count; });
      var geometry = geo(new THREE.BufferGeometry());
      ["position", "normal", "uv"].forEach(function (name) {
        var size = name === "uv" ? 2 : 3, data = new Float32Array(count * size), offset = 0;
        b.parts.forEach(function (g) { data.set(g.attributes[name].array, offset); offset += g.attributes[name].array.length; });
        geometry.setAttribute(name, new THREE.BufferAttribute(data, size));
      });
      geometry.computeBoundingSphere();
      var mesh = new THREE.Mesh(geometry, b.material); mesh.castShadow = b.material !== eyeMat; mesh.receiveShadow = false;
      b.parent.add(mesh); b.parts.forEach(function (g) { g.dispose(); });
    });
    batches.length = 0;
    // Two world-space Verlet ribbons. Every buffer/vector used below is persistent.
    var tails = [], nodes = low ? 4 : 7, segment = low ? 0.066 : 0.035;
    for (i = 0; i < 2; i++) {
      var ribbon = geo(new THREE.BufferGeometry()), positions = new Float32Array(nodes * 6), uv = new Float32Array(nodes * 4), indices = [];
      for (j = 0; j < nodes; j++) {
        uv[j * 4] = 0; uv[j * 4 + 1] = j / (nodes - 1); uv[j * 4 + 2] = 1; uv[j * 4 + 3] = j / (nodes - 1);
        if (j < nodes - 1) { var n = j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      }
      ribbon.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      ribbon.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nodes * 6), 3).setUsage(THREE.DynamicDrawUsage));
      ribbon.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); ribbon.setIndex(indices);
      var tailMesh = new THREE.Mesh(ribbon, scarfMat); tailMesh.name = "scarf tail " + i; tailMesh.castShadow = true; tailMesh.frustumCulled = false; root.add(tailMesh);
      var current = [], previous = [];
      for (j = 0; j < nodes; j++) { current.push(new THREE.Vector3()); previous.push(new THREE.Vector3()); }
      tails.push({ geometry: ribbon, current: current, previous: previous, anchor: new THREE.Vector3(-0.105 - i * 0.013, 0.235, 0.065 - i * 0.026),
        pin: new THREE.Vector3(), width: new THREE.Vector3(), length: segment * (i ? 0.87 : 1) });
    }
    var rootWorld = new THREE.Vector3(), lastWorld = new THREE.Vector3(), movement = new THREE.Vector3();
    var temp = new THREE.Vector3(), correction = new THREE.Vector3(), local = new THREE.Vector3(), local2 = new THREE.Vector3();
    var rootInverse = new THREE.Matrix4(), torsoInverse = new THREE.Matrix4();
    var scarfInitialized = false;
    function updateScarf(dt, t) {
      root.updateWorldMatrix(true, true);
      rootWorld.setFromMatrixPosition(root.matrixWorld);
      if (!scarfInitialized) lastWorld.copy(rootWorld);
      movement.subVectors(rootWorld, lastWorld);
      var teleport = movement.lengthSq() > 0.64;
      rootInverse.copy(root.matrixWorld).invert(); torsoInverse.copy(torso.matrixWorld).invert();
      var steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
      var speedX = dt > 0 ? movement.x / dt : 0, speedZ = dt > 0 ? movement.z / dt : 0;
      for (var ti = 0; ti < 2; ti++) {
        var tail = tails[ti], cur = tail.current, prev = tail.previous;
        tail.pin.copy(tail.anchor).applyMatrix4(torso.matrixWorld);
        tail.width.set(1, 0, 0).transformDirection(torso.matrixWorld);
        if (!scarfInitialized || teleport) for (var ni = 0; ni < nodes; ni++) {
          cur[ni].set(tail.anchor.x - ni * 0.008, tail.anchor.y - ni * tail.length, tail.anchor.z + ni * 0.009).applyMatrix4(torso.matrixWorld);
          prev[ni].copy(cur[ni]);
        }
        for (var sub = 0; sub < steps; sub++) {
          if (h > 0) for (ni = 1; ni < nodes; ni++) {
            temp.subVectors(cur[ni], prev[ni]).multiplyScalar(Math.exp(-9 * h)); prev[ni].copy(cur[ni]); cur[ni].add(temp);
            cur[ni].x += (-speedX * 1.6 + (low ? 0 : Math.sin(t * 3 + ni) * 0.07)) * h * h;
            cur[ni].y -= 2.4 * h * h; cur[ni].z -= speedZ * 1.6 * h * h;
          }
          for (var pass = 0; pass < 6; pass++) {
            cur[0].copy(tail.pin);
            for (ni = 1; ni < nodes; ni++) {
              correction.subVectors(cur[ni], cur[ni - 1]); var len = correction.length();
              correction.multiplyScalar((len - tail.length) / Math.max(len, 0.00001));
              if (ni === 1) cur[ni].sub(correction);
              else { correction.multiplyScalar(0.5); cur[ni].sub(correction); cur[ni - 1].add(correction); }
              // Expanded torso ellipsoid; test in torso space so turns/parenting work.
              local.copy(cur[ni]).applyMatrix4(torsoInverse); local.y -= 0.112;
              var d = Math.sqrt(local.x * local.x / 0.021025 + local.y * local.y / 0.021025 + local.z * local.z / 0.018225);
              if (d < 1) { local.multiplyScalar(1 / Math.max(d, 0.0001)); local.y += 0.112; cur[ni].copy(local).applyMatrix4(torso.matrixWorld); }
            }
          }
          cur[0].copy(tail.pin);
        }
        var array = tail.geometry.attributes.position.array;
        for (ni = 0; ni < nodes; ni++) {
          var half = 0.038 * (1 - 0.13 * ni / (nodes - 1));
          local.copy(cur[ni]).addScaledVector(tail.width, -half).applyMatrix4(rootInverse);
          local2.copy(cur[ni]).addScaledVector(tail.width, half).applyMatrix4(rootInverse);
          var at = ni * 6; array[at] = local.x; array[at + 1] = local.y; array[at + 2] = local.z;
          array[at + 3] = local2.x; array[at + 4] = local2.y; array[at + 5] = local2.z;
        }
        tail.geometry.attributes.position.needsUpdate = true;
        tail.geometry.computeVertexNormals();
      }
      lastWorld.copy(rootWorld); scarfInitialized = true;
    }
    var currentAnim = "idle", animTime = 0, phase = 0, glow = 1, requestedGlow = 1, keyAngle = 0;
    var weights = new Float64Array(7); weights[0] = 1;
    var blinkClock = 0, nextBlink = 2.8, blinkAge = -1, air = 0;
    var stepEvents = [{ foot: "L" }, { foot: "R" }];
    var hero = { object3D: root, light: light, onStep: null,
      setAnim: function (name) {
        name = ANIMS.indexOf(name) < 0 ? "idle" : name;
        if (name !== currentAnim) { currentAnim = name; animTime = 0; }
      },
      setGlow: function (k) { if (Number.isFinite(k)) requestedGlow = Math.max(0, Math.min(2, k)); },
      update: function (dt, t, state) {
        if (disposed) return;
        dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        t = Number.isFinite(t) ? t : animTime;
        var speed = state && Number.isFinite(state.speed) ? Math.abs(state.speed) : 1.4;
        var grounded = !state || state.grounded !== false;
        animTime += dt;
        var ease = 1 - Math.exp(-dt * 16), target = ANIMS.indexOf(currentAnim);
        for (var wi = 0; wi < 7; wi++) weights[wi] += ((wi === target ? 1 : 0) - weights[wi]) * ease;
        var walk = weights[1], climb = weights[2], celebrate = weights[3], bump = weights[4], ride = weights[5], wave = weights[6];
        var gait = (walk + climb) * Math.min(1, speed / 0.3);
        var oldContact = Math.floor(phase / Math.PI);
        phase += dt * speed * Math.PI * 2 * (1 - climb * 0.2);
        var newContact = Math.floor(phase / Math.PI);
        if ((currentAnim === "walk" || currentAnim === "climb") && grounded && speed > 0.01) {
          for (var contact = oldContact + 1; contact <= newContact; contact++) {
            if (typeof hero.onStep === "function") { try { hero.onStep(stepEvents[contact % 2]); } catch (_) { /* Engine callbacks cannot break animation. */ } }
          }
        }
        air += ((grounded ? 0 : 1) - air) * ease;
        var s = Math.sin(phase), hop = Math.pow(Math.max(0, Math.sin(animTime * 5)), 2);
        hips.position.y = 0.225 + Math.sin(t * 2.6) * 0.0025 + gait * (0.009 + 0.008 * Math.cos(phase * 2))
          + celebrate * 0.048 * hop + wave * (0.005 + 0.004 * Math.sin(t * 5)) - ride * 0.017;
        torso.rotation.x = 0.09 * walk + 0.19 * climb;
        torso.rotation.z = gait * 0.025 * s + ride * Math.sin(t * 3) * 0.045 + bump * Math.sin(animTime * 22) * Math.exp(-animTime * 4) * 0.11;
        torso.scale.y = 1 + 0.008 * Math.sin(t * 2.6);
        var look = Math.sin(t * 0.69) * Math.pow(Math.max(0, Math.sin(t * 0.37)), 4);
        head.position.y = 0.272 + celebrate * 0.025 + gait * 0.003 * Math.cos(phase * 2);
        head.rotation.y = look * 0.5 * weights[0];
        head.rotation.z = bump * 0.28 + wave * 0.11 + ride * Math.sin(t * 2.4) * 0.04;
        head.rotation.x = bump * 0.12 - torso.rotation.x * 0.65;
        for (var li = 0; li < 2; li++) {
          var sideSign = li === 0 ? 1 : -1, swing = s * sideSign;
          legHips[li].rotation.x = -gait * swing * (0.48 + climb * 0.2) - air * 0.55 - ride * 0.21;
          legHips[li].rotation.z = sideSign * (ride * 0.13 + celebrate * 0.05);
          knees[li].rotation.x = gait * Math.max(0, swing) * (0.72 + climb * 0.5) + air * 1.1 + ride * 0.42;
          shoulders[li].rotation.x = gait * swing * 0.55 + Math.sin(t * 2 + li) * 0.035 - bump * (li ? 0.8 : 0.05);
          shoulders[li].rotation.z = sideSign * (0.12 + celebrate * 2.35 + ride * 0.55 + wave * (li ? 2.2 : 0));
          elbows[li].rotation.x = -0.13 - gait * (0.2 + Math.max(0, -swing) * 0.25) - celebrate * 0.35 - bump * (li ? 0.8 : 0);
          elbows[li].rotation.z = wave * (li ? Math.sin(t * 9) * 0.5 - 0.3 : 0) + sideSign * celebrate * 0.25;
        }
        keyAngle += dt * (0.32 + gait * speed * 2.8); key.rotation.z = keyAngle;
        needle.rotation.z = -0.65 + Math.sin(t * 0.8) * 0.23 + Math.sin(t * 3.1) * 0.045;
        blinkClock += dt;
        if (blinkAge < 0 && blinkClock >= nextBlink) { blinkAge = 0; blinkClock = 0; nextBlink = 2.5 + (0.5 + Math.sin(t * 7.13) * 0.5) * 2.5; }
        if (blinkAge >= 0) { blinkAge += dt; if (blinkAge >= 0.12) blinkAge = -1; }
        eyes.scale.y = blinkAge < 0 ? 1 : 0.1 + 0.9 * Math.abs(blinkAge - 0.06) / 0.06;
        eyes.position.x = look * 0.008;
        var glowTarget = requestedGlow + (2 - requestedGlow) * celebrate;
        glow += (glowTarget - glow) * (1 - Math.exp(-dt * 7));
        var flicker = 1 + 0.035 * Math.sin(t * 17) + 0.021 * Math.sin(t * 29 + 1) + bump * 0.045 * Math.sin(t * 51);
        var flameSize = (0.82 + glow * 0.18) * (1 + celebrate * 0.5);
        flame.scale.set(flameSize * (2 - flicker), flameSize * flicker, flameSize);
        flame.rotation.z = Math.sin(t * 11) * 0.025 + gait * s * 0.03;
        outer.scale.x = 1 + Math.sin(t * 13) * 0.025;
        tongue.scale.y = 0.76 + Math.sin(t * 19) * 0.06;
        if (halo) { halo.scale.setScalar(0.47 * (0.85 + glow * 0.15)); halo.material.opacity = 0.65 * glow; }
        updateScarf(dt, t);
        temp.set(0, 0.105, 0).applyMatrix4(head.matrixWorld).applyMatrix4(rootInverse); light.position.copy(temp);
        light.intensity = 1.2 * glow * flicker;
      },
      dispose: function () {
        if (disposed) return; disposed = true;
        if (root.parent) root.parent.remove(root);
        geometries.forEach(function (g) { g.dispose(); });
        materials.forEach(function (m) { m.dispose(); });
        textures.forEach(function (tx) { tx.dispose(); });
        hero.onStep = null; root.clear();
      }
    };
    Object.defineProperty(hero, "anim", { enumerable: true, get: function () { return currentAnim; } });
    hero.update(0, 0);
    return hero;
  }
  // THREE is deliberately resolved at create(), so script load has no dependencies.
  if (typeof window !== "undefined") window.Hero = { create: create };
})();
