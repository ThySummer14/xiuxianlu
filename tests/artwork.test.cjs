'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createGame}=require('./harness.cjs');
test('optional sanctuary loads once, renders at preserved aspect, and leaves game state untouched',()=>{
  const g=createGame({images:true,width:360,height:800,save:{S:0,stones:500}}),before=g.state();
  assert.equal(g.images.length,2);assert.equal(g.images[0].url,'assets/art/sanctuary-dawn-v1.webp');
  assert.equal(g.sandbox.XD.artStatus().ready,false);g.images[0].onload();g.render();
  assert.equal(g.sandbox.XD.artStatus().ready,true);assert.ok(g.imageDraws.length>0);
  const [,x,y,w,h]=g.imageDraws.at(-1);assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.equal(w/h,1024/1536);
  for(const key of ['S','stones','exp','tn','ph','dj'])assert.equal(g.state()[key],before[key]);
  g.resize(390,480);assert.equal(g.images.length,2);
});
test('blocked or unsupported artwork keeps the procedural game playable without retry storms',()=>{
  const g=createGame({images:true,save:{stones:500}});g.images[0].onerror();g.render();
  assert.equal(g.sandbox.XD.artStatus().failed,true);assert.equal(g.imageDraws.length,0);g.api.buy('sj');assert.equal(g.state().sj,1);
  for(let i=0;i<30;i++)g.render();assert.equal(g.images.length,2);
  const noImage=createGame();noImage.render();assert.equal(noImage.state().errs.length,0);
});
test('later realm scenery retains its distinct native progression background',()=>{
  const g=createGame({images:true,save:{S:36}});g.images[0].onload();g.render();assert.equal(g.imageDraws.length,0);
});
test('shipping illustration stays within phone asset budget and has an actual WebP header',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../assets/art/sanctuary-dawn-v1.webp'));assert.ok(b.length<350*1024);
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
});
function lum(h){const c=h.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){let [x,y]=[lum(a),lum(b)].sort((x,y)=>x-y);return(y+.05)/(x+.05);}
test('enabled gold and primary button labels have at least 4.5:1 contrast at both gradient stops',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../assets/ui.js'),'utf8');
  for(const [style,fg] of [['gold','#2f2a24'],['primary','#f4ecdc']]){
    const colors=src.match(new RegExp(style+": \\['(#[0-9a-f]+)', '(#[0-9a-f]+)'\\]"));assert.ok(colors);
    for(const bg of colors.slice(1))assert.ok(contrast(fg,bg)>=4.5,`${style}/${bg}: ${contrast(fg,bg)}`);
  }
  assert.match(src,/style === 'ghost' \|\| style === 'gold'/);
});
function physicalEvent(g,id){const b=g.uiControls.get(id),s=g.api.layout().scale;return {pointerId:17,isPrimary:true,pointerType:'touch',clientX:(b.x+b.w/2)*s,clientY:(b.y+b.h/2)*s,preventDefault(){}};}
for(const outcome of ['onload','onerror'])test(`art ${outcome} during touch leaves hitboxes and completed taps intact`,()=>{
 const g=createGame({images:true,noStart:true,width:390,height:844,save:{S:8,stones:10000}});g.render();
 const geometry=()=>JSON.stringify([...g.uiControls].map(([id,b])=>[id,b.x,b.y,b.w,b.h]));
 const before=geometry(),e=physicalEvent(g,'start');g.canvasEvent('pointerdown',e);
 g.images[0][outcome]();g.uiControls.clear();g.render();assert.equal(geometry(),before);
 g.canvasEvent('pointerup',e);g.canvasEvent('pointerleave',e);g.frame(16);g.frame(16);assert.equal(g.state().scene,'play');
 g.api.closeModal();g.render();const buy=physicalEvent(g,'buy-sj');g.canvasEvent('pointerdown',buy);g.canvasEvent('pointerup',buy);g.canvasEvent('pointerleave',buy);g.frame(16);
 assert.equal(g.state().sj,1);assert.equal(g.images.length,2);assert.equal(g.state().errs.length,0);
});
