'use strict';
// Controlled first-enemy comparisons; real production stats, no upgrades mid-fight.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createGame}=require('../tests/harness.cjs');
const base='36626d3556f44ff01c655e302d34f934448ee4e2';
const old=Object.fromEntries(['platform','balance','draw','ui','audio','main'].map(n=>[n,execFileSync('git',['show',`${base}:assets/${n}.js`],{encoding:'utf8'})]));
function run(fixture,policy,seed,before){
 const g=createGame({fast:true,seed,save:{...fixture,level:fixture.floor,towerFloor:fixture.floor,towerBest:fixture.floor,huntStage:1,wardCharges:policy==='ward-idle'?2:0},
  source:before?(n,src)=>old[n].replace('type: types[idx].id,',"type: 'shanxiao',"):undefined});
 g.api.enterTower('advance');if(!before)g.api.setMonsterForTest('shanxiao');
 const initial=g.api.snapshot().ph;let seconds=0,hits=0,interruptions=0,lastPhase='ready';
 for(let i=0;i<2400;i++){
  const s=g.state();if(i>0&&(s.dying||s.mode!=='tower'))break;
  if(i%10===0&&i>0&&(policy==='steady-2hz'||policy==='reactive'&&s.intent?.phase==='charging')){if(g.api.attack())hits++;}
  g.step(.05);seconds+=.05;const phase=g.state().intent?.phase;
  if(phase==='staggered'&&lastPhase!=='staggered')interruptions++;lastPhase=phase;
 }
 const s=g.state();return {seconds:+seconds.toFixed(2),healthLoss:+(initial-g.api.snapshot().ph).toFixed(2),remainingHp:+g.api.snapshot().ph.toFixed(2),result:s.dying?'win':s.mode==='home'?'retreat':'timeout',manualHits:hits,interruptions,wards:s.wardCharges||0};
}
const fixtures=[{name:'first Shanxiao',floor:6,S:0,sj:0,ss:0},{name:'next-floor lesson',floor:7,S:0,sj:1,ss:1},{name:'established cultivator',floor:12,S:4,sj:4,ss:4},{name:'controlled boss Shanxiao',floor:20,S:8,sj:8,ss:8},{name:'first natural Shanxiao boss',floor:40,S:18,sj:16,ss:16}];
function aggregate(rows){const q=(key,p)=>rows.map(x=>x[key]).sort((a,b)=>a-b)[Math.floor((rows.length-1)*p)];return {wins:rows.filter(x=>x.result==='win').length,n:rows.length,seconds:{p10:q('seconds',.1),median:q('seconds',.5),p90:q('seconds',.9)},healthLoss:{p10:q('healthLoss',.1),median:q('healthLoss',.5),p90:q('healthLoss',.9)},medianHits:q('manualHits',.5),medianInterruptions:q('interruptions',.5)};}
const results=[];for(const fixture of fixtures)for(const policy of ['idle','steady-2hz','reactive','ward-idle']){
 const after=Array.from({length:20},(_,i)=>run(fixture,policy,i+1,false));
 const before=['idle','steady-2hz'].includes(policy)?Array.from({length:20},(_,i)=>run(fixture,policy,i+1,true)):null;
 results.push({fixture,policy,before:before&&aggregate(before),after:aggregate(after)});
}
const result={baseline:base,notes:['Actual HP/attack/player stats; one controlled Shanxiao encounter, 20 RNG seeds per case.','Boss case forces the Shanxiao species onto real floor20 boss stats; it is a mechanics fixture, not a promised spawn.','Steady input is2 clicks/second; reactive input only supplies3 comfortably spaced hits during the warning.','Ward-idle starts with the one-off encounter reward of2 talismans; not available on every run.','First enemy only; these numbers are combat evidence, not a complete campaign balance claim.'],results};
fs.writeFileSync(path.join(__dirname,'../docs/monster-study.json'),JSON.stringify(result,null,2)+'\n');
for(const r of results)console.log(`${r.fixture.name} / ${r.policy}: ${r.before?`before ${r.before.wins}/20 wins, loss${r.before.healthLoss.median}; `:''}after ${r.after.wins}/20 wins, loss${r.after.healthLoss.median}, time${r.after.seconds.median}s, hits${r.after.medianHits}, breaks${r.after.medianInterruptions}`);
