"use strict";
// Campaign enemies. Registry callbacks own movement and attack clocks; no frame listener
// changes gameplay. setup() is safe before the optional registry/THREE seams exist.
window.Enemies = (() => {
  // Tuning: distances are metres, timers are simulation seconds, damage is HP.
  const TUNE = Object.freeze({
    lane: 3.4, laneHalf: 1.35, activeRange: 48, contactRadius: 0.65,
    shieldSide: 2.2, shieldAngle: 25 * Math.PI / 180,
    chargeWarn: 0.9, chargeTrigger: 18, chargeSpeed: 3, chargeCap: 8,
    fuse: 2.2, fuseRange: 9, blastRadius: 2.4, blastDamage: 30,
    rifleRange: 20, rifleWarn: 1, rifleCooldown: 2.6, rifleFraction: 0.03,
    healRate: 0.06, healRange: 24, healSearch: 0.25,
    bossWarn: 1.1, bossGap: 17, bossChargeSpeed: 24,
    bossChargeCap: 12, bossSlamCap: 10, bossBarrageFraction: 0.08,
    bossShieldDuration: 4.5, bossShieldCap: 6, bossOpeningDelay: 1.2,
    bossRadius: 2.1, bossHeight: 8,
    weakDuration: 1.4, weakMultiplier: 2.5, splitAt: 0.5,
    // Fixed mesh budget. If exhausted, new damaging telegraphs wait for a slot.
    telegraphs: 256, bossReserve: 12
  });
  // Per-archetype tuning: [HP, contact radius, sprite height, speed, contact loss, fallback tint].
  const ENEMY_DATA = {
    shieldbearer: [18, 0.65, 2.05, 2.1, 3, 0x8ecbff],
    charger: [10, 0.48, 1.8, 3.5, 2, 0xff7163],
    bomber: [7, 0.46, 1.65, 2.8, 0, 0xffb251],
    rifleman: [8, 0.44, 1.7, 2.5, 1, 0xc8a0ff],
    medic: [9, 0.44, 1.7, 2.6, 1, 0x75ffb1],
    splitter: [16, 0.65, 2.15, 2.5, 3, 0xd1a0ff],
    splitter_mini: [3, 0.26, 0.9, 5.2, 1, 0xe3baff],
    colossus_half: [700, 1.1, 4.5, 0, 0, 0xc4b5d3]
  };
  // Declarative phase tables: thresholds are descending remaining-HP fractions.
  const BOSS_DATA = {
    ogre: { name: "Ogre Warlord", hp: 900, tint: 0xe8ac78,
      phases: [{ at: 1, attacks: ["slam"], cadence: 2.6 },
        { at: 0.5, attacks: ["slam", "summon"], cadence: 1.9, summonType: "grunt", summons: 4 }],
      weak: { after: "slam", dur: TUNE.weakDuration, mult: TUNE.weakMultiplier } },
    bulwark: { name: "Iron Bulwark", hp: 1400, tint: 0x8ac9e4,
      phases: [{ at: 1, attacks: ["shieldWall", "slam"], cadence: 2.6 },
        { at: 0.5, attacks: ["shieldWall", "slam", "summon"], cadence: 2.0, summonType: "shieldbearer", summons: 2 }],
      weak: { after: "slam", dur: 1.4, mult: 2.5 } },
    ravager: { name: "Dune Ravager", hp: 1800, tint: 0xffb268,
      phases: [{ at: 1, attacks: ["charge"], cadence: 2.6, lanes: 1 },
        { at: 0.5, attacks: ["charge", "charge", "slam"], cadence: 1.9, lanes: 2 }],
      weak: { after: "charge", dur: 1.4, mult: 2.5 } },
    gunner: { name: "Harbor Gunner", hp: 2200, tint: 0x9cabed,
      phases: [{ at: 1, attacks: ["barrage", "summon"], cadence: 2.6, lanes: 1, summonType: "rifleman", summons: 2 },
        { at: 0.5, attacks: ["barrage", "barrage", "summon"], cadence: 2.0, lanes: 2, summonType: "rifleman", summons: 3 }],
      weak: { after: "barrage", dur: 1.4, mult: 2.5 } },
    colossus: { name: "Scrap Colossus", hp: 2800, tint: 0xc4b5d3,
      phases: [{ at: 1, attacks: ["slam", "shieldWall"], cadence: 2.6 },
        { at: 0.5, attacks: ["slam", "barrage"], cadence: 1.9, lanes: 2, entry: "split" }],
      weak: { after: "slam", dur: 1.4, mult: 2.5 } },
    warlord: { name: "The Warlord, Reborn", hp: 3600, tint: 0xff7c8a,
      phases: [{ at: 1, attacks: ["slam", "shieldWall", "summon"], cadence: 2.6, summonType: "shieldbearer", summons: 2 },
        { at: 0.66, attacks: ["charge", "barrage", "summon"], cadence: 2.2, lanes: 2, summonType: "rifleman", summons: 2 },
        { at: 0.33, attacks: ["shieldWall", "slam", "charge", "barrage", "summon"], cadence: 1.9, lanes: 2, summonType: "splitter", summons: 2 }],
      weak: { after: "slam", dur: 1.4, mult: 2.5 } }
  };
  const RED = 0xff4036, AMBER = 0xffad32, GREEN = 0x64ff9c;
  const CYAN = 0x62e8ff, GOLD = 0xffec73;
  const EMPTY = [];
  let C = null, pool = [], actors = [], definitions = [], subscribed = false;
  let built = false, serial = 0;
  const squadScratch = { x: 0, z: 0, count: 0, radius: 0, soldiers: EMPTY };
  const MINI_OPTIONS = { campaignChild: true };

  function number(n, fallback) { return typeof n === "number" && Number.isFinite(n) ? n : fallback; }
  function alive(e) { return !!e && e.hp > 0 && e.state !== "dead" && e.state !== "dying" && e.state !== "down"; }
  function level() { try { return C && C.L; } catch (_) { return null; } }
  function squad() {
    const l = level();
    // Older ctx.squad getters construct an object on every read. Reuse a view of
    // the existing level in that host; contract-only hosts supply ctx.squad directly.
    if (l && typeof l.sx === "number" && typeof l.sz === "number") {
      squadScratch.x = l.sx; squadScratch.z = l.sz;
      squadScratch.soldiers = l.soldiers || EMPTY; squadScratch.count = squadScratch.soldiers.length;
      squadScratch.radius = number(l.radius, 3);
      try {
        if (C && typeof C.squadRadius === "function") squadScratch.radius = C.squadRadius(squadScratch.count);
      } catch (_) { /* retain conservative fallback */ }
      return squadScratch;
    }
    try { return C && C.squad || null; } catch (_) { return null; }
  }
  // Never require a sibling module, and contain failures at each engine boundary.
  function rect(x0, x1, z0, z1, cap, cause) {
    try { return C && typeof C.killSoldiersInRect === "function" ? number(C.killSoldiersInRect(x0, x1, z0, z1, cap, cause), 0) : 0; } catch (_) { return 0; }
  }
  function circle(x, z, radius, cap, cause) {
    try { return C && typeof C.killSoldiersInCircle === "function" ? number(C.killSoldiersInCircle(x, z, radius, cap, cause), 0) : 0; } catch (_) { return 0; }
  }
  function damageArea(x, z, radius, damage) {
    try { if (C && typeof C.damageEnemiesInCircle === "function") C.damageEnemiesInCircle(x, z, radius, damage); } catch (_) { /* optional seam */ }
  }
  function spawn(type, x, z, opts) {
    try { return C && typeof C.spawnEnemy === "function" ? C.spawnEnemy(type, x, z, opts) : null; } catch (_) { return null; }
  }
  function emit(name, event) {
    try { if (C && C.bus && typeof C.bus.emit === "function") C.bus.emit(name, event); } catch (_) { /* optional bus */ }
  }
  function lane(x) { return x < -TUNE.lane / 2 ? -1 : x > TUNE.lane / 2 ? 1 : 0; }
  function bypass(b) {
    const l = level();
    return !!b && (!!b.splash || b.pierce > 0 || b.piercer || b.kind === "piercer" ||
      b.kind === "grenadier" || b.source === "airstrike" || b.source === "giant" || !!(l && l.giantT > 0));
  }

  // One shared quad geometry. Shader masks produce arrows, rings, lanes, shields,
  // tethers and glowing weak cores without rebuilding geometry or allocating FX.
  const VERT = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
  const FRAG = "uniform vec3 color;uniform float mode;uniform float progress;uniform float opacity;varying vec2 vUv;" +
    "void main(){vec2 p=vUv-0.5;float a=1.;float glow=1.;" +
    "if(mode<0.5){float edge=step(0.44,abs(p.x));a=0.18+0.72*edge;}" +
    "else if(mode<1.5){float shaft=step(abs(p.x),0.13)*step(vUv.y,0.70);float head=step(0.52,vUv.y)*step(abs(p.x),(1.-vUv.y)*0.95);a=max(shaft,head);}" +
    "else if(mode<2.5){float r=length(p)*2.;float angle=atan(p.x,p.y)/6.2831853+0.5;float ring=smoothstep(0.78,0.84,r)*(1.-smoothstep(0.94,1.,r));a=ring*(angle<progress?1.:0.20)+0.06*step(r,0.78);}" +
    "else if(mode<3.5){float edge=max(step(0.42,abs(p.x)),step(0.42,abs(p.y)));a=0.28+0.65*edge;}" +
    "else if(mode<4.5){a=1.-smoothstep(0.1,0.5,abs(p.x));glow=1.4;}" +
    "else{float r=length(p)*2.;a=(1.-smoothstep(0.1,1.,r))*(0.65+0.35*progress);glow=2.;}" +
    "gl_FragColor=vec4(color*glow,a*opacity);}";

  function buildPool() {
    if (built || !C || !C.telegraphGroup || typeof C.telegraphGroup.add !== "function") return;
    const t = C.THREE;
    if (!t || typeof t.PlaneBufferGeometry !== "function" || typeof t.ShaderMaterial !== "function" ||
        typeof t.Mesh !== "function" || typeof t.Color !== "function") return;
    try {
      const geo = new t.PlaneBufferGeometry(1, 1);
      for (let i = 0; i < TUNE.telegraphs; i++) {
        const material = new t.ShaderMaterial({
          uniforms: { color: { value: new t.Color(RED) }, mode: { value: 0 },
            progress: { value: 1 }, opacity: { value: 0.8 } },
          vertexShader: VERT, fragmentShader: FRAG, transparent: true,
          depthWrite: false, side: t.DoubleSide, toneMapped: false, fog: false
        });
        const mesh = new t.Mesh(geo, material);
        mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 9;
        C.telegraphGroup.add(mesh);
        pool.push({ mesh, owner: null });
      }
      built = true;
    } catch (_) { built = true; /* any successfully built slots remain usable */ }
  }
  function take(s, mode, color, boss) {
    const end = boss ? pool.length : Math.max(0, pool.length - TUNE.bossReserve);
    for (let i = 0; i < end; i++) {
      const p = pool[i];
      if (p.owner) continue;
      p.owner = s;
      const m = p.mesh, u = m.material.uniforms;
      u.mode.value = mode; u.color.value.set(color); u.progress.value = 1; u.opacity.value = 0.8;
      m.rotation.set(-Math.PI / 2, 0, 0); m.visible = true;
      return p;
    }
    return null;
  }
  function release(p) { if (p) { p.mesh.visible = false; p.owner = null; } }
  function releaseAttack(s) { release(s.a); release(s.b); s.a = s.b = null; }
  function cleanup(s) {
    releaseAttack(s); release(s.shield); release(s.marker); s.shield = s.marker = null;
    if (s.weak > 0) { s.weak = 0; s.e.weakT = 0; s.weakEvent.on = false; emit("bossWeak", s.weakEvent); }
  }
  function ground(p, x, z, width, depth, progress) {
    if (!p) return;
    const m = p.mesh;
    m.position.set(x, 0.08, z); m.scale.set(width, depth, 1);
    m.material.uniforms.progress.value = progress;
  }
  function laneVisual(p, x, z0, z1, arrow, progress) {
    ground(p, x, (z0 + z1) * 0.5, TUNE.laneHalf * 2, Math.max(1, Math.abs(z1 - z0)), progress);
    // Ground quad +Y points toward -Z after rotateX(-PI/2): reverse arrows toward squad (+Z).
    if (p) p.mesh.rotation.set(-Math.PI / 2, 0, arrow ? Math.PI : 0);
  }
  function shieldVisual(s, q) {
    if (!s.shield) s.shield = take(s, 3, CYAN, s.boss);
    if (!s.shield) return;
    const e = s.e, m = s.shield.mesh;
    const angle = Math.atan2(number(q.x, 0) - e.x, number(q.z, 0) - e.z);
    m.rotation.set(0, angle, 0);
    m.position.set(e.x + Math.sin(angle) * 0.55, s.baseH * 0.48, e.z + Math.cos(angle) * 0.55);
    m.scale.set(s.boss ? 4.2 : 1.6, s.boss ? 3 : 1.9, 1);
  }
  function signal(s, kind) {
    const ev = s.teleEvent;
    ev.kind = kind; ev.x = s.targetX; ev.z = s.targetZ;
    emit("enemyTelegraph", ev);
  }
  function makeState(e, type, boss) {
    if (!e || typeof e !== "object") return null;
    if (e._campaignEnemy) return e._campaignEnemy;
    const s = {
      e, type, boss: !!boss, id: ++serial, mode: "walk", timer: 0, cooldown: 0,
      age: 0, baseH: number(e.h, boss ? 9.5 : 1.7), speed: number(e.sp, 3),
      a: null, b: null, shield: null, marker: null, patient: null, search: 0,
      targetX: 0, targetZ: 0, z0: 0, z1: 0, lane1: 0, lane2: 9, safeLane: 0,
      losses: 0, detonated: false, dead: false, phase: -1, attackIndex: 0,
      attack: "", config: null, weak: 0, wall: 0, split: false, splitAttempted: false, half1: null, half2: null,
      parent: null, halfOptions1: { hp: 1, maxHp: 1 }, halfOptions2: { hp: 1, maxHp: 1 },
      teleEvent: { type, kind: "", x: 0, z: 0 },
      phaseEvent: { type, phase: 0 }, weakEvent: { on: false }
    };
    e._campaignEnemy = s;
    // Supported by registry implementations that retain generic movement/contact.
    e.manualMovement = true; e.noContact = true;
    actors.push(s);
    return s;
  }
  function liveState(e, type, boss) { return e && (e._campaignEnemy || makeState(e, type, boss)); }
  function active(e, q) { return alive(e) && q && e.z > number(q.z, 0) - TUNE.activeRange; }
  function walk(s, dt, q, contact) {
    const e = s.e, oldZ = e.z;
    e.state = "walk"; e.z += s.speed * dt;
    if (contact && rect(e.x - e.r, e.x + e.r, oldZ - e.r, e.z + e.r, e.dmg || 1, s.type) > 0) {
      enemyDeath(e); retire(s);
    }
    if (e.z > q.z + Math.max(16, number(q.radius, 0) + 3)) retire(s);
  }
  function retire(s) { s.e.hp = 0; s.e.state = "dead"; s.dead = true; cleanup(s); }
  function stop(s) { s.e.state = "idle"; }
  function detonate(s, early) {
    if (s.detonated) return;
    s.detonated = true;
    if (early) damageArea(s.e.x, s.e.z, TUNE.blastRadius, TUNE.blastDamage);
    else circle(s.e.x, s.e.z, TUNE.blastRadius, 1000000, "bomber");
  }
  function nearestPatient(s) {
    const l = level(); let best = null, distance = TUNE.healRange * TUNE.healRange;
    const boss = l && l.boss;
    if (alive(boss) && boss.state !== "wait" && !(boss._campaignEnemy && boss._campaignEnemy.split)) {
      const d = (boss.x - s.e.x) ** 2 + (boss.z - s.e.z) ** 2;
      if (d < distance) { best = boss; distance = d; }
    }
    const list = l && l.enemies ? l.enemies : EMPTY;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!alive(e) || (e.type !== "brute" && e.type !== "colossus_half")) continue;
      const d = (e.x - s.e.x) ** 2 + (e.z - s.e.z) ** 2;
      if (d < distance) { best = e; distance = d; }
    }
    // Registry-only hosts can still expose a boss through its init callback.
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i], e = a.e;
      if (!a.boss || a.split || !alive(e) || e.state === "wait") continue;
      const d = (e.x - s.e.x) ** 2 + (e.z - s.e.z) ** 2;
      if (d < distance) { best = e; distance = d; }
    }
    return best;
  }
  function enemyUpdate(e, dt) {
    const s = liveState(e, e && e.type, false), q = squad();
    if (!s || !active(e, q) || !(dt > 0)) { if (s && !alive(e)) cleanup(s); return true; }
    s.age += dt; s.cooldown = Math.max(0, s.cooldown - dt);
    const distance = q.z - e.z;
    if (s.type === "shieldbearer") {
      shieldVisual(s, q); walk(s, dt, q, true);
    } else if (s.type === "charger") {
      if (s.mode === "walk" && distance < TUNE.chargeTrigger && distance > 0) {
        s.a = take(s, 1, RED, false);
        if (s.a) {
          s.mode = "warn"; s.timer = TUNE.chargeWarn; s.targetX = e.x;
          s.targetZ = q.z; s.z0 = e.z; s.z1 = q.z + number(q.radius, 3) + 5;
          signal(s, "charge"); stop(s); e.h = s.baseH * 0.58; e.crouch = true;
          laneVisual(s.a, s.targetX, s.z0, s.z1, true, 0);
          return true; // The warning begins now; its first full dt is the next tick.
        } else { stop(s); return true; }
      }
      if (s.mode === "warn") {
        stop(s); e.h = s.baseH * 0.58; e.crouch = true;
        laneVisual(s.a, s.targetX, s.z0, s.z1, true, 1 - s.timer / TUNE.chargeWarn);
        s.timer -= dt;
        if (s.timer <= 0) { s.mode = "rush"; e.h = s.baseH; e.crouch = false; }
      } else if (s.mode === "rush") {
        e.state = "walk";
        const oldZ = e.z; e.z += s.speed * TUNE.chargeSpeed * dt;
        s.losses += rect(e.x - TUNE.contactRadius, e.x + TUNE.contactRadius,
          oldZ - e.r, e.z + e.r, Math.max(0, TUNE.chargeCap - s.losses), "charger");
        if (e.z >= s.z1) retire(s);
      } else walk(s, dt, q, true);
    } else if (s.type === "bomber") {
      if (s.mode === "walk" && distance <= TUNE.fuseRange && distance >= -TUNE.blastRadius) {
        s.a = take(s, 2, AMBER, false);
        if (s.a) {
          s.mode = "fuse"; s.timer = TUNE.fuse; s.targetX = e.x; s.targetZ = e.z; signal(s, "fuse");
          stop(s); ground(s.a, e.x, e.z, TUNE.blastRadius * 2, TUNE.blastRadius * 2, 1);
          return true;
        }
        else { stop(s); return true; }
      }
      if (s.mode === "fuse") {
        stop(s); ground(s.a, e.x, e.z, TUNE.blastRadius * 2, TUNE.blastRadius * 2, s.timer / TUNE.fuse);
        s.timer -= dt;
        if (s.timer <= 0) { detonate(s, false); retire(s); }
      } else walk(s, dt, q, false);
    } else if (s.type === "rifleman") {
      if (distance > TUNE.rifleRange) walk(s, dt, q, false);
      else {
        stop(s);
        if (s.mode !== "warn" && s.cooldown <= 0) {
          s.a = take(s, 0, RED, false);
          if (s.a) {
            s.mode = "warn"; s.timer = TUNE.rifleWarn; s.targetX = lane(q.x) * TUNE.lane;
            s.targetZ = q.z; s.z0 = e.z; s.z1 = q.z + number(q.radius, 3) + 8; signal(s, "laser");
            laneVisual(s.a, s.targetX, s.z0, s.z1, false, 0); return true;
          }
        }
        if (s.mode === "warn") {
          laneVisual(s.a, s.targetX, s.z0, s.z1, false, 1 - s.timer / TUNE.rifleWarn);
          s.timer -= dt;
          if (s.timer <= 0) {
            rect(s.targetX - TUNE.laneHalf, s.targetX + TUNE.laneHalf, s.z0, s.z1,
              Math.max(2, Math.floor(number(q.count, 0) * TUNE.rifleFraction)), "rifleman");
            releaseAttack(s); s.mode = "walk"; s.cooldown = TUNE.rifleCooldown;
          }
        }
      }
      if (distance < -number(q.radius, 3) - 8) retire(s);
    } else if (s.type === "medic") {
      s.search -= dt;
      if (s.search <= 0 || !alive(s.patient)) { s.patient = nearestPatient(s); s.search = TUNE.healSearch; }
      const p = s.patient;
      if (alive(p)) {
        if (!s.a) s.a = take(s, 4, GREEN, false);
        stop(s);
        if (s.a) {
          p.hp = Math.min(number(p.maxHp, p.hp), p.hp + number(p.maxHp, p.hp) * TUNE.healRate * dt);
          const dx = p.x - e.x, dz = p.z - e.z;
          ground(s.a, (e.x + p.x) / 2, (e.z + p.z) / 2, 0.24, Math.max(0.1, Math.hypot(dx, dz)), 1);
          s.a.mesh.position.y = 1.1; s.a.mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, -dz));
        }
      } else { releaseAttack(s); walk(s, dt, q, true); }
    } else if (s.type === "colossus_half") {
      stop(s); // Parent schedules both halves against one shared, safe-lane attack plan.
      if (s.parent && (!alive(s.parent.e) || s.parent.dead)) retire(s);
    } else walk(s, dt, q, true); // splitter and its small, fast mini
    return true;
  }
  function enemyBullet(e, b) {
    const s = e && e._campaignEnemy;
    if (!s || s.type !== "shieldbearer" || bypass(b)) return true;
    const q = squad(); if (!q) return true;
    const dx = Math.abs(q.x - e.x), dz = q.z - e.z;
    // Front is +Z. Moving >2.2m to the side exposes the body; the shield's
    // narrow +/-25 degree frontal cone also leaves close side/rear shots open.
    return dz <= 0 || dx > TUNE.shieldSide || Math.atan2(dx, dz) > TUNE.shieldAngle;
  }
  function enemyDeath(e) {
    const s = e && e._campaignEnemy;
    if (!s || s.dead) return;
    s.dead = true; cleanup(s);
    if (s.type === "bomber") detonate(s, true);
    if (s.type === "splitter") {
      for (let i = 0; i < 3; i++) spawn("splitter_mini", e.x + (i - 1) * 0.65, e.z - (i % 2) * 0.6, MINI_OPTIONS);
    }
  }

  function bossInit(e, type) {
    const s = makeState(e, type, true);
    if (s) { s.config = BOSS_DATA[type]; s.cooldown = TUNE.bossOpeningDelay; }
    return s;
  }
  function phaseFor(s) {
    const phases = s.config.phases, ratio = s.e.hp / Math.max(1, s.e.maxHp);
    let phase = 0;
    for (let i = 1; i < phases.length; i++) if (ratio <= phases[i].at) phase = i;
    if (s.phase !== phase) {
      s.phase = phase; s.attackIndex = 0; s.phaseEvent.phase = phase + 1;
      emit("bossPhase", s.phaseEvent);
    }
    return phases[phase];
  }
  function beginAttack(s, name, q, phase) {
    if (s.attack || s.weak > 0) return false;
    // For two lanes, reserve the adjacent lane closest to the squad. Never target
    // both neighboring exits while painting the squad's lane; dodge distance <= 3.4m.
    s.lane1 = lane(q.x);
    s.safeLane = s.lane1 === 0 ? (q.x < 0 ? -1 : 1) : 0;
    const twoHalves = !s.split || (alive(s.half1) && alive(s.half2));
    s.lane2 = (twoHalves && phase.lanes === 2 && (name === "charge" || name === "barrage" || (s.split && name === "slam"))) ? -s.lane1 - s.safeLane : 9;
    s.targetX = s.lane1 * TUNE.lane; s.targetZ = q.z;
    s.z0 = Math.min(s.e.z, q.z - TUNE.bossGap);
    s.z1 = q.z + number(q.radius, 3) + 6;
    const mode = name === "charge" ? 1 : name === "summon" || name === "split" ? 2 : 0;
    s.a = take(s, mode, name === "summon" || name === "split" ? AMBER : RED, true);
    if (!s.a) return false;
    if (s.lane2 !== 9) {
      s.b = take(s, mode, RED, true);
      if (!s.b) { releaseAttack(s); return false; }
    }
    s.attack = name; s.mode = "warn"; s.timer = TUNE.bossWarn; s.losses = 0;
    // Warning coordinates are immutable through the complete attack.
    drawBossAttack(s); signal(s, name);
    return true;
  }
  function drawBossAttack(s) {
    const progress = 1 - Math.max(0, s.timer) / TUNE.bossWarn;
    if (s.attack === "summon" || s.attack === "split") {
      ground(s.a, s.targetX, s.z0, 3.1, 3.1, progress);
    } else {
      laneVisual(s.a, s.targetX, s.z0, s.z1, s.attack === "charge", progress);
      if (s.b) laneVisual(s.b, s.lane2 * TUNE.lane, s.z0, s.z1, s.attack === "charge", progress);
    }
  }
  function weakWindow(s, attack) {
    if (s.config.weak.after !== attack || !alive(s.e)) return;
    release(s.shield); s.shield = null; s.wall = 0;
    s.weak = s.config.weak.dur; s.e.weakT = s.weak;
    s.marker = take(s, 5, GOLD, true);
    s.weakEvent.on = true; emit("bossWeak", s.weakEvent);
  }
  function finishAttack(s, phase) {
    const attack = s.attack;
    releaseAttack(s); s.attack = ""; s.mode = "walk";
    s.e.h = s.split ? 0 : s.baseH;
    s.e.crouch = false; s.cooldown = Math.max(phase.cadence, s.config.weak.dur);
    weakWindow(s, attack);
  }
  function hitBossLanes(s, cap, cause, z0, z1) {
    let killed = rect(s.targetX - TUNE.laneHalf, s.targetX + TUNE.laneHalf, z0, z1, cap, cause);
    if (s.lane2 !== 9 && killed < cap) killed += rect(s.lane2 * TUNE.lane - TUNE.laneHalf,
      s.lane2 * TUNE.lane + TUNE.laneHalf, z0, z1, cap - killed, cause);
    return killed;
  }
  function splitBoss(s) {
    if (s.split) return true;
    s.splitAttempted = true;
    const hp = Math.max(1, s.e.hp * 0.5);
    s.halfOptions1.hp = s.halfOptions1.maxHp = hp;
    s.halfOptions2.hp = s.halfOptions2.maxHp = hp;
    // Separate spawn options are retained by some hosts; never reuse between halves.
    s.half1 = spawn("colossus_half", -TUNE.lane, s.e.z, s.halfOptions1);
    s.half2 = spawn("colossus_half", TUNE.lane, s.e.z, s.halfOptions2);
    if (!s.half1 || !s.half2) {
      if (s.half1) { s.half1.hp = 0; s.half1.state = "dead"; }
      if (s.half2) { s.half2.hp = 0; s.half2.state = "dead"; }
      s.half1 = s.half2 = null; return false;
    }
    s.split = true;
    for (let i = 0; i < 2; i++) {
      const half = i === 0 ? s.half1 : s.half2;
      half.hp = half.maxHp = hp;
      const hs = liveState(half, "colossus_half", false);
      if (hs) hs.parent = s;
    }
    s.e.hidden = true; s.e.h = 0; s.e.scale = 0; s.e.renderScale = 0; s.e.r = 0;
    // h/scale are honoured by new registries. Moving the aggregate health carrier
    // off-road also works in hosts whose legacy boss renderer uses a fixed size.
    s.e.x = 1000;
    release(s.shield); s.shield = null;
    return true;
  }
  function executeAttack(s, q, phase) {
    const name = s.attack;
    if (name === "charge") {
      s.mode = "rush"; s.timer = 0; s.e.x = s.targetX; s.e.z = s.z0;
      return;
    }
    if (name === "slam") hitBossLanes(s, TUNE.bossSlamCap, "boss:slam", s.z0, s.z1);
    else if (name === "barrage") hitBossLanes(s, Math.max(3, Math.floor(q.count * TUNE.bossBarrageFraction)), "boss:barrage", s.z0, s.z1);
    else if (name === "summon") {
      const n = phase.summons || 3, type = phase.summonType || "grunt";
      for (let i = 0; i < n; i++) {
        const child = spawn(type, s.targetX + ((i % 3) - 1) * 0.65, s.z0 - 2 - Math.floor(i / 3) * 1.5, MINI_OPTIONS);
        // Give summons time to become readable before their first independent shot.
        if (child && child._campaignEnemy) child._campaignEnemy.cooldown = TUNE.rifleCooldown;
      }
    } else if (name === "shieldWall") {
      s.wall = TUNE.bossShieldDuration; shieldVisual(s, q);
      hitBossLanes(s, TUNE.bossShieldCap, "boss:shieldWall", s.z0, s.z1);
    } else if (name === "split") splitBoss(s);
    finishAttack(s, phase);
  }
  function bossUpdate(e, dt) {
    let s = e && e._campaignEnemy;
    if (!s && e && BOSS_DATA[e.type]) s = bossInit(e, e.type);
    const q = squad();
    if (!s || !s.config || !q || !(dt > 0) || !alive(e) || e.state === "wait") {
      if (s && !alive(e)) cleanup(s); return true;
    }
    s.age += dt;
    if (s.split) {
      e.hp = Math.max(0, number(s.half1 && s.half1.hp, 0)) + Math.max(0, number(s.half2 && s.half2.hp, 0));
      if (e.hp <= 0) {
        // Route victory through the engine's normal damage/down hook when present.
        try { if (C && typeof C.damageBoss === "function") { e.hp = 0.001; C.damageBoss(1); } } catch (_) { e.hp = 0; }
        cleanup(s); return true;
      }
    }
    const phase = phaseFor(s);
    s.wall = Math.max(0, s.wall - dt);
    if (s.wall > 0 && !s.split) shieldVisual(s, q);
    else { release(s.shield); s.shield = null; }
    if (s.weak > 0) {
      s.weak = Math.max(0, s.weak - dt); e.weakT = s.weak;
      if (s.marker) {
        const m = s.marker.mesh;
        const core = s.split ? (alive(s.half1) ? s.half1 : s.half2) : e;
        m.position.set(core.x, s.split ? 3.4 : s.baseH * 0.57, core.z + 0.6); m.scale.set(2.2, 2.2, 1);
        if (C.camera && C.camera.quaternion && m.quaternion && typeof m.quaternion.copy === "function") m.quaternion.copy(C.camera.quaternion);
        m.material.uniforms.progress.value = 0.5 + 0.5 * Math.sin(s.age * 12);
      }
      if (s.weak <= 0) { release(s.marker); s.marker = null; s.weakEvent.on = false; emit("bossWeak", s.weakEvent); }
    }
    if (!s.attack) {
      e.z = Math.min(e.z, q.z - TUNE.bossGap - number(q.radius, 0));
      s.cooldown -= dt;
      if (s.type === "colossus" && !s.splitAttempted && e.hp / e.maxHp <= TUNE.splitAt) {
        beginAttack(s, "split", q, phase);
      } else if (s.cooldown <= 0 && s.weak <= 0) {
        const name = phase.attacks[s.attackIndex % phase.attacks.length];
        if (beginAttack(s, name, q, phase)) s.attackIndex++;
      }
      return true;
    }
    if (s.mode === "warn") {
      if (s.attack === "charge" || s.attack === "slam") { e.h = s.split ? 0 : s.baseH * 0.78; e.crouch = true; }
      drawBossAttack(s); s.timer -= dt;
      if (s.timer <= 0) executeAttack(s, q, phase);
    } else if (s.mode === "rush") {
      const oldZ = e.z;
      e.z += TUNE.bossChargeSpeed * dt;
      s.losses += hitBossLanes(s, Math.max(0, TUNE.bossChargeCap - s.losses), "boss:charge", oldZ - 0.7, e.z + 0.7);
      if (e.z >= s.z1) { e.z = q.z - TUNE.bossGap - number(q.radius, 0); finishAttack(s, phase); }
    }
    return true;
  }
  function bossBullet(e, b) {
    const s = e && e._campaignEnemy;
    if (!s) return true;
    if (s.split) return false;
    if (s.wall > 0 && s.weak <= 0 && !bypass(b)) return false;
    // Apply extra damage to this target, never mutate a pooled/piercing projectile.
    if (s.weak > 0 && b) e.hp -= number(b.dmg, 0) * (s.config.weak.mult - 1);
    return true;
  }
  function halfBullet(e, b) {
    const s = e && e._campaignEnemy, parent = s && s.parent;
    if (parent && parent.weak > 0 && b) e.hp -= number(b.dmg, 0) * (parent.config.weak.mult - 1);
    return true;
  }
  function bossDeath(e) {
    const s = e && e._campaignEnemy;
    if (!s) return;
    s.dead = true; cleanup(s);
    if (s.split) { e.x = 0; e.z = s.half1 ? s.half1.z : e.z; }
    if (s.half1) { s.half1.hp = 0; s.half1.state = "dead"; }
    if (s.half2) { s.half2.hp = 0; s.half2.state = "dead"; }
  }

  // All exported callbacks are guarded once, at registration (no per-tick closures).
  function guarded(fn, fallback) {
    return function (a, b) { try { return fn(a, b); } catch (_) { return fallback; } };
  }
  function register(record) {
    const method = record.boss ? "registerBoss" : "registerEnemy";
    try {
      if (!C || typeof C[method] !== "function") return false;
      C[method](record.type, record.def); record.registered = true; return true;
    } catch (_) { return false; }
  }
  function addDefinition(type, hp, r, h, sp, dmg, tint, boss) {
    const fallback = boss || type === "shieldbearer" || type === "splitter" || type === "colossus_half" ? "assets/brute.webp" : "assets/grunt.webp";
    const record = { type, boss, registered: false, probed: false, def: null };
    const def = { sheet: fallback, fallbackSheet: fallback, cols: 4, rows: 2,
      hp, r, h, sp, dmg, scale: 1, tint, fallbackTint: tint,
      manualMovement: true, noContact: true,
      init: guarded(function (e) { return boss ? bossInit(e, type) : makeState(e, type, false); }, null),
      update: guarded(boss ? bossUpdate : enemyUpdate, true),
      onBullet: guarded(boss ? bossBullet : type === "colossus_half" ? halfBullet : enemyBullet, true),
      onDeath: guarded(boss ? bossDeath : enemyDeath, undefined)
    };
    if (boss) {
      const data = BOSS_DATA[type];
      def.name = data.name; def.phases = data.phases; def.weak = data.weak; def.attacks = {};
      const names = ["slam", "summon", "charge", "barrage", "shieldWall", "split"];
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        def.attacks[name] = guarded(function (e) {
          const s = e && e._campaignEnemy, q = squad();
          return !!s && !!q && beginAttack(s, name, q, phaseFor(s));
        }, false);
      }
    }
    record.def = def; definitions.push(record);
  }
  function defineAll() {
    if (definitions.length) return;
    const enemies = Object.keys(ENEMY_DATA);
    for (let i = 0; i < enemies.length; i++) {
      const type = enemies[i], d = ENEMY_DATA[type];
      addDefinition(type, d[0], d[1], d[2], d[3], d[4], d[5], false);
    }
    const keys = Object.keys(BOSS_DATA);
    for (let i = 0; i < keys.length; i++) {
      const type = keys[i], d = BOSS_DATA[type];
      addDefinition(type, d.hp, TUNE.bossRadius, TUNE.bossHeight, 0, 0, d.tint, true);
    }
  }
  function probe(record) {
    if (record.probed || typeof window.Image !== "function") return;
    record.probed = true;
    try {
      const img = new window.Image();
      img.onload = function () {
        if (!number(img.naturalWidth, img.width)) return;
        record.def.sheet = img.src; record.def.cols = record.boss ? 3 : 4;
        record.def.tint = 0xffffff; register(record);
      };
      // The already registered, correctly laid-out tinted fallback remains live.
      img.onerror = function () {};
      img.src = "assets/units2/" + record.type + ".webp";
    } catch (_) { /* optional browser image loader */ }
  }
  function refresh() {
    buildPool();
    for (let i = 0; i < definitions.length; i++) {
      const record = definitions[i];
      if (!record.registered) register(record);
      if (record.registered) probe(record);
    }
  }
  function reset() {
    const l = level(), enemies = l && l.enemies ? l.enemies : EMPTY;
    let n = 0;
    for (let i = 0; i < actors.length; i++) {
      const s = actors[i]; cleanup(s);
      // generate/missionStart may arrive AFTER the engine has called init on the
      // new roster. Retain those actors so their later telegraphs are reclaimed.
      if (alive(s.e) && l && (s.e === l.boss || enemies.indexOf(s.e) !== -1)) actors[n++] = s;
    }
    actors.length = n;
    for (let i = 0; i < pool.length; i++) release(pool[i]);
    refresh();
  }
  function sweep() {
    // No map/filter/splice/temporary payloads in simulation callbacks.
    let n = 0;
    for (let i = 0; i < actors.length; i++) {
      const s = actors[i];
      if (!alive(s.e)) { cleanup(s); continue; }
      actors[n++] = s;
    }
    actors.length = n;
    // Registries/group can arrive after setup, including when another module is absent.
    if (!built) buildPool();
    for (let i = 0; i < definitions.length; i++) if (!definitions[i].registered) register(definitions[i]);
  }
  function setup(ctx) {
    try {
      if (!ctx || (C && C !== ctx)) return;
      C = ctx; defineAll(); refresh();
      if (!subscribed && C.bus && typeof C.bus.on === "function") {
        subscribed = true;
        C.bus.on("generate", guarded(reset));
        C.bus.on("missionStart", guarded(reset));
        C.bus.on("tick", guarded(sweep));
        C.bus.on("enemyDie", guarded(function (ev) { if (ev && ev.e) enemyDeath(ev.e); }));
        C.bus.on("bossDown", guarded(function (ev) { if (ev && ev.boss) bossDeath(ev.boss); }));
        C.bus.on("win", guarded(reset)); C.bus.on("lose", guarded(reset));
        C.bus.on("state", guarded(function (ev) { if (ev && (ev.to === "home" || ev.to === "levels")) reset(); }));
      }
    } catch (_) { /* Module is optional; a partial host must still boot. */ }
  }
  return { setup, tuning: TUNE, bosses: BOSS_DATA };
})();
