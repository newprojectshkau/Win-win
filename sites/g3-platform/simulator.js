import {initPresentation} from './presentation.js';
import {savePrivateDataset,loadPrivateDataset,listPrivateDatasets,loadSavedDataset} from './dataset-store.js';
import {DEFAULT_CONFIG,validateDataset,fingerprint} from './engine.js';
import {runWindow} from './performance.js';
const el=id=>document.getElementById(id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const usd=n=>`${n<0?'−':''}US$ ${format(Math.abs(n))}`;
let data=null,result=null,busy=false;
const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
const row=items=>`<tr>${items.map(i=>`<td>${i}</td>`).join('')}</tr>`;
function error(message){el('error').textContent=message;el('error').hidden=!message;}
function installDataset(next){
  validateDataset(next);
  if(next.kind!=='imported')throw Error('此頁只接受真實歷史資料。');
  if(next.instruments[0].sessions.length<=DEFAULT_CONFIG.lookback)throw Error('資料需有至少 20 個前置交易日及 1 個測試日。');
  data=next;el("execution").value=next.recommendedConfig?.execution||"signal_close";result=null;el('output').hidden=true;el('dirty').hidden=true;error('');
  const dates=next.instruments[0].sessions.map(s=>s.date),first=Math.max(DEFAULT_CONFIG.lookback,dates.length-(next.schemaVersion===2?30:10));
  for(const key of ['start','end']){el(key).min=dates[DEFAULT_CONFIG.lookback];el(key).max=dates.at(-1);}
  el('start').value=dates[first];el('end').value=dates.at(-1);el('run').disabled=false;
  el('available-dates').innerHTML=dates.slice(DEFAULT_CONFIG.lookback).map(d=>`<option value="${d}">${d}</option>`).join('');
  el('coverage').textContent=`可測試日期：${dates[DEFAULT_CONFIG.lookback]} 至 ${dates.at(-1)}（${dates.length-DEFAULT_CONFIG.lookback} 個交易日）；另有 20 日前置資料。`;
  const q=next.provenance;
  el('universe-note').textContent=next.schemaVersion===2?`50 個已存檔代號，每日重篩並獨立選早／午名單。全市場同期有 ${q.marketNonCapUnionCount} 個代號曾通過成交量／波幅／價格三條件，其中 ${q.unarchivedNonCapUnionCount} 個不在此池；尚未核實它們的市值及 IB 資格。市值不齊時只使用已知值總和 ÷ 20 的非負下限；下限不足不能判定，會列為資料不足及排除，可能改變排名。結果只代表可判定子集。`:'此檔為舊版固定研究子集；篩選成交量沿用常規時段分鐘總和，便於重現舊結果。擴展版使用官方日線。';
  syncDates();presentation.refresh();
  el('scope').textContent=`${data.instruments.length} 隻 · ${dates.length} 個交易日（包含回看期）`;
  el('source').textContent=`已載入真實行情研究檔（供應商聲明；未獨立驗證）｜${data.instruments.map(i=>i.symbol).join('、')}。${data.description||''}`;
}
function currentConfig(){return {...DEFAULT_CONFIG,execution:el("execution").value,candidates:Number(el("candidates").value),target:Number(el('target').value),threshold:Number(el('threshold').value)/100,commission:Number(el('fee').value),slippageBps:Number(el('slip').value),mode:el('mode').value,gateEnabled:el('gate').value==='on'};}
function curve(days){
  const values=[0,...days.map(d=>d.cumulative)],width=1050,height=300,pad=70;
  const lo=Math.min(0,...values),hi=Math.max(0,...values),span=hi-lo||1;
  const x=i=>pad+i*(width-2*pad)/(values.length-1||1),y=v=>height-pad-(v-lo)*(height-2*pad)/span;
  let lines='';for(let i=0;i<5;i++){const value=lo+(hi-lo)*i/4;lines+=`<line x1="${pad}" x2="${width-pad}" y1="${y(value)}" y2="${y(value)}" stroke="#dfd6ce"/><text x="${pad-10}" y="${y(value)+5}" text-anchor="end" font-size="15" fill="#786f66">${format(value,0)}</text>`;}
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="每日收市累計淨盈虧圖；詳細數字見逐日結果表"><title>累計淨盈虧（美元）</title>${lines}<polyline fill="none" stroke="#b95b10" stroke-width="3" points="${values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#b95b10"><title>${i?days[i-1].date:'期初'}：${usd(v)}</title></circle>`).join('')}<text x="${pad}" y="${height-20}" font-size="17" fill="#786f66">期初 0</text><text x="${width-pad}" y="${height-20}" text-anchor="end" font-size="17" fill="#786f66">${escapeHTML(days.at(-1).date)}</text></svg>`;
}
function renderResult(){
  const s=result.summary;
  const stats=[['淨盈虧',usd(s.net),'已扣手續費及滑點'],['費前損益',usd(s.grossBeforeCosts),'按參考價計算，未扣費用及滑點'],['模擬成本',usd(s.fees+s.slippage),`手續費 ${usd(s.fees)} · 滑點 ${usd(s.slippage)}`],['收市最大回撤',usd(s.maxCloseDrawdown),'只量度收市點；不是日內最大回撤'],['有成交的交易日',`${s.activeDays} / ${s.days}`,`${s.orders} 筆成交 · 淨持倉殘留 ${s.residual}`],['盈利日比例',s.winningDayRate===null?'沒有成交':format(s.winningDayRate*100,1)+'%',`${s.winningDays} 個盈利日／${s.activeDays} 個有成交日`]];
  el('stats').innerHTML=stats.map(([label,value,detail])=>`<div class="sim-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join('');
  el('run-label').textContent=`${result.startDate} → ${result.endDate} · 真實行情／暫定成交假設 · ${result.data.symbols.join('、')} · 每股名義金額 ${usd(result.config.target)} · 手續費 ${usd(result.config.commission)}/筆 · 滑點 ${result.config.slippageBps} 基點 · 資料指紋 ${result.dataHash?.slice(0,12)||'未提供'}`;
  el('run-coverage').textContent=`資料不足的股票／日合計 ${s.unassessedStockDays||0}；因缺分鐘而整段停止 ${s.blockedSlots||0} 次。這些並非策略主動不交易；盈虧不代表完整 IB 股票池。成交模式：${result.config.execution==='next_open'?'訊號後下一分鐘開市價':'同訊號分鐘收市價（舊版比較）'}；時段尾仍按最後分鐘收市價強制平倉。`;
  el('curve').innerHTML=curve(result.days);
  el('daily-table').innerHTML=table(['日期','費前損益','手續費','滑點','淨盈虧','累計淨盈虧','成交筆數','通過篩選','資料不足／阻擋時段'],result.days.map(d=>row([`<button class="button ghost small" data-date="${escapeHTML(d.date)}">${escapeHTML(d.date)}</button>`,usd(d.grossBeforeCosts),usd(d.fees),usd(d.slippage),usd(d.net),usd(d.cumulative),d.orders,`${d.eligible} / ${result.data.symbols.length}`,`${d.unassessed||0} / ${d.blockedSlots||0}`])));
  el('symbols').innerHTML=table(['股票','淨盈虧','手續費','成交筆數','有成交時段'],result.symbols.map(s=>row([escapeHTML(s.symbol),usd(s.net),usd(s.fees),s.fills,s.tradedSessions])));
  el('detail-date').innerHTML=result.days.map(d=>`<option value="${d.date}">${d.date}</option>`).join('');
  renderDetail();el('output').hidden=false;presentation.refresh();
}
function renderDetail(){
  const r=result.runs.find(r=>r.data.date===el('detail-date').value);if(!r)return;
  el('gates').textContent=`早市：${r.slots.AM.gate.reason}。午市：${r.slots.PM.gate.reason}。前日準備：${r.data.previousDate}。`;
  const labels={cap:'市值',volume:'成交量',range:'波幅',price:'股價'};
  el('screening').innerHTML=table(['股票','20 日市值／下限','20 日平均成交量','20 日平均波幅','篩選結果'],r.screening.map(s=>row([escapeHTML(s.symbol),`${usd(s.cap)}${s.capBasis==='nonnegative_lower_bound'?`（下限；${s.knownCaps}/20 日）`:'（平均）'}`,format(s.volume,0),format(s.range*100)+'%',s.dataIncomplete?'資料不足，不能判定':s.pass?'通過':Object.entries(s.checks).filter(([,v])=>!v).map(([k])=>labels[k]).join('、')+'未通過'])));
  el('decision').innerHTML=table(['時段','前日 B / R','當日觀察 B / R','前日選股及配注'],Object.entries(r.slots).map(([key,s])=>row([key==='AM'?'早市':'午市',`${s.previous.B} / ${s.previous.R}`,`${s.current.B} / ${s.current.R}`,s.selected.map(v=>`${escapeHTML(v.symbol)}：${v.quantity} 股`).join('；')||'沒有候選'])));
  const ny=new Intl.DateTimeFormat('zh-HK',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false});
  const actions={open_long:'開好倉',open_short:'開淡倉',close_reverse:'平倉／準備反手',reverse_long:'反手開好倉',reverse_short:'反手開淡倉',slot_exit:'時段尾平倉'};
  el('fills').innerHTML=r.fills.length?table(['紐約時間','股票','時段','動作','方向','股數','參考價','成交價','費用'],r.fills.map(f=>row([ny.format(new Date(f.time)),escapeHTML(f.symbol),f.slot==='AM'?'早市':'午市',actions[f.action]||escapeHTML(f.action),f.side==='buy'?'買':'賣',f.quantity,format(f.reference,4),format(f.price,4),usd(f.fee)]))):'<p class="sim-empty">此日沒有成交。請查看上方篩選結果及交易開關原因。</p>';
  presentation.refreshDetail();
}
function download(name,value,type='application/json'){
  const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function execute(event){
  event?.preventDefault();if(!data||busy)return;
  busy=true;error('');document.querySelectorAll('#config input,#config select,#run,#import,#dataset-library').forEach(e=>e.disabled=true);
  try{
    const config=currentConfig();
    const next=await runWindow(data,config,{startDate:el('start').value,endDate:el('end').value,onProgress:(n,total)=>el('progress').textContent=`正在重播 ${n} / ${total} 日…`});
    next.dataHash=await fingerprint(data);next.configHash=await fingerprint(config);result=next;renderResult();el('dirty').hidden=true;el('progress').textContent=`已完成 ${result.days.length} 個交易日。`;
  }catch(e){error(`未完成：${e.message}。先前成功結果保留。`);el('progress').textContent='';}
  finally{busy=false;document.querySelectorAll('#config input,#config select,#run,#import,#dataset-library').forEach(e=>e.disabled=false);}
}
el('config').addEventListener('submit',execute);
el('config').addEventListener('input',()=>{if(result)el('dirty').hidden=false;});
el('import').onclick=()=>{if(!busy)el('file').click();};
el('file').onchange=async event=>{
  const file=event.target.files[0];if(!file||busy)return;
  try{if(file.size>250*1024**2)throw Error('檔案超過 250 MB');const next=JSON.parse(await file.text());if(next.kind!=='imported')throw Error('私人行情資料須標記 kind＝imported');installDataset(next);await rememberDataset(next);}catch(e){error('匯入失敗：'+e.message+'；原有資料及結果保留。');}finally{event.target.value='';}
};

el('detail-date').onchange=renderDetail;
el('daily-table').onclick=event=>{const button=event.target.closest('[data-date]');if(button){el('detail-date').value=button.dataset.date;renderDetail();el('details').scrollIntoView({behavior:'smooth'});}};
el('export-json').onclick=()=>download(`winwin-performance-${result.startDate}-${result.endDate}.json`,result);
el('export-csv').onclick=()=>{const keys=['date','grossBeforeCosts','fees','slippage','net','cumulative','drawdown','orders','eligible','unassessed','blockedSlots','AM','PM'];download('winwin-daily-results.csv','\ufeff'+[keys.join(','),...result.days.map(d=>keys.map(k=>d[k]).join(','))].join('\r\n'),'text/csv;charset=utf-8');};
el('print').onclick=()=>window.print();
function syncDates(){
  const single=el('period-mode').value==='single';
  el('end-wrap').hidden=single;
  if(single)el('end').value=el('start').value;
}
el('period-mode').onchange=syncDates;
el('start').addEventListener('change',syncDates);
async function rememberDataset(next){
 try{await savePrivateDataset(next);await refreshLibrary();el('storage-status').textContent='已保存在此瀏覽器；下次開啟會自動載入。清除網站資料或轉用另一裝置後需重新匯入。';}
 catch{el('storage-status').textContent='此瀏覽器未能保存資料；今次仍可重播，下次需重新匯入。';}
}
async function refreshLibrary(){
 const items=await listPrivateDatasets();
 el('dataset-library').innerHTML=items.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.symbols.join('、'))}｜${escapeHTML(item.first||'資料不足')} → ${escapeHTML(item.last)}</option>`).join('');
 if(data)el('dataset-library').value=data.id;
}
el('dataset-library').onchange=async event=>{
 if(busy)return;
 try{const next=await loadSavedDataset(event.target.value);if(!next)throw Error('找不到本機資料，請重新載入');installDataset(next);await rememberDataset(next);await execute();}catch(e){error(e.message);}
};
async function initialize(){
 const preload=document.getElementById('private-dataset');
 try{
  const next=preload?JSON.parse(preload.textContent):await loadPrivateDataset();
  if(next){installDataset(next);await rememberDataset(next);await execute();}
  else{el('source').textContent='首次使用：請匯入 Massive 私人歷史資料 JSON。匯入一次後，此瀏覽器會記住資料。';el('scope').textContent='等待 Massive 歷史資料';}
 }catch(e){error('未能載入已保存資料：'+e.message+'。請重新匯入私人 JSON。');el('source').textContent='等待匯入真實歷史資料。';}
}
const presentation=initPresentation({getResult:()=>result,getDataset:()=>data,money:usd,format,escapeHTML,onSelectDate:date=>{el('detail-date').value=date;renderDetail();el('details').scrollIntoView({behavior:'smooth'});}});
initialize();
