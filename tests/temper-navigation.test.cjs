'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
function farmer(options={}){const g=createGame({...options,save:{S:20,level:26,towerFloor:26,towerBest:26,...options.save}});g.api.enterTower('temper');return g;}
function walk(g,goal,max=400){for(let i=0;i<max&&!goal();i++){g.step(.05);if(g.state().modal)g.api.closeModal();}assert.ok(goal());}

test('reported21–25 loop is farming only and never overwrites the saved26 frontier',()=>{
 const g=farmer(),seen=[g.state().level];for(let i=0;i<400&&!(seen.length>5&&seen.at(-1)===21);i++){g.step(.05);if(g.state().modal)g.api.closeModal();if(g.state().level!==seen.at(-1))seen.push(g.state().level);}
 assert.deepEqual(seen,[21,22,23,24,25,21]);g.api.persist();assert.equal(g.save().towerFloor,26);assert.equal(g.save().towerBest,26);assert.equal(g.state().towerPlan,'temper');
});
test('direct return resumes26 with existing health/resources, then progresses beyond the farming band',()=>{
 const g=farmer();g.api.hurtPlayer(g.state().phMax*.25);const before=g.state(),hp=g.api.snapshot().ph;
 assert.equal(g.api.resumeAdvance(),true);assert.equal(g.state().level,26);assert.equal(g.state().towerFloor,26);assert.equal(g.state().towerPlan,'advance');assert.equal(g.api.snapshot().ph,hp);
 for(const key of ['stones','exp','contrib','S','dj','rb','wardCharges'])assert.equal(g.state()[key],before[key]);
 walk(g,()=>g.state().level>=27);g.api.persist();const reloaded=createGame({save:g.save()});assert.equal(reloaded.state().level,27);assert.equal(reloaded.state().towerFloor,27);assert.equal(reloaded.state().towerPlan,'advance');
});
test('leaving, offline return and reentry preserve farming and challenge checkpoints separately',()=>{
 const g=farmer();g.show(60);assert.equal(g.state().mode,'home');assert.equal(g.state().level,26);assert.equal(g.state().towerFloor,26);g.api.closeModal();g.api.enterTower('temper');assert.equal(g.state().level,21);
 g.api.leaveTower();assert.equal(g.state().level,26);g.api.enterTower('advance');assert.equal(g.state().level,26);
});
test('switching while a farm enemy is half defeated grants no free kill and cannot repeatedly respawn challenge targets',()=>{
 const g=farmer();g.api.setMonsterForTest('fox',1e9);g.api.attack();const money=g.state().stones;g.api.resumeAdvance();assert.equal(g.state().stones,money);
 g.api.setMonsterForTest('fox',1e9);g.api.attack();const hp=g.state().monsterHp;assert.equal(g.api.resumeAdvance(),false);assert.equal(g.state().monsterHp,hp);
});
test('title and quest milestone use the saved challenge frontier instead of a temporary farm floor',()=>{
 const g=createGame({noStart:true,save:{S:20,level:21,towerFloor:26,towerBest:26,towerPlan:'temper'}});g.render();assert.ok(g.uiTexts.some(t=>/魔窟第\s*26\s*层/.test(t.text)));
 const q=createGame({save:{S:8,level:11,towerFloor:11,towerBest:11}});q.api.enterTower('temper');assert.equal(q.state().level,1);assert.ok(q.state().quests.find(x=>x.id==='ten-thousand').ready);
 const newLife=createGame({save:{S:0,level:1,towerFloor:1,towerBest:100,rb:1}});assert.equal(newLife.state().quests.find(x=>x.id==='ten-thousand').ready,false);
});
test('phone shows the loop range, untouched frontier and a44px direct action; repeated tap stays in challenge mode',()=>{
 for(const [width,height]of[[360,800],[390,480],[430,932]]){
  const g=farmer({width,height});g.api.switchTab('tower');g.render();const v=g.scrollViews.get('tower-info'),r=g.uiControls.get('tw-resume');assert.ok(r);assert.ok(r.h*g.api.layout().scale>=44);
  assert.ok(g.uiTexts.some(t=>String(t.text).includes('21–25')));assert.ok(g.uiTexts.some(t=>String(t.text).includes('26')&&String(t.text).includes('温养不推进')));
  g.sandbox.XUI.wheel(v.x+20,v.y+20,(r.y-v.y-10)/3);g.render();const s=g.api.layout().scale,off=v.state.off;
  const e={pointerId:1,isPrimary:true,pointerType:'touch',clientX:(r.x+r.w/2)*s,clientY:(r.y-off+r.h/2)*s,preventDefault(){}};
  function tap(){g.canvasEvent('pointerdown',e);g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);g.frame(16);}
  tap();assert.equal(g.state().towerPlan,'advance');assert.equal(g.state().level,26);tap();assert.equal(g.state().mode,'tower');assert.equal(g.state().towerPlan,'advance');
 }
});
test('dragging or cancelling the direct action cannot leave the farming loop',()=>{
 for(const cancel of [false,true]){const g=farmer({width:390,height:844});g.api.switchTab('tower');g.render();const r=g.uiControls.get('tw-resume'),u=g.sandbox.XUI;
 u.pointerDown(r.x+r.w/2,r.y+r.h/2);if(cancel)u.cancelPointer();else u.pointerMove(r.x+r.w/2,r.y-50);u.pointerUp(r.x+r.w/2,r.y-50);g.render();assert.equal(g.state().towerPlan,'temper');}
});
test('return uses each player saved frontier rather than assuming the next layer is26',()=>{
 for(const frontier of [26,41,71]){const g=farmer({save:{level:frontier,towerFloor:frontier,towerBest:frontier}});assert.equal(g.state().level,21);g.api.resumeAdvance();assert.equal(g.state().level,frontier);assert.equal(g.state().towerFloor,frontier);}
});
test('resumed challenge crosses the next boss milestone and saves its new frontier',()=>{
 const g=farmer();g.api.resumeAdvance();walk(g,()=>g.state().level>=31,1200);assert.equal(g.state().towerFloor,31);assert.equal(g.state().towerBest,31);g.api.persist();assert.equal(createGame({save:g.save()}).state().level,31);
});
test('a failed farm run returns to the challenge checkpoint and cannot lower or inflate it',()=>{
 const g=farmer();g.api.hurtPlayer(1e12);assert.equal(g.state().mode,'home');assert.equal(g.state().level,26);assert.equal(g.state().towerFloor,26);assert.equal(g.state().towerBest,26);assert.equal(g.state().epip,0);
});
