"use strict";
// Scenery: renderer colour pipeline, lights, sky, ground, road, roadside. See design/overhaul.md section 6.
// STUB: reproduces the original look so the game runs while the real module is written.
window.Scenery = (() => {
  let C = null; // ctx from index.html

  function skyTexture(top, bottom) {
    const c = document.createElement("canvas"); c.width = 4; c.height = 256; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    return new C.THREE.CanvasTexture(c);
  }
  function repeatTex(name, rx, ry) { const t = C.TEX[name].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = C.THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; }
  function windowTexture(color) {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
    x.fillStyle = color; x.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) { x.fillStyle = Math.random() < 0.3 ? "#1a1a1a" : "#3d4a5c"; x.fillRect(6 + k * 20, 8 + r * 24, 12, 15); }
    return new C.THREE.CanvasTexture(c);
  }

  function setup(ctx) {
    C = ctx;
    const { THREE, scene } = C;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-6, 14, 8); scene.add(sun);
  }

  function preload(theme) { return Promise.resolve(); }

  function build(theme, length) {
    const { THREE, scene, world, ROAD } = C;
    while (world.children.length) world.remove(world.children[0]);
    scene.background = skyTexture(theme.sky[0], theme.sky[1]);
    scene.fog = new THREE.Fog(theme.fog, 45, 150);
    C.setSpriteTint(0xffffff);
    const span = length + 140, cz = -length / 2 + 20;
    const ground = new THREE.Mesh(new THREE.PlaneBufferGeometry(220, span),
      theme.ground ? new THREE.MeshLambertMaterial({ map: repeatTex(theme.ground, 18, span / 12) }) : new THREE.MeshLambertMaterial({ color: theme.water }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, theme.ground ? -0.05 : -2.5, cz); world.add(ground);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxBufferGeometry(4, 0.4, span), new THREE.MeshLambertMaterial({ map: repeatTex(theme.side, 1, span / 4) }));
      side.position.set(s * (ROAD + 2.4), -0.18, cz); world.add(side);
      const rail = new THREE.Mesh(new THREE.BoxBufferGeometry(0.4, 0.55, span), new THREE.MeshLambertMaterial({ color: 0x8b93a3 }));
      rail.position.set(s * (ROAD + 0.25), 0.27, cz); world.add(rail);
    }
    const road = new THREE.Mesh(new THREE.PlaneBufferGeometry(ROAD * 2, span), new THREE.MeshLambertMaterial({ map: repeatTex(theme.road, 1.5, span / 8) }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, cz); world.add(road);
    if (!theme.ground) {
      for (let z = 10; z > -length - 60; z -= 22) for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxBufferGeometry(1.2, 6, 1.2), new THREE.MeshLambertMaterial({ color: theme.deco === "pier" ? 0x7a5a3a : 0x9aa3b5 }));
        p.position.set(s * (ROAD + 3.5), -3, z); world.add(p);
      }
    }
    const r = C.rng(length * 7 + 3);
    if (theme.deco === "city") {
      for (let z = 20; z > -length - 80; z -= 9 + r() * 8) for (const s of [-1, 1]) {
        if (r() < 0.25) continue;
        const h = 4 + r() * 9, w = 5 + r() * 4;
        const colors = ["#e9e2d4", "#c9b79c", "#d8c3a5", "#b8a08a", "#f1ece2"];
        const b = new THREE.Mesh(new THREE.BoxBufferGeometry(w, h, 6), new THREE.MeshLambertMaterial({ map: windowTexture(colors[Math.floor(r() * colors.length)]) }));
        b.position.set(s * (ROAD + 7 + w / 2 + r() * 6), h / 2 - 0.1, z); b.rotation.y = (r() - 0.5) * 0.3; world.add(b);
        if (r() < 0.3) {
          const car = new THREE.Mesh(new THREE.BoxBufferGeometry(2.2, 0.9, 1.3), new THREE.MeshLambertMaterial({ color: 0xd97a2b }));
          car.position.set(s * (ROAD + 4.8), 0.45, z + 4); car.rotation.set(0, r() * 2, r() < 0.5 ? Math.PI : 0.3); world.add(car);
        }
      }
    } else if (theme.deco === "bridge") {
      for (let z = 0; z > -length - 80; z -= 60) for (const s of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.BoxBufferGeometry(1.4, 22, 1.4), new THREE.MeshLambertMaterial({ color: 0xc8432f }));
        t.position.set(s * (ROAD + 3.2), 11, z); world.add(t);
      }
      for (const s of [-1, 1]) {
        const cable = new THREE.Mesh(new THREE.BoxBufferGeometry(0.15, 0.15, length + 120), new THREE.MeshLambertMaterial({ color: 0xc8432f }));
        cable.position.set(s * (ROAD + 3.2), 9, -length / 2); world.add(cable);
      }
    } else if (theme.deco === "desert") {
      for (let z = 20; z > -length - 80; z -= 6 + r() * 10) for (const s of [-1, 1]) {
        const h = 1.5 + r() * 2.5;
        const c = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.35, 0.4, h, 6), new THREE.MeshLambertMaterial({ color: 0x4f8a3a }));
        c.position.set(s * (ROAD + 5 + r() * 25), h / 2, z); world.add(c);
        if (r() < 0.2) { const rock = new THREE.Mesh(new THREE.DodecahedronBufferGeometry(1.5 + r() * 2), new THREE.MeshLambertMaterial({ color: 0xc08a55 })); rock.position.set(s * (ROAD + 10 + r() * 20), 0.5, z); world.add(rock); }
      }
    } else if (theme.deco === "arena") {
      for (const s of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 2.5, length + 140), new THREE.MeshLambertMaterial({ color: 0x5d6884 }));
        wall.position.set(s * (ROAD + 4.6), 1.1, cz); world.add(wall);
      }
    }
    if (theme.landmark === "tower") {
      const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0x8a6a55 });
      const l1 = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.6, 3.2, 22, 4, 1, true), m); l1.position.y = 11; g.add(l1);
      const l2 = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.15, 0.7, 20, 4), m); l2.position.y = 31; g.add(l2);
      const deck = new THREE.Mesh(new THREE.BoxBufferGeometry(5, 0.6, 5), m); deck.position.y = 8; deck.rotation.y = Math.PI / 4; g.add(deck);
      g.position.set(8, 0, -length - 70); g.scale.setScalar(1.6); world.add(g);
    }
  }

  function update(dt) {}

  return { setup, preload, build, update };
})();
