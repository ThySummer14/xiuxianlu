'use strict';
const { createGame } = require('../tests/harness.cjs');
const cp=require('node:child_process');
const ref=process.argv.find(x=>x.startsWith('--ref='))?.slice(6);
const cache={};
const source=ref?(name,current)=>cache[name] ||= cp.execFileSync('git',['show',ref+':assets/'+name+'.js'],{encoding:'utf8',maxBuffer:2e6}):undefined;
const make=options=>createGame({...options,source});
const g = make();
const B = g.XB;
const rows = [0,4,8,16,24,32,40,48,58].map(S => ({
  stage: S, realm: B.realmName(S),
  unassistedStageSeconds: Math.round(B.expNeed(S) / B.meditationRate(S, 0, 1, 1, 1)),
  teaRecipeCost: B.marketProfitCost(0, 0, S),
  teaRecipePaybackSeconds: Math.round(B.marketProfitCost(0, 0, S) / (B.marketRate([4,0,0,0,0], S, 1, 1, [1,0,0,0,0]) - B.marketRate([4,0,0,0,0], S, 1, 1))),
  rebirthReward: B.daoJiGain(S),
}));
const rich = { S: 16, level: 40, tn: 20, gf: [5,5,5,5,5,5,5], cmp: [30,30,30,30,30,30,30], mk: [20,10,5,1,0], mp: [3,2,1,0,0], dj: 10, bond: 8, epip: 5, sectId: 'dantang', sectLv: { dt1: 5, dt2: 5, ts1: 3, qy2: 3, wb2: 3 } };
const rates = make({save:rich});
const before = rates.state();
const expectedOffline = make({save:{...rich, ts:1800000000000-3600000}}).state().offline;
const actualResume = rates.api.simulateReturn(3600);
console.log(JSON.stringify({baseCommit:ref||'working-tree',rows,offline:{expectedReload:expectedOffline,actualResume}, bonuses:{onlineMeditation:before.medRate, expectedAllBonuses: B.meditationRate(16,20,(1+.12*5)*B.insightBonus(30)*(1+.1*5)*B.insightBonus(30)*(1+.12*5),B.daoJiMult(10),1)*B.bondMult(8)*B.epiphanyMult(5)*1.4,critRate:before.critRate,critMult:before.critMult}}, null, 2));
