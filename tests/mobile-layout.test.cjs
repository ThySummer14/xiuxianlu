'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
const sizes=[[360,800],[390,844],[430,932],[360,480]];
function renderTab(g,tab){g.uiControls.clear();g.scrollViews.clear();g.uiTexts.length=0;g.api.switchTab(tab);g.render();}
function click(g,id,scroll){const b=g.uiControls.get(id),off=scroll?g.scrollViews.get(scroll).state.off:0;g.sandbox.XUI.pointerDown(b.x+b.w/2,b.y-off+b.h/2);g.sandbox.XUI.pointerUp(b.x+b.w/2,b.y-off+b.h/2);g.render();}
for(const [width,height] of sizes){
  test(`phone ${width}x${height}: six panels keep readable non-overlapping touch controls`,()=>{
    const g=createGame({width,height,save:{S:36,stones:1e8}}),layout=g.api.layout();
    assert.ok(layout.mobile);assert.equal(layout.height*layout.scale,height);
    for(const tab of ['cult','gongfa','market','tower','sect','quest']){
      renderTab(g,tab);
      const controls=[...g.uiControls.entries()];
      for(const [id,b] of controls){
        assert.ok(b.w*layout.scale>=44-1e-6,`${tab}/${id} width`);
        assert.ok(b.h*layout.scale>=44-1e-6,`${tab}/${id} height`);
        assert.ok((b.opt.size||24)*layout.scale>=13,`${tab}/${id} label`);
        assert.ok(b.x>=0 && b.x+b.w<=layout.width,`${tab}/${id} horizontal bounds`);
      }
      for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
        const [a,r]=controls[i],[b,s]=controls[j];
        const overlap=Math.min(r.x+r.w,s.x+s.w)-Math.max(r.x,s.x)>1 && Math.min(r.y+r.h,s.y+s.h)-Math.max(r.y,s.y)>1;
        assert.ok(!overlap,`${tab}: ${a} overlaps ${b}`);
      }
      for(const [id,v] of g.scrollViews){assert.ok(v.y>=0&&v.y+v.h<=layout.height,`${id} stays in viewport`);assert.ok(v.h>0);}
    }
    g.api.joinSect('sword');renderTab(g,'sect');
    for(const [id,b] of g.uiControls)assert.ok(b.h*layout.scale>=44-1e-6,id);
  });
}
test('short portrait lists can reveal and buy the final shop with real pointer coordinates',()=>{
  const g=createGame({width:360,height:480,save:{S:36,stones:1e10}});renderTab(g,'market');
  let v=g.scrollViews.get('market-list'),b=g.uiControls.get('mk-4');
  g.sandbox.XUI.wheel(v.x+30,v.y+30,(b.y-v.y-10)/3);g.render();v=g.scrollViews.get('market-list');
  assert.ok(b.y-v.state.off>=v.y&&b.y-v.state.off+b.h<=v.y+v.h);
  click(g,'mk-4','market-list');assert.equal(g.state().mk[4],1);assert.equal(g.state().mk[0],0);
});
test('resizing or pointer cancellation never completes an interrupted purchase',()=>{
  for(const interruption of ['resize','pointercancel']){
    const g=createGame({width:360,height:800,save:{stones:1e5}});g.render();const b=g.uiControls.get('buy-sj'),scale=g.api.layout().scale;
    const ev={pointerId:1,isPrimary:true,clientX:(b.x+b.w/2)*scale,clientY:(b.y+b.h/2)*scale,preventDefault(){}};
    g.canvasEvent('pointerdown',ev);
    if(interruption==='resize')g.resize(390,480);else g.canvasEvent('pointercancel',ev);
    g.canvasEvent('pointerup',ev);g.render();assert.equal(g.state().sj,0);
    renderTab(g,'cult');click(g,'buy-sj','cult-list');assert.equal(g.state().sj,1);
  }
});
test('a second finger cannot commit the first finger purchase',()=>{
  const g=createGame({width:360,height:800,save:{stones:1e5}});g.render();const b=g.uiControls.get('buy-sj'),s=g.api.layout().scale;
  const event={pointerId:1,isPrimary:true,clientX:(b.x+b.w/2)*s,clientY:(b.y+b.h/2)*s,preventDefault(){}};
  g.canvasEvent('pointerdown',event);g.canvasEvent('pointerup',{...event,pointerId:2,isPrimary:false});g.render();assert.equal(g.state().sj,0);
  g.canvasEvent('pointercancel',event);g.canvasEvent('pointerup',event);g.render();assert.equal(g.state().sj,0);
});
test('visualViewport size changes cancel stale coordinates and preserve earned state',()=>{
  const g=createGame({width:390,height:844,visualViewport:true,save:{S:12,stones:555,tn:4}}),before=g.state();
  g.resize(390,480);const after=g.state();assert.equal(g.sandbox.XP.vh,480);assert.equal(g.api.layout().height*g.api.layout().scale,480);
  for(const key of ['S','stones','tn','dj','rb'])assert.equal(after[key],before[key]);
});
