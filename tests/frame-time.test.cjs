'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('foreground cultivation and market income use real elapsed time at 10 and 60 FPS',()=>{
  const slow=createGame({save:{mk:[1,0,0,0,0]}}),fast=createGame({save:{mk:[1,0,0,0,0]}});
  slow.frame(16);fast.frame(16);
  for(let i=0;i<100;i++)slow.frame(100);
  for(let i=0;i<600;i++)fast.frame(1000/60);
  close(slow.state().exp,fast.state().exp);close(slow.state().stones,fast.state().stones);
});
test('a long foreground stall catches up through bounded offline settlement',()=>{
  const g=createGame({save:{mk:[1,0,0,0,0]}});g.frame(16);const before=g.state();g.frame(10000);
  close(g.state().exp-before.exp,5);close(g.state().stones-before.stones,18);
  assert.equal(g.state().modal,null);
});
test('animation frames while hidden cannot bypass background pause or duplicate rewards',()=>{
  const g=createGame({save:{mk:[1,0,0,0,0]}});g.frame(16);const before=g.state();
  g.sandbox.XP._fireHide();g.frame(10000);close(g.state().exp,before.exp);close(g.state().stones,before.stones);
  g.sandbox.XP._fireShow();close(g.state().exp-before.exp,5);close(g.state().stones-before.stones,18);
});
