'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createGame, KEY} = require('./harness.cjs');
const backup = (fields={}) => JSON.stringify({v:3,balanceVersion:1,S:4,stones:321,exp:17,ts:1800000000000,...fields});

function trackDialog(g) {
  const u=g.sandbox.XUI, text=u.text, button=u.button, backdrop=u.modalBackdrop;
  let active=false;
  const result={texts:[],buttons:new Map()};
  u.modalBackdrop=(...args)=>{active=true;return backdrop(...args);};
  u.text=(value,x,y,opt)=>{if(active)result.texts.push({value,x,y,opt});return text(value,x,y,opt);};
  u.button=(id,x,y,w,h,opt)=>{if(active)result.buttons.set(id,{x,y,w,h,opt});return button(id,x,y,w,h,opt);};
  result.render=()=>{active=false;result.texts.length=0;result.buttons.clear();g.render();};
  return result;
}
function click(g,id,scrollId) {
  const row=g.uiControls.get(id);assert.ok(row,`missing ${id}`);
  const view=scrollId&&g.scrollViews.get(scrollId),off=view?view.state.off:0;
  const x=row.x+row.w/2,y=row.y-off+row.h/2,u=g.sandbox.XUI;
  u.pointerDown(x,y);u.pointerUp(x,y);g.render();g.render();
}
function reveal(g,id,scrollId) {
  const row=g.uiControls.get(id),view=g.scrollViews.get(scrollId);assert.ok(row&&view);
  const target=Math.max(0,Math.min(view.state.contentH,row.y-view.y-12));
  g.sandbox.XUI.wheel(view.x+view.w/2,view.y+view.h/2,(target-view.state.off)/3);g.render();
  const off=view.state.off;
  assert.ok(row.y-off>=view.y-0.01&&row.y-off+row.h<=view.y+view.h+0.01,`${id} is not fully visible`);
}
function assertFooter(g,id) {
  const row=g.uiControls.get(id),layout=g.api.layout();assert.ok(row,`missing ${id}`);
  assert.ok(row.h*layout.scale>=44-0.001,`${id} below 44 CSS px`);
  assert.ok(row.w*layout.scale>=44-0.001,`${id} too narrow`);
  assert.ok(row.y>=layout.hudTop,`${id} above safe area`);
  assert.ok(row.y+row.h<=layout.height-layout.safeBottom,`${id} below safe area`);
}

for(const [width,height] of [[320,480],[375,667],[390,844],[600,300]]) {
  test(`mobile dialogs keep readable content and reachable fixed actions at ${width}×${height}`,()=>{
    const g=createGame({width,height,save:{S:32,stones:9999,tn:10}}),tracked=trackDialog(g);
    g.storage.set(KEY+'_backup',backup());
    const cases=[
      ['settings',()=>g.api.openModal('settings'),['close']],
      ['realm',()=>g.api.openModal('realm'),['rebirth','realm-close']],
      ['vault',()=>g.api.openVault(),['vault-close']],
      ['restore',()=>g.api.previewImportedSave(backup()),['restore-confirm','restore-cancel']],
      ['offline',()=>g.show(60),['offline-ok']],
      ['fate',()=>{g.api.closeModal();g.api.openFateEvent(3);},[]]
    ];
    for(const [kind,open,footers] of cases) {
      open();tracked.render();assert.equal(g.state().modal,kind);
      for(const id of footers)assertFooter(g,id);
      const scale=g.api.layout().scale;
      for(const [id,row] of tracked.buttons) {
        assert.ok(row.h*scale>=44-0.001,`${kind}/${id} height`);
        assert.ok(row.opt.size*scale>=14-0.001,`${kind}/${id} label`);
        assert.ok(g.sandbox.XUI.textW(row.opt.label,row.opt.size,false,700)<=row.w-16,`${kind}/${id} label overflows`);
      }
      for(const item of tracked.texts)assert.ok(item.opt.size*scale>=13-0.001,`${kind} has tiny text`);
      const view=g.scrollViews.get(kind==='realm'?'realm-list':'mobile-'+kind+'-body');
      assert.ok(view&&view.h>0);assert.ok(view.y>=g.api.layout().hudTop);
      if(footers.length)assert.ok(view.y+view.h<g.uiControls.get(footers[0]).y);
    }
    const story=createGame({width,height,save:{S:3}}),storyTracked=trackDialog(story);
    story.api.addExp(story.state().expNeed);story.api.breakthrough();storyTracked.render();
    assert.equal(story.state().modal,'story');assertFooter(story,'story-ok');
    click(story,'story-ok');assert.equal(story.state().modal,null);
  });
}

test('mobile settings scrolling preserves timed reset confirmation and a fixed Close action',()=>{
  const g=createGame({width:320,height:480,save:{S:16,stones:9999}});
  g.api.openModal('settings');g.render();const initialClose={...g.uiControls.get('close')};
  reveal(g,'reset','mobile-settings-body');
  assert.equal(g.uiControls.get('close').y,initialClose.y);
  click(g,'reset','mobile-settings-body');assert.equal(g.state().S,16);
  g.step(4);click(g,'reset','mobile-settings-body');assert.equal(g.state().S,16);
  click(g,'close');assert.equal(g.state().modal,null);assert.equal(g.state().S,16);
  g.api.openModal('settings');g.render();reveal(g,'reset','mobile-settings-body');
  click(g,'reset','mobile-settings-body');assert.equal(g.state().S,16);
  click(g,'reset','mobile-settings-body');assert.equal(g.state().S,0);
});

test('mobile realm confirmation remains in place after scrolling and can be cancelled without rebirth',()=>{
  const g=createGame({width:320,height:480,save:{S:32}});
  g.api.openModal('realm');g.render();const row={...g.uiControls.get('rebirth')},view=g.scrollViews.get('realm-list');
  g.sandbox.XUI.wheel(view.x+50,view.y+100,1000);g.render();assert.ok(view.state.off>0);
  click(g,'rebirth');g.render();assert.equal(g.state().rb,0);
  assert.equal(g.uiControls.get('rebirth').y,row.y);assert.equal(g.uiControls.get('realm-close').y,row.y);
  assert.ok(g.uiTexts.some(t=>String(t.text).includes('坊市归零')));
  click(g,'realm-close');assert.equal(g.state().modal,null);assert.equal(g.state().rb,0);
  g.api.openModal('realm');g.render();click(g,'rebirth');click(g,'rebirth');assert.equal(g.state().rb,1);
});

test('a scrolled mobile vault requires explicit restore confirmation and preserves undo',()=>{
  const g=createGame({width:320,height:480,save:{S:16,stones:9999},downloads:true});
  g.storage.set(KEY+'_backup',backup());g.api.openVault();g.render();
  reveal(g,'vault-restore-0','mobile-vault-body');click(g,'vault-restore-0','mobile-vault-body');
  assert.equal(g.state().modal,'restore');assert.equal(g.state().S,16);
  click(g,'restore-cancel');assert.equal(g.state().modal,'vault');assert.equal(g.state().S,16);
  g.render();reveal(g,'vault-restore-0','mobile-vault-body');click(g,'vault-restore-0','mobile-vault-body');
  click(g,'restore-confirm');assert.equal(g.state().S,4);
  assert.equal(JSON.parse(g.storage.get(KEY+'_before_restore')).S,16);
  g.api.openVault();g.render();reveal(g,'vault-restore-2','mobile-vault-body');click(g,'vault-restore-2','mobile-vault-body');
  click(g,'restore-confirm');assert.equal(g.state().S,16);
});

test('dragging a mobile fate option scrolls without selecting it; a tap resolves only once',()=>{
  const g=createGame({width:320,height:360});g.api.closeModal();g.api.openFateEvent(0);g.render();
  reveal(g,'fate-0','mobile-fate-body');const row=g.uiControls.get('fate-0'),view=g.scrollViews.get('mobile-fate-body'),u=g.sandbox.XUI;
  const y=row.y-view.state.off+row.h/2;
  u.pointerDown(row.x+row.w/2,y);u.pointerMove(row.x+row.w/2,y-50);u.pointerUp(row.x+row.w/2,y-50);g.render();
  assert.equal(g.state().modal,'fate');assert.equal(g.state().sgn,0);
  reveal(g,'fate-0','mobile-fate-body');click(g,'fate-0','mobile-fate-body');assert.equal(g.state().sgn,1);
  assert.equal(g.state().modal,null);assert.equal(g.state().errs.length,0);
});

test('mobile modal scroll does not reach the page behind it and Close stays live after resize',()=>{
  const g=createGame({width:320,height:480,save:{S:36,stones:1e8}});
  g.api.switchTab('gongfa');g.render();const background=g.scrollViews.get('gongfa-list');
  g.api.openVault();g.render();const body=g.scrollViews.get('mobile-vault-body');
  g.sandbox.XUI.wheel(body.x+50,body.y+100,100);g.render();assert.equal(background.state.off,0);
  g.resize(390,844);assertFooter(g,'vault-close');click(g,'vault-close');assert.equal(g.state().modal,null);
});

test('mobile modal footers respect top and bottom device safe areas',()=>{
  const g=createGame({width:390,height:844,save:{S:32},source:(name,src)=>name==='platform'?src
    .replace('var safeTop = 0;','var safeTop = 48;').replace('var safeBottom = 0;','var safeBottom = 34;'):src});
  assert.ok(g.api.layout().safeBottom>0);
  for(const [modal,ids] of [['settings',['close']],['realm',['rebirth','realm-close']]]) {
    g.api.openModal(modal);g.render();for(const id of ids)assertFooter(g,id);
  }
  g.api.openVault();g.render();assertFooter(g,'vault-close');
  g.api.previewImportedSave(backup());g.render();assertFooter(g,'restore-confirm');assertFooter(g,'restore-cancel');
});

test('short mobile realm confirmation starts at its warning instead of preserving the old list scroll',()=>{
  const g=createGame({width:600,height:300,save:{S:32}});
  g.api.openModal('realm');g.render();const view=g.scrollViews.get('realm-list');
  g.sandbox.XUI.wheel(view.x+30,view.y+20,1000);g.render();assert.ok(view.state.off>0);
  click(g,'rebirth');assert.equal(g.scrollViews.get('realm-list').state.off,0);assert.equal(g.state().rb,0);
  click(g,'realm-close');assert.equal(g.state().rb,0);
});

test('mobile fate modal still self-heals when its event has disappeared',()=>{
  const g=createGame({width:320,height:480});g.api.openModal('fate');g.render();
  assert.equal(g.state().modal,null);assert.equal(g.state().errs.length,0);
});
