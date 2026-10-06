'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame,KEY}=require('./harness.cjs');
function encounter(save={}){const g=createGame({fast:true,save:{S:8,level:16,towerFloor:16,towerBest:16,ph:979,stones:1000,...save}});g.api.enterTower('advance');g.api.setMonsterForTest('mirrorfox',1000);return g;}
test('mirror split redistributes remaining health, and automatic overflow preserves the original damage budget',()=>{
 const g=encounter(),B=g.XB,m=B.mirrorState('mirrorfox',16);let hp=B.mirrorDamage(m,1000,1000,500);
 assert.equal(hp,300);assert.equal(m.flame,100);assert.equal(m.ward,100);assert.equal(B.mirrorTotalHp(m,hp),500);
 hp=B.mirrorDamage(m,hp,1000,100);assert.equal(m.flame,0);assert.equal(m.cleared,1);assert.equal(hp,300);
 hp=B.mirrorDamage(m,hp,1000,400);assert.equal(hp,0);assert.equal(m.cleared,2);
 const one=B.mirrorState('mirrorfox',16);assert.equal(B.mirrorDamage(one,1000,1000,1200),-200);assert.equal(one.cleared,2);
});
test('flame, ward and direct-body targets produce distinct tactical consequences with no extra health',()=>{
 const B=encounter().XB;
 function half(){const m=B.mirrorState('mirrorfox',16);B.mirrorDamage(m,1000,1000,500);return m;}
 const flame=half();flame.focus='flame';B.mirrorDamage(flame,300,1000,100);assert.equal(B.mirrorAttackMult(flame,''),.75);assert.equal(flame.ward,100);
 const ward=half();ward.focus='ward';assert.equal(B.mirrorDamage(ward,300,1000,100),300);assert.equal(ward.ward,0);assert.equal(B.mirrorAttackMult(ward,''),1.2);
 ward.focus='body';assert.equal(B.mirrorDamage(ward,300,1000,300),0);
 const body=half();body.focus='body';assert.equal(B.mirrorDamage(body,300,1000,100),235);assert.equal(B.mirrorAttackMult(body,'calm'),1.05);
});
test('each target carries excess damage once, and a lethal body strike never leaves a reward-bearing shadow',()=>{
 const g=encounter({mirrorStage:1});g.api.damageMonster(500);g.api.chooseMirrorTarget('ward');g.api.damageMonster(140);assert.equal(g.state().mirror.ward,0);assert.equal(g.state().mirror.flame,60);
 g.api.chooseMirrorTarget('body');g.api.damageMonster(10000);const before=g.state();g.api.persist();const save=g.save();
 assert.equal(before.dying,true);assert.equal(before.mirrorStage,1);assert.equal(save.kills,1);assert.equal(save.contrib,1);
 for(let i=0;i<5;i++)g.api.damageMonster(10000);g.api.persist();assert.equal(g.save().kills,1);assert.equal(g.state().stones,before.stones);
});
test('splitting and clearing shadows never awards resources or advances the tower before the body dies',()=>{
 const g=encounter({mirrorStage:1});const before=g.state();g.api.damageMonster(500);g.api.damageMonster(200);
 assert.equal(g.state().mirror.cleared,2);assert.equal(g.state().stones,before.stones);assert.equal(g.state().exp,before.exp);assert.equal(g.state().contrib,before.contrib);assert.equal(g.state().towerFloor,16);assert.equal(g.state().mirrorStage,1);
 g.api.damageMonster(300);assert.equal(g.state().mirrorStage,2);assert.equal(g.state().dying,true);g.step(.6);assert.equal(g.state().towerFloor,17);
});
test('retreat, background return and reload discard transient shadows without preserving extra rewards or targets',()=>{
 const g=encounter({mirrorStage:1,mirrorChoice:'calm'});g.api.damageMonster(500);g.api.chooseMirrorTarget('body');const before=g.state();
 g.api.leaveTower();g.api.enterTower('advance');assert.equal(g.state().mirror.split,false);assert.equal(g.state().mirror.focus,'auto');assert.equal(g.state().stones,before.stones);assert.equal(g.state().mirrorStage,1);
 g.api.damageMonster(g.state().monsterMaxHp*.5);g.api.persist();const reloaded=createGame({save:g.save()});assert.equal(reloaded.state().mode,'home');assert.equal(reloaded.state().mirror,null);assert.equal(reloaded.state().mirrorChoice,'calm');assert.equal(reloaded.state().towerFloor,16);
 g.show(60);assert.equal(g.state().mode,'home');assert.equal(g.state().mirror,null);assert.equal(g.state().towerFloor,16);
});
test('old saves add optional story fields without changing earned resources and invalid choices are normalized',()=>{
 const g=createGame({save:{S:20,stones:12345,tn:7}});assert.equal(g.state().mirrorStage,0);assert.equal(g.state().mirrorChoice,'');assert.equal(g.state().S,20);assert.equal(g.state().stones,12345);
 const bad=createGame({save:{mirrorStage:999,mirrorChoice:'bad'}});assert.equal(bad.state().mirrorStage,3);assert.equal(bad.state().mirrorChoice,'');
});
test('fox-lantern choices and completion survive repeated input, save restoration and reincarnation',()=>{
 const g=encounter();assert.equal(g.api.openMirrorEvent(),true);g.api.fateOption(0);g.api.fateOption(1);assert.equal(g.state().mirrorStage,1);assert.equal(g.state().mirrorChoice,'calm');
 g.api.damageMonster(1000);assert.equal(g.state().mirrorStage,2);g.api.openMirrorEvent();g.api.fateOption(0);g.api.fateOption(0);assert.equal(g.state().bond,1);assert.equal(g.state().mirrorStage,3);
 const other=createGame({save:{S:32}});other.api.previewImportedSave(g.storage.get(KEY));other.api.confirmBackupRestore();assert.equal(other.state().mirrorStage,3);assert.equal(other.state().mirrorChoice,'calm');assert.equal(other.state().bond,1);
 const veteran=createGame({save:{...g.save(),S:32}});veteran.api.rebirth();assert.equal(veteran.state().mirrorStage,3);assert.equal(veteran.state().mirrorChoice,'calm');assert.equal(veteran.state().bond,1);
});
test('insight alternative respects remaining capacity and full veterans get useful bounded cultivation',()=>{
 const g=encounter();g.api.openMirrorEvent();g.api.fateOption(1);assert.equal(g.state().cmp.reduce((a,b)=>a+b,0),6);assert.equal(g.state().mirrorChoice,'insight');
 const full=encounter({S:36,cmp:Array(g.XB.GONGFA_COUNT).fill(100)});const exp=full.state().exp;full.api.openMirrorEvent();full.api.fateOption(1);assert.ok(full.state().exp>exp);assert.ok(full.state().exp-exp<=full.state().expNeed*.35+1);
});

test('targets can be preselected but cannot damage an unborn shadow, and dead targets fall back to the safe order',()=>{
 const g=encounter();assert.equal(g.api.chooseMirrorTarget('ward'),true);assert.equal(g.state().mirror.focus,'ward');g.api.damageMonster(400);assert.equal(g.state().monsterHp,600);assert.equal(g.state().mirror.ward,0);
 g.api.damageMonster(200);assert.equal(g.state().mirror.ward,0);assert.equal(g.state().mirror.flame,100);assert.equal(g.state().mirror.focus,'auto');assert.equal(g.api.chooseMirrorTarget('ward'),false);assert.equal(g.api.chooseMirrorTarget('invalid'),false);
});
test('low-FPS and regular frames preserve split, shadow damage and the same enemy attack timing',()=>{
 const make=()=>{const g=createGame({width:390,height:844,save:{S:8,level:16,towerFloor:16,towerBest:16}});g.api.enterTower('advance');g.api.setMonsterForTest('mirrorfox',10000);g.api.damageMonster(5000);return g;};
 const a=make(),b=make();a.frame(16);b.frame(16);for(let i=0;i<50;i++)a.frame(100);for(let i=0;i<300;i++)b.frame(1000/60);
 assert.ok(Math.abs(a.state().monsterTotalHp-b.state().monsterTotalHp)<1e-6);assert.ok(Math.abs(a.api.snapshot().ph-b.api.snapshot().ph)<1e-6);assert.equal(a.state().mirror.cleared,b.state().mirror.cleared);
});
test('opening a dialog freezes shadows and damage, and repeated selection cannot reset the attack timer',()=>{
 const g=encounter();g.api.damageMonster(500);g.api.openModal('settings');const before=g.state();g.step(2);assert.equal(g.state().monsterTotalHp,before.monsterTotalHp);assert.equal(g.state().ph,before.ph);assert.equal(g.api.chooseMirrorTarget('body'),false);
 g.api.closeModal();for(let i=0;i<28;i++){g.api.chooseMirrorTarget(i%2?'body':'auto');g.step(.05);}assert.ok(g.state().ph<before.ph);
});
test('one full encounter has the same kill, milestone drop and reward budget as an ordinary fox',()=>{
 for(const floor of [16,20,30]){const make=type=>{const g=createGame({fast:true,seed:997,save:{S:12,level:floor,towerFloor:floor,towerBest:floor}});g.api.enterTower('advance');g.api.setMonsterForTest(type);g.api.damageMonster(1e12);g.api.persist();return g.save();};
  const a=make('fox'),b=make('mirrorfox');for(const key of ['stones','contrib','kills','accStones','exp'])assert.equal(b[key],a[key],`${floor}/${key}`);assert.deepEqual(b.eq,a.eq);assert.deepEqual(b.cmp,a.cmp);
 }
});
test('new target controls remain44px at320px and never move or overlap the leave/resume row',()=>{
 for(const[width,height]of[[320,480],[360,800],[390,480],[430,932]]){
  const g=createGame({width,height,save:{S:8,level:16,towerFloor:16,towerBest:16}});g.api.enterTower('advance');g.api.setMonsterForTest('fox',10000);g.api.switchTab('tower');g.render();const before=g.uiControls.get('tw-leave');
  g.api.setMonsterForTest('mirrorfox',10000);g.uiControls.clear();g.uiTexts.length=0;g.render();const leave=g.uiControls.get('tw-leave'),scale=g.api.layout().scale;
  assert.deepEqual([leave.x,leave.y,leave.w,leave.h],[before.x,before.y,before.w,before.h]);
  let last=null;for(const id of ['auto','flame','ward','body']){const r=g.uiControls.get('mirror-target-'+id);assert.ok(r.w*scale>=44&&r.h*scale>=44);assert.ok(r.y+r.h<leave.y);if(last)assert.ok(last.x+last.w<r.x);last=r;}
  assert.ok(g.uiTexts.some(t=>String(t.text).includes('分影前仅预选')));assert.equal(g.state().errs.length,0);
 }
});
test('Android release/leave selects once; drag/cancel or a second finger cannot change the chosen target',()=>{
 for(const action of ['tap','drag','cancel','second']){
  const g=createGame({width:320,height:480,save:{S:8,level:16,towerFloor:16,towerBest:16}});g.api.enterTower('advance');g.api.setMonsterForTest('mirrorfox',10000);g.api.switchTab('tower');g.render();const r=g.uiControls.get('mirror-target-ward'),v=g.scrollViews.get('tower-info');
  if(v)g.sandbox.XUI.wheel(v.x+20,v.y+20,Math.max(0,r.y-v.y-10)/3);g.render();const scale=g.api.layout().scale;
  const e={pointerId:1,isPrimary:true,pointerType:'touch',clientX:(r.x+r.w/2)*scale,clientY:(r.y-(v?v.state.off:0)+r.h/2)*scale,preventDefault(){}};
  g.canvasEvent('pointerdown',e);if(action==='drag')g.canvasEvent('pointermove',{...e,clientY:e.clientY-65});if(action==='cancel')g.canvasEvent('pointercancel',e);if(action==='second'){const second={...e,pointerId:2,isPrimary:false};g.canvasEvent('pointerdown',second);g.canvasEvent('pointerup',second);g.frame(16);assert.equal(g.state().mirror.focus,'auto');}
  g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);g.frame(16);assert.equal(g.state().mirror.focus,(action==='tap'||action==='second')?'ward':'auto',action);assert.equal(g.state().mode,'tower');
 }
});
test('short-window fox choices and repeated close/reopen retain story state and accessible scrolling',()=>{
 const g=createGame({width:320,height:480,save:{S:8,towerBest:16}});g.api.openMirrorEvent();g.render();assert.equal(g.state().modal,'fate');const first=g.uiControls.get('fate-0');assert.ok(first.h*g.api.layout().scale>=44);assert.ok(g.scrollViews.has('mobile-fate-body'));
 g.api.closeModal();assert.equal(g.state().mirrorStage,0);g.api.openMirrorEvent();g.api.fateOption(0);g.api.fateOption(1);assert.equal(g.state().mirrorChoice,'calm');assert.equal(g.state().mirrorStage,1);
});
test('mirror visuals add no image requests or phantom hitboxes and survive unavailable art',()=>{
 const g=createGame({images:true,width:390,height:844,save:{S:8,level:16,towerFloor:16,towerBest:16}});g.api.enterTower('advance');g.api.setMonsterForTest('mirrorfox',10000);g.api.damageMonster(5000);const count=g.images.length;
 for(const im of g.images)im.onerror();g.uiControls.clear();g.render();assert.equal(g.images.length,count);assert.equal(count,2);assert.equal(g.state().errs.length,0);assert.ok(![...g.uiControls.keys()].some(id=>id.includes('phantom')));
});

test('mirror fox starts at16 without reshuffling earlier species or the first Shanxiao lesson',()=>{
 const g=createGame({fast:true});g.api.jumpToLevel(6);g.api.enterTower('advance');assert.equal(g.state().monsterType,'shanxiao');g.api.jumpToLevel(15);assert.notEqual(g.state().monsterType,'mirrorfox');
 g.api.jumpToLevel(16);assert.equal(g.state().monsterType,'mirrorfox');g.api.jumpToLevel(20);assert.equal(g.state().monsterType,'mirrorfox');assert.equal(g.state().isBoss,true);
});
test('new native labels fit320px and explicitly reflect cleared shadows without stale status',()=>{
 const g=createGame({width:320,height:480,save:{S:8,level:16,towerFloor:16,towerBest:16}});g.api.enterTower('advance');g.api.setMonsterForTest('mirrorfox',1000);g.api.damageMonster(500);g.uiTexts.length=0;g.render();
 const detail=g.uiTexts.find(t=>String(t.text).includes('烈影增伤'));assert.ok(detail);assert.ok(detail.opt.size*g.api.layout().scale>=14);
 const ctx=g.sandbox.XP.canvas.getContext('2d');ctx.font=detail.opt.size+'px sans-serif';assert.ok(ctx.measureText(detail.text).width<=678);
 g.api.damageMonster(100);g.uiTexts.length=0;g.render();assert.ok(g.uiTexts.some(t=>String(t.text).includes('烈影已散')));
});
