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
  close(reload.expGain, Math.floor(g.state().medRate * 3600), 'offline rate equals no-tide online');
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
test('ten-minute insight gift applies Dao foundation and arts only once', () => {
  const g=createGame({save:rich});g.api.enterTower();const rate=g.state().medRate;
  const reward=g.api.triggerFate(0);close(reward.exp,rate*600,'gift');
});
test('old version-three saves keep currency, equipment, realm, sect, and shops', () => {
  const saved={...rich,stones:98765,exp:333,eq:{sword:{name:'良品精钢剑',power:45,qIdx:1}}};
  const g=createGame({save:saved});const s=g.state();assert.equal(s.S,saved.S);assert.equal(s.stones,98765);assert.equal(s.equip.sword,45);assert.equal(s.sectId,saved.sectId);assert.deepEqual(Array.from(s.mp),saved.mp);
});
test('tower combat pauses while an encounter choice is open', () => {
  const g=createGame();g.api.enterTower();g.api.openFateEvent(0);const hp=g.state().ph,monster=g.state().monsterHp;
  g.step(2);assert.equal(g.state().ph,hp);assert.equal(g.state().monsterHp,monster);
});
