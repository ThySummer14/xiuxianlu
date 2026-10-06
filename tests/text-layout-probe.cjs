'use strict';
const crypto=require('node:crypto');
const {createGame}=require('./harness.cjs');
function collect(disableCache=false){
 const g=createGame({images:true,fonts:true,width:390,height:844,save:{S:8,level:26,towerFloor:26,towerBest:26,stones:1e6},
  source:(name,src)=>disableCache&&name==='ui'?src.replace('var TEXT_CACHE_MAX_LENGTH = 2048;','var TEXT_CACHE_MAX_LENGTH = -1;'):src});
 for(const im of g.images)im.onload();g.api.openHuntEvent();g.render();
 const ctx=g.sandbox.XP.canvas.getContext('2d'),measure=ctx.measureText,hash=crypto.createHash('sha256');let count=0,draws=0,widthFactor=1;
 ctx.measureText=function(text){count++;return {width:measure.call(this,text).width*widthFactor+(parseFloat(this.letterSpacing)||0)*String(text).length};};
 ctx.fillText=function(...args){draws++;hash.update(JSON.stringify([args,this.font,this.fillStyle,this.textAlign,this.textBaseline]));};
 let peakEntries=0,peakUnits=0;
 for(let i=0;i<300;i++){
  if(i===5)g.fontsReady();
  if(i===60)g.api.openVault();
  if(i===100)g.resize(320,480);
  if(i===120)g.api.openModal('realm');
  if(i===150){widthFactor=1.12;g.fontEvent('loadingdone');}
  if(i===180)g.api.openModal('settings');
  if(i===200)ctx.letterSpacing='0.5px';
  if(i===220)g.resize(430,932);
  if(i===240){g.api.closeModal();g.api.switchTab('gongfa');}
  if(i===280)g.resize(360,800);
  if(i%15===0)g.api.addStones(i+7);
  g.frame(1000/60);g.uiTexts.length=0;
  const info=g.sandbox.XUI.textCacheInfo();peakEntries=Math.max(peakEntries,info.entries);peakUnits=Math.max(peakUnits,info.units);
 }
 return {frames:300,measureTextCalls:count,textDrawCalls:draws,textTraceSha256:hash.digest('hex'),peakEntries,peakUnits,state:JSON.parse(JSON.stringify(g.state()))};
}
module.exports={collect};
