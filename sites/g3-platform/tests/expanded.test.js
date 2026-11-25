import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDataset} from './fixture-data.js';
import {DEFAULT_CONFIG as CURRENT_CONFIG,validateDataset,runReplay,simulateSymbol} from '../engine.js';
const DEFAULT_CONFIG={...CURRENT_CONFIG,priceMin:20,priceMax:1000};
function fixture(){
 const d=createDemoDataset();d.schemaVersion=2;
 for(const i of d.instruments)for(const s of i.sessions){
  s.daily={open:s.bars[0].open,close:s.bars.at(-1).close,high:Math.max(...s.bars.map(b=>b.high)),low:Math.min(...s.bars.map(b=>b.low)),volume:20000000};
  s.marketCap=100000000000;
 }
 return d;
}
test('official daily volume drives screening, not regular-minute sums',()=>{
 const d=fixture();for(const s of d.instruments[0].sessions) s.daily.volume=1;
 const r=runReplay(d,DEFAULT_CONFIG);assert.equal(r.screening[0].volume,1);assert.equal(r.screening[0].pass,false);
 assert.ok(r.screening.filter(s=>s.pass).length>3);
 assert.ok(r.slots.AM.selected.length>=10);assert.ok(r.slots.PM.selected.length>=10);
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
test('missing previous minutes excludes only that stock before ranking',()=>{
 const d=fixture();d.instruments[0].sessions.at(-2).bars=null;
 const r=runReplay(d,DEFAULT_CONFIG);assert.ok(r.slots.AM.excludedPrevious.includes(d.instruments[0].symbol));assert.ok(!r.slots.AM.ranked.some(x=>x.symbol===d.instruments[0].symbol));assert.ok(r.summary.orders>0);
});
test('missing current stock drops without replacement; future cap cannot change screening',()=>{
 const d=fixture();const before=runReplay(d,DEFAULT_CONFIG);const selected=before.slots.AM.selected[0].symbol;
 const i=d.instruments.find(i=>i.symbol===selected);i.sessions.at(-1).bars=null;i.sessions.at(-1).marketCap=1;
 const after=runReplay(d,DEFAULT_CONFIG);assert.deepEqual(after.screening,before.screening);assert.ok(after.slots.AM.excludedCurrent.includes(selected));assert.ok(after.slots.AM.symbols.some(x=>x.status==='traded'));assert.deepEqual(after.slots.AM.selected,before.slots.AM.selected);
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
test('IBKR complete coverage uses the exact average and flags missing cap despite a sufficient lower bound',()=>{
 const d=fixture();d.marketCapCoverage='complete';
 const sessions=d.instruments[0].sessions;
 const exact=runReplay(d,DEFAULT_CONFIG).screening[0];
 assert.equal(exact.cap,100000000000);assert.equal(exact.capBasis,'exact_average');
 sessions.at(-2).marketCap=null;sessions.at(-2).marketCapAvailableAt=null;
 const missing=runReplay(d,DEFAULT_CONFIG).screening[0];
 assert.equal(missing.cap,null);assert.equal(missing.capBasis,'missing_required');
 assert.equal(missing.dataIncomplete,true);assert.equal(missing.pass,false);
 assert.equal(runReplay(d,{...DEFAULT_CONFIG,marketCapPolicy:'research_lower_bound'}).screening[0].pass,true);
 sessions.at(-2).marketCap=100000000000;
 sessions.at(-2).marketCapAvailableAt=new Date(Date.parse(sessions.at(-2).bars.at(-1).availableAt)+1000).toISOString();
 sessions.at(-2).bars=null;
 assert.throws(()=>validateDataset(d),/市值可用時間/);
});
test('30-second data resets the 10:00 anchor using the last completed bar and executes once per bar',()=>{
 const d=fixture();
 d.instruments=d.instruments.slice(0,1);
 d.instruments[0].sessions=d.instruments[0].sessions.slice(-3);
 const cfg={...DEFAULT_CONFIG,lookback:2,gateEnabled:false,slippageBps:0};
 assert.throws(()=>runReplay(d,{...cfg,barSeconds:30}),/原始資料週期/);
 d.barSeconds=30;
 const iso=ms=>new Date(ms).toISOString();
 for(const session of d.instruments[0].sessions){
  session.bars=session.bars.flatMap(b=>{
   const middle=iso(Date.parse(b.time)+30000);
   return [{...b,availableAt:middle},{...b,time:middle}];
  });
 }
 const current=d.instruments[0].sessions.at(-1).bars;
 current[58]= {...current[58],open:100,high:100,low:100,close:100};
 current[59]= {...current[59],open:104,high:105,low:104,close:105};
 current[60]= {...current[60],open:105,high:115,low:105,close:115};
 current[61]= {...current[61],open:116,high:116,low:110,close:110};
 const r=runReplay(d,cfg);
 const symbol=r.slots.AM.symbols[0];
 assert.equal(r.data.barSeconds,30);
 assert.equal(symbol.initial,105);
 assert.equal(symbol.fills[0].time,current[60].availableAt);
 assert.equal(symbol.fills[0].reference,116);
 assert.equal(symbol.fills.filter(f=>f.time===current[60].availableAt).length,1);
 assert.ok(symbol.transitions[0].bricks>1);
 const longer=runReplay(d,{...cfg,barSeconds:90});
 assert.equal(longer.slots.AM.symbols[0].initial,105);
 assert.equal(longer.data.barSeconds,90);
 const opening=current[62];
 current.splice(63,1); // The next-minute open is known before its second half is missing.
 const gap=runReplay(d,{...cfg,barSeconds:60}).slots.AM.symbols[0];
 assert.equal(gap.status,'aborted_missing_data');
 assert.equal(gap.fills.length,1);
 assert.equal(gap.fills[0].time,opening.time);
 assert.equal(gap.fills[0].reference,opening.open);
});
test('isolated gaps exclude previous or observation data, and a trading gap preserves earlier fills',()=>{
 const d=fixture();
 const cfg={...DEFAULT_CONFIG,gateEnabled:false};
 const before=runReplay(d,cfg);
 const [during,observed]=before.slots.AM.symbols.filter(s=>s.fills.length);
 const previous=d.instruments.find(i=>!before.slots.AM.selected.some(row=>row.symbol===i.symbol) && before.screening.find(s=>s.symbol===i.symbol).pass)
   ?? d.instruments.find(i=>![during.symbol,observed.symbol].includes(i.symbol));
 previous.sessions.at(-2).bars.splice(120,1);
 const sessions=symbol=>d.instruments.find(i=>i.symbol===symbol).sessions;
 const bars=sessions(during.symbol).at(-1).bars;
 const firstOpen=bars.findIndex(bar=>bar.time===during.fills[0].time);
 const gap=bars[firstOpen+1].time;
 bars.splice(firstOpen+1,1);
 sessions(observed.symbol).at(-1).bars.splice(20,1);
 const after=runReplay(d,cfg);
 assert.ok(after.slots.AM.excludedCurrent.includes(observed.symbol));
 assert.ok(!after.slots.PM.excludedCurrent.includes(observed.symbol));
 assert.ok(!after.slots.AM.ranked.some(row=>row.symbol===previous.symbol));
 const stopped=after.slots.AM.symbols.find(s=>s.symbol===during.symbol);
 assert.equal(stopped.status,'aborted_missing_data');
 assert.deepEqual(stopped.fills,during.fills.filter(f=>f.time<gap));
 assert.notEqual(stopped.position,0);
 assert.equal(stopped.net,stopped.fills.reduce((total,fill)=>total+fill.netContribution,0));
 assert.ok(after.slots.AM.symbols.some(s=>s.symbol!==during.symbol&&s.status==='traded'));
 for(const instrument of d.instruments)instrument.sessions.at(-1).bars.splice(0,1);
 const blocked=runReplay(d,cfg);
 assert.equal(blocked.slots.AM.gate.status,'data_blocked');
 assert.equal(blocked.slots.AM.coverageStatus,'all_incomplete');
});

test('one custom window uses the chosen observation and exits at its own end',()=>{
 const d=fixture();
 d.instruments=d.instruments.slice(0,1);
 const [stock]=d.instruments;
 const today=stock.sessions.at(-1).bars;
 for(let i=40;i<46;i++){
  const open=i<44?100:105,close=i<43?100:105;
  Object.assign(today[i],{open,close,high:Math.max(open,close),low:Math.min(open,close)});
 }
 const cfg={...DEFAULT_CONFIG,gateEnabled:false,barSeconds:120,priceMin:1,rangeMin:0,volumeMin:0,
   tradingWindow:{start:'10:10',tradeStart:'10:12',end:'10:16'}};
 const r=runReplay(d,cfg);
 assert.deepEqual(Object.keys(r.slots),['CUSTOM']);
 const [result]=r.slots.CUSTOM.symbols;
 assert.equal(result.initial,100);
 assert.deepEqual(result.fills.map(f=>[f.action,f.time]),[
  ['open_long',today[44].time],
  ['slot_exit',today[45].availableAt],
 ]);
 assert.equal(result.position,0);
 assert.equal(r.slots.CUSTOM.window.observeEnd,42);
 assert.deepEqual(Object.keys(runReplay(d,{...cfg,tradingWindow:null}).slots),['AM','PM']);
 for(const window of [{...cfg.tradingWindow,tradeStart:'10:11'},{...cfg.tradingWindow,end:'10:14'},{...cfg.tradingWindow,start:'09:29'}])
  assert.throws(()=>runReplay(d,{...cfg,tradingWindow:window}),/自訂時段/);
});

test('editable AM and PM each rank, observe and exit within their own window',()=>{
 const d=fixture();
 d.instruments=d.instruments.slice(0,1);
 const today=d.instruments[0].sessions.at(-1).bars;
 const splitWindows={
  AM:{start:'10:10',tradeStart:'10:12',end:'10:16'},
  PM:{start:'12:04',tradeStart:'12:06',end:'12:10'},
 };
 for(const offset of [40,154]){
  for(let i=offset;i<offset+6;i++){
   const open=i<offset+4?100:105,close=i<offset+3?100:105;
   Object.assign(today[i],{open,close,high:Math.max(open,close),low:Math.min(open,close)});
  }
 }
 const cfg={...DEFAULT_CONFIG,gateEnabled:false,barSeconds:120,priceMin:1,rangeMin:0,volumeMin:0,splitWindows};
 const run=runReplay(d,cfg);
 assert.deepEqual(Object.keys(run.slots),['AM','PM']);
 for(const [key,offset] of [['AM',40],['PM',154]]){
  assert.equal(run.slots[key].symbols[0].initial,100);
  assert.deepEqual(run.slots[key].symbols[0].fills.map(f=>[f.action,f.time]),[
   ['open_long',today[offset+4].time],['slot_exit',today[offset+5].availableAt],
  ]);
 }
 const adjacent={...splitWindows,PM:{start:'10:16',tradeStart:'10:18',end:'10:22'}};
 assert.equal(runReplay(d,{...cfg,splitWindows:adjacent}).slots.PM.window.start,46);
 const overlap={...splitWindows,PM:{...splitWindows.PM,start:'10:14'}};
 assert.throws(()=>runReplay(d,{...cfg,splitWindows:overlap}),/午市觀察開始須等於或遲於早市結束/);
 const misaligned={...splitWindows,AM:{...splitWindows.AM,tradeStart:'10:11'}};
 assert.throws(()=>runReplay(d,{...cfg,splitWindows:misaligned}),/早市.*對齊/);
});
