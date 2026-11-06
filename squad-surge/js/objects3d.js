"use strict";
// Obj3D: visuals of gates and shootable solids (blocks, crates, tyres, weapon cases, ammo boxes).
// See design/overhaul.md section 6. STUB: reproduces the original flat look.
window.Obj3D = (() => {
  let C = null;
  const SPEC = {
    blockBlue: { tex: "blockBlue", w: 2.1, h: 2.1 }, blockYellow: { tex: "blockYellow", w: 2.3, h: 2.3 },
    crate: { tex: "crate", w: 2.3, h: 2.2 }, tyres: { tex: "tyres", w: 1.7, h: 1.9 },
    ammo: { tex: "ammo", w: 2.0, h: 1.66 }, weaponCase: { tex: "weaponCase", w: 2.6, h: 1.85 },
  };
  const DEPTH = { blockBlue: 0x1f5fd6, blockYellow: 0xd99a00, crate: 0x7a4a22, tyres: 0x222222, ammo: 0x4a5a2a, weaponCase: 0x5c6a80 };

  function setup(ctx) { C = ctx; }
  function clear() { const t = C.track; while (t.children.length) t.remove(t.children[0]); }

  function gate(g) {
    const { THREE, track, ROAD, TEX } = C;
    for (const h of g.halves) {
      const plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(ROAD - 0.2, 3.2), new THREE.MeshBasicMaterial({ map: TEX.gateBlue, transparent: true, opacity: 0.88, depthWrite: false }));
      plane.position.set(h.x, 1.6, g.z); track.add(plane);
      const lab = C.makeLabel(256, 128);
      const lp = new THREE.Mesh(new THREE.PlaneBufferGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false }));
      lp.position.set(h.x, 1.7, g.z + 0.05); lp.renderOrder = 3; track.add(lp);
      const post = new THREE.Mesh(new THREE.BoxBufferGeometry(0.25, 3.4, 0.25), new THREE.MeshLambertMaterial({ color: 0xdfe6f2 }));
      post.position.set(h.side * (ROAD - 0.05), 1.7, g.z); track.add(post);
      h.vis = { plane, lab };
    }
    const mid = new THREE.Mesh(new THREE.BoxBufferGeometry(0.3, 3.4, 0.3), new THREE.MeshLambertMaterial({ color: 0xdfe6f2 }));
    mid.position.set(0, 1.7, g.z); track.add(mid);
  }
  function gateHalf(g, h, good, text) { h.vis.plane.material.map = good ? C.TEX.gateBlue : C.TEX.gateRed; C.drawLabel(h.vis.lab, text); }
  function gateUsed(g, half) { for (const h of g.halves) h.vis.plane.material.opacity = 0.35; }

  function solid(o) {
    const { THREE, track, TEX } = C, spec = SPEC[o.kind];
    const mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(spec.w, spec.h), new THREE.MeshBasicMaterial({ map: TEX[spec.tex], alphaTest: 0.5 }));
    mesh.position.set(o.x, spec.h / 2, o.z); track.add(mesh);
    const depth = new THREE.Mesh(new THREE.BoxBufferGeometry(spec.w * 0.92, spec.h * 0.92, 1.2), new THREE.MeshLambertMaterial({ color: DEPTH[o.kind] }));
    depth.position.set(o.x, spec.h / 2, o.z - 0.62); track.add(depth);
    const lab = C.makeLabel(256, 128);
    const lp = new THREE.Mesh(new THREE.PlaneBufferGeometry(spec.w * 0.95, spec.w * 0.47), new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false }));
    lp.position.set(o.x, o.kind === "weaponCase" || o.kind === "ammo" ? spec.h + 0.55 : spec.h * 0.5, o.z + 0.08); lp.renderOrder = 3; track.add(lp);
    o.vis = { mesh, depth, lp, lab, hitT: 0 };
  }
  function solidLabel(o, text, color) { C.drawLabel(o.vis.lab, text, color); }
  function solidHit(o) { o.vis.hitT = 0.06; }
  function solidBreak(o) { for (const m of [o.vis.mesh, o.vis.depth, o.vis.lp]) C.track.remove(m); }

  function update(dt) {
    const L = C.L; if (!L) return;
    for (const o of L.solids) if (o.alive && o.vis) { o.vis.hitT = Math.max(0, o.vis.hitT - dt); o.vis.mesh.scale.setScalar(o.vis.hitT > 0 ? 1.06 : 1); }
  }

  return { setup, clear, gate, gateHalf, gateUsed, solid, solidLabel, solidHit, solidBreak, update };
})();
