'use strict';
const {simulate}=require('./simulate.cjs');
const policies=['active','idle','investor','explorer'];
const seeds=[7,42,123,2026,65537];
const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*q)];
const range=a=>({min:Math.min(...a),p25:quantile(a,.25),median:quantile(a,.5),p75:quantile(a,.75),max:Math.max(...a)});
const groups=[];
for(const ref of ['c8a0af3',undefined])for(const policy of policies){
  const runs=seeds.map(seed=>simulate({duration:3600,seed,policy,ref}));
  groups.push({version:ref||'candidate',policy,seeds,
    stageAtMinutes:Object.fromEntries([15,30,60].map(min=>[min,range(runs.map(r=>r.milestones.filter(m=>m.atSeconds<=min*60).at(-1)?.stage||0))])),
    foundationSeconds:range(runs.map(r=>r.milestones.find(m=>m.stage>=4)?.atSeconds||3600)),
    goldenCoreSeconds:range(runs.map(r=>r.milestones.find(m=>m.stage>=8)?.atSeconds||3600)),
    injuries:range(runs.map(r=>r.injuries)),recipePurchases:range(runs.map(r=>r.purchases.recipes)),
    reachedFinalRealm:runs.filter(r=>r.final.S===59).length,
    samples:runs.map(r=>({seed:r.seed,injuries:r.injuries,purchases:r.purchases,snapshots:r.snapshots,final:r.final}))});
  process.stderr.write(`${ref||'candidate'} ${policy}: median 60-minute stage ${groups.at(-1).stageAtMinutes[60].median}\n`);
}
console.log(JSON.stringify({date:'2026-10-05',method:'Real production updateCore at 50ms steps. Canvas output omitted, no human playtest. Five fixed seeds per policy. Same policy across original and candidate. Minor timing differences can consume RNG in different order. Candidate metrics are initial evaluation targets, not retention predictions.',policies:{active:'4 clicks/sec, decisions each 2 seconds',idle:'First 30 seconds of clicks, then no clicks, decisions each 60 seconds',investor:'1 click/sec, decisions each 10 seconds, up to 80% spend on investment',explorer:'4 clicks/sec, decisions each 2 seconds, only 35% spend on investment'},groups},null,2));
