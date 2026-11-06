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
    mc.fillStyle = "#eee4cf"; mc.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 6500; i++) {
      var x = random() * 256, y = random() * 256;
      mc.fillStyle = random() < 0.5 ? "rgba(54,35,21,.045)" : "rgba(255,246,213,.08)";
      mc.fillRect(x, y, 0.5 + random(), 0.4 + random());
    }
    // Restrained oxidation in the UV seams, rather than spots across every panel.
    for (i = 0; i < 220; i++) {
      x = (i % 4) * 64 + random() * 5; y = random() * 256;
      mc.fillStyle = "rgba(79,165,151,.24)";
      mc.fillRect(x, y, 1 + random() * 3, 1 + random() * 4);
    }
    var metalMap = texture(metalCanvas, true);
    var grainMap = texture(metalCanvas, false);
    // A tiny, instance-owned reflection studio. No PMREM or scene mutation.
    var faces = [];
    for (i = 0; i < 6; i++) {
      var c = canvas(64, 64), ctx = c.getContext("2d");
      var sky = ctx.createLinearGradient(0, 0, 0, 64);
      sky.addColorStop(0, i === 2 ? "#b6c4db" : "#879bb6");
      sky.addColorStop(0.42, "#a49c8b"); sky.addColorStop(0.55, "#e6bb7d");
      sky.addColorStop(0.68, "#82715b"); sky.addColorStop(1, "#555061");
      ctx.fillStyle = i === 3 ? "#645361" : sky; ctx.fillRect(0, 0, 64, 64);
      var strip = ctx.createLinearGradient(0, 0, 64, 0);
      strip.addColorStop(0, "rgba(255,239,204,0)"); strip.addColorStop(0.3, "rgba(255,239,204,0)");
      strip.addColorStop(0.43, "rgba(255,239,204,.6)"); strip.addColorStop(0.54, "rgba(255,239,204,.6)");
      strip.addColorStop(0.68, "rgba(255,239,204,0)"); strip.addColorStop(1, "rgba(255,239,204,0)");
      ctx.fillStyle = strip; if (i !== 3) ctx.fillRect(0, 0, 64, 45); faces.push(c);
    }
    var env = new THREE.CubeTexture(faces); env.encoding = THREE.sRGBEncoding; env.needsUpdate = true; textures.push(env);
    function linear(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
    var brass = mat(new THREE.MeshStandardMaterial({ color: linear(0xc79540), metalness: 0.75, roughness: 0.45,
      map: metalMap, bumpMap: grainMap, bumpScale: 0.00035, envMap: env, envMapIntensity: 1.4 }));
    var dark = mat(new THREE.MeshStandardMaterial({ color: linear(0x5c4931), metalness: 0.85, roughness: 0.53, envMap: env }));
    var patina = mat(new THREE.MeshStandardMaterial({ color: linear(0x4fa597), metalness: 0.65, roughness: 0.55, envMap: env }));
    var knitCanvas = canvas(128, 128), kc = knitCanvas.getContext("2d");
    kc.fillStyle = "#2f9a98"; kc.fillRect(0, 0, 128, 128); kc.lineCap = "round";
    for (y = -8; y < 136; y += 8) for (x = -8; x < 136; x += 8) {
      kc.strokeStyle = "#277976"; kc.lineWidth = 4.5;
      kc.beginPath(); kc.moveTo(x - 2, y); kc.lineTo(x + 1, y + 5); kc.lineTo(x + 4, y); kc.stroke();
      kc.strokeStyle = (x + y) % 16 ? "#55b9ae" : "#43aaa5"; kc.lineWidth = 2;
      kc.beginPath(); kc.moveTo(x - 2, y); kc.lineTo(x + 1, y + 4); kc.lineTo(x + 4, y); kc.stroke();
    }
    var knitColor = texture(knitCanvas, true), knit = texture(knitCanvas, false);
    knitColor.repeat.set(2, 1); knit.repeat.set(2, 1);
    var scarfMat = mat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: knitColor, roughness: 0.96,
      bumpMap: knit, bumpScale: 0.0025, side: THREE.DoubleSide }));
    // Thin glass: silhouette Fresnel and two soft reflected studio strips.
    var glassMat = mat(new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { strength: { value: low ? 0.5 : 1 } },
      vertexShader: "varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=-p.xyz; gl_Position=projectionMatrix*p;}",
      fragmentShader: "uniform float strength; varying vec3 n; varying vec3 v; void main(){vec3 N=normalize(n); float rim=pow(1.-abs(dot(N,normalize(v))),3.); float streak=pow(max(0.,dot(N,normalize(vec3(-.65,.3,.7)))),65.); float a=(.025+.38*rim+.65*streak)*strength; gl_FragColor=vec4(mix(vec3(.72,.45,.18),vec3(1.,.95,.79),min(1.,rim+streak)),a);}" }));
    var eyeMat = mat(new THREE.MeshBasicMaterial({ color: 0x241006, toneMapped: false }));
    var flameMat = mat(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff,
      emissiveIntensity: 1.85, roughness: 1, vertexColors: true }));
    // In r128 vertex colour normally affects diffuse only; the flame's gradient
    // belongs to its emitted light as well.
    flameMat.onBeforeCompile = function (shader) {
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor;");
    };
    var coreMat = mat(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffefaa, emissiveIntensity: 2.6 }));
    var tipMat = mat(new THREE.MeshBasicMaterial({ color: 0xff730a, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    var sphere = geo(new THREE.SphereGeometry(1, low ? 12 : 18, low ? 8 : 12));
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
    // Keep the fuller lantern silhouette within the 0.85-unit game scale.
    var assembly = group(root, "assembly"); assembly.scale.setScalar(0.82);
    var hips = group(assembly, "hips", 0, 0.222, 0);
    var torso = group(hips, "torso");
    var egg = lathe([[0,0],[0.055,0.008],[0.089,0.029],[0.108,0.063],[0.116,0.105],
      [0.112,0.148],[0.097,0.194],[0.071,0.22],[0,0.226]]);
    egg.scale(1.29, 1.1, 1.29);
    part(torso, egg, brass);
    part(torso, geo(new THREE.TorusGeometry(0.135, 0.002, 6, radial)), dark, 0, 0.055, 0, 1, 1, 1, Math.PI / 2);
    part(torso, geo(new THREE.TorusGeometry(0.139, 0.003, 6, radial)), brass, 0, 0.063, 0, 1, 1, 1, Math.PI / 2);
    part(torso, geo(new THREE.TorusGeometry(0.13, 0.003, 6, radial)), brass, 0, 0.2024, 0, 1, 1, 1, Math.PI / 2);
    part(torso, geo(new THREE.TorusGeometry(0.128, 0.0015, 6, radial)), dark, 0, 0.209, 0, 1, 1, 1, Math.PI / 2);
    // Six fine longitudinal seams, expressed as curved brass wires.
    for (i = 0; i < 6; i++) {
      var angle = i * Math.PI / 3, seam = [];
      for (var j = 1; j < 8; j++) {
        var pp = [[0,0],[0.055,0.008],[0.089,0.029],[0.108,0.063],[0.116,0.105],[0.112,0.148],[0.097,0.194],[0.071,0.22]][j];
        seam.push(new THREE.Vector3(Math.sin(angle) * (pp[0] * 1.29 + 0.001), pp[1] * 1.1, Math.cos(angle) * (pp[0] * 1.29 + 0.001)));
      }
      var wire = geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 12, 0.0018, 4, false)); part(torso, wire, dark);
      for (j = 0; j < 3; j++) {
        var yy = 0.055 + j * 0.065, rr = j === 1 ? 0.116 : 0.104;
        ball(torso, Math.sin(angle + 0.2) * rr * 1.29, yy * 1.1, Math.cos(angle + 0.2) * rr * 1.29, 0.0075);
        ball(torso, Math.sin(angle + 0.2) * rr * 1.28, yy * 1.1 - 0.005, Math.cos(angle + 0.2) * rr * 1.28, 0.009, 0.008, 0.008, patina);
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
    var gauge = group(torso, "chest gauge", 0, 0.16, 0.148); gauge.scale.setScalar(1.28); gauge.rotation.x = -0.16;
    rod(gauge, 0, 0, 0, 0.042, 0.014, Math.PI / 2);
    ring(gauge, 0, 0, 0.011, 0.037, 0);
    part(gauge, geo(new THREE.CircleGeometry(0.033, radial)), dialMat, 0, 0, 0.013);
    var needle = group(gauge, "gauge needle", 0, 0, 0.014);
    rod(needle, 0, 0.009, 0, 0.0016, 0.031, 0, 0, dark); ball(needle, 0, 0, 0.001, 0.0033, 0.0033, 0.002, dark);
    var key = group(torso, "key", 0, 0.13, -0.157);
    rod(key, 0, 0, -0.014, 0.014, 0.065, Math.PI / 2);
    ball(key, 0, 0, -0.052, 0.017, 0.019, 0.01);
    ring(key, -0.031, 0.012, -0.053, 0.025, 0, brass, 0.03);
    ring(key, 0.031, 0.012, -0.053, 0.025, 0, brass, 0.03);
    rod(key, 0, 0.005, -0.053, 0.01, 0.06, 0, Math.PI / 2);
    // A real wool torus, with a rolled lower lip and a front-side knot.
    part(torso, geo(new THREE.TorusGeometry(0.088, 0.043, 12, radial)), scarfMat,
      0, 0.263, 0, 1, 1, 0.8, Math.PI / 2);
    ring(torso, 0, 0.242, 0, 0.096, Math.PI / 2, scarfMat);
    ball(torso, -0.094, 0.262, 0.093, 0.038, 0.035, 0.035, scarfMat);
    rod(torso, 0, 0.295, 0, 0.073, 0.065);
    var head = group(torso, "head", 0, 0.32, 0);
    var globe = lathe([[0.114,0.008],[0.145,0.03],[0.173,0.067],[0.183,0.111],
      [0.184,0.151],[0.18,0.22],[0.16,0.275],[0.155,0.285]]);
    var glass = new THREE.Mesh(globe, glassMat); glass.name = "lantern glass"; glass.renderOrder = 3; head.add(glass);
    rod(head, 0, 0.009, 0, 0.12, 0.014);
    part(head, geo(new THREE.TorusGeometry(0.115, 0.0045, 8, radial)), brass, 0, 0.017, 0, 1, 1, 1, Math.PI / 2);
    // Convex spun dome, seated directly on the globe, with a rolled rim.
    var dome = lathe([[0,0.248],[0.163,0.248],[0.17,0.254],[0.168,0.265],
      [0.156,0.283],[0.136,0.305],[0.108,0.324],[0.074,0.339],[0.035,0.348],[0,0.35]]);
    part(head, dome, brass, 0, 0.035, 0);
    part(head, geo(new THREE.TorusGeometry(0.164, 0.006, 8, radial)), brass, 0, 0.29, 0, 1, 1, 1, Math.PI / 2);
    rod(head, 0, 0.392, 0, 0.025, 0.018);
    ball(head, 0, 0.406, 0, 0.017);
    part(head, geo(new THREE.TorusGeometry(0.05, 0.012, 8, radial)), brass, 0, 0.452, 0);
    for (i = 0; i < 4; i++) {
      angle = Math.PI / 4 + i * Math.PI / 2;
      var ribs = [], ribProfile = [[.116,.017],[.15,.04],[.181,.078],[.188,.117],[.188,.16],[.183,.22],[.16,.288]];
      for (j = 0; j < ribProfile.length; j++) {
        ribs.push(new THREE.Vector3(Math.sin(angle) * ribProfile[j][0], ribProfile[j][1], Math.cos(angle) * ribProfile[j][0]));
      }
      part(head, geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribs), low ? 10 : 24, 0.0055, 6, false)), brass);
    }
    for (i = 0; i < 16; i++) {
      angle = i * Math.PI / 8;
      ball(head, Math.sin(angle) * 0.16, 0.313, Math.cos(angle) * 0.16, 0.005);
      ball(head, Math.sin(angle) * 0.117, 0.013, Math.cos(angle) * 0.117, 0.005);
      if (i % 2 === 0) ball(head, Math.sin(angle) * 0.16, 0.309, Math.cos(angle) * 0.16, 0.006, 0.002, 0.006, patina);
    }
    var flame = group(head, "living flame", 0, 0.031, 0.045);
    var flameShape = lathe([[0,0],[0.045,0.008],[0.074,0.03],[0.079,0.057],[0.066,0.083],
      [0.044,0.111],[0.027,0.137],[0.019,0.158],[0.009,0.178],[0,0.197]]);
    var fp = flameShape.attributes.position, colors = new Float32Array(fp.count * 3), color = new THREE.Color();
    for (i = 0; i < fp.count; i++) {
      var fy = fp.getY(i), bend = Math.max(0, (fy - 0.1) / 0.097);
      fp.setX(i, fp.getX(i) + Math.sin(bend * 6.8) * 0.038 * bend);
      fp.setZ(i, fp.getZ(i) + bend * 0.08);
      fp.setY(i, fy * 1.1);
      var heat = fy / 0.197;
      var faceDim = 1 - 0.25 * Math.exp(-Math.pow((heat - 0.36) / 0.18, 2));
      color.setRGB(faceDim, Math.max(0.018, 0.5 * Math.pow(1 - heat, 2)) * faceDim, 0.004);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    flameShape.setAttribute("color", new THREE.BufferAttribute(colors, 3)); flameShape.computeVertexNormals();
    var outer = new THREE.Mesh(flameShape, flameMat); flame.add(outer);
    var core = new THREE.Mesh(flameShape, coreMat); core.scale.set(0.49, 0.51, 0.48); core.position.set(0, 0.003, 0.038); flame.add(core);
    var tongue = new THREE.Mesh(flameShape, tipMat); tongue.scale.set(1.09, 1.03, 1.09); tongue.position.set(0, 0, -0.003); flame.add(tongue);
    var eyes = group(flame, "eyes", 0, 0.078, 0.078);
    ball(eyes, -0.023, 0, 0, 0.007, 0.0175, 0.006, eyeMat);
    ball(eyes, 0.023, 0, 0, 0.007, 0.0175, 0.006, eyeMat);
    var light = new THREE.PointLight(0xffb35a, 1.4, 4, 2); light.name = "Wick flame light";
    light.castShadow = false; root.add(light);
    var halo = null;
    if (!low) {
      var hc = canvas(128, 128), hctx = hc.getContext("2d"), hg = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      hg.addColorStop(0, "rgba(255,205,100,.4)"); hg.addColorStop(0.24, "rgba(255,153,40,.2)");
      hg.addColorStop(0.55, "rgba(255,120,20,.045)"); hg.addColorStop(1, "rgba(255,100,0,0)");
      hctx.fillStyle = hg; hctx.fillRect(0, 0, 128, 128);
      halo = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: texture(hc, true), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75, toneMapped: false })));
      halo.position.y = 0.13; halo.scale.set(1.1, 1.1, 1); head.add(halo);
    }
    var shoulders = [], elbows = [], legHips = [], knees = [], ankles = [];
    for (i = 0; i < 2; i++) {
      var sign = i === 0 ? 1 : -1, side = i === 0 ? "L" : "R";
      var sh = group(torso, "shoulder." + side, sign * 0.153, 0.20, 0); shoulders.push(sh);
      ball(sh, 0, 0, 0, 0.025, 0.028, 0.025);
      rod(sh, 0, -0.044, 0, 0.011, 0.072);
      ring(sh, 0, -0.025, 0, 0.013, Math.PI / 2);
      var el = group(sh, "elbow." + side, 0, -0.084, 0); elbows.push(el);
      ball(el, 0, 0, 0, 0.018);
      rod(el, 0, -0.035, 0, 0.0105, 0.059);
      ball(el, 0, -0.069, 0, 0.014);
      rod(el, 0, -0.065, 0, 0.02, 0.012);
      ball(el, 0, -0.088, 0.003, 0.023, 0.025, 0.018);
      for (j = 0; j < 3; j++) ball(el, (j - 1) * 0.014, -0.111, 0.01, 0.008, 0.016, 0.01);
      ball(el, -sign * 0.027, -0.088, 0.014, 0.01, 0.017, 0.011);
      var hip = group(hips, "hip." + side, sign * 0.065, 0, 0); legHips.push(hip);
      ball(hip, 0, 0, 0, 0.023); rod(hip, 0, -0.043, 0, 0.014, 0.069);
      var knee = group(hip, "knee." + side, 0, -0.085, 0); knees.push(knee);
      ball(knee, 0, 0, 0, 0.019); rod(knee, 0, -0.036, 0, 0.014, 0.06);
      var ankle = group(knee, "ankle." + side, 0, -0.071, 0); ankles.push(ankle);
      ball(ankle, 0, 0, 0, 0.019);
      rod(ankle, 0, -0.004, 0, 0.026, 0.012);
      ball(ankle, 0, -0.034, 0.024, 0.051, 0.032, 0.075);
      ball(ankle, 0, -0.058, 0.025, 0.054, 0.008, 0.077, dark);
      part(ankle, geo(new THREE.TorusGeometry(1, 0.045, 5, radial)), brass, 0, -0.052, 0.025, 0.052, 0.075, 0.052, Math.PI / 2);
      ring(ankle, 0, -0.014, 0, 0.023, Math.PI / 2);
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
    var tails = [], nodes = low ? 4 : 7, segment = low ? 0.122 : 0.061;
    for (i = 0; i < 2; i++) {
      var ribbon = geo(new THREE.BufferGeometry()), positions = new Float32Array(nodes * 6 + 72), uv = new Float32Array(nodes * 4 + 48), indices = [];
      for (j = 0; j < nodes; j++) {
        uv[j * 4] = 0; uv[j * 4 + 1] = j / (nodes - 1); uv[j * 4 + 2] = 1; uv[j * 4 + 3] = j / (nodes - 1);
        if (j < nodes - 1) { var n = j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      }
      for (j = 0; j < 6; j++) {
        var fringeBase = nodes * 2 + j * 4;
        indices.push(fringeBase, fringeBase + 1, fringeBase + 2, fringeBase + 1, fringeBase + 3, fringeBase + 2);
        for (var fv = 0; fv < 4; fv++) {
          uv[fringeBase * 2 + fv * 2] = (j + (fv % 2)) / 6;
          uv[fringeBase * 2 + fv * 2 + 1] = 1 + (fv > 1 ? 0.08 : 0);
        }
      }
      ribbon.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      ribbon.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nodes * 6 + 72), 3).setUsage(THREE.DynamicDrawUsage));
      ribbon.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); ribbon.setIndex(indices);
      var tailMesh = new THREE.Mesh(ribbon, scarfMat); tailMesh.name = "scarf tail " + i; tailMesh.castShadow = true; tailMesh.frustumCulled = false; root.add(tailMesh);
      var current = [], previous = [];
      for (j = 0; j < nodes; j++) { current.push(new THREE.Vector3()); previous.push(new THREE.Vector3()); }
      tails.push({ geometry: ribbon, current: current, previous: previous, anchor: new THREE.Vector3(-0.09 - i * 0.045, 0.259, 0.124 - i * 0.008),
        pin: new THREE.Vector3(), width: new THREE.Vector3(), lastDt: 1 / 120, length: segment * (i ? 0.94 : 1) });
    }
    var rootWorld = new THREE.Vector3(), lastWorld = new THREE.Vector3(), movement = new THREE.Vector3();
    var temp = new THREE.Vector3(), correction = new THREE.Vector3(), local = new THREE.Vector3(), local2 = new THREE.Vector3();
    var rootInverse = new THREE.Matrix4(), torsoInverse = new THREE.Matrix4();
    var armCapsules = [];
    for (i = 0; i < 4; i++) armCapsules.push({ a: new THREE.Vector3(), b: new THREE.Vector3() });
    var scarfInitialized = false;
    function updateScarf(dt, t) {
      root.updateWorldMatrix(true, true);
      rootWorld.setFromMatrixPosition(root.matrixWorld);
      if (!scarfInitialized) lastWorld.copy(rootWorld);
      movement.subVectors(rootWorld, lastWorld);
      var teleport = movement.lengthSq() > 0.64;
      rootInverse.copy(root.matrixWorld).invert(); torsoInverse.copy(torso.matrixWorld).invert();
      for (var arm = 0; arm < 2; arm++) {
        armCapsules[arm * 2].a.setFromMatrixPosition(shoulders[arm].matrixWorld);
        armCapsules[arm * 2].b.setFromMatrixPosition(elbows[arm].matrixWorld);
        armCapsules[arm * 2 + 1].a.copy(armCapsules[arm * 2].b);
        armCapsules[arm * 2 + 1].b.set(0, -0.11, 0.008).applyMatrix4(elbows[arm].matrixWorld);
      }
      var steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
      var speedX = dt > 0 ? movement.x / dt : 0, speedZ = dt > 0 ? movement.z / dt : 0;
      for (var ti = 0; ti < 2; ti++) {
        var tail = tails[ti], cur = tail.current, prev = tail.previous;
        tail.pin.copy(tail.anchor).applyMatrix4(torso.matrixWorld);
        tail.width.set(1, 0, 0).transformDirection(torso.matrixWorld);
        if (!scarfInitialized || teleport) for (var ni = 0; ni < nodes; ni++) {
          cur[ni].set(tail.anchor.x - ni * (ti ? 0.012 : 0.002), tail.anchor.y - ni * tail.length, tail.anchor.z + ni * 0.009).applyMatrix4(torso.matrixWorld);
          prev[ni].copy(cur[ni]);
        }
        for (var sub = 0; sub < steps; sub++) {
          if (h > 0) for (ni = 1; ni < nodes; ni++) {
            temp.subVectors(cur[ni], prev[ni]).multiplyScalar(Math.exp(-9 * h) * h / tail.lastDt); prev[ni].copy(cur[ni]); cur[ni].add(temp);
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
              // Rounded torso capsule, expanded by half the ribbon width.
              local.copy(cur[ni]).applyMatrix4(torsoInverse);
              var capsuleY = Math.max(0.115, Math.min(0.14, local.y));
              local.y -= capsuleY;
              var d = Math.sqrt(local.x * local.x / 0.038 + local.y * local.y / 0.0196 + local.z * local.z / 0.038);
              if (d < 1) local.multiplyScalar(1 / Math.max(d, 0.0001));
              local.y += capsuleY;
              // Clearance around the projecting gauge and its bezel.
              correction.set(local.x, local.y - 0.16, local.z - 0.166);
              var gaugeDistance = correction.length();
              if (gaugeDistance < 0.088) local.addScaledVector(correction, (0.088 - gaugeDistance) / Math.max(gaugeDistance, 0.0001));
              cur[ni].copy(local).applyMatrix4(torso.matrixWorld);
              // Animated arm capsules keep the ribbons ahead of the pumping hands.
              for (var ac = 0; ac < 4; ac++) {
                var capsule = armCapsules[ac];
                correction.subVectors(capsule.b, capsule.a); temp.subVectors(cur[ni], capsule.a);
                var projection = Math.max(0, Math.min(1, temp.dot(correction) / Math.max(0.000001, correction.lengthSq())));
                temp.addScaledVector(correction, -projection);
                var clearance = temp.length();
                if (clearance < 0.06) cur[ni].addScaledVector(temp, (0.06 - clearance) / Math.max(0.0001, clearance));
              }
            }
          }
          cur[0].copy(tail.pin);
          if (h > 0) tail.lastDt = h;
        }
        var array = tail.geometry.attributes.position.array;
        for (ni = 0; ni < nodes; ni++) {
          var along = ni / (nodes - 1), twist = 0.25 + along * (ti ? -0.85 : 0.65);
          tail.width.set(Math.cos(twist), 0.12 * Math.sin(along * 3), Math.sin(twist)).transformDirection(torso.matrixWorld);
          var half = 0.041 * (1 - 0.19 * along);
          local.copy(cur[ni]).addScaledVector(tail.width, -half).applyMatrix4(rootInverse);
          local2.copy(cur[ni]).addScaledVector(tail.width, half).applyMatrix4(rootInverse);
          var at = ni * 6; array[at] = local.x; array[at + 1] = local.y; array[at + 2] = local.z;
          array[at + 3] = local2.x; array[at + 4] = local2.y; array[at + 5] = local2.z;
        }
        tail.geometry.attributes.position.needsUpdate = true;
        // r128 computeVertexNormals() allocates scratch vectors. Derive the
        // smooth ribbon normals directly in the existing typed array instead.
        var normal = tail.geometry.attributes.normal.array;
        for (ni = 0; ni < nodes; ni++) {
          var before = Math.max(0, ni - 1) * 6, after = Math.min(nodes - 1, ni + 1) * 6, base = ni * 6;
          var tx = array[after] - array[before], ty = array[after + 1] - array[before + 1], tz = array[after + 2] - array[before + 2];
          var wx = array[base + 3] - array[base], wy = array[base + 4] - array[base + 1], wz = array[base + 5] - array[base + 2];
          var nx = wy * tz - wz * ty, ny = wz * tx - wx * tz, nz = wx * ty - wy * tx;
          var inv = 1 / Math.max(0.000001, Math.sqrt(nx * nx + ny * ny + nz * nz));
          normal[base] = normal[base + 3] = nx * inv;
          normal[base + 1] = normal[base + 4] = ny * inv;
          normal[base + 2] = normal[base + 5] = nz * inv;
        }
        // Fringe follows the final tangent and inherits the ribbon's tip normal.
        var end = (nodes - 1) * 6, prior = end - 6;
        var dx = array[end] - array[prior], dy = array[end + 1] - array[prior + 1], dz = array[end + 2] - array[prior + 2];
        var norm = 1 / Math.max(0.0001, Math.sqrt(dx * dx + dy * dy + dz * dz));
        for (var fringe = 0; fringe < 6; fringe++) for (var corner = 0; corner < 4; corner++) {
          var fraction = (fringe + (corner % 2 ? 0.86 : 0.08)) / 6;
          var tassel = corner > 1 ? 0.013 + (fringe % 3) * 0.0025 : 0;
          var fa = nodes * 6 + fringe * 12 + corner * 3;
          array[fa] = array[end] + (array[end + 3] - array[end]) * fraction + dx * norm * tassel;
          array[fa + 1] = array[end + 1] + (array[end + 4] - array[end + 1]) * fraction + dy * norm * tassel;
          array[fa + 2] = array[end + 2] + (array[end + 5] - array[end + 2]) * fraction + dz * norm * tassel;
          normal[fa] = normal[end]; normal[fa + 1] = normal[end + 1]; normal[fa + 2] = normal[end + 2];
        }
        tail.geometry.attributes.normal.needsUpdate = true;
      }
      lastWorld.copy(rootWorld); scarfInitialized = true;
    }
    var currentAnim = "idle", animTime = 0, phase = Math.PI * 2 - 0.6, glow = 1, requestedGlow = 1, keyAngle = 0;
    var weights = new Float64Array(7), animTimes = new Float64Array(7), elapsed = 0; weights[0] = 1;
    var blinkClock = 0, nextBlink = 2.8, blinkAge = -1, air = 0;
    var stepEvents = [{ foot: "L" }, { foot: "R" }];
    var hero = { object3D: root, light: light, onStep: null,
      setAnim: function (name) {
        name = ANIMS.indexOf(name) < 0 ? "idle" : name;
        if (name !== currentAnim) {
          var index = ANIMS.indexOf(name);
          if (weights[index] < 0.001) animTimes[index] = 0;
          currentAnim = name; animTime = 0;
        }
      },
      setGlow: function (k) { if (Number.isFinite(k)) requestedGlow = Math.max(0, Math.min(2, k)); },
      update: function (dt, t, state) {
        if (disposed) return;
        dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        elapsed += dt; t = Number.isFinite(t) ? t : elapsed;
        var speed = state && Number.isFinite(state.speed) ? Math.abs(state.speed) : 1.4;
        var grounded = !state || state.grounded !== false;
        animTime += dt;
        var ease = 1 - Math.exp(-dt * 16), target = ANIMS.indexOf(currentAnim);
        for (var wi = 0; wi < 7; wi++) {
          weights[wi] += ((wi === target ? 1 : 0) - weights[wi]) * ease;
          animTimes[wi] += dt;
        }
        var walk = weights[1], climb = weights[2], celebrate = weights[3], bump = weights[4], ride = weights[5], wave = weights[6];
        var gait = (walk + climb) * Math.min(1, speed / 0.3);
        var oldContact = Math.floor((phase + climb * 0.9) / Math.PI);
        phase += dt * speed * Math.PI * 2 * (1 - climb * 0.2);
        var newContact = Math.floor((phase + climb * 0.9) / Math.PI);
        if ((currentAnim === "walk" || currentAnim === "climb") && grounded && speed > 0.01) {
          for (var contact = oldContact + 1; contact <= newContact; contact++) {
            if (typeof hero.onStep === "function") { try { hero.onStep(stepEvents[(contact + 1) % 2]); } catch (_) { /* Engine callbacks cannot break animation. */ } }
          }
        }
        air += ((grounded ? 0 : 1) - air) * ease;
        var s = Math.sin(phase + climb * 0.9), hop = Math.pow(Math.max(0, Math.sin(animTimes[3] * 5)), 2);
        hips.position.y = 0.222
          + celebrate * 0.048 * hop + wave * (0.005 + 0.004 * Math.sin(t * 5));
        torso.rotation.x = 0.09 * walk + 0.19 * climb;
        torso.rotation.z = gait * 0.025 * s + ride * Math.sin(t * 3) * 0.045 + bump * Math.sin(animTimes[4] * 22) * Math.exp(-animTimes[4] * 4) * 0.11;
        torso.scale.y = 1 + 0.008 * Math.sin(t * 2.6);
        var look = Math.sin(t * 0.69) * Math.pow(Math.max(0, Math.sin(t * 0.37)), 4);
        head.position.y = 0.32 + celebrate * 0.042 + gait * 0.003 * Math.cos(phase * 2);
        head.rotation.y = look * 0.5 * weights[0];
        head.rotation.z = bump * 0.28 + wave * 0.11 + ride * Math.sin(t * 2.4) * 0.04;
        head.rotation.x = bump * 0.12 - torso.rotation.x * 0.65;
        for (var li = 0; li < 2; li++) {
          var sideSign = li === 0 ? 1 : -1, swing = s * sideSign;
          legHips[li].rotation.x = -gait * swing * (0.72 + climb * 0.32) - air * 0.55 - ride * 0.38;
          legHips[li].rotation.z = sideSign * (ride * 0.13 + celebrate * 0.05);
          knees[li].rotation.x = gait * Math.max(0, swing) * (2.1 + climb * 0.6) + air * 1.1 + ride * 0.76;
          ankles[li].rotation.x = -legHips[li].rotation.x - knees[li].rotation.x;
          ankles[li].rotation.z = -legHips[li].rotation.z;
          shoulders[li].rotation.x = gait * swing * (0.65 + climb * 0.2) + Math.sin(t * 2 + li) * 0.035 - bump * (li ? 0.8 : 0.05);
          shoulders[li].rotation.z = sideSign * (0.18 + celebrate * 2.65 + ride * 0.85 + wave * (li ? 2.45 : 0) + bump * (li ? 0.9 : 0));
          elbows[li].rotation.x = -0.13 - gait * (0.2 + Math.max(0, -swing) * 0.25) - celebrate * 0.35 - bump * (li ? 0.8 : 0);
          elbows[li].rotation.z = wave * (li ? Math.sin(t * 9) * 0.5 - 0.3 : 0) + sideSign * celebrate * 0.25;
        }
        // Plant the lower sole analytically; the opposite knee supplies foot lift.
        // This also produces the 0.03-unit walking bob without floor penetration.
        var plantHeight = 0;
        for (li = 0; li < 2; li++) {
          var hipX = legHips[li].rotation.x, kneeX = knees[li].rotation.x;
          var reach = (0.085 * Math.cos(hipX) + 0.071 * Math.cos(hipX + kneeX)) * Math.cos(legHips[li].rotation.z) + 0.066;
          plantHeight = Math.max(plantHeight, reach);
        }
        hips.position.y += (plantHeight - 0.222) * Math.min(1, gait + ride) * (1 - air);
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
        var flameSize = (0.82 + glow * 0.18) * (1 + celebrate * 0.28);
        // A broad flare stays inside the glass, with breathing room below the cap.
        flame.scale.set(flameSize * (2 - flicker), Math.min(1.04, flameSize * flicker), Math.min(1.15, flameSize));
        flame.rotation.z = Math.sin(t * 11) * 0.025 + gait * s * 0.03;
        outer.scale.x = 1 + Math.sin(t * 13) * 0.025;
        tongue.scale.y = 1.03 + Math.sin(t * 19) * 0.025;
        flameMat.emissiveIntensity = 1.85 * (0.65 + glow * 0.35) * flicker;
        if (halo) { halo.scale.setScalar(1.1 * (0.85 + glow * 0.15)); halo.material.opacity = 0.75 * glow; }
        updateScarf(dt, t);
        temp.set(0, 0.105, 0).applyMatrix4(head.matrixWorld).applyMatrix4(rootInverse); light.position.copy(temp);
        light.intensity = 1.4 * glow * flicker;
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
