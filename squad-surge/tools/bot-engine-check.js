#!/usr/bin/env node
"use strict";
// CPU contract checks. Run from repository root with THREE_LOCAL pointing to Three r128.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function fixture(withEnemies=true){
 let src=fs.readFileSync('tools/check-tactics.js','utf8').split('const H=sandbox.H,events=[];')[0].replace(/^#!.*\n/,'');
 src=src.replace('performance:{now:()=>10000}',"performance:require('perf_hooks').performance");
 src=src.replace('ctx,startLevel,setState,step,','ctx,enemy,hitEnemy,win,lose,startLevel,setState,step,'+('fixedStep,advanceClock,stateHash,playReplay,get replay(){return replay},get profile(){return profileSnapshot()},goMission,updateBullets,killSoldiersInCircle,registerBoss,spawnEnemy,'));
 const s=new Function('require',src+'\nreturn sandbox;')(require);
 {for(const file of ['js/enemies.js','js/campaign.js'])vm.runInContext(fs.readFileSync(file,'utf8'),s);if(withEnemies)s.Enemies.setup(s.H.ctx);}return s;
}
(async()=>{
 let s=fixture(),H=s.H;await H.goMission('c2m1');assert(H.L.enemies.some(e=>e.type==='shieldbearer'));assert.equal(H.L.soldiers.length,H.L.mission.start);assert(H.L.noBoss);
 H.ctx.addSoldiers(1000);assert.equal(H.L.soldiers.length,300);
 H.L.soldiers.length=0;H.ctx.addSoldiers(4);H.L.soldiers.forEach((s,i)=>{s.x=i<2?-3:3;s.z=0;});assert.equal(H.killSoldiersInCircle(-3,0,1,8,'bomber'),2);assert.equal(H.L.missionState.causes.bomber,2);
 H.L.soldiers[0].specialist='defender';H.L.soldiers[0].armor=1;const before=H.L.soldiers.length;H.ctx.killSoldiersInRect(2,4,-1,1,1,'rifleman');assert.equal(H.L.soldiers.length,before);assert.equal(H.L.soldiers[0].armor,0);
 // Nearest hit must win over category ordering. Enemy in front of solid.
 H.L.enemies=[];H.L.solids=[];H.L.gates=[];const e=H.spawnEnemy('grunt',0,-2,{hp:100});const o=H.ctx.spawnSolid('crate',0,-4,100);H.L.bullets.length=0;H.L.bullets.push({x:0,z:0,vx:0,life:1,dmg:10,splash:0,pierce:0});H.updateBullets(.1);assert.equal(e.hp,90);assert.equal(o.hp,100);
 // Assist affects count and HP, is run-only, and cannot earn the skill star.
 await H.goMission('c3m1');const n=H.L.enemies.length,hp=H.L.enemies[0].hp;await H.goMission('c3m1',{assist:2});assert(H.L.enemies.length<n);assert(H.L.enemies[0].hp<hp);assert(H.L.solids.some(o=>o.kind==='airdrop'&&o.z===-18));await H.ctx.restartSame();assert.equal(H.L.missionState.assisted,0);
 let offers=[];H.bus.on('assistOffer',e=>offers.push(e.level));for(let i=0;i<4;i++){await H.goMission('c2m1');H.lose();}assert.deepEqual(offers,[1,2]);assert.equal(H.save.campaign.c2m1.consecutiveFails,4);
 // Replay must reproduce the same tick hash even after another attempt.
 await H.goMission('c3m2');for(let t=0;t<300;t++){if(t%30===0)H.ctx.usePowerup(t%60?1:0);H.L.targetX=Math.sin(t/60)*3;H.fixedStep();}const record=JSON.parse(JSON.stringify(H.replay)),hash=H.stateHash();await H.playReplay(record);for(let i=0;i<300;i++)H.fixedStep();assert.equal(H.stateHash(),hash,'same-seed replay hash');
 // Fixed wall steps give identical gameplay across 30/60/120 Hz rendering.
 const hashes=[];for(const hz of [30,60,120]){const s=fixture(),h=s.H;await h.goMission('c1m2');for(let i=0;i<hz*10;i++)h.advanceClock(1/hz);hashes.push(h.stateHash());}assert.equal(new Set(hashes).size,1,'render-rate independence');
 console.log('PASS: authored waves, squad cap, geometric contacts, defender armor, nearest hit, Assist/reset/offers, same-seed replay, 30/60/120 Hz hashes.');
 // Presentation must not move soldiers, advance combat clocks, or change the replay hash.
 vm.runInContext(`
   TEX.soldier=TEX.grunt=TEX.fx=new THREE.Texture();
   layers={sold:new SpriteLayer(TEX.soldier,4,2,700),enem:new SpriteLayer(TEX.grunt,4,2,900),brute:new SpriteLayer(TEX.grunt,4,2,100),boss:new SpriteLayer(TEX.grunt,3,2,4),fx:new SpriteLayer(TEX.fx,4,4,1400,{additive:true}),shadow:new ShadowLayer(1500)};
   createSpecialistLayers();window.drawTest=render;
 `,s);
 const beforeRender=H.stateHash();s.drawTest(1/30);s.drawTest(1/120);assert.equal(H.stateHash(),beforeRender);
 // A failed registered sheet uses the grunt atlas and a visible tint.
 vm.runInContext(`THREE.TextureLoader.prototype.load=function(url,ok,p,fail){if(fail)fail();return new THREE.Texture();};registerEnemy('missing-sheet',{sheet:'missing.webp',tint:0xff8800});window.fallbackGrid=registeredLayers['missing-sheet'].mesh.material.uniforms.grid.value;`,s);
 assert.equal(s.fallbackGrid.x,4);assert.equal(s.fallbackGrid.y,2);
 // A stalled display executes at most five fixed steps; pause executes none.
 const catchup=fixture(),ch=catchup.H;await ch.goMission('c1m1');ch.advanceClock(2);assert(ch.L.tick<=5);const tick=ch.L.tick;ch.setState('paused');ch.advanceClock(2);assert.equal(ch.L.tick,tick);
 // Specialist piercing and legacy boss callbacks must not double the weak bonus.
 await H.goMission('c2m6');H.setState('boss');H.L.enemies=[];H.L.gates=[];H.L.solids=[];const boss=H.L.boss;boss.x=0;boss.z=-2;boss.weakT=1;boss._campaignEnemy.weak=1;
 H.L.bullets.length=0;H.L.bullets.push({x:0,z:0,vx:0,life:1,dmg:10,splash:0,pierce:0});const bossHP=boss.hp;H.updateBullets(.1);assert.equal(bossHP-boss.hp,25);
 console.log('PASS: render-only state invariance, missing sheet fallback, five-step catch-up cap, pause freeze, weak damage applied once.');

 // Every authored mission generates and advances without an error.
 s=fixture();H=s.H;for(const id of Object.keys(s.Campaign.missions)){await H.goMission(id);H.fixedStep();assert(Number.isFinite(H.L.sz));}
 console.log('PASS: 36 mission generation/first-tick smoke.');
 const missing=fixture(false);await missing.H.goMission('c6m6');missing.H.fixedStep();assert(missing.H.L.enemies.length>0);assert.equal(missing.H.L.boss.def,undefined);
 console.log('PASS: absent enemy module falls back to base units and boss.');
 // ARCADE and daily share the replay seed, including generated drops/barrels.
 for(const options of [{},{mode:'daily',seed:711,modifier:'horde'}]){
   H.startLevel(4,options);H.setState('play');for(let i=0;i<180;i++)H.fixedStep();const recording=JSON.parse(JSON.stringify(H.replay)),expected=H.stateHash();await H.playReplay(recording);for(let i=0;i<180;i++)H.fixedStep();assert.equal(H.stateHash(),expected);
 }
 console.log('PASS: ARCADE and daily replay seeds include procedural supplies.');
 await H.goMission('c1m6');H.setState('boss');H.L.boss.state='walk';H.collectPowerup('shield');H.bus.emit('enemyTelegraph',{type:'ogre',kind:'slam',x:0,z:H.L.sz});assert.equal(H.ctx.threat.counter,'shield');H.usePowerup(0);assert.equal(H.L.tactics.perfect,1);
 console.log('PASS: registered boss telegraphs preserve PERFECT counters.');
 await H.goMission('c5m6');H.setState('boss');H.L.enemies=[];H.L.gates=[];H.L.solids=[];H.L.bullets.length=0;
 const parent=H.L.boss._campaignEnemy;parent.split=true;parent.weak=1;H.L.boss.weakT=1;H.L.boss.x=1000;H.L.giantT=6;
 parent.half1=H.spawnEnemy('colossus_half',0,-2,{hp:1000});parent.half2=H.spawnEnemy('colossus_half',4,-2,{hp:1000});parent.half1._campaignEnemy.parent=parent;parent.half2._campaignEnemy.parent=parent;
 H.L.bullets.push({x:0,z:0,vx:0,life:1,dmg:10,splash:0,pierce:0});H.updateBullets(.1);assert.equal(parent.half1.hp,950);
 const halvesHP=parent.half1.hp+parent.half2.hp;H.damageBoss(100);assert(Math.abs(halvesHP-parent.half1.hp-parent.half2.hp-250)<1e-6);
 console.log('PASS: split boss halves retain GIANT/weak multipliers and receive boss area damage.');



})().catch(e=>{console.error(e);process.exitCode=1;});
