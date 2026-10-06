'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGame,KEY}=require('./harness.cjs');
const saved=(fields={})=>JSON.stringify({v:3,balanceVersion:1,S:4,stones:321,exp:17,ts:1800000000000-86400000,...fields});
const addBackup=(g,key,fields)=>g.storage.set(KEY+key,saved(fields));

test('failed auto-save is visible and never reports a successful timestamp',()=>{
  const g=createGame({save:{S:4,stones:111}});const original=g.storage.get(KEY);
  g.failWrites(k=>k===KEY);g.api.addStones(50);g.step(4);
  assert.equal(g.state().saveError,true);assert.equal(g.storage.get(KEY),original);
  g.failWrites(null);assert.equal(g.api.persist(),true);assert.equal(g.state().saveError,false);
  assert.ok(g.state().lastSavedAt>0);
});
test('opening and previewing the vault never applies a backup',()=>{
  const g=createGame({save:{S:16,stones:9999}});addBackup(g,'_backup',{S:4,stones:321});
  const before=g.state();g.api.openVault();assert.ok(g.api.previewBackup(0));
  assert.equal(g.state().S,before.S);assert.equal(g.state().stones,before.stones);
  g.api.cancelBackupRestore();assert.equal(g.state().S,before.S);
});
test('confirmed restore preserves a rescue copy and never awards old offline time again',()=>{
  const g=createGame({save:{S:16,stones:9999,exp:50,sectLv:{dt1:3}}});
  addBackup(g,'_backup',{S:4,stones:321,exp:17,tn:8,mk:[4,0,0,0,0]});
  g.api.openVault();g.api.previewBackup(0);assert.equal(g.api.confirmBackupRestore(),true);
  assert.equal(g.state().S,4);assert.equal(g.state().stones,321);assert.equal(g.state().exp,17);assert.equal(g.state().tn,8);
  const rescue=JSON.parse(g.storage.get(KEY+'_before_restore'));assert.equal(rescue.S,16);assert.equal(rescue.stones,9999);
  assert.equal(g.save().ts,1800000000000);assert.equal(g.state().offline,null);
  assert.equal(g.api.confirmBackupRestore(),false);assert.equal(g.state().stones,321);
});
test('restore aborts before replacing progress if the rescue copy cannot be saved',()=>{
  const g=createGame({save:{S:16,stones:9999}});addBackup(g,'_backup',{S:4});
  g.api.openVault();g.api.previewBackup(0);g.failWrites(k=>k===KEY+'_before_restore');
  assert.equal(g.api.confirmBackupRestore(),false);assert.equal(g.state().S,16);assert.equal(g.save().S,16);
});
test('a failed primary replacement leaves the live character untouched and can be retried safely',()=>{
  const g=createGame({save:{S:16,stones:9999}});addBackup(g,'_backup',{S:4});
  g.api.openVault();g.api.previewBackup(0);g.failWrites(k=>k===KEY);
  assert.equal(g.api.confirmBackupRestore(),false);assert.equal(g.state().S,16);
  g.failWrites(null);assert.equal(g.api.confirmBackupRestore(),true);assert.equal(g.state().S,4);
});
test('the pre-restore rescue slot can reverse a completed recovery',()=>{
  const g=createGame({save:{S:16,stones:9999}});addBackup(g,'_backup',{S:4,stones:321});
  g.api.openVault();g.api.previewBackup(0);g.api.confirmBackupRestore();
  g.api.openVault();assert.ok(g.api.previewBackup(2));assert.equal(g.api.confirmBackupRestore(),true);
  assert.equal(g.state().S,16);assert.equal(g.state().stones,9999);
});
test('corrupt and newer-version backups cannot be confirmed',()=>{
  const g=createGame();g.storage.set(KEY+'_backup','not json');addBackup(g,'_previous',{v:99});
  g.api.openVault();assert.equal(g.api.previewBackup(0),false);assert.equal(g.api.previewBackup(1),false);
  assert.equal(g.api.confirmBackupRestore(),false);
});
test('a corrupt primary can be recovered from the title without first overwriting it with a new character',()=>{
  const g=createGame({rawSave:'broken-primary',noStart:true,storageEntries:{[KEY+'_previous']:saved({S:20,stones:555})}});
  g.api.openVault();g.api.previewBackup(1);assert.equal(g.api.confirmBackupRestore(),true);
  assert.equal(g.state().scene,'play');assert.equal(g.state().S,20);assert.equal(g.state().stones,555);
  assert.equal(g.storage.get(KEY+'_before_restore'),'broken-primary');
});
test('export works from live progress even when local storage is full',()=>{
  const g=createGame({save:{stones:100}});g.failWrites(()=>true);g.api.addStones(777);
  let exported=null;g.sandbox.XP.exportText=(name,raw,cb)=>{exported={name,raw};cb(null);};
  assert.equal(g.api.exportCurrentSave(),true);assert.equal(JSON.parse(exported.raw).stones,877);
  assert.match(exported.name,/\.json$/);
});
test('old-balance backups migrate once, with their progress fraction preserved',()=>{
  const g=createGame({save:{S:20}});addBackup(g,'_backup',{balanceVersion:0,S:11,exp:1234});
  g.api.openVault();g.api.previewBackup(0);g.api.confirmBackupRestore();
  const expected=1234*g.XB.expNeed(11)/g.XB.legacyExpNeed(11);
  assert.ok(Math.abs(g.state().exp-expected)<1e-6);assert.equal(g.save().balanceVersion,1);
});

test('an interrupted recovery preserves the newly earned live progress before replacing it',()=>{
  const g=createGame({save:{S:16,exp:12,stones:500}});addBackup(g,'_backup',{S:4,exp:17,stones:321});
  g.api.openVault();g.api.previewBackup(0);g.show(60);assert.equal(g.state().modal,'offline');
  const earned=g.state().exp;g.api.dismissOffline();assert.equal(g.state().modal,'restore');
  g.api.confirmBackupRestore();assert.equal(g.state().exp,17);assert.equal(JSON.parse(g.storage.get(KEY+'_before_restore')).exp,earned);
});
test('title recovery path cannot replace unreadable progress with a blank character',()=>{
  const g=createGame({rawSave:'unreadable-primary'});
  assert.equal(g.state().scene,'title');assert.equal(g.state().modal,'vault');assert.equal(g.storage.get(KEY),'unreadable-primary');
});
test('browser export produces the live JSON blob and releases its temporary object URL',async()=>{
  const g=createGame({save:{S:12,stones:1234},downloads:true});g.api.exportCurrentSave();
  assert.equal(g.downloads.length,1);const file=g.downloads[0];
  assert.equal(JSON.parse(await file.blob.text()).stones,1234);assert.equal(file.blob.type,'application/json;charset=utf-8');
  assert.match(file.name,/^xiuxianlu-save-\d+\.json$/);assert.equal(g.objectUrls.size,1);g.flushTimers();assert.equal(g.objectUrls.size,0);
});
test('original corrupt backup bytes can be exported without parsing or rewriting them',async()=>{
  const g=createGame({downloads:true});g.storage.set(KEY+'_backup','original damaged data');g.api.openVault();
  assert.equal(g.api.exportVaultBackup(0),true);assert.equal(await g.downloads[0].blob.text(),'original damaged data');
});
test('recovery confirmation cannot be invoked through a repeated tap on the preview row',()=>{
  const g=createGame({save:{S:16},downloads:true});addBackup(g,'_backup',{S:4});g.api.openVault();g.render();
  const row=g.uiControls.get('vault-restore-0'),u=g.sandbox.XUI;
  const tap=()=>{u.pointerDown(row.x+row.w/2,row.y+row.h/2);u.pointerUp(row.x+row.w/2,row.y+row.h/2);g.render();};
  tap();g.render();tap();assert.equal(g.state().S,16);assert.equal(g.state().modal,'restore');
  const confirm=g.uiControls.get('restore-confirm');u.pointerDown(confirm.x+confirm.w/2,confirm.y+confirm.h/2);u.pointerUp(confirm.x+confirm.w/2,confirm.y+confirm.h/2);g.render();
  assert.equal(g.state().S,4);
});

test('an exported file can be imported, previewed and confirmed on an empty installation',async()=>{
  const a=createGame({save:{S:24,stones:7890,tn:37},downloads:true});a.api.exportCurrentSave();
  const raw=await a.downloads[0].blob.text(),b=createGame();
  assert.equal(b.api.previewImportedSave(raw),true);assert.equal(b.state().S,0);
  assert.equal(b.api.confirmBackupRestore(),true);assert.equal(b.state().S,24);assert.equal(b.state().stones,7890);assert.equal(b.state().tn,37);
});
test('foreign, damaged, future-version and oversized imports leave the current character unchanged',()=>{
  const g=createGame({save:{S:16,stones:3000}});
  for(const raw of ['{}','not json',JSON.stringify({v:3,ts:123,otherGame:true}),saved({v:99}),saved({S:'not-a-number'}),' '.repeat(1024*1024+1)])assert.equal(g.api.previewImportedSave(raw),false);
  assert.equal(g.state().S,16);assert.equal(g.state().stones,3000);
});
test('cancelled and stale file reads cannot reopen or mutate a dismissed vault',()=>{
  const g=createGame({save:{S:16}});let done;
  g.sandbox.XP.readSaveFile=cb=>{done=cb;};g.api.openVault();g.api.importSaveFile();done(null,null);
  assert.equal(g.state().modal,'vault');g.api.importSaveFile();g.api.closeModal();done(null,saved({S:4}));
  assert.equal(g.state().modal,null);assert.equal(g.state().S,16);
});
