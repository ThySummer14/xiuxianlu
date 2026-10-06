'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createGame}=require('../tests/harness.cjs');
const baseline='7aa1ec7be1c3969680c1b3966b44e24c8faf21af';
let baselineObject=baseline;
try{execFileSync('git',['cat-file','-e',baseline],{stdio:'ignore'});}catch{baselineObject='9c57be0e312880b685662ff1e60bcbb39c1a3874';}
if(execFileSync('git',['rev-parse',`${baselineObject}^{tree}`],{encoding:'utf8'}).trim()!=='5e7c9aea6af510587630787c38b1378ad47ae101')throw new Error('Baseline source tree mismatch');
const old=Object.fromEntries(['platform','balance','draw','ui','audio','main'].map(n=>[n,execFileSync('git',['show',`${baselineObject}:assets/${n}.js`],{encoding:'utf8'})]));
function run(f,policy,seed,before){
 const g=createGame({fast:true,seed,save:{...f,level:f.floor,towerFloor:f.floor,towerBest:f.floor,mirrorChoice:policy==='calm-idle'?'calm':'',mirrorStage:1},source:before?(n)=>old[n]:undefined});
 g.api.enterTower('advance');g.api.setMonsterForTest(before?'fox':'mirrorfox');const start=g.state(),initial=g.api.snapshot().ph;let seconds=0,hits=0;
 for(let i=0;i<4000;i++){
  const s=g.state();if(s.dying||s.mode!=='tower')break;
  if(!before&&s.mirror?.enabled){if(policy==='ward-body')g.api.chooseMirrorTarget(!s.mirror.split||s.mirror.ward>0?'ward':'body');if(policy==='flame-body')g.api.chooseMirrorTarget(!s.mirror.split||s.mirror.flame>0?'flame':'body');if(policy==='body')g.api.chooseMirrorTarget('body');}
  if(!policy.includes('idle')&&i>0&&i%10===0){if(g.api.attack())hits++;}
  g.step(.05);seconds+=.05;
 }
 const s=g.state();g.api.persist();return {result:s.dying?'win':s.mode==='home'?'retreat':'timeout',seconds:+seconds.toFixed(2),healthLoss:+(initial-g.api.snapshot().ph).toFixed(2),stones:s.stones-start.stones,contrib:s.contrib-start.contrib,kills:g.save().kills||0,manualHits:hits};
}
function aggregate(rows){const q=(key,p)=>rows.map(x=>x[key]).sort((a,b)=>a-b)[Math.floor((rows.length-1)*p)];return {wins:rows.filter(x=>x.result==='win').length,n:rows.length,seconds:{p10:q('seconds',.1),median:q('seconds',.5),p90:q('seconds',.9)},healthLoss:{p10:q('healthLoss',.1),median:q('healthLoss',.5),p90:q('healthLoss',.9)},medianStones:q('stones',.5),medianKills:q('kills',.5),medianContrib:q('contrib',.5),medianHits:q('manualHits',.5)};}
const fixtures=[{name:'first mirror fox',floor:16,S:4,sj:4,ss:4},{name:'idle-ready first encounter',floor:16,S:6,sj:4,ss:4},{name:'first natural mirror boss',floor:20,S:12,sj:4,ss:4},{name:'established cultivator',floor:26,S:8,sj:8,ss:8},{name:'controlled boss',floor:30,S:14,sj:12,ss:12},{name:'veteran',floor:46,S:22,sj:20,ss:20}];
const results=[];for(const fixture of fixtures)for(const policy of ['idle','auto-2hz','ward-body','flame-body','body','calm-idle']){
 const after=Array.from({length:20},(_,i)=>run(fixture,policy,Math.imul(i+1,0x9e3779b1)>>>0,false));const before=Array.from({length:20},(_,i)=>run(fixture,policy,Math.imul(i+1,0x9e3779b1)>>>0,true));results.push({fixture,policy,before:aggregate(before),after:aggregate(after)});if(global.gc)global.gc();
}
const result={baseline:'7aa1ec7be1c3969680c1b3966b44e24c8faf21af',sourceTree:'5e7c9aea6af510587630787c38b1378ad47ae101',notes:['Production combat code,20 spaced deterministic seeds per case; one encounter, no purchases; seeds are imul(index+1,0x9e3779b1) unsigned.','Baseline forces an ordinary fox at the same floor; the boss case is controlled, not a promised natural spawn.','Manual input is2Hz. Auto clears flame,ward,body; other policies select the named first target and then attack the body.','Shadow health is redistributed from remaining body HP; resource rewards occur once per final body defeat.','This is combat simulation, not phone FPS or a whole-campaign balance claim.'],results};
fs.writeFileSync(path.join(__dirname,'../docs/mirror-study.json'),JSON.stringify(result,null,2)+'\n');
for(const r of results)console.log(`${r.fixture.name}/${r.policy}: wins ${r.before.wins}->${r.after.wins}/20; time ${r.before.seconds.median}->${r.after.seconds.median}s; HP loss ${r.before.healthLoss.median}->${r.after.healthLoss.median}; stones ${r.before.medianStones}->${r.after.medianStones}`);
