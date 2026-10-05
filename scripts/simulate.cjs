'use strict';
// Policy experiments, not predictions of human retention. Uses the real game loop.
const fs=require('node:fs');
const cp=require('node:child_process');
const {createGame}=require('../tests/harness.cjs');
function simulate({duration=3600,seed=42,active=true,ref,save,events=true,policy='active'}={}) {
  const cached={};
  const source=ref ? (name,current) => cached[name] ||= cp.execFileSync('git',['show',`${ref}:assets/${name}.js`],{encoding:'utf8',maxBuffer:2e6}) : undefined;
  const g=createGame({seed,save,source,fast:true}),a=g.api,B=g.XB;
  const snapshots=[], milestones=[], purchases={shops:0,recipes:0,cultivation:0,combat:0,arts:0};
  let prevS=g.state().S, firstShop=null, injuries=0, prevInjury=0, failedPower=0, temperPower=0;
  const inputGap=policy==='idle'?60:policy==='investor'?10:2;
  const marketShare=policy==='explorer'?.35:policy==='investor'?.8:.65;
  a.joinSect('dantang');
  function invest(s) {
    for(const q of s.quests) if(q.ready) a.claimQuest(q.id);
    for(let i=0;i<s.missions.length;i++) if(s.missions[i]?.done) a.claimMission(i);
    for(const art of B.getSect('dantang').arts) {s=a.state();if(s.S>=art.reqS&&s.contrib>=B.sectArtCost(art,s.sectLv[art.id]||0)){a.learnArt(art.id);purchases.arts++;}}
    // Reinvest in production if it returns within three minutes at current realm.
    for(let k=0;k<12;k++) {
      s=a.state(); const mk=s.mk||g.save().mk||[0,0,0,0,0];
      if(s.towerBest<5&&!(B.BALANCE_VERSION&&s.S>=4))break;
      const candidates=[];
      for(let i=0;i<5;i++) {
        const cost=B.marketCost(i,mk[i]);
        const aggregate=mk.reduce((sum,n,j)=>sum+n*B.MARKET_SHOPS[j].rate*Math.pow(B.MARKET_PROFIT_R,s.mp[j]),0);
        const perUnit=aggregate>0?s.marketRate/aggregate:(B.marketRealmMult||B.realmMult)(s.S)*B.daoJiMult(s.dj);
        const base=B.MARKET_SHOPS[i].rate*Math.pow(B.MARKET_PROFIT_R,s.mp[i])*perUnit;
        if(cost<=s.stones*marketShare)candidates.push({kind:'shop',i,cost,roi:cost/base});
        if(mk[i]>=B.MARKET_PROFIT_UP[s.mp[i]+1]) {
          const pcost=B.marketProfitCost(i,s.mp[i],s.S);
          if(pcost<=s.stones*marketShare)candidates.push({kind:'recipe',i,cost:pcost,roi:pcost/(mk[i]*base*(B.MARKET_PROFIT_R-1))});
        }
      }
      candidates.sort((x,y)=>x.roi-y.roi);const pick=candidates[0];if(!pick||pick.roi>180)break;
      if(pick.kind==='shop'){a.buyMarket(pick.i);purchases.shops++;}else{a.buyMarketProfit(pick.i);purchases.recipes++;}
    }
    // Spend on direct progress as well; avoid the simulator's choosing income forever.
    s=a.state();
    if(s.stones>=B.costTuna(s.tn)*2){a.buy('tn');purchases.cultivation++;}
    for(let i=0;i<B.GONGFA.length;i++) {s=a.state();if(B.realmIdx(s.S)>=B.GONGFA[i].unlock&&s.stones>=B.gongfaCost(B.GONGFA[i],s.gf[i])*3){a.buyGongfa(i);purchases.cultivation++;}}
    for(const [key,fn] of [['sj',B.costSwordJue],['ss',B.costSwordShi],['ls',B.costBeast]]) {s=a.state();if(s.stones>=fn(s[key])*3){a.buy(key);purchases.combat++;}}
  }
  const dt=1;
  const clicks=policy==='idle'?0:policy==='explorer'?4:policy==='investor'?1:4;
  for(let t=0;t<duration;t+=dt) {
    let s=a.state();
    if(t%inputGap===0) {
      if(s.modal==='fate') {if(events)a.fateOption(0);else a.closeModal();}
      else if(s.modal)a.closeModal();
      if(s.canBreak&&s.atGate&&s.S<59)g.tap('bt-break');
      invest(a.state());
    }
    s=a.state();
    if(active&&s.mode==='home'&&s.injuryT<=0&&s.ph>=s.phMax*.95&&t%inputGap===0) {
      const plan=s.towerBest>=6&&failedPower>0&&s.totalPower<failedPower*1.4?'temper':'advance';
      a.enterTower(plan);if(plan==='temper')temperPower=s.totalPower;
    }
    if(s.towerPlan==='temper'&&s.totalPower>=Math.max(failedPower*1.4,temperPower*1.4))a.leaveTower();
    const n=t<30?4:clicks;
    for(let c=0;c<Math.max(1,n);c++){if(active&&n>0)a.attack();g.step(dt/Math.max(1,n));}
    s=a.state();if(s.injuryT>0&&prevInjury<=0){injuries++;failedPower=s.totalPower/B.INJURE_PENALTY;}prevInjury=s.injuryT;
    if(s.S>prevS){milestones.push({stage:s.S,atSeconds:Math.round(t+dt)});prevS=s.S;}
    if(firstShop===null&&(s.mk||g.save().mk||[]).some(x=>x>0))firstShop=Math.round(t+dt);
    if([900,1800,3600,7200].includes(t+dt))snapshots.push({seconds:t+dt,S:s.S,realm:s.realmName,floor:s.level,frontier:s.towerBest,medRate:Math.round(s.medRate),marketRate:Math.round(s.marketRate),stones:Math.round(s.stones),tn:s.tn,shops:s.mk||g.save().mk,recipes:Array.from(s.mp)});
    if(s.S>=59)break;
  }
  const s=a.state();
  return {seed,duration,active,ref:ref||'working-tree',policy,inputGap,clicksPerSecond:clicks,firstShop,injuries,purchases,milestones,snapshots,final:{S:s.S,realm:s.realmName,floor:s.level,frontier:s.towerBest,tn:s.tn,dj:s.dj,exp:Math.round(s.exp),expNeed:s.expNeed,medRate:Math.round(s.medRate),marketRate:Math.round(s.marketRate)}};
}
if(require.main===module){const ref=process.argv.find(x=>x.startsWith('--ref='))?.slice(6);const duration=Number(process.argv.find(x=>x.startsWith('--seconds='))?.slice(10)||3600);console.log(JSON.stringify(simulate({ref,duration,active:!process.argv.includes('--passive'),policy:process.argv.find(x=>x.startsWith('--policy='))?.slice(9)||'active'}),null,2));}
module.exports={simulate};
