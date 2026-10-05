'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
function pointerClick(g,x,y){g.sandbox.XUI.pointerDown(x,y);g.sandbox.XUI.pointerUp(x,y);g.api.step(.016);}

test('a scrolled technique purchase hits the visible technique, never a different hidden row',()=>{
  const g=createGame({save:{S:36,stones:1e7}});g.api.switchTab('gongfa');g.render();
  const view=g.scrollViews.get('gongfa-list');g.sandbox.XUI.wheel(view.x+40,view.y+100,100);g.render();
  const row=g.uiControls.get('gf-4');const off=g.scrollViews.get('gongfa-list').state.off;
  assert.ok(row.y-off>=view.y&&row.y-off+row.h<=view.y+view.h);
  pointerClick(g,row.x+row.w/2,row.y-off+row.h/2);
  assert.equal(g.state().gf[4],1);assert.equal(g.state().gf[1],0);
});
test('dragging from a technique button scrolls rather than purchasing it',()=>{
  const g=createGame({save:{S:36,stones:1e7}});g.api.switchTab('gongfa');g.render();
  const row=g.uiControls.get('gf-1'),u=g.sandbox.XUI;
  u.pointerDown(row.x+row.w/2,row.y+row.h/2);u.pointerMove(row.x+row.w/2,row.y-70);u.pointerUp(row.x+row.w/2,row.y-70);g.render();
  assert.ok(g.scrollViews.get('gongfa-list').state.off>0);assert.equal(g.state().gf[1],0);
});
test('a modal backdrop blocks scrolling the hidden technique list',()=>{
  const g=createGame({save:{S:36,stones:1e7}});g.api.switchTab('gongfa');g.render();
  const view=g.scrollViews.get('gongfa-list');g.api.openModal('settings');g.render();
  g.sandbox.XUI.wheel(view.x+40,view.y+100,100);g.render();assert.equal(g.scrollViews.get('gongfa-list').state.off,0);
});
test('a clipped-out technique cannot intercept input above the panel',()=>{
  const g=createGame({save:{S:36,stones:1e7}});g.api.switchTab('gongfa');g.render();
  const view=g.scrollViews.get('gongfa-list');g.sandbox.XUI.wheel(view.x+30,view.y+100,120);g.render();
  const off=g.scrollViews.get('gongfa-list').state.off,row=g.uiControls.get('gf-0');
  assert.ok(row.y-off+row.h<view.y);
  pointerClick(g,row.x+row.w/2,row.y-off+row.h/2);assert.equal(g.state().gf[0],0);
});

test('a modal opened between press and release cancels the background purchase',()=>{
  const g=createGame({save:{S:8,stones:10000}});g.render();const row=g.uiControls.get('buy-sj'),u=g.sandbox.XUI;
  u.pointerDown(row.x+row.w/2,row.y+row.h/2);g.api.openModal('settings');g.render();
  u.pointerUp(row.x+row.w/2,row.y+row.h/2);g.render();assert.equal(g.state().sj,0);
});
test('the realm list can be dragged inside its modal without hitting the backdrop',()=>{
  const g=createGame();g.api.openModal('realm');g.render();const v=g.scrollViews.get('realm-list'),u=g.sandbox.XUI;
  u.pointerDown(v.x+80,v.y+240);u.pointerMove(v.x+80,v.y+80);u.pointerUp(v.x+80,v.y+80);g.render();
  assert.ok(g.scrollViews.get('realm-list').state.off>0);assert.equal(g.state().modal,'realm');
});
test('a small release outside a button does not purchase',()=>{
  const g=createGame({save:{S:8,stones:10000}});g.render();const row=g.uiControls.get('buy-sj'),u=g.sandbox.XUI;
  u.pointerDown(row.x+row.w-3,row.y+row.h/2);u.pointerUp(row.x+row.w+3,row.y+row.h/2);g.render();assert.equal(g.state().sj,0);
});
test('repeated quest taps cannot claim the same reward twice',()=>{
  const g=createGame({save:{kills:10,level:11}});g.api.switchTab('quest');g.render();const row=g.uiControls.get('quest-first-blood');
  pointerClick(g,row.x+row.w/2,row.y+row.h/2);const after=g.state().stones;
  pointerClick(g,row.x+row.w/2,row.y+row.h/2);assert.equal(g.state().stones,after);assert.ok(g.state().quests.find(q=>q.id==='first-blood').done);
});
test('rebirth confirmation expires, then requires a fresh two-tap decision',()=>{
  const g=createGame({save:{S:32}});g.api.openModal('realm');g.render();const row=g.uiControls.get('rebirth');
  pointerClick(g,row.x+row.w/2,row.y+row.h/2);assert.equal(g.state().rb,0);g.step(6);
  pointerClick(g,row.x+row.w/2,row.y+row.h/2);assert.equal(g.state().rb,0);
  pointerClick(g,row.x+row.w/2,row.y+row.h/2);assert.equal(g.state().rb,1);
});
test('backgrounding clears a held purchase gesture',()=>{
  const g=createGame({save:{S:8,stones:10000}});g.render();const row=g.uiControls.get('buy-sj'),u=g.sandbox.XUI;
  u.pointerDown(row.x+row.w/2,row.y+row.h/2);g.show(1);u.pointerUp(row.x+row.w/2,row.y+row.h/2);g.render();assert.equal(g.state().sj,0);
});
test('scrolled purchases remain correct at short desktop and tall phone logical layouts',()=>{
  for(const [width,height] of [[960,600],[390,844]]) {
    const g=createGame({width,height,save:{S:36,stones:1e7}});g.api.switchTab('gongfa');g.render();
    const v=g.scrollViews.get('gongfa-list');g.sandbox.XUI.wheel(v.x+40,v.y+100,100);g.render();
    const row=g.uiControls.get('gf-4'),off=g.scrollViews.get('gongfa-list').state.off;
    pointerClick(g,row.x+row.w/2,row.y-off+row.h/2);assert.equal(g.state().gf[4],1);
  }
});
