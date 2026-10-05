'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGame,KEY}=require('./harness.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-9),`${a} != ${b}`);

test('backgrounding the title screen never overwrites an existing character',()=>{
  const g=createGame({save:{S:20,stones:123456789,level:70,tn:30},noStart:true});
  const before=g.storage.get(KEY);g.show(3600);
  assert.equal(g.storage.get(KEY),before);assert.equal(g.state().scene,'title');
});
test('short returns retain fractional progress without an interrupting offline dialog',()=>{
  const g=createGame();const before=g.state();g.show(1);
  close(g.state().exp-before.exp,.5);assert.equal(g.state().modal,null);
});
test('a paused background frame cannot double-count production',()=>{
  const g=createGame({save:{S:8,mk:[10,2,0,0,0]}});const before=g.state();
  g.sandbox.XP._fireHide();g.step(30);assert.equal(g.state().exp,before.exp);assert.equal(g.state().stones,before.stones);
});
test('away recovery settles an injury once and returns with usable health',()=>{
  const g=createGame({save:{S:8,ph:0,injuryT:40,epipFrontier:99}});
  g.show(60);assert.equal(g.state().injuryT,0);assert.equal(g.state().ph,g.state().phMax);
  const once=g.state().exp;g.sandbox.XP._fireShow();assert.equal(g.state().exp,once);
});
test('invalid or backwards clock values never inject NaN into a save',()=>{
  const g=createGame();const snapshot=g.api.snapshot();
  for(const gap of [NaN,Infinity,-Infinity,-10])assert.equal(g.api.computeOffline(snapshot,gap),null);
});
test('reloading after reincarnation keeps the current frontier at floor one',()=>{
  const g=createGame({save:{S:32,level:120,towerFloor:120,towerBest:120,epip:5}});g.api.rebirth();g.step(1);
  const restored=createGame({save:g.save()});
  assert.equal(restored.state().S,0);assert.equal(restored.state().level,1);assert.equal(restored.state().towerBest,120);
  restored.api.enterTower('advance');assert.equal(restored.state().level,1);
});
test('offline recovery matches continuous home recovery without random/tide bonuses',()=>{
  const saved={S:4,injuryT:20,ph:30,epipFrontier:99,sectId:'dantang'};
  const g=createGame({save:saved});const b=g.state();const info=g.api.computeOffline(g.api.snapshot(),10);
  close(info.injuryRemaining,5);close(info.health,Math.min(b.phMax,30+b.phMax*.03*1.5*10));
  close(info.expGain,b.medRate*10);
});


test('an interrupted encounter choice returns after the offline receipt closes',()=>{
  const g=createGame();g.api.openFateEvent(0);assert.equal(g.state().modal,'fate');
  g.show(60);assert.equal(g.state().modal,'offline');g.api.dismissOffline();
  assert.equal(g.state().modal,'fate');g.api.fateOption(0);assert.equal(g.state().sgn,1);
});
test('many one-second absences preserve the same fractional rewards as one long absence',()=>{
  const a=createGame(),b=createGame();
  for(let i=0;i<20;i++)a.show(1);b.show(20);
  close(a.state().exp,b.state().exp);close(a.state().stones,b.state().stones);
});
test('a long tower absence returns home while a brief app switch preserves the encounter',()=>{
  const g=createGame({save:{level:5,towerFloor:5,towerBest:5,S:3}});g.api.enterTower();
  g.show(3);assert.equal(g.state().mode,'tower');
  g.show(60);assert.equal(g.state().mode,'home');assert.equal(g.state().level,5);
});
