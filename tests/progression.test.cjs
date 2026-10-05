'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
const close = (a, b, msg) => assert.ok(Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-10), `${msg}: ${a} != ${b}`);
const rich = { S: 16, level: 40, tn: 20, gf: [5,5,5,5,5,5,5], cmp: [30,30,30,30,30,30,30], mk: [20,10,5,1,0], mp: [3,2,1,0,0], dj: 10, bond: 8, epip: 5, sectId: 'dantang', sectLv: { dt1: 5, dt2: 5, ts1: 3, qy2: 3, wb2: 3 } };

test('new game can start, meditate, and save using the production scripts', () => {
  const g = createGame(); g.step(4);
  assert.equal(g.state().scene, 'play'); assert.ok(g.state().exp > 1.9);
  assert.equal(g.save().v, 3); assert.equal(g.state().errs.length, 0);
});
test('permanent epiphany and all-cultivation sect art affect online meditation', () => {
  const base = createGame({save:{S:8}}).state().medRate;
  const g = createGame({save:{S:8,epip:5,sectLv:{dt1:2,dt2:3}}});
  close(g.state().medRate, base * 1.25 * 1.24 * 1.24, 'all bonuses exactly once');
});
test('sect critical arts affect combat and still obey the critical cap', () => {
  const g = createGame({save:{S:10,sectLv:{qy2:3,wb2:4}}});
  close(g.state().critRate, .12, 'crit rate'); close(g.state().critMult, 7.8, 'crit damage');
  assert.equal(createGame({save:{sectLv:{wb2:100}}}).state().critRate, .5);
});
test('full reload and tab return award identical offline gains with all earned multipliers', () => {
  const g = createGame({save:rich});
  const reload = g.api.computeOffline({...rich,ts:1},3600);
  const resume = g.api.computeOffline(g.api.snapshot(),3600);
  close(reload.expGain, resume.expGain, 'experience'); close(reload.stoneGain, resume.stoneGain, 'stones');
  close(reload.expGain, g.state().medRate * 3600, 'offline rate equals no-tide online');
});
test('offline reward grows after two hours and caps at 24 hours', () => {
  const g = createGame({save:rich}); const snap=g.api.snapshot();
  const two=g.api.computeOffline(snap,7200), eight=g.api.computeOffline(snap,28800), day=g.api.computeOffline(snap,86400), long=g.api.computeOffline(snap,604800);
  assert.ok(eight.expGain>two.expGain); assert.ok(day.expGain>eight.expGain);
  assert.equal(day.expGain,long.expGain); assert.equal(day.stoneGain,long.stoneGain);
});
test('tab return counts earned stones toward missions and persists the awarded balance', () => {
  const g=createGame({save:rich}); const before=g.state(); const after=g.show(3600);
  close(after.accStones-before.accStones, after.offline.stoneGain, 'mission accounting');
  close(g.save().stones,after.stones,'immediate save');
});
test('maximum realm cannot advance beyond Dao Ancestor perfection', () => {
  const g=createGame({save:{S:59,exp:1e30}}); g.api.breakthrough();g.step(3);
  assert.equal(g.state().S,59);assert.equal(g.state().canBreak,false); assert.ok(!g.state().realmName.includes('undefined'));
});
test('rebirth animation never grants a free breakthrough and preserves permanent progress', () => {
  const g=createGame({save:{S:32,dj:4,epip:3,bond:6,sgn:8,sectId:'dantang',sectLv:{dt1:2}}});
  g.api.rebirth();g.step(1);
  const s=g.state();assert.equal(s.S,0);assert.equal(s.rb,1);assert.equal(s.epip,3);assert.equal(s.bond,6);assert.equal(s.sgn,8);assert.equal(s.sectLv.dt1,2);
  assert.ok(s.dj>4);assert.deepEqual(Array.from(s.mk),[0,0,0,0,0]);
});
test('shop-profit upgrades cannot pass their final tier even by repeated calls', () => {
  const g=createGame({save:{S:4,level:5,mk:[100,0,0,0,0],mp:[7,0,0,0,0],stones:1e30}});g.api.buyMarketProfit(0);g.api.buyMarketProfit(0);
  assert.equal(g.state().mp[0],7);
});
test('insight gift is capped at 35% of current stage after all multipliers', () => {
  const g=createGame({save:rich});g.api.enterTower();const rate=g.state().medRate;
  const reward=g.api.triggerFate(0);close(reward.exp,Math.min(rate*120,g.state().expNeed*.35),'gift');
});
test('old version-three saves keep currency, equipment, realm, sect, and shops', () => {
  const saved={...rich,stones:98765,exp:333,eq:{sword:{name:'良品精钢剑',power:45,qIdx:1}}};
  const g=createGame({save:saved});const s=g.state();assert.equal(s.S,saved.S);assert.equal(s.stones,98765);assert.equal(s.equip.sword,45);assert.equal(s.sectId,saved.sectId);assert.deepEqual(Array.from(s.mp),saved.mp);
});
test('tower combat pauses while an encounter choice is open', () => {
  const g=createGame();g.api.enterTower();g.api.openFateEvent(0);const hp=g.state().ph,monster=g.state().monsterHp;
  g.step(2);assert.equal(g.state().ph,hp);assert.equal(g.state().monsterHp,monster);
});


test('major breakthrough is stronger than a minor stage and restores combat readiness', () => {
  const g=createGame({save:{S:3,exp:1e7,ph:20}}); const old=g.state();
  g.tap('bt-break');g.step(2.5);
  const s=g.state();assert.equal(s.S,4);assert.equal(s.ph,s.phMax);
  close(g.XB.realmMult(4)/g.XB.realmMult(3),2.25,'realm burst');
  close(g.XB.realmMult(3)/g.XB.realmMult(2),1.3,'minor burst');
  assert.deepEqual(Array.from(g.XB.breakthroughPreview(3).unlocks),['太虚剑意']);
});
test('legacy balance migration preserves current breakthrough percentage and all banked experience', () => {
  const g=createGame({save:{balanceVersion:0,S:15,exp:12345,stones:98765}});
  close(g.state().exp/g.state().expNeed,12345/g.XB.legacyExpNeed(15),'progress fraction');
  assert.equal(g.state().stones,98765);assert.equal(g.state().S,15);
  g.step(4);assert.equal(g.save().balanceVersion,1);
});
test('a breakthrough never makes a shop recipe cost more or take longer to repay', () => {
  const B=createGame().XB;
  for(let S=0;S<59;S++) {
    const before=B.marketProfitCost(0,0,S),after=B.marketProfitCost(0,0,S+1);
    assert.equal(before,after);
    assert.ok(after/B.marketRate([4,0,0,0,0],S+1,1,1)<before/B.marketRate([4,0,0,0,0],S,1,1));
  }
});
test('temper mode loops cleared floors without inflating the frontier', () => {
  const g=createGame({save:{S:8,level:41,towerFloor:41,towerBest:41,sj:20,ss:20}});
  g.api.enterTower('temper');assert.equal(g.state().towerPlan,'temper');
  const initial=g.state().level;g.step(20);
  assert.equal(g.state().towerBest,41);assert.ok(g.state().level<=initial+4);
  g.api.leaveTower();assert.equal(g.state().level,41);
  g.api.enterTower('advance');assert.equal(g.state().level,41);
});
test('old tower saves restore the frontier after a temper run and reload', () => {
  const g=createGame({save:{S:12,level:31,towerBest:71,towerFloor:71,towerPlan:'temper'}});
  assert.equal(g.state().level,71);assert.equal(g.state().towerBest,71);
});
test('dying repeatedly at one wall cannot farm permanent epiphanies', () => {
  const g=createGame({save:{S:8,towerBest:30,level:30,epipFrontier:30}});
  for(let i=0;i<30;i++){g.api.hurtPlayer(1e12);g.step(41);}
  assert.equal(g.state().epip,0);
});
test('temper selection never includes an uncleared floor or boss', () => {
  const B=createGame().XB;
  for(let best=6;best<220;best++) {
    const start=B.temperStart(best,1000,5000);
    assert.ok(start+4<best);for(let f=start;f<start+5;f++)assert.notEqual(f%10,0);
  }
});
test('all playable realms and investment prices remain finite and positive', () => {
  const B=createGame().XB;
  for(let S=0;S<=B.MAX_STAGE;S++){assert.ok(Number.isFinite(B.expNeed(S)));assert.ok(B.expNeed(S)>0);assert.ok(Number.isFinite(B.realmMult(S)));}
  for(let i=0;i<5;i++)for(let n=0;n<100;n++)assert.ok(Number.isFinite(B.marketCost(i,n)));
});


test('a peaceful cultivator receives a working tea stall at Foundation Establishment', () => {
  const g=createGame({save:{S:3,exp:1000,level:1,towerBest:1}});g.tap('bt-break');g.step(2.5);
  assert.equal(g.state().S,4);assert.equal(g.state().mk[0],1);assert.ok(g.state().marketRate>0);
  g.api.addStones(100);g.api.buyMarket(0);assert.equal(g.state().mk[0],2);
});
test('upgrading during temper combat does not move the current five-floor loop onto a boss', () => {
  const g=createGame({save:{S:8,towerBest:90,level:90,towerFloor:90,ss:20}});g.api.enterTower('temper');
  const start=g.state().level;g.api.addStones(1e15);for(let i=0;i<25;i++)g.api.buy('ss');
  for(let i=0;i<30;i++){g.step(1);assert.ok(g.state().level>=start&&g.state().level<=start+4);assert.equal(g.state().isBoss,false);}
});
