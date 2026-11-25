import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRuns,runWindow} from '../performance.js';
import {DEFAULT_CONFIG} from '../engine.js';
import {createDemoDataset} from './fixture-data.js';

function manualDay(date,net,fees=0,fills=[]) {
  return {data:{date},fills,slots:{AM:{gate:{status:'passed'},symbols:[{symbol:'TEST',net,fees,fills}]},PM:{gate:{status:'below'},symbols:[]}},summary:{net,fees,orders:fills.length,eligible:1,residual:0}};
}
test('cost attribution and close drawdown include initial zero and retain no-trade days',()=>{
  const fills=[{quantity:10,reference:100,price:100.05},{quantity:10,reference:102,price:101.95}];
  const r=summarizeRuns([manualDay('2026-10-15',-5,2,fills),manualDay('2026-10-16',15,2,fills),manualDay('2026-10-19',0),manualDay('2026-10-20',-12,2,fills)]);
  assert.equal(r.summary.net,-2);
  assert.equal(r.summary.maxCloseDrawdown,12);
  assert.equal(r.summary.activeDays,3);
  assert.equal(r.summary.winningDayRate,1/3);
  assert.equal(r.summary.orders,6);
  assert.ok(Math.abs(r.summary.slippage-3)<1e-9);
  assert.ok(Math.abs(r.summary.grossBeforeCosts-7)<1e-9);
  assert.deepEqual(r.days.map(d=>d.cumulative),[-5,10,10,-2]);
  assert.equal(r.symbols[0].net,-2);
});
test('zero trades has no defined win rate',()=>{
  const r=summarizeRuns([manualDay('2026-10-15',0)]);
  assert.equal(r.summary.winningDayRate,null);assert.equal(r.summary.maxCloseDrawdown,0);
});
test('rolling replay rejects missing warmup and does not use future bars',async()=>{
  const data=createDemoDataset();data.instruments=data.instruments.slice(0,2);
  const dates=data.instruments[0].sessions.map(s=>s.date);
  await assert.rejects(runWindow(data,DEFAULT_CONFIG,{startDate:dates[19],endDate:dates.at(-1)}),/20/);
  await assert.rejects(runWindow(data,DEFAULT_CONFIG,{startDate:'1900-01-01',endDate:dates.at(-1)}),/交易日/);
  const original=await runWindow(data,DEFAULT_CONFIG,{startDate:dates[20],endDate:dates[21]});
  const changed=structuredClone(data);
  for(const i of changed.instruments)for(const b of i.sessions[21].bars){b.close*=1.001;b.high=Math.max(b.high,b.close);b.low=Math.min(b.low,b.close);}
  const next=await runWindow(changed,DEFAULT_CONFIG,{startDate:dates[20],endDate:dates[21]});
  assert.equal(original.days.length,2);
  assert.deepEqual(original.runs[0],next.runs[0]);
  assert.equal(original.runs[0].data.date,dates[20]);
  assert.equal(original.runs[1].data.previousDate,dates[20]);
});
