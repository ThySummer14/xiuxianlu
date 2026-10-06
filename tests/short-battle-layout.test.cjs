'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
const sizes=[[320,568,224],[390,640,296],[500,565,221],[844,390,228],[568,320,158]];
function combat(width,height,type='mirrorfox'){const g=createGame({width,height,save:{S:8,level:20,towerFloor:20,towerBest:20}});g.api.enterTower('advance');g.api.setMonsterForTest(type,10000);g.api.switchTab('tower');g.render();return g;}
function overlap(a,b){return Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)+1e-6;}
function tap(g,id){const r=g.uiControls.get(id),s=g.api.layout().scale,e={pointerId:1,isPrimary:true,pointerType:'touch',clientX:(r.x+r.w/2)*s,clientY:(r.y+r.h/2)*s,preventDefault(){}};g.canvasEvent('pointerdown',e);g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);g.frame(16);}
for(const[width,height,minWorld]of sizes)test(`short battle ${width}x${height}: readable HUD, native targets and ${minWorld}px unobstructed world`,()=>{
 const g=combat(width,height),l=g.api.layout(),f=l.frames;assert.ok(l.compact);assert.ok(f.world.h>=minWorld-1e-6);assert.equal(l.height*l.scale,height);
 for(const r of [f.hud,f.enemy,f.world,f.panel]){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1e-6&&r.y+r.h<=height+1e-6);}
 assert.ok(!overlap(f.world,f.enemy)&&!overlap(f.world,f.hud)&&!overlap(f.world,f.panel));
 const boxes=[...g.uiControls.entries()].filter(([id])=>id!=='bt-break');
 for(const[id,r]of boxes){assert.ok(r.w*l.scale>=44-1e-6&&r.h*l.scale>=44-1e-6,id);assert.ok(r.x*l.scale>=f.panel.x-1e-6&&((r.x+r.w)*l.scale)<=f.panel.x+f.panel.w+1e-6,id);}
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i][1],boxes[j][1]),boxes[i][0]+'/'+boxes[j][0]);
 const labels=g.uiTexts.filter(t=>String(t.text).includes('镜狐王')||String(t.text).includes('分影前仅预选'));assert.equal(labels.length,2);for(const text of labels)assert.ok(text.opt.size*l.scale>=14-1e-6);
 const ctx=g.sandbox.XP.canvas.getContext('2d');for(const[id,r]of boxes){ctx.font=r.opt.size+'px sans-serif';assert.ok(ctx.measureText(r.opt.label).width<=r.w-4/l.scale,id+' label fits');}
});
test('preselect, return from details, strike in the visible world and leave all work through real pointer events',()=>{
 for(const[w,h]of[[320,568],[844,390],[568,320]]){const g=combat(w,h);tap(g,'mirror-target-ward');assert.equal(g.state().mirror.focus,'ward');tap(g,'compact-more');assert.equal(g.state().modal,'navigation');g.render();tap(g,'compact-back');assert.equal(g.state().modal,null);assert.equal(g.state().tab,'tower');
  const before=g.state().monsterTotalHp;assert.ok(g.api.attack());assert.ok(g.state().monsterTotalHp<before);tap(g,'tw-leave');assert.equal(g.state().mode,'home');assert.equal(g.state().towerFloor,20);
 }
});
test('the toast uses its existing information row and never covers the enemy or captures a target',()=>{
 const g=combat(320,568);const l=g.api.layout(),f=l.frames,draws=[];const ctx=g.sandbox.XP.canvas.getContext('2d');ctx.fillText=(text,x,y)=>draws.push({text,x,y});g.sandbox.XUI.toast('这是一条很长的测试消息，说明文字仍然存在，但是不会覆盖敌人名称、蓄力预警、目标按钮或归山动作。');g.render();
 const toast=draws.find(t=>String(t.text).startsWith('这是一条'));assert.ok(toast);assert.ok(toast.text.endsWith('…'));const y=toast.y*l.scale;assert.ok(y>=f.info.y&&y<=f.info.y+f.info.h);assert.ok(!overlap(f.info,f.enemy));const before=JSON.stringify(g.api.layout().frames);g.step(2);assert.equal(JSON.stringify(g.api.layout().frames),before);
 tap(g,'mirror-target-flame');assert.equal(g.state().mirror.focus,'flame');
});
test('orientation and layout changes cancel a pressed target without losing progression or quest choices',()=>{
 const g=combat(390,640);const r=g.uiControls.get('mirror-target-body'),s=g.api.layout().scale,e={pointerId:1,isPrimary:true,pointerType:'touch',clientX:(r.x+r.w/2)*s,clientY:(r.y+r.h/2)*s,preventDefault(){}};
 g.canvasEvent('pointerdown',e);const before=g.state();g.resize(844,390);g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.render();assert.equal(g.state().mirror.focus,'auto');for(const key of ['S','stones','exp','towerFloor','towerBest','mirrorStage','mirrorChoice'])assert.equal(g.state()[key],before[key]);
 tap(g,'mirror-target-body');assert.equal(g.state().mirror.focus,'body');
});
test('layout alone leaves combat, split, story rewards and saved resources equal to tall-portrait play',()=>{
 function run(w,h){const g=createGame({fast:true,width:w,height:h,seed:321,save:{S:8,level:20,towerFloor:20,towerBest:20,mirrorStage:1,mirrorChoice:'calm'}});g.api.enterTower('advance');g.api.setMonsterForTest('mirrorfox',10000);g.api.switchTab('tower');g.render();for(let i=0;i<120;i++){if(i%10===0)g.api.attack();g.step(.05);}g.api.persist();const save=g.save();delete save.ts;return save;}
 const base=run(390,844);for(const[w,h]of sizes)assert.deepEqual(run(w,h),base);
});
test('landscape navigation exposes every panel and a clear return to combat without overlapping footer actions',()=>{
 const g=combat(568,320);tap(g,'compact-more');g.render();for(const id of ['cult','tower','sect','gongfa','market','quest'])assert.ok(g.uiControls.has('nav-'+id));assert.ok(g.uiControls.has('compact-back'));
 const f=g.api.layout().frames;assert.ok(f.side);assert.ok(f.panel.w>=296);const r=g.uiControls.get('compact-back');assert.ok(r.h*g.api.layout().scale>=44-1e-6);
});

test('smallest landscape keeps live split and charge warnings inside the enemy strip at14px',()=>{
 for(const type of ['mirrorfox','shanxiao']){const g=combat(560,320,type);g.api.setMonsterForTest(type,100000);if(type==='mirrorfox')g.api.damageMonster(50000);else for(let i=0;i<80;i++)g.step(.05);g.uiTexts.length=0;g.render();const l=g.api.layout(),r=l.frames.enemy,ctx=g.sandbox.XP.canvas.getContext('2d');
  const detail=g.uiTexts.find(t=>String(t.text).includes(type==='mirrorfox'?'烈影增伤':'按住破招'));assert.ok(detail);ctx.font=detail.opt.size+'px sans-serif';assert.ok(ctx.measureText(detail.text).width*l.scale<=r.w-12+1e-6);assert.ok(detail.opt.size*l.scale>=14-1e-6);
 }
});
