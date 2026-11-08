import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,countEvents,runReplay,simulateSymbol,decideGate,ratio} from '../engine.js';
import {createDemoDataset} from './fixture-data.js';
test('new defaults and zero/equal RR have explicit meanings',()=>{
 assert.equal(DEFAULT_CONFIG.priceMin,200);assert.equal(DEFAULT_CONFIG.target,10000);assert.equal(DEFAULT_CONFIG.execution,'next_open');
 assert.equal(ratio(20,0),20);assert.equal(ratio(0,0),0);
 assert.equal(decideGate({B:0,R:0},{B:0,R:0}).status,'equal_pass');
 assert.equal(decideGate({B:20,R:2},{B:20,R:2},true,'skip').pass,false);
});
test('strict thresholds count only exceeded levels in both directions',()=>{
 const b=close=>({open:100,close,availableAt:'2026-10-13T14:00:00Z'});
 for(const mode of ['fixed','percentage']){
  assert.equal(countEvents([b(100.5)],{initial:100,mode}).B,0);
  assert.equal(countEvents([b(99.5)],{initial:100,mode}).B,0);
  assert.equal(countEvents([b(100.5001)],{initial:100,mode}).B,1);
 }
 assert.equal(countEvents([b(101)],{initial:100}).B,1);
});
test('every exact cutoff tie is selected, regardless of requested N',()=>{
 const d=createDemoDataset();const template=d.instruments[0];
 d.instruments=Array.from({length:12},(_,i)=>({...structuredClone(template),symbol:'T'+i}));
 const r=runReplay(d,{...DEFAULT_CONFIG,priceMin:1,priceMax:10000,rangeMin:0,volumeMin:0,capMin:0,candidates:2});
 for(const slot of Object.values(r.slots))assert.equal(slot.selected.length,12);
});
test('screening range uses each daily opening price, not previous close',()=>{
 const d=createDemoDataset();for(const i of d.instruments)for(const s of i.sessions)s.previousClose=1e6;
 const config={...DEFAULT_CONFIG,priceMin:1,priceMax:10000};const r=runReplay(d,config);
 const h=d.instruments[0].sessions.slice(-21,-1);
 const expected=h.reduce((sum,s)=>sum+(Math.max(...s.bars.map(b=>b.high))-Math.min(...s.bars.map(b=>b.low)))/s.bars[0].open,0)/20;
 assert.equal(r.screening[0].range,expected);
});
test('reversals close old quantity then open resized dollar exposure',()=>{
 const bars=Array.from({length:390},(_,i)=>{const close=i<30?100:i===30?135:80;return {open:close,close,time:new Date(Date.UTC(2026,9,13,13,30+i)).toISOString(),availableAt:new Date(Date.UTC(2026,9,13,13,31+i)).toISOString()};});
 const r=simulateSymbol({symbol:'X',bars,slot:'AM',quantity:100,config:{...DEFAULT_CONFIG,execution:'signal_close',slippageBps:0}});
 assert.deepEqual(r.fills.map(f=>[f.action,f.quantity]),[['open_long',74],['close_reverse',74],['reverse_short',125],['slot_exit',125]]);
 assert.equal(r.position,0);assert.equal(r.net,r.fills.reduce((n,f)=>n+f.netContribution,0));
});
