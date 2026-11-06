// Spirelight testbed: a minimal true-isometric three.js scene for testing one module on its own.
// Include three.min.js (and any examples/js you need) first, then this file, then your module, then:
//
//   Testbed.start({ height: 10, center: [0, 1, 0], bg: 0x241a3a, lights: true, grid: true }, (tb) => {
//     // tb.THREE, tb.scene, tb.camera, tb.renderer, tb.key (DirectionalLight), tb.hemi, tb.time
//     tb.scene.add(myObject);
//     tb.onFrame((dt, t) => { ... });      // per-frame callback
//     return promiseOrNothing;             // window.__ready becomes true after it settles (and 2 frames rendered)
//   });
//
// Camera: orthographic, looking along -(1,1,1) with +y up, exactly the game's projection (design.md section 4).
(function () {
  "use strict";
  const Testbed = {};
  Testbed.start = function (opts, setup) {
    opts = opts || {};
    const THREE = window.THREE;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block";
    document.body.style.margin = "0";
    document.body.style.background = "#000";
    document.body.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure || 1.0;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.bg != null ? opts.bg : 0x241a3a);
    const H = opts.height || 10, c = opts.center || [0, 0, 0];
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    camera.position.set(c[0] + 50, c[1] + 50, c[2] + 50);
    camera.up.set(0, 1, 0);
    camera.lookAt(c[0], c[1], c[2]);
    const tb = { THREE, scene, camera, renderer, canvas, time: 0, frames: [], onFrame(fn) { this.frames.push(fn); } };
    if (opts.lights !== false) {
      tb.hemi = new THREE.HemisphereLight(0xb9c7ff, 0x5a3a52, 0.55);
      scene.add(tb.hemi);
      tb.key = new THREE.DirectionalLight(0xffd2a0, 1.6);
      tb.key.position.set(c[0] - 12, c[1] + 20, c[2] + 8);
      tb.key.target.position.set(c[0], c[1], c[2]);
      tb.key.castShadow = true;
      tb.key.shadow.mapSize.set(2048, 2048);
      const s = tb.key.shadow.camera; s.left = -H; s.right = H; s.top = H; s.bottom = -H; s.near = 0.5; s.far = 80;
      tb.key.shadow.bias = -0.0005;
      scene.add(tb.key, tb.key.target);
    }
    if (opts.grid) {
      const g = new THREE.GridHelper(20, 20, 0x6a5a8a, 0x3a2f55);
      g.position.set(c[0], 0, c[2]);
      scene.add(g);
    }
    function resize() {
      const w = window.innerWidth, h = window.innerHeight, a = w / h;
      renderer.setSize(w, h, false);
      camera.left = -H * a / 2; camera.right = H * a / 2; camera.top = H / 2; camera.bottom = -H / 2;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();
    let last = performance.now(), rendered = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; tb.time += dt;
      for (const f of tb.frames) { try { f(dt, tb.time); } catch (e) { console.error(e); } }
      renderer.render(scene, camera);
      rendered++;
      requestAnimationFrame(frame);
    }
    window.Testbed.tb = tb;
    Promise.resolve().then(() => setup && setup(tb)).then(() => {
      requestAnimationFrame(frame);
      const wait = () => (rendered >= 2 ? (window.__ready = true) : requestAnimationFrame(wait));
      wait();
    }).catch(e => { console.error(e); window.__ready = true; window.__error = String(e && e.message || e); });
    return tb;
  };
  window.Testbed = Testbed;
})();
