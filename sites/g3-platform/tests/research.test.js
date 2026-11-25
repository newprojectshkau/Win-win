import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,simulateSymbol,countEvents,validateConfig} from '../engine.js';
import {createDemoDataset} from './fixture-data.js';
import {runWindow} from '../performance.js';
import {parseSlippageRates,parseEntryLimits,runResearch} from '../research.js';
function bars(){return Array.from({length:390},(_,i)=>{const close=i<30?100:i===30?101:99;return {open:close,close,time:new Date(Date.UTC(2026,9,13,13,30+i)).toISOString(),availableAt:new Date(Date.UTC(2026,9,13,13,31+i)).toISOString()};});}
test('rates are bounded, unit-explicit, and deduplicated',()=>{
 assert.deepEqual(parseSlippageRates('5, 10,5,100'),[5,10,100]);
 for(const t of ['',',','NaN','-5','1001','5,',Array(14).fill('5').join(',')])assert.throws(()=>parseSlippageRates(t));
 assert.deepEqual(parseEntryLimits('0,0.25,1,0.25'),[0,.25,1]);
 assert.throws(()=>parseEntryLimits('1,11'));
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
test('research crosses both axes and compares each protection to its own unprotected control', async () => {
  const dataset = createDemoDataset();
  const config = {...DEFAULT_CONFIG, priceMin:1, feeModel:'ibkr_tiered', slippageBps:90, entryChaseLimit:2};
  const original = structuredClone(config);
  const dates = dataset.instruments[0].sessions;
  const window = {startDate:dates.at(-2).date, endDate:dates.at(-1).date};
  const r = await runResearch(dataset, config, {...window, rates:[50], limits:[.25, 1]});

  assert.deepEqual(config, original);
  assert.deepEqual(r.rates, [5, 50]);
  assert.deepEqual(r.limits, [-1, .25, 1]);
  assert.equal(r.dataHash.length, 64);
  assert.equal(r.rows[0].label, 'baseline');
  assert.equal(r.baseline.slippageBps, 5);
  assert.equal(r.baseline.entryChaseLimit, -1);
  assert.deepEqual(r.rows.map(({config:c}) => [c.slippageBps,c.entryChaseLimit]),
    [[5,-1],[5,.25],[5,1],[50,-1],[50,.25],[50,1]]);
  const standalone = await runWindow(dataset, r.rows[4].config, window);
  assert.deepEqual(r.rows[4].summary, standalone.summary);
  assert.equal(r.rows[4].netVsUnprotected, standalone.summary.net - r.rows[3].summary.net);
  assert.ok(r.rows[0].summary.entryAttempts > 0);
  assert.equal(r.rows[0].summary.entryFillRate, 1);
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
