'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame,KEY}=require('./harness.cjs');
function encounter(extra={}){const g=createGame({save:{S:0,level:6,towerFloor:6,towerBest:6,ph:120,stones:1000,...extra}});g.api.enterTower('advance');g.api.setMonsterForTest('shanxiao',1e9);return g;}
function charge(g){for(let i=0;i<200&&g.state().intent?.phase!=='charging';i++)g.step(.05);assert.equal(g.state().intent.phase,'charging');}
function interrupt(g){for(let i=0;i<3;i++){g.api.attack();if(i<2)g.step(.5);}}

test('山魈 replaces its third attack with a full 3.2-second warning and bounded strike',()=>{
 const g=encounter();charge(g);const before=g.api.snapshot().ph,windup=g.state().intent.left;
 assert.ok(windup>=3.19);g.step(3.0);assert.equal(g.api.snapshot().ph,before);assert.equal(g.state().intent.phase,'charging');
 g.step(.25);const damage=before-g.api.snapshot().ph;assert.ok(damage>0);assert.ok(damage<=g.state().phMax*.35+1e-9);
});
test('three comfortably spaced manual hits interrupt; auto damage never impersonates a manual hit',()=>{
 const g=encounter();charge(g);const before=g.api.snapshot().ph;g.step(.5);assert.equal(g.state().intent.hits,0);
 interrupt(g);assert.equal(g.state().intent.phase,'staggered');assert.equal(g.api.snapshot().ph,before);
 g.step(1);assert.equal(g.api.snapshot().ph,before);assert.equal(g.state().intent.phase,'staggered');
});
test('one frame of repeated attack calls cannot instantly manufacture three interruption hits',()=>{
 const g=encounter();charge(g);for(let i=0;i<8;i++)g.api.attack();assert.equal(g.state().intent.hits,1);assert.equal(g.state().intent.phase,'charging');
});
test('background and foreground stalls cannot finish a pending charge offscreen',()=>{
 for(const gap of [1,60]){const g=encounter();charge(g);g.step(3);const wards=g.state().wardCharges;g.show(gap);
  assert.equal(g.state().wardCharges,wards);assert.ok(g.state().mode==='home'||g.state().intent.phase==='ready');
  if(g.state().mode==='tower'){const hp=g.api.snapshot().ph;g.step(.3);assert.equal(g.api.snapshot().ph,hp);}
 }
 const g=encounter();charge(g);g.frame(16);g.frame(10000);assert.notEqual(g.state().intent?.phase,'charging');
});
test('retreat/reentry and reload provide a new telegraph without health, ward or reward duplication',()=>{
 const g=encounter();g.api.openHuntEvent();g.api.fateOption(0);charge(g);const hp=g.api.snapshot().ph;
 g.api.leaveTower();g.api.enterTower('advance');assert.equal(g.api.snapshot().ph,hp);assert.equal(g.state().intent.phase,'ready');assert.equal(g.state().wardCharges,2);assert.equal(g.state().huntStage,1);
 g.api.persist();const reloaded=createGame({save:g.save()});assert.equal(reloaded.state().mode,'home');assert.equal(reloaded.state().wardCharges,2);assert.equal(reloaded.state().huntStage,1);assert.equal(reloaded.state().sgn,0);
});
test('protective talisman is consumed exactly once and persists before another encounter',()=>{
 const g=encounter();g.api.openHuntEvent();g.api.fateOption(0);charge(g);const hp=g.api.snapshot().ph;g.step(3.25);
 assert.equal(g.api.snapshot().ph,hp);assert.equal(g.state().wardCharges,1);assert.equal(g.save().wardCharges,1);
 const reloaded=createGame({save:g.save()});assert.equal(reloaded.state().wardCharges,1);
});
test('linked encounter choices are different, complete only after a real interruption, and pay once',()=>{
 const g=encounter();assert.equal(g.api.openHuntEvent(),true);g.api.fateOption(1);assert.equal(g.state().huntChoice,'insight');assert.equal(g.state().wardCharges,0);assert.equal(g.state().cmp.reduce((a,b)=>a+b,0),6);
 assert.equal(g.api.openHuntEvent(),false);charge(g);interrupt(g);assert.equal(g.state().huntStage,2);g.api.openHuntEvent();g.api.fateOption(0);
 assert.equal(g.state().huntStage,3);assert.equal(g.state().sgn,1);g.api.fateOption(0);assert.equal(g.api.openHuntEvent(),false);assert.equal(g.state().sgn,1);
 const reloaded=createGame({save:g.save()});assert.equal(reloaded.state().huntStage,3);assert.equal(reloaded.api.openHuntEvent(),false);assert.equal(reloaded.state().sgn,1);
});
test('ward reward refills to the visible cap; completed story survives reincarnation',()=>{
 const g=encounter({S:32,huntStage:2,huntChoice:'ward',wardCharges:2});g.api.openHuntEvent();g.api.fateOption(1);assert.equal(g.state().wardCharges,3);g.api.rebirth();assert.equal(g.state().huntStage,3);assert.equal(g.state().wardCharges,3);assert.equal(g.state().S,0);
});
test('old saves migrate additively and malformed encounter fields are bounded',()=>{
 const g=createGame({save:{S:20,stones:12345,tn:7}});assert.equal(g.state().huntStage,0);assert.equal(g.state().wardCharges,0);assert.equal(g.state().S,20);assert.equal(g.state().stones,12345);
 const corrupt=createGame({save:{huntStage:900,wardCharges:1e99,huntChoice:'invalid'}});assert.equal(corrupt.state().huntStage,3);assert.equal(corrupt.state().wardCharges,3);assert.equal(corrupt.state().huntChoice,'');
});
test('restoring a save restores encounter progress and talismans together',()=>{
 const g=encounter({huntStage:3,huntChoice:'ward',wardCharges:1});g.api.persist();const raw=g.storage.get(KEY);
 const other=createGame({save:{huntStage:0,wardCharges:0}});other.api.previewImportedSave(raw);other.api.confirmBackupRestore();assert.equal(other.state().huntStage,3);assert.equal(other.state().wardCharges,1);assert.equal(other.state().mode,'home');
});
test('phone warning has readable text and no extra capture layer over the enemy',()=>{
 const g=encounter();charge(g);g.uiControls.clear();g.uiTexts.length=0;g.render();
 assert.ok(g.uiTexts.some(t=>String(t.text).includes('镇岳重击')&&t.opt.size*g.api.layout().scale>=14));
 assert.ok(![...g.uiControls.keys()].some(id=>id.includes('charge')));const hits=g.state().intent.hits;g.api.attack();assert.equal(g.state().intent.hits,hits+1);
});
test('low-FPS and normal-FPS idle combat resolve the same attacks',()=>{
 const a=encounter(),b=encounter();a.frame(16);b.frame(16);for(let i=0;i<90;i++)a.frame(100);for(let i=0;i<540;i++)b.frame(1000/60);
 assert.ok(Math.abs(a.api.snapshot().ph-b.api.snapshot().ph)<1e-6);assert.equal(a.state().intent.phase,b.state().intent.phase);assert.equal(a.state().wardCharges,b.state().wardCharges);
});
test('veteran with full insight receives a bounded cultivation alternative instead of a wasted choice',()=>{
 const fixture=createGame();const g=encounter({S:36,cmp:Array(fixture.XB.GONGFA_COUNT).fill(100)});const before=g.state().exp;g.api.openHuntEvent();g.api.fateOption(1);
 assert.ok(g.state().exp>before);assert.ok(g.state().exp-before<=g.state().expNeed*.35+1);assert.equal(g.state().huntStage,1);
});
test('monster sprite loading and failure cannot capture an in-flight strike or change intent',()=>{
 for(const outcome of ['onload','onerror']){
  const g=createGame({images:true,width:390,height:844,save:{level:6,towerFloor:6,towerBest:6}});g.api.enterTower('advance');g.api.setMonsterForTest('shanxiao',1e9);charge(g);
  const before=g.state().intent.left;g.images[1][outcome]();g.render();assert.equal(g.state().intent.left,before);g.api.attack();assert.equal(g.state().intent.hits,1);
 }
});
test('new sprite is a bounded WebP asset and warning controls preserve Android release-leave behavior',()=>{
 const fs=require('node:fs'),path=require('node:path'),b=fs.readFileSync(path.join(__dirname,'../assets/art/shanxiao-stone-v2.webp'));
 assert.ok(b.length<220*1024);assert.equal(b.toString('ascii',8,12),'WEBP');
 const g=createGame({width:390,height:844,save:{towerBest:6}});g.api.switchTab('tower');g.render();const v=g.scrollViews.get('tower-info'),row=g.uiControls.get('hunt-open');
 g.sandbox.XUI.wheel(v.x+20,v.y+20,(row.y-v.y-10)/3);g.render();const off=v.state.off,s=g.api.layout().scale;
 const e={pointerId:3,isPrimary:true,pointerType:'touch',clientX:(row.x+row.w/2)*s,clientY:(row.y-off+row.h/2)*s,preventDefault(){}};
 g.canvasEvent('pointerdown',e);g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);assert.equal(g.state().modal,'fate');assert.equal(g.state().huntStage,0);
});
test('closing a paused dialog restores the full warning instead of an immediate hidden strike',()=>{
 const g=encounter();charge(g);g.step(3);g.api.openModal('settings');const hp=g.api.snapshot().ph;g.step(2);assert.equal(g.api.snapshot().ph,hp);
 g.api.closeModal();g.step(.05);assert.ok(g.state().intent.left>=3.1);assert.equal(g.api.snapshot().ph,hp);
});
