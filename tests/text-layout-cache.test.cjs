'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const{createGame}=require('./harness.cjs');
const{collect}=require('./text-layout-probe.cjs');
function setup(options={}){const g=createGame(options);g.render();const u=g.sandbox.XUI,ctx=g.sandbox.XP.canvas.getContext('2d'),measure=ctx.measureText;let calls=0;
 ctx.measureText=function(t){calls++;return measure.call(this,t);};u.clearTextLayoutCache();return {g,u,ctx,calls:()=>calls};}

test('identical wraps reuse measurements and return independent line arrays',()=>{
 const{u,calls}=setup();const a=u.wrap('山河很远，修行仍在继续。',90,24,true,600),n=calls();assert.ok(n>0);
 a[0]='external mutation';const b=u.wrap('山河很远，修行仍在继续。',90,24,true,600);assert.equal(calls(),n);assert.notEqual(b[0],'external mutation');
});
test('text, width, complete font family/weight/size each invalidate their own layout key',()=>{
 const{u,calls}=setup();for(const args of [['灵石100',80,20,true,400],['灵石101',80,20,true,400],['灵石101',100,20,true,400],['灵石101',100,30,true,400],['灵石101',100,30,false,400],['灵石101',100,30,false,700]]){
  const before=calls();u.wrap(...args);assert.ok(calls()>before);const measured=calls();u.wrap(...args);assert.equal(calls(),measured);
 }
});
test('Canvas shaping and language parameters cannot reuse an incompatible result',()=>{
 const{g,u,ctx,calls}=setup();ctx.canvas={lang:'zh-CN',dir:'ltr'};const wrap=()=>u.wrap('山河AB天地CD',90,22,true,600);wrap();
 for(const[prop,value]of Object.entries({direction:'rtl',fontKerning:'none',fontStretch:'expanded',fontVariantCaps:'small-caps',letterSpacing:'2px',wordSpacing:'3px',textRendering:'geometricPrecision',lang:'ja'})){
  const before=calls();ctx[prop]=value;wrap();assert.ok(calls()>before,prop);const n=calls();wrap();assert.equal(calls(),n,prop);
 }
 for(const[object,prop,value]of[[ctx.canvas,'lang','zh-TW'],[ctx.canvas,'dir','rtl'],[g.sandbox.document.documentElement,'lang','ja'],[g.sandbox.document.documentElement,'dir','rtl']]){
  const before=calls();object[prop]=value;wrap();assert.ok(calls()>before,prop);
 }
});
test('font readiness, loading completion and failure drop fallback-font measurements',()=>{
 const{g,u,ctx}=setup({fonts:true});const measure=ctx.measureText;let factor=1;ctx.measureText=function(t){return {width:measure.call(this,t).width*factor};};
 const first=Array.from(u.wrap('甲乙丙丁戊己庚辛',100,20,true,600));factor=1.6;g.fontsReady();const loaded=Array.from(u.wrap('甲乙丙丁戊己庚辛',100,20,true,600));assert.notDeepEqual(loaded,first);
 factor=1;g.fontEvent('loadingdone');assert.deepEqual(Array.from(u.wrap('甲乙丙丁戊己庚辛',100,20,true,600)),first);
 factor=1.6;g.fontEvent('loadingerror');assert.deepEqual(Array.from(u.wrap('甲乙丙丁戊己庚辛',100,20,true,600)),loaded);
});
test('entry count and total cache budget stay bounded under changing paragraphs',()=>{
 const{u}=setup(),limits=u.textCacheInfo();for(let i=0;i<500;i++)u.wrap('第'+i+'段见闻',100,24,true,600);
 assert.equal(u.textCacheInfo().entries,limits.limit);assert.ok(u.textCacheInfo().units<=limits.budget);
 u.clearTextLayoutCache();for(let i=0;i<50;i++){
  u.wrap(String(i).padStart(3,'0')+'山'.repeat(limits.maxTextLength-3),120,24,true,600);
  const info=u.textCacheInfo();assert.ok(info.entries<=limits.limit);assert.ok(info.units<=limits.budget);
 }
 assert.ok(u.textCacheInfo().entries>0&&u.textCacheInfo().entries<limits.limit);
});
test('oversize paragraphs and invalid widths bypass storage without changing wrapping',()=>{
 const{u,calls}=setup(),text='山'.repeat(u.textCacheInfo().maxTextLength+1);
 const a=u.wrap(text,100,20,true,600),n=calls();const b=u.wrap(text,100,20,true,600);assert.ok(calls()>n);assert.deepEqual(a,b);assert.equal(u.textCacheInfo().entries,0);
 for(const width of [0,-1,NaN,Infinity])u.wrap('甲乙丙丁',width,20,true,600);assert.equal(u.textCacheInfo().entries,0);
});
test('least recently used entries expire and repeated recent labels keep their measurements',()=>{
 const{u,calls}=setup(),n=u.textCacheInfo().limit;for(let i=0;i<n;i++)u.wrap('短'+i,100,20,true,400);
 u.wrap('短0',100,20,true,400);u.wrap('新增',100,20,true,400);let before=calls();u.wrap('短0',100,20,true,400);assert.equal(calls(),before);
 before=calls();u.wrap('短1',100,20,true,400);assert.ok(calls()>before);
});
test('resize clears prior layouts and repeated dialog changes cannot grow the cache indefinitely',()=>{
 const{g,u,calls}=setup({width:390,height:844,save:{S:8,towerBest:26}});u.wrap('独立布局哨兵',91,23,true,500);g.resize(320,480);let before=calls();u.wrap('独立布局哨兵',91,23,true,500);assert.ok(calls()>before);
 for(let i=0;i<240;i++){
  if(i%3===0)g.api.openVault();else g.api.openModal(i%3===1?'realm':'settings');
  g.api.addStones(i);g.render();g.uiTexts.length=0;u.wrap('动态数值 '+i,110,24,true,600);
  const info=u.textCacheInfo();assert.ok(info.entries<=info.limit);assert.ok(info.units<=info.budget);
 }
 assert.equal(g.state().errs.length,0);
});
test('cached and uncached rendering have equal text output and game state across numbers, fonts and resizes',()=>{
 const old=collect(true),cached=collect(false);assert.equal(cached.textDrawCalls,old.textDrawCalls);assert.equal(cached.textTraceSha256,old.textTraceSha256);assert.deepEqual(cached.state,old.state);
 assert.ok(cached.measureTextCalls<old.measureTextCalls*.1,`${cached.measureTextCalls}/${old.measureTextCalls}`);assert.ok(cached.peakEntries<=128);assert.ok(cached.peakUnits<=32768);
});
test('a different canvas context cannot inherit another context font metrics',()=>{
 const{u}=setup();const first=Array.from(u.wrap('甲乙丙丁',80,20,true,400));
 u.beginFrame({font:'',measureText:t=>({width:String(t).length*40})},.016);
 const second=Array.from(u.wrap('甲乙丙丁',80,20,true,400));assert.notDeepEqual(second,first);assert.deepEqual(second,['甲乙','丙丁']);
});
test('partially loaded font batches bypass caching until all fonts finish',()=>{
 const{g,u,ctx}=setup({fonts:true}),measure=ctx.measureText;let factor=1;
 ctx.measureText=function(t){return {width:measure.call(this,t).width*factor};};const text='甲乙丙丁戊己庚辛';u.wrap(text,100,20,true,400);
 g.sandbox.document.fonts.status='loading';g.fontEvent('loading');assert.equal(u.textCacheInfo().entries,0);
 const a=Array.from(u.wrap(text,100,20,true,400));factor=1.8;const b=Array.from(u.wrap(text,100,20,true,400));assert.notDeepEqual(a,b);assert.equal(u.textCacheInfo().entries,0);
 g.sandbox.document.fonts.status='loaded';g.fontEvent('loadingdone');assert.deepEqual(Array.from(u.wrap(text,100,20,true,400)),b);assert.equal(u.textCacheInfo().entries,1);
});
