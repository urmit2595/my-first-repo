#!/usr/bin/env node
"use strict";
// node tools/bot-campaign.js --missions c1m1-c6m6 --policies never,smart --runs 3
// Optional: --three /path/three.min.js --engine simulation (CPU fixture; no GPU claims).
const fs=require("fs"),path=require("path"),http=require("http"),vm=require("vm");
const ROOT=path.resolve(__dirname,"..");
const args={};for(let i=2;i<process.argv.length;i+=2){if(!process.argv[i+1])throw Error("Missing value: "+process.argv[i]);args[process.argv[i].replace(/^--/,"")]=process.argv[i+1];}
const runs=Number(args.runs||1),policies=(args.policies||"never,smart").split(","),engine=args.engine||"browser";
if(!Number.isInteger(runs)||runs<1||!policies.every(p=>["never","smart"].includes(p))||!["browser","simulation"].includes(engine))throw Error("Invalid runs, policy or engine");
const ordinal=id=>{const m=/^c([1-6])m([1-6])$/.exec(id);if(!m)throw Error("Invalid mission: "+id);return (+m[1]-1)*6+(+m[2]-1);};
const fromOrdinal=n=>`c${Math.floor(n/6)+1}m${n%6+1}`;
const range=args.missions||"c1m1-c6m6";
const missions=range.includes("-")?(()=>{const [a,b]=range.split("-").map(ordinal);if(b<a)throw Error("Reversed mission range");return Array.from({length:b-a+1},(_,i)=>fromOrdinal(a+i));})():range.split(",");missions.forEach(ordinal);
const local=args.three||process.env.THREE_LOCAL;if(local)process.env.THREE_LOCAL=path.resolve(local);
const mime={".html":"text/html",".js":"application/javascript",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg",".woff2":"font/woff2"};
const server=http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400);return res.end();}
  const file=path.resolve(ROOT,"."+(name==="/"?"/index.html":name));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
});
// This function is serialized into the browser/VM; all decisions use observed state.
async function installBot({id,policy,seed}) {
  const g=window.__game,C=g.ctx;
  g.setTestMode(true);
  let result=null;C.bus.on("missionEnd",d=>{result={...d};});
  await C.goMission(id,{assist:0});g.resetProfile();
  let random=seed>>>0,next=0;
  const rnd=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296);
  const warnings=[];C.bus.on("enemyTelegraph",t=>warnings.push({...t,until:g.L.time+(t.kind==="fuse"?2.3:1.25)}));
  function risk(x) {
    const L=g.L;let r=0;
    for(const e of L.enemies)if(e.hp>0&&L.sz-e.z<32&&L.sz-e.z>-4&&Math.abs(e.x-x)<1.8)r+=e.type==="rifleman"?5:e.type==="charger"||e.type==="bomber"?4:1;
    for(const h of L.hazards||[])if(!h.done&&Math.abs(L.sz-h.z)<24&&Math.abs(h.x-x)<1.8)r+=12;
    return r;
  }
  function decide(){
    const L=g.L;if(L.time<next)return;next=L.time+.12+rnd()*.12;
    let x=0,gate=null;
    for(const q of L.gates)if(!q.used&&q.z<L.sz&&q.z>L.sz-32&&(!gate||q.z>gate.z))gate=q;
    if(gate){
      const n=L.soldiers.length;
      const value=h=>{let v=h.powerup?n+(L.belt.includes(null)?9:2):h.recruit?n+(h.n||1)*3:h.rescue?n-(h.cost||0)+(L.mission.skill.id==="rescueAll"?10:0):h.op==="x"?n*h.v:n+h.v;
        if(policy==="smart"&&n<45)v-=risk(h.x)*3;return v;};
      x=value(gate.halves[0])>=value(gate.halves[1])?gate.halves[0].x:gate.halves[1].x;
    }
    if(policy==="smart"){
      if(!gate){
        const medics=L.enemies.filter(e=>e.hp>0&&e.type==="medic"&&L.sz-e.z<43&&e.z<L.sz).sort((a,b)=>b.z-a.z);
        if(medics.length)x=medics[0].x;
        else if(g.state==="boss"&&L.enemies.some(e=>e.type==="colossus_half"&&e.hp>0))x=L.enemies.find(e=>e.type==="colossus_half"&&e.hp>0).x;
        else {const shield=L.enemies.find(e=>e.type==="shieldbearer"&&e.hp>0&&L.sz-e.z<30&&e.z<L.sz);if(shield)x=shield.x>0?shield.x-3:shield.x+3;}
      }
      const danger=[];
      for(let i=warnings.length-1;i>=0;i--){if(warnings[i].until<L.time)warnings.splice(i,1);else danger.push({x:warnings[i].x,r: warnings[i].kind==="fuse"?2.8:1.6});}
      for(const e of [...L.enemies,L.boss]){
        const s=e._campaignEnemy;if(e.hp<=0||!s||!["warn","rush","fuse"].includes(s.mode))continue;
        danger.push({x:s.targetX,r:s.mode==="fuse"?2.8:1.6});if(s.lane2!==undefined&&s.lane2!==9)danger.push({x:s.lane2*3.4,r:1.6});
      }
      for(const h of L.hazards||[])if(!h.done&&h.warned&&Math.abs(L.sz-h.z)<18)danger.push({x:h.x,r:1.8});
      if(danger.some(d=>Math.abs(x-d.x)<d.r)){
        const lanes=[-4.8,-3.4,0,3.4,4.8];lanes.sort((a,b)=>{
          const score=p=>danger.reduce((v,d)=>v+(Math.abs(p-d.x)<d.r?100:0),0)+Math.abs(p-L.sx)+risk(p)*.2;
          return score(a)-score(b);
        });x=lanes[0];
      }
      const threat=C.threat,bs=L.boss._campaignEnemy;
      const counter=threat?.counter || (g.state==="boss"&&bs?.mode==="warn"?"shield":null);
      if(L.swap&&(!counter||L.swap.type===counter))C.usePowerup(L.belt[0]===counter?1:0);
      else if(counter&&L.belt.includes(counter))C.usePowerup(L.belt.indexOf(counter));
      else if(g.state==="boss"){const slot=L.belt.findIndex(t=>t==="airstrike"||t==="giant");if(slot>=0)C.usePowerup(slot);}
      if(C.surgeReady&&(threat||g.state==="boss"||L.enemies.filter(e=>e.hp>0&&L.sz-e.z<24).length>15))C.useSurge();
    }
    g.input("steer",x+(rnd()-.5)*.18);
  }
  window.__campaignBatch=(ticks=120)=>{
    for(let i=0;i<ticks&&["play","boss","bonus"].includes(g.state);i++){decide();g.advance(1);if(g.draw&&g.L.tick%60===0)g.draw();}
    const L=g.L;
    return {done:!!result,tick:L.tick,debug:L.tick>=18000?{state:g.state,squad:L.soldiers.length,x:L.sx,z:L.sz,boss:{hp:L.boss.hp,x:L.boss.x,z:L.boss.z,mode:L.boss._campaignEnemy?.mode},enemies:L.enemies.filter(e=>e.hp>0).map(e=>({type:e.type,hp:e.hp,x:e.x,z:e.z,mode:e._campaignEnemy?.mode}))}:null,result:result?{...result,chapter:L.mission.chapter,tag:L.mission.tag,hash:g.stateHash(),score:L.score,peak:L.peakSquad,profile:g.profile()}:null};
  };
}
function makeSimulation(){
  // Reuse the established DOM/texture fixture, without running its old balance assertions.
  let fixture=fs.readFileSync(path.join(ROOT,"tools/check-tactics.js"),"utf8").split("const H=sandbox.H,events=[];")[0].replace(/^#!.*\n/,"");
  fixture=fixture.replace("performance:{now:()=>10000}","performance:require('perf_hooks').performance");
  fixture=fixture.replace("ctx,startLevel,setState,step,", "ctx,stateHash,advanceTicks,advanceClock,resetProfile,profileSnapshot,setTestMode:v=>testMode=!!v,queueInput,startLevel,setState,step,");
  const sandbox=new Function("require",fixture+"\nreturn sandbox;")(require),H=sandbox.H;
  sandbox.__game={ctx:H.ctx,get L(){return H.L;},get state(){return H.state;},stateHash:H.stateHash,advance:H.advanceTicks,advanceClock:H.advanceClock,input:H.queueInput,setTestMode:H.setTestMode,profile:H.profileSnapshot,resetProfile:H.resetProfile};
  for(const file of ["js/enemies.js","js/campaign.js"])if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,"utf8"),sandbox);
  sandbox.Enemies?.setup(H.ctx);return sandbox;
}
let browser;
(async()=>{
  process.chdir(ROOT);const results=[];
  if(engine==="browser"){
    const {chromium}=require("playwright");await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
    browser=await chromium.launch({args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  }
  for(let run=0;run<runs;run++)for(const id of missions)for(const policy of policies){
    let context;const errors=[];
    try{
      const config={id,policy,seed:7301+ordinal(id)*173+run*697};let batch;
      if(engine==="simulation"){
        const sandbox=makeSimulation();await vm.runInContext(`(${installBot.toString()})(${JSON.stringify(config)})`,sandbox);
        batch=()=>sandbox.__campaignBatch(120);
      }else{
        context=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:1});const page=await context.newPage();
        page.on("pageerror",e=>errors.push(e.message));
        if(local)await page.route("**/three.min.js",r=>r.fulfill({path:path.resolve(local),contentType:"application/javascript"}));
        await page.addInitScript(()=>localStorage.setItem("squad-surge-v1",JSON.stringify({sound:false,vibe:false,level:1})));
        await page.goto(`http://127.0.0.1:${server.address().port}/index.html?hq`);await page.waitForFunction(()=>window.__game&&__game.state==="home",null,{timeout:60000});
        await page.evaluate(installBot,config);batch=()=>page.evaluate(()=>window.__campaignBatch(120));
      }
      let data;do{data=await batch();}while(!data.done&&data.tick<18000);
      if(!data.done)throw Error("Mission exceeded 300 simulation seconds: "+JSON.stringify(data.debug));
      const row={id,policy,run:run+1,engine,...data.result,errors};results.push(row);console.log(JSON.stringify(row));
    }catch(e){const row={id,chapter:Math.floor(ordinal(id)/6)+1,tag:ordinal(id)%6===5?"boss":ordinal(id)%6===4?"hard":"normal",policy,run:run+1,result:"ERROR",error:e.message,errors};results.push(row);console.error(JSON.stringify(row));process.exitCode=1;}
    finally{if(context)await context.close();}
  }
  const summary=(label,select)=>policies.map(policy=>{const all=results.filter(r=>r.policy===policy&&select(r)),r=all.filter(r=>r.result!=="ERROR");return {group:label,policy,wins:r.filter(r=>r.result==="win").length,attempts:r.length,errors:all.length-r.length,winRate:r.length?(100*r.filter(r=>r.result==="win").length/r.length).toFixed(1)+"%":"—",stars:r.length?(r.reduce((s,x)=>s+x.stars.filter(Boolean).length,0)/r.length).toFixed(2):"—"};});
  console.log("First-attempt results: fresh save, no Assist; errors excluded from win rates.");
  console.table([...["normal","hard","boss"].flatMap(t=>summary(t,r=>r.tag===t)),...Array.from({length:6},(_,i)=>summary("chapter "+(i+1),r=>r.chapter===i+1)).flat()]);
  const causes={};for(const r of results)if(r.result==="lose"){const k=r.policy+":"+r.cause;causes[k]=(causes[k]||0)+1;}console.log("Causes of loss",JSON.stringify(causes));
  if(results.some(r=>r.errors?.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
