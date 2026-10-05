'use strict';
const {simulate}=require('./simulate.cjs');
const {createGame}=require('../tests/harness.cjs');
const fs=require('node:fs');
const first=simulate({duration:18000,seed:42,stopAtStage:32,includeSave:true});
if(first.final.S<32)throw new Error('The first-life policy did not reach rebirth within the five-hour observation window.');
fs.mkdirSync('tests/fixtures',{recursive:true});
fs.writeFileSync('tests/fixtures/simulated-rebirth-save.json',JSON.stringify(first.save,null,2)+'\n');
const rows=[];
for(const legacyReward of [true,false]) {
  const g=createGame({save:first.save,fast:true});
  if(legacyReward)g.XB.daoJiGain=()=>1; // Isolate reward size; all other current mechanics are identical.
  const before=g.state().dj;g.api.rebirth();g.step(1);g.api.persist();
  const second=simulate({duration:7200,seed:42,stopAtStage:32,save:g.save()});
  rows.push({rewardModel:legacyReward?'old +1 foundation':'candidate +4 foundation',gain:g.state().dj-before,
    cultivationMultiplier:g.XB.daoJiMult(g.state().dj)/g.XB.daoJiMult(before),
    secondLifeElapsedSeconds:second.elapsedSeconds,secondLifeFinal:second.final,milestones:second.milestones,
    firstGoldenCoreSeconds:second.milestones.find(m=>m.stage>=8)?.atSeconds});
}
const noLuck=simulate({duration:3600,seed:42,noLuckyEvents:true});
const peaceful=simulate({duration:3600,seed:42,active:false});
console.log(JSON.stringify({date:'2026-10-05',method:'One deterministic first life and paired second lives with only Dao reward changed. Uses the real game. No free currency injected. No-luck case disables random crits, epiphanies and fate events via fixed high RNG; scheduled tides and deterministic equipment still occur. Peaceful case never enters the tower. This is not human playtesting or a retention estimate.',firstLife:{elapsedSeconds:first.elapsedSeconds,final:first.final,milestones:first.milestones},secondLives:rows,noLuck:{final:noLuck.final,milestones:noLuck.milestones},peaceful:{final:peaceful.final,milestones:peaceful.milestones}},null,2));
