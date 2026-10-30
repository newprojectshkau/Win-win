import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateSymbol,DEFAULT_CONFIG} from '../engine.js';
import {summarizeRuns} from '../performance.js';
function replay(third=true){
 const bars=Array.from({length:390},(_,i)=>{
  const close=i<30?100:i===30?101:(!third||i===31)?99:i===179?102:100;
  return {time:new Date(Date.UTC(2026,9,20,13,30+i)).toISOString(),availableAt:new Date(Date.UTC(2026,9,20,13,31+i)).toISOString(),open:close,high:close,low:close,close,volume:10000};
 });
 if(!third)bars[179].close=97;
 return simulateSymbol({symbol:'AAPL',bars,slot:'AM',quantity:2,config:{...DEFAULT_CONFIG,slippageBps:0,commission:1}});
}
test('long and short reversals: turnover and realized contributions reconcile by hand',()=>{
 const r=replay();
 assert.deepEqual(r.fills.map(f=>f.amount),[202,198,198,200,200,204]);
 assert.deepEqual(r.fills.map(f=>f.realizedGross),[0,-4,0,-2,0,4]);
 assert.deepEqual(r.fills.map(f=>f.netContribution),[-1,-5,-1,-3,-1,3]);
 assert.equal(r.turnover,1202);assert.equal(r.net,-8);
 assert.equal(r.fills.at(-1).cumulativeRealizedNet,r.net);
 assert.equal(r.fills[0].name,'Apple Inc.');
 const run={data:{date:'2026-10-20'},fills:r.fills,slots:{AM:{gate:{status:'passed'},symbols:[r]},PM:{gate:{status:'below'},symbols:[]}},summary:{net:r.net,fees:r.fees,orders:r.fills.length,eligible:1,residual:0}};
 const summary=summarizeRuns([run]);
 assert.equal(summary.days[0].turnover,1202);assert.equal(summary.summary.turnover,1202);assert.equal(summary.symbols[0].turnover,1202);assert.equal(summary.summary.tradedStocks,1);
});
test('short proceeds are not profit; profit is recognized when the short is covered',()=>{
 const r=replay(false);assert.deepEqual(r.fills.map(f=>f.realizedGross),[0,-4,0,4]);
 assert.equal(r.fills[2].netContribution,-1);assert.equal(r.fills.at(-1).netContribution,3);assert.equal(r.net,-4);
});
