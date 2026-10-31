// Official schedules reviewed 2026-10-31; see ibkr-fees.html for scope and sources.
export const FEE_VERSION='ibkr-us-20261031-v1';
export const FEE_COMPONENTS=['broker','sec','taf','cat','clearing','exchange','passThrough','rounding'];
export const feeModelLabel=c=>({custom:'自訂每筆成本',ibkr_fixed:'IBKR Pro 固定式',ibkr_tiered:'IBKR Pro 階梯式（估算）'}[c.feeModel||'custom']);
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
const ceilCent=n=>Math.max(0,Math.ceil((n-1e-10)*100)/100);
export function validateFees(c){
 if(!['custom','ibkr_fixed','ibkr_tiered'].includes(c.feeModel||'custom'))throw Error('Unknown fee model');
 for(const [k,max] of [['exchangePerShare',.1],['initialMonthlyShares',1e10]])if(c[k]!==undefined&&(!Number.isFinite(c[k])||c[k]<0||c[k]>max))throw Error('Invalid fee setting: '+k);
 if(c.initialMonthlyShares!==undefined&&!Number.isInteger(c.initialMonthlyShares))throw Error('Initial monthly shares must be an integer');
}
export function calculateFee({quantity,price,side,date},c,state={}){
 validateFees(c);
 if(!(Number.isInteger(quantity)&&quantity>0&&Number.isFinite(price)&&price>0&&['buy','sell'].includes(side)))throw Error('Invalid fee order');
 const parts=Object.fromEntries(FEE_COMPONENTS.map(k=>[k,0])),model=c.feeModel||'custom';
 if(model==='custom'){parts.broker=c.commission;return {...parts,total:c.commission,model,version:FEE_VERSION};}
 // Refuse unsupported years instead of silently applying today's regulatory rates.
 if(!/^2026-\d{2}-\d{2}$/.test(date))throw Error('IBKR fee schedule supports 2026 dates only; use custom costs for other years');
 const month=date.slice(0,7),tiered=model==='ibkr_tiered';
 if(state.month!==month){state.shares=state.month===undefined?(c.initialMonthlyShares||0):0;state.month=month;}
 const before=state.shares,value=quantity*price;
 let raw=quantity*.005;
 if(tiered){
  raw=0;let used=before,left=quantity;
  for(const [limit,rate] of [[300000,.0035],[3000000,.002],[20000000,.0015],[100000000,.001],[Infinity,.0005]]){
   const n=Math.min(left,Math.max(0,limit-used));raw+=n*rate;left-=n;used+=n;if(!left)break;
  }
 }
 const capped=Math.min(Math.max(tiered?.35:1,raw),value*.01);
 parts.broker=cents(capped);
 if(tiered&&capped<value*.01)state.shares+=quantity; // capped orders do not count toward tiers
 // 2026 SEC charge-date changes approximated by trade date; no current sample spans the April boundary.
 parts.sec=side==='sell'?ceilCent(value*(date>='2026-04-04'?.0000206:0)):0;
 parts.taf=side==='sell'&&date<'2026-10-01'?ceilCent(Math.min(9.79,quantity*.000195)):0;
 parts.cat=quantity*.000003;
 if(tiered){parts.clearing=Math.min(quantity*.0002,value*.005);parts.exchange=quantity*(c.exchangePerShare??.003);parts.passThrough=parts.broker*(.000175+.00056);}
 const subtotal=FEE_COMPONENTS.reduce((s,k)=>s+parts[k],0),total=cents(subtotal);
 parts.rounding=total-subtotal;
 return {...parts,total,model,version:FEE_VERSION,monthlySharesBefore:before,monthlySharesAfter:state.shares,tafHoliday:date>='2026-10-01'};
}
// Charge in chronological order across symbols; each fill is one separate order.
export function applyFeeSchedule(results,fills,c,state,date){
 if((c.feeModel||'custom')==='custom')return;
 for(const f of fills){f.feeBreakdown=calculateFee({...f,date},c,state);f.fee=f.feeBreakdown.total;f.netContribution=f.realizedGross-f.fee;}
 for(const r of results){
  let cash=0,net=0;
  for(const f of r.fills){cash+=(f.side==='sell'?1:-1)*f.amount-f.fee;net+=f.netContribution;f.cash=cash;f.cumulativeRealizedNet=net;}
  r.net=cash;r.fees=r.fills.reduce((s,f)=>s+f.fee,0);
 }
}
