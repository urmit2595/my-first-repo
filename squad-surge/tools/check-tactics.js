#!/usr/bin/env node
"use strict";
// Browser-free behavioral checks using the real inline simulation, Powerups and Obj3D.
// Stubs DOM, texture loading, PMREM and renderer only; does not validate pixels or GPU shaders.
// Run from the repository root:
//   THREE_LOCAL=/path/to/three-r128.min.js node tools/check-tactics.js
// The Playwright bot remains the authoritative browser balance check.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const THREE = require(process.env.THREE_LOCAL || 'three');
THREE.TextureLoader.prototype.load = function(url, cb) { const t = new THREE.Texture({width:128,height:128}); if(cb) cb(t); return t; };
const noop=()=>{};
const elements = new Map();
const paint = new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:t=>({width:t.length*10})}, {get:(o,k)=>o[k]||noop});
function el() { return {hidden:false,style:{},dataset:{},classList:{toggle:noop,add:noop,remove:noop},setAttribute:noop,appendChild:noop,remove:noop,addEventListener:noop,querySelector:()=>null,closest:()=>null,getBoundingClientRect:()=>({left:0,right:70,top:0,bottom:70}),getContext:()=>paint,clientWidth:390,clientHeight:780, firstElementChild:{hidden:true,src:''}}; }
const document={getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,addEventListener:noop};

const sandbox={console,THREE,document,Scenery:{build:noop,preload:async()=>{},update:noop},localStorage:{getItem:()=>JSON.stringify({sound:false,vibe:false}),setItem:noop},performance:{now:()=>10000},location:{search:''},devicePixelRatio:1,matchMedia:()=>({matches:true}),navigator:{},setTimeout:noop,clearTimeout:noop,addEventListener:noop,requestAnimationFrame:noop};
sandbox.window=sandbox;
THREE.PMREMGenerator = class { fromScene() { return {texture:new THREE.Texture()}; } dispose() {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/objects3d.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('js/powerups.js','utf8'),sandbox);
let src=fs.readFileSync('index.html','utf8').match(/<script>\s*"use strict";([\s\S]*?)<\/script>/)[1];
src=src.slice(0,src.indexOf('// ---------- boot ----------'));
src=src.replace('new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" })','({setPixelRatio(){},setSize(){},render(){},shadowMap:{enabled:false}})');
vm.runInContext(src+'\nwindow.H={ctx,startLevel,setState,step,fillSurge,updateTactics,collectPowerup,usePowerup,useSurge,liveThreat,announceThreat,endThreat,damageBoss,bossDown,finishLevel,breakSolid,fireRate,damage,get L(){return L},get state(){return state},save,bus}; Obj3D.setup(ctx); Powerups.setup(ctx);',sandbox);
const H=sandbox.H,events=[];for(const n of ['belt','powerupGot','swapOffer','swapDone','swapExpired','powerupUse','threat','threatLive','threatEnd','surgeReady','bank','win','tacticsCoach'])H.bus.on(n,d=>events.push([n,d]));
function start(l=2){H.startLevel(l);H.setState('play');events.length=0;}
start();H.collectPowerup('shield');H.collectPowerup('giant');assert.deepEqual(Array.from(H.ctx.belt),['shield','giant']);const before=H.L.soldiers.length;
H.collectPowerup('airstrike');H.L.time+=3.1;H.updateTactics(.01);assert.equal(H.L.soldiers.length,before+8);assert.equal(H.ctx.belt[0],'shield');
H.collectPowerup('airstrike');H.usePowerup(1);assert.equal(H.ctx.belt[1],'airstrike');assert.equal(H.ctx.tactics.used,0);
H.L.threats=[];H.L.enemies=[];H.L.solids=[];H.usePowerup(1);assert.equal(H.ctx.tactics.wasted,1);assert.equal(H.ctx.belt[1],null);
H.setState('paused');assert.equal(H.usePowerup(0),false);assert.equal(H.ctx.belt[0],'shield');H.setState('play');
start();H.fillSurge(1);assert(H.ctx.surgeReady);const uses=H.L.surges;H.L.idleT=10;H.step(.05);assert.equal(H.L.surge,1);assert.equal(H.L.surges,uses);
H.setState('boss');H.L.boss.z=H.L.sz-20;H.useSurge();assert.equal(H.ctx.surgeReady,false);assert.equal(H.L.tactics.surgePerfect,1);assert(events.some(e=>e[0]==='powerupUse'&&e[1].type==='surge'&&e[1].perfect));
start(3);const t=H.L.threats[0];H.L.sz=t.z+24;H.updateTactics(.01);assert.equal(H.ctx.threat.kind,'barricade');H.collectPowerup('giant');const score=H.L.score;H.usePowerup(0);assert.equal(H.L.score-score,900);assert.equal(H.L.tactics.perfect,1);assert.equal(H.L.combo,10);H.L.sz=t.z+10;H.updateTactics(.01);assert(t.actors.every(o=>!o.alive));assert(t.done);
start(4);const m=H.L.threats[0];H.ctx.addSoldiers(45);H.L.sz=m.z+24;H.updateTactics(.01);H.collectPowerup('shield');H.usePowerup(0);const protectedN=H.L.soldiers.length;for(let i=0;i<100;i++){H.L.sz-=.05*8.5;H.updateTactics(.05);}assert.equal(H.L.soldiers.length,protectedN);
start(4);H.setState('boss');H.L.boss.z=H.L.sz-14;H.collectPowerup('airstrike');const hp=H.L.boss.hp;H.usePowerup(0);assert(Math.abs(H.L.boss.hp-hp*.82)<1e-7);
start(3);H.collectPowerup('shield');H.collectPowerup('giant');H.setState('boss');H.damageBoss(H.L.boss.hp);assert.equal(H.L.bankBonus,1);assert.equal(H.ctx.tactics.banked,2);assert(H.ctx.belt.every(x=>x===null));H.finishLevel(3);assert.equal(H.L.mult,4);assert.equal(H.state,'win');H.finishLevel(3);assert.equal(H.L.mult,4);
for(let level=2;level<=8;level++){start(level);assert.equal(H.L.threats.length,level>=6?3:2);assert.equal(H.L.gates.filter(g=>g.halves.some(h=>h.powerup)).length,level>=3?1:0);for(let i=1;i<H.L.threats.length;i++)assert(H.L.threats[i-1].z-H.L.threats[i].z>80);}
console.log('PASS: belt/swap/expiry, paused input, WASTED, held SURGE, PERFECT rewards, GIANT wall smash, SHIELD mortars, 18% boss AIRSTRIKE, banking, threat spacing/tool gates.');
// Pure simulation smoke: actual core and power-up module, stubbing only DOM/graphics.
for(let level=1;level<=8;level++){start(level);for(let i=0;i<6000&&['play','boss'].includes(H.state);i++){const L=H.L;let target=0;for(const g of L.gates){if(g.used||g.z>L.sz||g.z<L.sz-30)continue;const val=h=>h.powerup?L.soldiers.length+8:h.op==='x'?L.soldiers.length*h.v:L.soldiers.length+h.v;target=val(g.halves[0])>val(g.halves[1])?g.halves[0].x:g.halves[1].x;break;}L.targetX=H.state==='boss'?(L.boss.slamT>1.5?(L.boss.x>0?-5:5):0):target;H.step(.05);}console.log(JSON.stringify({level,state:H.state,squad:H.L.bossSoldiers||H.L.soldiers.length,used:H.ctx.tactics.used,perfect:H.ctx.tactics.perfect}));assert.equal(H.state,'win');}

// The three introductory supplies must be on the belt before their first encounter,
// even if steering misses the crate. No button is pressed during this check.
for (const level of [2, 3, 4]) {
  start(level);
  const first = H.L.threats[0];
  for (let i = 0; i < 400 && !first.live && !first.done; i++) {
    H.L.targetX = 4.5; H.step(.05);
  }
  assert(first.live || first.done);
  assert(H.ctx.belt.includes(first.counter), `Level ${level} teaching counter missing`);
  assert(events.some(e => e[0] === 'tacticsCoach' && e[1].kind === first.counter));
}
// MISUSED gives no PERFECT score; repeat starts discard both offers and held SURGE.
start(3); H.L.sz = H.L.threats[0].z + 24; H.updateTactics(.01);
H.collectPowerup('shield'); const misuseScore = H.L.score; H.usePowerup(0);
assert.equal(H.ctx.tactics.misused, 1); assert.equal(H.L.score, misuseScore);
H.collectPowerup('shield'); H.collectPowerup('giant'); H.collectPowerup('airstrike'); H.fillSurge(1);
start(3); assert.equal(H.L.swap, null); assert.equal(H.ctx.surgeReady, false); assert(H.ctx.belt.every(x => x === null));
console.log('PASS: guaranteed teaching supplies/coaches, MISUSED classification, restart cleanup.');
// Bomb ticks must not secretly deal additional boss damage after the initial 18%.
start(4); H.setState('boss'); H.L.boss.z = H.L.sz - 14;
H.collectPowerup('airstrike'); H.usePowerup(0);
const afterStrike = H.L.boss.hp;
for (let i = 0; i < 70; i++) H.bus.emit('tick', { dt: .05, L: H.L, state: 'boss' });
assert.equal(H.L.boss.hp, afterStrike);
// The same bullet does exactly twice the boss damage while GIANT is active.
const bossHits = [];
for (const giant of [false, true]) {
  start(3); H.setState('boss'); H.L.boss.z = H.L.sz - 14;
  if (giant) H.ctx.setGiant(6);
  H.L.bullets.push({ x: 0, z: H.L.boss.z + 1, vx: 0, life: 1, dmg: 10, splash: 0, pierce: 0 });
  const hp = H.L.boss.hp; H.step(.02); bossHits.push(hp - H.L.boss.hp);
}
assert.deepEqual(bossHits, [10, 20]);
// Counter clears a dense SWARM; road threat losses stay bounded without a counter.
start(2); const swarm = H.L.threats[0]; H.L.sz = swarm.z + 24; H.updateTactics(.01);
H.collectPowerup('airstrike'); H.usePowerup(0);
for (let i = 0; i < 70; i++) H.bus.emit('tick', { dt: .05, L: H.L, state: 'play' });
assert(swarm.actors.filter(e => e.hp <= 0).length >= swarm.actors.length * .8);
start(4); const mortar = H.L.threats[0]; H.L.sz = mortar.z + 24; H.updateTactics(.01);
for (let i = 0; i < 130; i++) H.updateTactics(.05);
assert(mortar.done); assert(mortar.lost <= mortar.lossCap); assert(H.L.soldiers.length >= 3);
// Per-level label resources are disposed; old warning meshes detach on restart.
let disposed = false;
mortar.vis.sign.children[1].material.addEventListener('dispose', () => { disposed = true; });
start(2); assert(disposed); assert.equal(mortar.vis.sign.parent, null);
console.log('PASS: no extra boss splash, double GIANT damage, SWARM clearance, bounded losses, per-level visual disposal.');
