#!/usr/bin/env node
"use strict";
// Browser profiling (orchestrator only):
// node tools/bot-engine-profile.js --before /path/to/baseline --after . --three /path/three.min.js
// A baseline directory can contain just index.html, js/objects3d.js and js/powerups.js;
// unchanged assets/modules fall back to --after. No browser is launched by the engine itself.
const fs=require('fs'),path=require('path'),http=require('http');
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
const after=path.resolve(args.after||path.join(__dirname,'..')),before=args.before&&path.resolve(args.before);
const roots={after,...(before?{before}:{})},local=args.three||process.env.THREE_LOCAL;
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 let parts;try{parts=decodeURIComponent(new URL(req.url,'http://localhost').pathname).split('/').filter(Boolean);}catch{res.writeHead(400);return res.end();}
 const root=roots[parts.shift()];if(!root){res.writeHead(404);return res.end();}
 const relative=parts.join('/')||'index.html';let file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file))file=path.resolve(after,relative);
 if(!file.startsWith(after+path.sep)&&!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
let browser;
(async()=>{
 const {chromium}=require('playwright');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 for(const version of before?['before','after']:['after']){
  const context=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:1});
  try{
   const page=await context.newPage();page.on('pageerror',e=>{console.error(e);process.exitCode=1;});
   if(local)await page.route('**/three.min.js',r=>r.fulfill({path:path.resolve(local),contentType:'application/javascript'}));
   await page.addInitScript(()=>localStorage.setItem('squad-surge-v1',JSON.stringify({sound:false,vibe:false,level:1})));
   await page.goto(`http://127.0.0.1:${server.address().port}/${version}/index.html?hq`);
   await page.waitForFunction(()=>window.__game&&__game.state==='home',null,{timeout:60000});
   const report=await page.evaluate(()=>{
    const g=window.__game;g.setTestMode?.(true);g.startLevel(4,{seed:4001});g.setState('boss');const L=g.L;
    L.soldiers.length=0;g.ctx.addSoldiers(300);L.boss.hp=0;L.rateMult=0;L.gates=[];L.solids=[];L.threats=[];L.threat=null;L.enemies=[];
    for(let i=0;i<400;i++){const e=window.enemy('grunt',(i%20-9.5)*.5,-10-Math.floor(i/20)*1.5,4);e.hp=e.maxHp=1e9;e.sp=0;e.state='walk';L.enemies.push(e);}
    let simMs=0,calls=0,triangles=0,frames=0,maxCalls=0;
    for(let tick=0;tick<600;tick++){
     if(tick%40===0){L.bullets.length=0;for(let j=0;j<480;j++)L.bullets.push({x:(j%40-19.5)*.25,z:0,vx:0,life:1,dmg:1,splash:0,pierce:0});}
     const t=performance.now();window.step(1/60);simMs+=performance.now()-t;
     if(tick%10===0){window.render(1/60);const r=g.ctx.renderer.info.render;calls+=r.calls;triangles+=r.triangles;frames++;maxCalls=Math.max(maxCalls,r.calls);}
    }
    return {steps:600,soldiers:300,enemies:400,bulletsPerVolley:480,simMs,meanSimMs:simMs/600,frames,meanCalls:calls/frames,maxCalls,meanTriangles:triangles/frames,memory:{...g.ctx.renderer.info.memory}};
   });console.log(JSON.stringify({version,...report}));
  }finally{await context.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
