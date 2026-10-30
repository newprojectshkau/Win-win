import {replayValidated, validateDataset, validateConfig, ENGINE_VERSION, stockName} from './engine.js?v=20261030-ledger';

export function summarizeRuns(runs) {
  let cumulative=0, peak=0, maxDrawdown=0;
  const symbols=new Map();
  const days=runs.map(run=>{
    const slippage=run.fills.reduce((s,f)=>s+Math.abs(f.price-f.reference)*f.quantity,0);
    cumulative+=run.summary.net; peak=Math.max(peak,cumulative);
    const drawdown=peak-cumulative; maxDrawdown=Math.max(maxDrawdown,drawdown);
    for(const slot of Object.values(run.slots)) for(const row of slot.symbols){
      const v=symbols.get(row.symbol)||{symbol:row.symbol,name:stockName(row.symbol),net:0,fees:0,fills:0,turnover:0,tradedSessions:0};
      v.turnover+=row.fills.reduce((s,f)=>s+f.quantity*f.price,0);v.net+=row.net;v.fees+=row.fees;v.fills+=row.fills.length;v.tradedSessions+=Number(row.fills.length>0);symbols.set(row.symbol,v);
    }
    return {date:run.data.date,turnover:run.fills.reduce((s,f)=>s+f.quantity*f.price,0),tradedStocks:new Set(run.fills.map(f=>f.symbol)).size,net:run.summary.net,fees:run.summary.fees,slippage,grossBeforeCosts:run.summary.net+run.summary.fees+slippage,cumulative,drawdown,orders:run.summary.orders,eligible:run.summary.eligible,unassessed:run.summary.unassessed||0,blockedSlots:run.summary.blockedSlots||0,AM:run.slots.AM.gate.status,PM:run.slots.PM.gate.status};
  });
  const sum=k=>days.reduce((s,d)=>s+d[k],0);
  const activeDays=days.filter(d=>d.orders>0).length;
  return {days,symbols:[...symbols.values()],summary:{turnover:sum("turnover"),tradedStocks:new Set(runs.flatMap(r=>r.fills.map(f=>f.symbol))).size,net:cumulative,fees:sum('fees'),slippage:sum('slippage'),grossBeforeCosts:sum('grossBeforeCosts'),orders:sum('orders'),blockedSlots:sum('blockedSlots'),unassessedStockDays:sum('unassessed'),days:days.length,activeDays,winningDays:days.filter(d=>d.orders>0&&d.net>0).length,winningDayRate:activeDays?days.filter(d=>d.orders>0&&d.net>0).length/activeDays:null,maxCloseDrawdown:maxDrawdown,residual:runs.reduce((s,r)=>s+r.summary.residual,0)}};
}

export async function runWindow(dataset, config, {startDate,endDate,onProgress=()=>{}}={}) {
  validateDataset(dataset);validateConfig(config);
  const dates=dataset.instruments[0].sessions.map(s=>s.date);
  if(!dates.includes(startDate)||!dates.includes(endDate)||startDate>endDate)throw Error('開始及結束日期須是資料內的交易日，並按先後排列。');
  const start=dates.indexOf(startDate),end=dates.indexOf(endDate);
  if(start<config.lookback)throw Error(`開始日之前需要 ${config.lookback} 個完整交易日；不能縮短回看期補足。`);
  const runs=[];
  for(let i=start;i<=end;i++){
    // Each run receives only its own past window and current session, never future sessions.
    const window={...dataset,instruments:dataset.instruments.map(s=>({...s,sessions:s.sessions.slice(i-config.lookback,i+1)}))};
    runs.push(replayValidated(window,config));
    onProgress(runs.length,end-start+1);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {schemaVersion:1,engineVersion:ENGINE_VERSION,createdAt:new Date().toISOString(),startDate,endDate,data:{id:dataset.id,kind:dataset.kind,description:dataset.description,providerStatement:dataset.providerStatement,provenance:dataset.provenance,symbols:dataset.instruments.map(i=>i.symbol)},config:structuredClone(config),...summarizeRuns(runs),runs};
}
