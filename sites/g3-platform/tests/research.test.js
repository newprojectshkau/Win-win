import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,simulateSymbol,countEvents,validateConfig} from '../engine.js';
import {createDemoDataset} from './fixture-data.js';
import {runWindow} from '../performance.js';
import {parseSlippageRates,parseEntryLimits,runResearch} from '../research.js';
function bars(){return Array.from({length:390},(_,i)=>{const close=i<30?100:i===30?101:99;return {open:close,close,time:new Date(Date.UTC(2026,9,13,13,30+i)).toISOString(),availableAt:new Date(Date.UTC(2026,9,13,13,31+i)).toISOString()};});}
test('rates are bounded, unit-explicit, and deduplicated',()=>{
 assert.deepEqual(parseSlippageRates('5, 10,5,100'),[5,10,100]);
 assert.deepEqual(parseEntryLimits('.25，0.5,0.5,1'),[.25,.5,1]);
 for(const t of ['', '-1', '10.01', '0.25,'])assert.throws(()=>parseEntryLimits(t));
 for(const t of ['',',','NaN','-5','1001','5,',Array(14).fill('5').join(',')])assert.throws(()=>parseSlippageRates(t));
 assert.throws(()=>validateConfig({...DEFAULT_CONFIG,entryChaseLimit:-.5}));
 assert.throws(()=>validateConfig({...DEFAULT_CONFIG,entryChaseLimit:Infinity}));
});
test('new entry can be rejected but reversal always closes old position',()=>{
 const b=bars();b[31].open=101;b[32].open=98; // first entry at signal price; short reversal is two bricks too far
 const r=simulateSymbol({symbol:'X',slot:'AM',bars:b,quantity:100,config:{...DEFAULT_CONFIG,slippageBps:0,entryChaseLimit:.5}});
 assert.deepEqual(r.fills.map(f=>f.action),['open_long','close_reverse']);
 assert.equal(r.position,0);assert.equal(r.rejectedEntries.length,1);assert.equal(r.entryAttempts,2);
 assert.equal(r.rejectedEntries[0].direction,-1);assert.equal(r.rejectedEntries[0].chaseBricks,2);
 assert.equal(r.net,r.fills.reduce((s,f)=>s+f.netContribution,0));
});
test('guard uses adverse movement plus slippage, permits exact cap, never gates scheduled exit',()=>{
 const b=bars();b[31].open=101.25;b[32].open=100; // .25 / .5 = .5 brick cap
 const config={...DEFAULT_CONFIG,slippageBps:0,entryChaseLimit:.5};
 const exact=simulateSymbol({symbol:'X',slot:'AM',bars:b,quantity:100,config});
 assert.equal(exact.fills[0].action,'open_long');assert.ok(exact.fills.some(f=>f.action==='slot_exit'));assert.equal(exact.position,0);
 const costly=simulateSymbol({symbol:'X',slot:'AM',bars:b,quantity:100,config:{...config,slippageBps:5}});
 assert.ok(costly.rejectedEntries.some(e=>e.direction===1));
 const disabled=simulateSymbol({symbol:'X',slot:'AM',bars:b,quantity:100,config:{...config,entryChaseLimit:-1}});
 assert.equal(disabled.rejectedEntries.length,0);
});
test('simple percentage keeps its window reference; compound updates every event',()=>{
 const b=[{open:100,close:110,availableAt:'x'}];
 assert.equal(countEvents(b,{mode:'percentage_simple',initial:100}).B,19);
 assert.equal(countEvents(b,{mode:'fixed',initial:100}).B,19);
 assert.equal(countEvents(b,{mode:'percentage',initial:100}).B,19); // anchors, not just counts, distinguish them
 assert.notEqual(countEvents(b,{mode:'percentage',initial:100}).anchor,countEvents(b,{mode:'percentage_simple',initial:100}).anchor);
});
test('research freezes configs and period; baseline and independent fee runs reproduce',async()=>{
 const d=createDemoDataset(),config={...DEFAULT_CONFIG,priceMin:1,feeModel:'ibkr_tiered',entryChaseLimit:.75};
 const original=structuredClone(config),startDate=d.instruments[0].sessions.at(-2).date,endDate=d.instruments[0].sessions.at(-1).date;
 const r=await runResearch(d,config,{startDate,endDate,rates:[5,50]});
 assert.equal(r.rows.length,5);assert.deepEqual(config,original);assert.equal(r.dataHash.length,64);
 const standalone=await runWindow(d,{...config,entryChaseLimit:-1},{startDate,endDate});
 assert.deepEqual(r.rows[0].summary,standalone.summary);
 assert.equal(r.rows.at(-1).config.slippageBps,50);assert.equal(r.baseline.entryChaseLimit,-1);assert.equal(r.rows[1].config.entryChaseLimit,.25);
 assert.ok(r.rows[0].summary.entryAttempts>0);assert.equal(r.rows[0].summary.entryFillRate,1);
});
test('matrix compares every guard against the unguarded result at the same slippage',async()=>{
 const d=createDemoDataset(),config={...DEFAULT_CONFIG,priceMin:1,entryChaseLimit:1,slippageBps:90};
 const date=d.instruments[0].sessions.at(-1).date;
 const progress=[];
 const r=await runResearch(d,config,{startDate:date,endDate:date,design:'matrix',baselineBps:5,rates:[5,50],limits:[.25,.5],onProgress:(...value)=>progress.push(value)});
 assert.deepEqual(r.rows.map(({config:c})=>[c.slippageBps,c.entryChaseLimit]),[[5,-1],[5,.25],[5,.5],[50,-1],[50,.25],[50,.5]]);
 assert.deepEqual(progress.at(-1),[6,6]);
 assert.equal(r.rows[4].deltaFromUnguardedAtSameSlippage.net,r.rows[4].summary.net-r.rows[3].summary.net);
 assert.equal(r.rows[4].deltaFromBaseline.net,r.rows[4].summary.net-r.rows[0].summary.net);
 assert.equal(r.rows[3].deltaFromUnguardedAtSameSlippage,null);
});
test('separates a one-brick breach from signal movement and modeled execution slippage', () => {
  const b = bars();
  b[31].open = 101.6; // 0.6 adverse move from the long signal of 101.
  b[32].open = 99;    // No adverse move from the short signal of 99.
  const result = simulateSymbol({symbol:'X', slot:'AM', bars:b, quantity:100,
    config:{...DEFAULT_CONFIG, slippageBps:75, entryChaseLimit:1}});
  assert.equal(result.signalMovesOverBrick, 1);
  assert.equal(result.entrySlippagesOverBrick, 2);
  assert.equal(result.rejectedEntries.length, 2);
});
