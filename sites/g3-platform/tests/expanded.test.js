import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDataset} from './fixture-data.js';
import {DEFAULT_CONFIG,validateDataset,runReplay,simulateSymbol} from '../engine.js';
function fixture(){
 const d=createDemoDataset();d.schemaVersion=2;
 for(const i of d.instruments)for(const s of i.sessions){
  s.daily={close:s.bars.at(-1).close,high:Math.max(...s.bars.map(b=>b.high)),low:Math.min(...s.bars.map(b=>b.low)),volume:20000000};
  s.marketCap=100000000000;
 }
 return d;
}
test('official daily volume drives screening, not regular-minute sums',()=>{
 const d=fixture();for(const s of d.instruments[0].sessions) s.daily.volume=1;
 const r=runReplay(d,DEFAULT_CONFIG);assert.equal(r.screening[0].volume,1);assert.equal(r.screening[0].pass,false);
 assert.ok(r.screening.filter(s=>s.pass).length>3);
 assert.equal(r.slots.AM.selected.length,10);assert.equal(r.slots.PM.selected.length,10);
});
test('partial cap observations prove a lower bound only; insufficient bound remains unassessed',()=>{
 const d=fixture();const sessions=d.instruments[0].sessions;
 for(const s of sessions){s.marketCap=null;s.marketCapAvailableAt=null;}
 sessions.at(-2).marketCap=50000000000;sessions.at(-2).marketCapAvailableAt=sessions.at(-2).bars.at(-1).availableAt;
 let r=runReplay(d,DEFAULT_CONFIG).screening[0];
 assert.equal(r.cap,2500000000);assert.equal(r.knownCaps,1);assert.equal(r.capBasis,'nonnegative_lower_bound');assert.equal(r.pass,true);
 sessions.at(-2).marketCap=40000000000;
 r=runReplay(d,DEFAULT_CONFIG).screening[0];assert.equal(r.pass,false);assert.equal(r.dataIncomplete,true);
});
test('missing eligible previous minutes blocks whole ranking slot, never substitutes stocks',()=>{
 const d=fixture();d.instruments[0].sessions.at(-2).bars=null;
 const r=runReplay(d,DEFAULT_CONFIG);assert.equal(r.slots.AM.gate.status,'data_blocked');assert.equal(r.slots.PM.gate.status,'data_blocked');assert.equal(r.summary.orders,0);
});
test('missing selected current minutes blocks whole slot; future cap cannot change screening',()=>{
 const d=fixture();const before=runReplay(d,DEFAULT_CONFIG);const selected=before.slots.AM.selected[0].symbol;
 const i=d.instruments.find(i=>i.symbol===selected);i.sessions.at(-1).bars=null;i.sessions.at(-1).marketCap=1;
 const after=runReplay(d,DEFAULT_CONFIG);assert.deepEqual(after.screening,before.screening);assert.equal(after.slots.AM.gate.status,'data_blocked');
});
test('packed bars roundtrip and malformed values cannot bypass validation',()=>{
 const d=fixture();const s=d.instruments[0].sessions[0];const original=s.bars;
 s.startMs=Date.parse(original[0].time);s.packedBars=original.map(b=>[b.open,b.high,b.low,b.close,b.volume]);delete s.bars;
 validateDataset(d);assert.deepEqual(s.bars,original);
 s.daily.volume=-1;assert.throws(()=>validateDataset(d),/日線/);
});
test('next-open fills use only following open, maintain timing and cash reconciliation',()=>{
 const d=fixture();const bars=d.instruments[0].sessions.at(-1).bars;
 const config={...DEFAULT_CONFIG,execution:'next_open'};
 const r=simulateSymbol({symbol:'X',bars,slot:'AM',quantity:10,config});assert.ok(r.fills.length>0);
 for(const f of r.fills.filter(f=>f.action!=='slot_exit')){
  const b=bars.find(b=>b.time===f.time);assert.ok(b);assert.equal(f.reference,b.open);
 }
 assert.equal(r.position,0);
 assert.ok(Math.abs(r.net-r.fills.reduce((s,f)=>s+(f.side==='sell'?1:-1)*f.quantity*f.price-f.fee,0))<1e-8);
 const first=r.fills[0];const changed=structuredClone(bars);const b=changed.find(b=>b.time===first.time);b.close*=1.02;b.high=Math.max(b.close,b.high);
 assert.deepEqual(simulateSymbol({symbol:'X',bars:changed,slot:'AM',quantity:10,config}).fills[0],first);
});
