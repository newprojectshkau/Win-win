import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFee,applyFeeSchedule} from '../fees.js';
const order=(quantity=100,price=25,side='buy',date='2026-09-30')=>({quantity,price,side,date});
const fixed={feeModel:'ibkr_fixed'},tiered={feeModel:'ibkr_tiered',exchangePerShare:.003};
test('IBKR published fixed examples, minimum and maximum',()=>{
 for(const [q,p,expected] of [[100,25,1],[1000,25,5],[1000,.25,2.5],[10,.2,.02]])assert.equal(calculateFee(order(q,p),fixed).broker,expected);
});
test('sell-only SEC/TAF, April effective date, October holiday, TAF cap',()=>{
 assert.equal(calculateFee(order(),fixed).sec,0);assert.equal(calculateFee(order(),fixed).taf,0);
 const sell=calculateFee(order(100,25,'sell'),fixed);assert.equal(sell.sec,.06);assert.equal(sell.taf,.02);
 assert.equal(calculateFee(order(100,25,'sell','2026-10-01'),fixed).taf,0);
 assert.equal(calculateFee(order(100,25,'sell','2026-04-03'),fixed).sec,0);
 assert.equal(calculateFee(order(100000,25,'sell'),fixed).taf,9.79);
 assert.throws(()=>calculateFee(order(1,25,'sell','2025-12-31'),fixed),/2026/);
});
test('tiered marginal threshold, calendar reset and capped-volume exclusion',()=>{
 const state={},c={...tiered,initialMonthlyShares:299900};
 assert.equal(calculateFee(order(200,25),c,state).broker,.55);
 assert.equal(state.shares,300100);
 assert.equal(calculateFee(order(1000,25),c,state).broker,2);
 assert.equal(calculateFee(order(1000,25,'buy','2026-10-01'),c,state).broker,3.5);
 assert.equal(state.shares,1000);
 const cappedState={};calculateFee(order(1000,.01),tiered,cappedState);assert.equal(cappedState.shares,0);
});
test('fixed includes venue/clearing, tiered adds estimates, components reconcile',()=>{
 for(const c of [fixed,tiered]){
 const f=calculateFee(order(1000,25,'sell'),c);
 assert.equal(f.clearing,c===fixed?0:.2);assert.equal(f.exchange,c===fixed?0:3);
 assert.ok(Math.abs(['broker','sec','taf','cat','clearing','exchange','passThrough','rounding'].reduce((s,k)=>s+f[k],0)-f.total)<1e-10);
 }
 assert.equal(calculateFee(order(),{feeModel:'custom',commission:1.234}).total,1.234);
 assert.equal(calculateFee(order(1000,.01),tiered).clearing,.05);
});
test('fee application preserves gross price P&L and charges both reversal orders',()=>{
 const fills=[{side:'buy',quantity:10,price:100,amount:1000,realizedGross:0},{side:'sell',quantity:10,price:101,amount:1010,realizedGross:10},{side:'sell',quantity:10,price:101,amount:1010,realizedGross:0},{side:'buy',quantity:10,price:100,amount:1000,realizedGross:10}];
 const r={fills};applyFeeSchedule([r],fills,fixed,{},'2026-09-30');
 assert.equal(fills.length,4);assert.ok(r.fees>=4);assert.ok(Math.abs(r.net-(20-r.fees))<1e-9);
 assert.ok(Math.abs(fills.reduce((s,f)=>s+f.netContribution,0)-r.net)<1e-9);
 assert.equal(fills.at(-1).cash,r.net);
});
