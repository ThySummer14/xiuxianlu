'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
function event(g,id,pointerId=7){const b=g.uiControls.get(id),s=g.api.layout().scale;assert.ok(b,id);return {pointerId,isPrimary:true,pointerType:'touch',clientX:(b.x+b.w/2)*s,clientY:(b.y+b.h/2)*s,preventDefault(){}};}
function touchTap(g,id){const e=event(g,id);g.canvasEvent('pointerdown',e);g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);g.frame(16);}
for(const [width,height]of[[360,800],[390,844],[430,932]]){
 test(`Android release-leave sequence starts game and opens/closes settings at ${width}px`,()=>{
  const g=createGame({width,height,noStart:true});g.render();touchTap(g,'start');assert.equal(g.state().scene,'play');
  g.api.closeModal();g.render();touchTap(g,'settings');assert.equal(g.state().modal,'settings');touchTap(g,'close');assert.equal(g.state().modal,null);
 });
}
test('Android release-leave buys exactly once, while leaving during a held press still cancels',()=>{
 const g=createGame({width:390,height:844,save:{stones:10000}});g.render();touchTap(g,'buy-sj');assert.equal(g.state().sj,1);
 const e=event(g,'buy-sj');g.canvasEvent('pointerdown',e);g.canvasEvent('pointerleave',e);g.canvasEvent('pointerup',e);g.frame(16);assert.equal(g.state().sj,1);
});
test('another finger leaving or cancelling cannot erase the primary completed tap',()=>{
 for(const name of ['pointerleave','pointercancel']){
  const g=createGame({width:390,height:844,save:{stones:10000}});g.render();const e=event(g,'buy-sj');
  g.canvasEvent('pointerdown',e);g.canvasEvent(name,{...e,pointerId:9,isPrimary:false});g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);assert.equal(g.state().sj,1);
 }
});
test('the previous release handler reproduces the reported dead start button',()=>{
 const g=createGame({width:390,height:844,noStart:true,source:(name,src)=>name==='main'?src.replace("cv.addEventListener('pointerleave', function (ev) {", "cv.addEventListener('pointerleave', function (ev) { XUI.cancelPointer();"):src});
 g.render();touchTap(g,'start');assert.equal(g.state().scene,'title');
});
