'use strict';
const {simulate}=require('./simulate.cjs');
const {createGame}=require('../tests/harness.cjs');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/simulated-rebirth-save.json','utf8'));
const cadence=[];
for(const policy of ['active','idle'])for(const seed of [7,42,123])for(const renderEvery of [0,1]){
  const r=simulate({seed,policy,renderEvery,duration:3600});
  cadence.push({policy,seed,renderEvery,final:r.final,injuries:r.injuries,
    foundationSeconds:r.milestones.find(m=>m.stage>=4)?.atSeconds,
    goldenCoreSeconds:r.milestones.find(m=>m.stage>=8)?.atSeconds});
  process.stderr.write(`${policy}, seed ${seed}, render ${renderEvery}s: stage ${r.final.S}\n`);
}
const long=simulate({seed:42,duration:86400,renderEvery:1,includeSave:true});
assert.ok(long.final.S<=59);
const returns=[];
for(const gap of [60,7200,28800,86400,172800]) {
  const g=createGame({save:{...fixture,ts:1800000000000},fast:true});const before=g.state();
  g.show(gap);const info=JSON.parse(JSON.stringify(g.state().offline));
  const afterAward=g.state();const saved=g.save();
  const reloaded=createGame({save:saved,now:saved.ts,fast:true});
  assert.equal(reloaded.state().exp,afterAward.exp);assert.equal(reloaded.state().stones,afterAward.stones);
  g.api.dismissOffline();g.step(4);
  assert.ok(g.state().S<=35,'offline auto-progress must stop before crossing the next major realm gate');
  returns.push({gapSeconds:gap,award:info,stageAfterAutoProgress:g.state().S,
    bankedExperience:g.state().exp,nextThreshold:g.state().expNeed,
    duplicateReloadAward:false,health:g.state().ph,healthMax:g.state().phMax});
}
const last=returns.at(-1),day=returns.at(-2);assert.equal(last.award.expGain,day.award.expGain);
console.log(JSON.stringify({date:'2026-10-05',method:'Headless real production scripts. Render-cadence comparison executes the real UI state transitions once/second, while still stubbing drawing. Game randomness and visual shake share Math.random, so equal seeds can diverge when rendering cadence differs. Long session observes up to 24 simulated hours or the final realm. This is numerical/input validation, not browser visual QA.',cadence,long:{elapsedSeconds:long.elapsedSeconds,final:long.final,milestones:long.milestones,injuries:long.injuries},returns},null,2));
