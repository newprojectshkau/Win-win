import test from 'node:test';
import assert from 'node:assert/strict';
import {chartSeries,compatibleCharts} from '../charts.js';
const days=[{date:'2026-10-20',net:-20,turnover:1000,orders:2,fees:2,slippage:1,blockedSlots:1},{date:'2026-10-21',net:10,turnover:2000,orders:4,fees:4,slippage:2,blockedSlots:0}];
test('mixed-unit relative charts preserve signs, exact raw values and missing-data flags',()=>{
 const s=chartSeries([{label:'目前',days}],['net','turnover','orders','costs'],true);
 assert.deepEqual(s[0].points.map(p=>p.value),[-100,50]);assert.notEqual(s[0].dash,s[1].dash);
 assert.deepEqual(s[1].points.map(p=>p.value),[50,100]);
 assert.deepEqual(s[2].points.map(p=>p.raw),[2,4]);
 assert.deepEqual(s[3].points.map(p=>p.raw),[3,6]);assert.equal(s[0].points[0].blocked,1);
 assert.deepEqual(chartSeries([{days:days.map(d=>({...d,net:0}))}],['net'],true)[0].points.map(p=>p.value),[0,0]);
});
test('parameter comparisons use common metric scale and retain only compatible datasets/dates',()=>{
 const b={label:'基準',days};const c={label:'目前',days:days.map(d=>({...d,net:d.net*2}))};
 assert.deepEqual(chartSeries([b,c],['net'],false).map(s=>s.points.map(p=>p.value)),[[-20,10],[-40,20]]);
 const a={dataHash:'abc',startDate:'2026-10-20',endDate:'2026-10-21'};
 assert.equal(compatibleCharts(a,{...a}),true);
 assert.equal(compatibleCharts(a,{...a,dataHash:'other'}),false);
 assert.equal(compatibleCharts(a,{...a,endDate:'2026-10-22'}),false);
});
