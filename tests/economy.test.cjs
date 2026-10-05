'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-9),`${a} != ${b}`);

test('gold art and sect earning bonuses affect market income exactly once online and offline',()=>{
  const plain=createGame({save:{S:16,mk:[10,5,0,0,0],dj:8}});
  const boosted=createGame({save:{S:16,mk:[10,5,0,0,0],dj:8,gf:[0,0,0,3,0,0,0],cmp:[0,0,0,20,0,0,0],sectLv:{ts2:4}}});
  close(boosted.state().marketRate,plain.state().marketRate*1.36*1.1*1.4);
  close(boosted.api.computeOffline(boosted.api.snapshot(),3600).stoneGain,boosted.state().marketRate*3600);
});
test('tide doubles live market income but cannot be banked into offline rates',()=>{
  const g=createGame({save:{S:16,mk:[10,5,0,0,0]}});const before=g.state();g.api.triggerTide();
  close(g.state().marketRate,before.marketRate*2);close(g.state().medRate,before.medRate*3);
  close(g.api.computeOffline(g.api.snapshot(),3600).stoneGain,before.marketRate*3600);
});
test('money encounters scale with 45 seconds of earned production across every era',()=>{
  for(const S of [0,8,24,40,59]) {
    const g=createGame({save:{S,mk:[15,8,3,0,0],dj:4,gf:[3,3,3,3,3,3,3]}});
    const expected=g.state().marketRate*45;close(g.api.fateStoneReward(),expected);
    g.api.triggerTide();close(g.api.fateStoneReward(),expected);
  }
});
test('a cultivator without shops still gets a finite, useful starting windfall',()=>{
  const g=createGame();assert.ok(g.api.fateStoneReward()>=30);assert.ok(Number.isFinite(g.api.fateStoneReward()));
});
test('sword tide offers immediate cultivation versus permanent sword growth',()=>{
  const a=createGame(),b=createGame();a.api.openFateEvent(4);a.api.fateOption(0);
  b.api.openFateEvent(4);b.api.fateOption(1);
  assert.equal(a.state().sgn,1);assert.equal(a.state().tideLeft,0);
  assert.equal(b.state().sgn,0);assert.equal(b.state().tideLeft,b.XB.TIDE_DUR);
});
test('first rebirth grants an inspectable 48% permanent foundation reward',()=>{
  const g=createGame({save:{S:32}});assert.equal(g.XB.daoJiGain(32),4);g.api.rebirth();g.step(1);
  close(g.state().medRate,createGame().state().medRate*1.48);assert.equal(g.state().dj,4);
});
test('pushing another major realm has a clear larger rebirth payout',()=>{
  const B=createGame().XB;
  for(let S=32;S<=59;S++){assert.ok(B.daoJiGain(S)>=4&&B.daoJiGain(S)<=30);if(S<59)assert.ok(B.daoJiGain(S+1)>=B.daoJiGain(S));}
  for(let S=32;S<=52;S+=4)assert.equal(B.daoJiGain(S+4)-B.daoJiGain(S),3);
});
test('mission board gives different goals and excludes impossible final-realm breakthroughs',()=>{
  for(const S of [0,32,58,59]) {
    const g=createGame({save:{S,sectId:'dantang'}});
    for(let i=0;i<20;i++) {g.api.rollMissions();const kinds=g.state().missions.map(m=>m.kind);assert.equal(new Set(kinds).size,3);if(S>=58)assert.ok(!kinds.includes('realm'));}
  }
});
test('stone missions take meaningful production time and cannot finance themselves',()=>{
  const g=createGame({save:{S:40,mk:[40,30,20,10,5],mp:[4,3,2,1,0],sectId:'dantang'}});
  let job;
  for(let i=0;i<20&&!job;i++){g.api.rollMissions();g.api.persist();job=g.save().missions.find(m=>m.kind==='stone');}
  assert.ok(job);assert.equal(job.need,Math.round(g.state().marketRate*90));assert.ok(job.stones<=job.need*.2);
});
test('reincarnation renews mission goals for the new life while preserving contribution and arts',()=>{
  const g=createGame({save:{S:32,towerFloor:120,towerBest:120,level:120,sectId:'dantang',contrib:1234,sectLv:{dt1:5}}});
  g.api.rebirth();const s=g.state();assert.equal(s.contrib,1234);assert.equal(s.sectLv.dt1,5);
  assert.equal(s.missions.length,3);for(const m of s.missions)assert.ok(m.cur>=0);
});
test('monster age names progress at actual reachable tower milestones',()=>{
  const B=createGame().XB;
  assert.equal(B.monsterName('fox',false,44),'狐妖');assert.equal(B.monsterName('fox',false,45),'百年狐妖');
  assert.equal(B.monsterName('fox',false,90),'千年狐妖');assert.equal(B.monsterName('fox',true,150),'万年狐妖王');
  assert.equal(B.monsterName('fox',true,240),'太古狐妖王');
});
