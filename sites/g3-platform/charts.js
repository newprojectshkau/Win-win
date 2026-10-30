// Native SVG charts for the existing simulator. Values come only from completed runs.
export const CHART_METRICS = {
 cumulative:{label:'累計淨盈虧',unit:'US$',color:'#b95b10'},
 net:{label:'淨盈虧',unit:'US$',color:'#b95b10'},
 turnover:{label:'成交總額（買＋賣）',unit:'US$',color:'#246b9c'},
 orders:{label:'成交筆數',unit:'筆',color:'#76509c'},
 costs:{label:'佣金＋滑點',unit:'US$',color:'#7b563c'},
 tradedStocks:{label:'成交股票數',unit:'隻',color:'#526273'},
};
export const metricValue=(day,key)=>key==='costs'?day.fees+day.slippage:day[key];
export function chartSeries(runs,keys,relative=false){
 return keys.flatMap(key=>{
  const max=Math.max(0,...runs.flatMap(r=>r.days.map(d=>Math.abs(metricValue(d,key)))));
  return runs.map((run,index)=>({key,label:runs.length>1?`${run.label} · ${CHART_METRICS[key].label}`:CHART_METRICS[key].label,color:runs.length>1?['#b95b10','#246b9c','#76509c','#526273'][index]:CHART_METRICS[key].color,dash:['','9 5','3 4','12 4 3 4','2 3'][runs.length>1?index:keys.indexOf(key)],unit:relative?'相對幅度':CHART_METRICS[key].unit,points:run.days.map(d=>({date:d.date,raw:metricValue(d,key),value:relative?(max?metricValue(d,key)/max*100:0):metricValue(d,key),blocked:d.blockedSlots||0}))}));
 });
}
export function compatibleCharts(a,b){return a.dataHash===b.dataHash&&a.startDate===b.startDate&&a.endDate===b.endDate;}
export function initCharts({getResult,onSelectDate,escapeHTML:esc,format,money}){
 const $=id=>document.getElementById(id);let current=null,saved=[],serial=0;
 const f=(v,unit)=>unit==='US$'?money(v):`${format(v,unit==='相對幅度'?1:0)} ${unit}`;
 const snapshot=r=>({label:'目前結果',days:structuredClone(r.days),config:structuredClone(r.config),dataHash:r.dataHash,configHash:r.configHash,startDate:r.startDate,endDate:r.endDate});
 const configLabel=c=>`配注 ${money(c.target)}／股 · 門檻 ${format(c.threshold*100)}% · 佣金 ${money(c.commission)} · 滑點 ${c.slippageBps} bp · 候選 ${c.candidates} · ${c.mode==='fixed'?'固定磚幅':'百分比磚幅'} · ${c.execution==='next_open'?'下一分鐘開市':'同分鐘收市'} · RR 開關${c.gateEnabled?'開':'關'}`;
 function bars(rows,unit){
  const min=Math.min(0,...rows.map(r=>r.value)),max=Math.max(0,...rows.map(r=>r.value)),span=max-min||1;
  const x=v=>175+(v-min)/span*360,zero=x(0);
  return `<svg viewBox="0 0 620 ${rows.length*65+45}" role="img" aria-label="${esc(rows.map(r=>`${r.label} ${f(r.value,unit)}`).join('；'))}"><line x1="${zero}" x2="${zero}" y1="5" y2="${rows.length*65}" stroke="#80766b"/>${rows.map((r,i)=>`<text x="5" y="${i*65+28}" font-size="18">${esc(r.label)}</text><rect x="${Math.min(x(r.value),zero)}" y="${i*65+9}" width="${Math.abs(x(r.value)-zero)}" height="26" fill="${r.color||'#b95b10'}"/><text x="${x(r.value)}" y="${i*65+57}" font-size="17" text-anchor="${r.value<0?'start':'end'}">${esc(f(r.value,unit))}</text>`).join('')}<text x="175" y="${rows.length*65+30}" font-size="16">零線及數字均按 ${esc(unit)} 顯示</text></svg>`;
 }
 function day(){
  const r=getResult();if(!r)return;const run=r.runs.find(x=>x.data.date===$('chart-date').value);if(!run)return;
  const d=r.days.find(x=>x.date===run.data.date);
  $('day-chart-values').innerHTML=[['淨盈虧',money(d.net)],['成交總額',money(d.turnover)],['成交筆數',`${d.orders} 筆`],['成交股票',`${d.tradedStocks} 隻`]].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');
  $('day-profit-chart').innerHTML=bars([{label:'費前損益',value:d.grossBeforeCosts},{label:'佣金扣項',value:-d.fees,color:'#7b563c'},{label:'滑點扣項',value:-d.slippage,color:'#76509c'},{label:'淨盈虧',value:d.net}],'US$');
  const slots=Object.entries(run.slots).map(([k,s])=>({label:k==='AM'?'早市':'午市',fills:s.symbols.flatMap(x=>x.fills)}));
  $('day-turnover-chart').innerHTML=bars(slots.map(s=>({label:s.label,value:s.fills.reduce((a,f)=>a+f.quantity*f.price,0),color:'#246b9c'})),'US$');
  $('day-orders-chart').innerHTML=bars(slots.map(s=>({label:s.label,value:s.fills.length,color:'#76509c'})),'筆');
  $('chart-day-note').textContent=`${d.date}｜早市：${run.slots.AM.gate.reason}；午市：${run.slots.PM.gate.reason}。缺資料阻擋 ${d.blockedSlots||0} 段；不能把相關零成交視為策略主動不交易。`;
 }
 function plot(series,title){
  const points=series.flatMap(s=>s.points),unit=series[0].unit;
  const lo=unit==='相對幅度'?-100:Math.min(0,...points.map(p=>p.value));
  const rawHi=Math.max(0,...points.map(p=>p.value));
  const hi=unit==='相對幅度'?100:['筆','隻'].includes(unit)?Math.max(4,Math.ceil(rawHi/4)*4):rawHi;
  const span=hi-lo||1;
  const dates=series[0].points.map(p=>p.date),w=1120,h=350,left=100,right=35,top=30,bottom=55;
  const x=i=>left+(w-left-right)*i/Math.max(1,dates.length-1),y=v=>h-bottom-(v-lo)/span*(h-top-bottom);
  const ticks=[...new Set([0,Math.floor((dates.length-1)/3),Math.floor(2*(dates.length-1)/3),dates.length-1])];
  let grid='';for(let i=0;i<5;i++){const value=lo+span*i/4;grid+=`<line x1="${left}" x2="${w-right}" y1="${y(value)}" y2="${y(value)}" stroke="#e1d8cf"/><text x="${left-12}" y="${y(value)+6}" text-anchor="end" font-size="17">${format(value,['筆','隻','相對幅度'].includes(unit)?0:Math.abs(value)<10?1:0)}</text>`;}
  return `<div class="chart-plot"><h3>${esc(title)} <small>（${esc(unit)}）</small></h3><div class="chart-legend">${series.map(s=>`<span><svg width="32" height="12" aria-hidden="true"><line x1="0" x2="32" y1="6" y2="6" stroke="${s.color}" stroke-width="3" stroke-dasharray="${s.dash}"/></svg>${esc(s.label)}</span>`).join('')}</div><div class="chart-scroll"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}；原值見下方逐日數值表"><title>${esc(title)}</title>${grid}<line x1="${left}" x2="${w-right}" y1="${y(0)}" y2="${y(0)}" stroke="#80766b"/><text x="${w-right+8}" y="${y(0)+5}" font-size="16">0</text>${ticks.map(i=>`<text x="${x(i)}" y="${h-15}" text-anchor="${i===0?'start':i===dates.length-1?'end':'middle'}" font-size="17">${dates[i]}</text>`).join('')}${series.map(s=>`<polyline points="${s.points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-dasharray="${s.dash}"/>${s.points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.blocked?5:3}" fill="${p.blocked?'white':s.color}" stroke="${s.color}" stroke-width="2"><title>${esc(s.label)} ${p.date}：${esc(f(p.raw,CHART_METRICS[s.key].unit))}；阻擋 ${p.blocked} 段</title></circle>`).join('')}`).join('')}</svg></div></div>`;
 }
 function trend(){
  if(!current)return;
  const comparing=$('chart-mode').value==='versions',relative=!comparing&&$('chart-scale').value==='relative';
  $('metric-controls').hidden=comparing;$('comparison-metric-wrap').hidden=!comparing;
  const keys=comparing?[$('comparison-metric').value]:[...document.querySelectorAll('[data-chart-metric]:checked')].map(e=>e.dataset.chartMetric);
  const runs=comparing?[...saved,current]:[current];
  $('chart-versions').textContent=[...saved,current].map(s=>`${s.label}：${configLabel(s.config)}`).join('\n');
  if(!keys.length){$('trend-chart').innerHTML='<p>請選擇至少一個指標。</p>';$('trend-values').innerHTML='';return;}
  const series=chartSeries(runs,keys,relative);
  $('trend-chart').innerHTML=relative||comparing?plot(series,comparing?'不同參數的逐日比較':'同一時間軸 · 多指標趨勢'):keys.map(k=>plot(series.filter(s=>s.key===k),CHART_METRICS[k].label)).join('');
  $('trend-scale-note').textContent=(relative?'相對幅度＝當日原值 ÷ 該指標於本次範圍的最大絕對值 × 100；保留正負號。不是回報率、增長率或共同美元尺度；線條交叉不代表金額相等。':comparing?'同一指標、同一原值尺度；只比較相同資料指紋及完全相同日期範圍。':'原值按指標分區，各區有獨立尺度；日期對齊，不混用美元及筆數。')+' 空心點代表有時段缺資料而阻擋。交易日按順序等距排列；下表可查原值。';
  $('trend-values').innerHTML=`<table><thead><tr><th>日期</th>${series.map(s=>`<th>${esc(s.label)}（${CHART_METRICS[s.key].unit}）</th>`).join('')}</tr></thead><tbody>${current.days.map((d,i)=>`<tr><td><button class="button ghost small" data-chart-date="${d.date}">${d.date}</button></td>${series.map(s=>`<td>${esc(f(s.points[i].raw,CHART_METRICS[s.key].unit))}${s.points[i].blocked?' · 缺資料':''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 }
 $('chart-date').onchange=()=>{day();onSelectDate($('chart-date').value,false);};
 $('chart-detail').onclick=()=>onSelectDate($('chart-date').value,true);
 for(const id of ['chart-mode','chart-scale','comparison-metric'])$(id).onchange=trend;
 document.querySelectorAll('[data-chart-metric]').forEach(e=>e.onchange=trend);
 $('save-chart-version').onclick=()=>{
  if(!current)return;
  if(saved.some(s=>s.configHash===current.configHash)){$('chart-status').textContent='這組參數已有基準，請改設定並重新模擬。';return;}
  if(saved.length===3){$('chart-status').textContent='最多保存三個基準；請先清除，再選擇需要的版本。';return;}
  saved.push({...structuredClone(current),label:`基準 ${++serial}`});$('chart-status').textContent='已保存鎖定結果。改上方參數並重新模擬，再選「參數版本比較」。基準只保留於目前頁面，重新整理會清除。';trend();
 };
 $('clear-chart-versions').onclick=()=>{saved=[];serial=0;$('chart-status').textContent='已清除基準。';trend();};
 $('trend-values').onclick=e=>{const b=e.target.closest('[data-chart-date]');if(b){$('chart-date').value=b.dataset.chartDate;day();onSelectDate(b.dataset.chartDate,false);$('same-day-charts').scrollIntoView({behavior:'smooth'});}};
 return {refresh(){
  const r=getResult();if(!r)return;
  const next=snapshot(r);
  if(current&&!compatibleCharts(current,next)){saved=[];serial=0;$('chart-status').textContent='資料或日期範圍已更改，已清除不相容基準。';}
  current=next;const chosen=$('chart-date').value;
  $('chart-date').innerHTML=r.days.map(d=>`<option>${d.date}</option>`).join('');
  if(r.days.some(d=>d.date===chosen))$('chart-date').value=chosen;
  day();trend();
 },selectDate(date){if(current?.days.some(d=>d.date===date)){$('chart-date').value=date;day();}}};
}
