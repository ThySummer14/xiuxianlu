'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGame,KEY}=require('./harness.cjs');
const fs=require('node:fs');
const fixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/simulated-rebirth-save.json'),'utf8'));
const scalarKeys=['stones','exp','S','sj','ss','ls','tn','dj','rb','bond','sgn','medRate','marketRate','clickDmg','dps','ph','contrib'];

test('experienced simulated save reloads without losing owned progress',()=>{
  const g=createGame({save:{...fixture,ts:1800000000000}});const s=g.state();
  for(const key of ['S','stones','sj','ss','ls','tn','dj','rb','bond','sgn','contrib'])assert.equal(s[key],fixture[key]);
  assert.deepEqual(Array.from(s.gf),fixture.gf);assert.deepEqual(Array.from(s.mk),fixture.mk);assert.deepEqual(JSON.parse(JSON.stringify(s.sectLv)),fixture.sectLv);
});
test('malformed numeric fields cannot turn production or combat into NaN or Infinity',()=>{
  const g=createGame({save:{S:2.5,stones:'Infinity',exp:'NaN',sj:'Infinity',ss:-5,ls:2.9,tn:{bad:1},dj:'Infinity',bond:'Infinity',sgn:'Infinity',contrib:'Infinity',gf:[Infinity,-1,3.5,'Infinity'],mk:[1.5,'Infinity',-10],mp:[999,-1],cmp:[Infinity,-8,999],sectLv:{dt1:'Infinity',dt2:-5,ts1:NaN}}});
  const s=g.state();for(const key of scalarKeys)assert.ok(Number.isFinite(s[key]),key+' must be finite');
  assert.equal(s.S,2);assert.equal(s.ls,2);assert.ok(!s.realmName.includes('undefined'));
  assert.ok(s.gf.every(Number.isInteger));assert.ok(s.mk.every(Number.isInteger));assert.ok(s.mp.every(x=>x>=0&&x<=7));
  g.step(4);assert.ok(!g.api.getSaveRaw().includes('Infinity'));
});
test('negative equipment and invalid mission structures are repaired safely',()=>{
  const g=createGame({save:{S:8,sectId:'dantang',eq:{sword:{name:'坏数据',power:-999,qIdx:99}},missions:[{kind:'unknown',need:'bad'}, {kind:'stone',base:0,need:1,contrib:'Infinity',stones:-7}]}});
  assert.ok(g.state().dps>0);for(const m of g.state().missions){assert.ok(m);assert.ok(['kill','floor','stone','shop','realm'].includes(m.kind));assert.ok(Number.isFinite(m.need));}
});
test('a pre-load backup keeps the original save before migration or repair',()=>{
  const g=createGame({save:{balanceVersion:0,S:12,stones:12345,exp:321}});
  const backup=JSON.parse(g.storage.get(KEY+'_backup'));
  assert.equal(backup.balanceVersion,0);assert.equal(backup.stones,12345);assert.equal(backup.exp,321);
});


test('large but finite earned linear levels are preserved instead of resetting a veteran',()=>{
  const g=createGame({save:{S:50,tn:1200,ls:800,gf:[900,500,800,400,700,500,300],sectLv:{dt1:600},stones:1e40}});
  assert.equal(g.state().tn,1200);assert.equal(g.state().gf[0],900);assert.equal(g.state().ls,800);assert.equal(g.state().sectLv.dt1,600);
  assert.equal(g.state().stones,1e40);for(const key of scalarKeys)assert.ok(Number.isFinite(g.state()[key]),key);
});
