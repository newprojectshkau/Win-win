import {stockName} from './engine.js?v=20261030-ledger';
import {DATA_AUDIT} from './quality-audit.js?v=20261030-ledger';
export function initPresentation({getResult,getDataset,money,format,escapeHTML:esc,onSelectDate}){
 let mode='numbers',paused=matchMedia('(prefers-reduced-motion: reduce)').matches,timer=null,step=0;
 const $=id=>document.getElementById(id);
 const blocks=['setup','performance','daily','symbol-section','details','scope-section'];
 const notes={
  'data-quality':['外部核對涵蓋指定三股及日期，並不代表全年資料已獲驗證。','擴展版 Stage 1 已改用官方日線；以下核對仍只涵蓋舊版三股，不能外推至 50 股；歷史市值的公布時點仍待獨立核對。'],
  setup:['這裏鎖定資料範圍、股數配注及交易成本，所有績效均依這組設定產生。','先定義研究股票池及可接受成本，再比較參數；保留一段未參與調參的樣本外日期，避免只挑最好看的結果。'],
  performance:['費前損益減去手續費與滑點，才是淨盈虧；曲線從 0 開始累加每個收市結果。','比較成本是否吃掉策略優勢；收市回撤可能低估日內風險。下一版加入逐分鐘持倉估值、資金及保證金限制。'],
  daily:['每條數字或圖形都是一個交易日；沒有成交的日子仍保留，點選日期可追溯決策。','查看盈利是否集中於少數日子，分辨市場狀態、開關及成本的影響。不要只憑兩星期結果判斷長期穩定性。'],
  'symbol-section':['逐股淨盈虧已包含成本；同一股票早／午時段的結果合併顯示。','檢查是否由單一股票主導結果，以及股票間是否高度相關；擴大股票池前先訂流動性及集中度限制。'],
  details:['按所選日期展示篩選、前日 B/R 計數、觀察期開關及實際模擬成交順序。','重點比較下一分鐘開市價及舊版同分鐘成交的差異，檢查資料不足有否改變排名，反手是否先平後開，以及跳過交易的原因；下一版加入延遲、報價及借券限制。'],
  'scope-section':['這些是資料及執行模型尚未完成的部分，不是已通過的實盤核准清單。','在實盤前完成資料口徑、時點驗證、樣本外測試及模擬盤，再訂風險上限、熔斷及人工接管流程。']
 };
 for(const id of ['data-quality',...blocks]){
  const section=$(id);if(!section)continue;
  const note=document.createElement('aside');note.className='team-review-note';note.innerHTML=`<strong>團隊審閱筆記</strong><p><b>這裏顯示：</b>${notes[id][0]}</p><p><b>審閱焦點：</b>${notes[id][1]}</p><p class="live-review" id="review-${id}"></p>`;section.append(note);
  if(id!=='data-quality'){const host=document.createElement('div');host.className='motion-view';host.id='motion-'+id;section.insertBefore(host,note);}
 }
 // Numeric information remains available; graphics only replace the associated presentation.
 $('curve').closest('section').classList.add('number-view');
 for(const id of ['stats','curve','daily-table','symbols','screening','decision','fills'])$(id)?.classList.add('number-view');
 function signedBars(items,{clickable=false}={}){
  const max=Math.max(1,...items.map(i=>Math.abs(i.value)));
  return `<div class="signed-bars"><div class="bar-legend"><span>← 負值</span><span>0</span><span>正值 →</span></div>${items.map(i=>`<${clickable?'button':'div'} ${clickable?`data-day="${esc(i.date)}"`:''} class="signed-row"><span>${esc(i.label)}</span><div class="bar-track"><i class="bar-zero"></i><i class="value-bar ${i.value<0?'negative-bar':'positive-bar'}" style="width:${Math.abs(i.value)/max*50}%;left:${i.value<0?50-Math.abs(i.value)/max*50:50}%"></i></div><strong>${money(i.value)}</strong></${clickable?'button':'div'}>`).join('')}</div>`;
 }
 function audit(){
  const a=DATA_AUDIT;
  $('audit-content').innerHTML=`<p class="audit-verdict"><strong>收市價整體接近；分鐘 OHLC 差異及日量口徑待釐清，未達實盤驗證要求。</strong></p><div class="audit-facts"><div><strong>${format(a.minutePairs,0)}</strong><span>Yahoo 對應分鐘，沒有缺配對</span></div><div><strong>${format(a.minuteCloseWithin1Cent,0)}</strong><span>分鐘收市價差不超過 US$0.01</span></div><div><strong>${format(a.dailyVolumeMedianDiffPct)}%</strong><span>舊版分鐘總量與外部日量差異中位數</span></div></div><p>分鐘收市價最大差異 ${format(a.minuteMaxCloseDiffPct,4)}%；日線另核對 Yahoo ${a.yahooDailyPairs} 組、Nasdaq ${a.nasdaqDailyPairs} 組。價格相近不保證訊號及成交一致。</p><p>${esc(a.intradayWarning)}</p><p id="audit-sensitivity"></p><details><summary>來源、口徑及核對範圍</summary><p>${esc(a.scope)}。${esc(a.limitations)}</p><ul><li><a href="https://finance.yahoo.com/quote/NVDA/history/" target="_blank" rel="noopener noreferrer">Yahoo Finance 歷史資料</a></li><li><a href="https://www.nasdaq.com/market-activity/stocks/nvda/historical" target="_blank" rel="noopener noreferrer">Nasdaq 歷史資料</a></li><li><a href="https://github.com/newprojectshkau/Win-win/blob/g3-platform-review/docs/G3-data-quality-audit-zh-HK.md" target="_blank" rel="noopener noreferrer">完整核對結果及可重現方法</a></li></ul></details>`;
  if(a.sensitivity)$('audit-sensitivity').textContent=a.sensitivity;
 }
 function refresh(){
  const data=getDataset(),r=getResult();
  if(data){$('motion-setup').innerHTML=`<div class="process-flow"><div><strong>${data.instruments.length}</strong><span>固定研究股票</span></div><b>→</b><div><strong>20 日</strong><span>每個交易日前回看</span></div><b>→</b><div><strong>${data.instruments[0].sessions.length-20} 日</strong><span>測試日期（完整性另列）</span></div></div>`;}
  $('motion-scope-section').innerHTML='<div class="scope-cards">'+['資料口徑與公布時點','流動性與成交延遲','借券及交易限制','資金、保證金及風險','樣本外穩定性','模擬盤及人工接管'].map((x,i)=>`<div><span>待完善 ${i+1}</span><strong>${x}</strong></div>`).join('')+'</div>';
  if(!r){$('audit-match').textContent=data?'目前資料指紋待重播後核對':'核對範圍：三股／指定日期';applyMode();return;}
  $('audit-match').textContent=r.dataHash===DATA_AUDIT.dataHash?'目前資料指紋與核對版本一致':'此資料版本不在本次外部核對範圍';
  const s=r.summary;
  $('motion-performance').innerHTML=`<h3>成本如何影響結果</h3><p>同一美元尺度；費用及滑點以下扣項顯示。淨盈虧＝費前損益－兩項成本。</p>${signedBars([{label:'費前損益',value:s.grossBeforeCosts},{label:'手續費（扣項）',value:-s.fees},{label:'滑點（扣項）',value:-s.slippage},{label:'淨盈虧',value:s.net}])}<div class="process-flow"><div><strong>${s.activeDays} / ${s.days}</strong><span>有成交交易日</span></div><div><strong>${s.winningDays} / ${s.activeDays}</strong><span>盈利日／有成交日</span></div><div><strong>${money(s.maxCloseDrawdown)}</strong><span>收市最大回撤</span></div></div><h3>累計收市淨盈虧</h3><div class="animated-curve">${$('curve').innerHTML}</div>`;
  $('motion-daily').innerHTML='<h3>每日淨盈虧</h3><p>每天一列，長度按淨盈虧；沒有成交以 0 保留。點選日期查看原因。</p>'+signedBars(r.days.map(d=>({label:d.date,value:d.net,date:d.date})),{clickable:true})+'<h3>每日成交總額（買＋賣，US$）</h3>'+signedBars(r.days.map(d=>({label:d.date,value:d.turnover,date:d.date})),{clickable:true});
  $('motion-symbol-section').innerHTML='<p>同一美元尺度，顏色和方向均區分正負值。</p>'+signedBars(r.symbols.map(x=>({label:x.symbol,value:x.net})));
  $('review-performance').textContent=`本次：費前 ${money(s.grossBeforeCosts)}，總成本 ${money(s.fees+s.slippage)}，淨額 ${money(s.net)}。這是成本後結果，不是本金回報率。`;
  $('review-daily').textContent=`本次 ${s.days} 日中，${s.activeDays} 日有成交，${s.winningDays} 日成本後盈利。`;
  refreshDetail();applyMode();
 }
 function refreshDetail(){
  stop();const r=getResult();if(!r)return;
  const run=r.runs.find(x=>x.data.date===$('detail-date').value);if(!run)return;
  const labels={cap:'市值',volume:'成交量',range:'波幅',price:'股價'};
  $('motion-details').innerHTML=`<h3>四項篩選，一眼看清</h3><div class="screen-grid">${run.screening.map(x=>`<div><strong>${esc(x.symbol)}</strong>${Object.entries(x.checks).map(([k,v])=>`<span class="check-tile ${v?'check-pass':'check-fail'}">${labels[k]}：${v?'✓ 通過':x.dataIncomplete&&(k==='cap'||x.volume===null)?'？資料不足':'× 未過'}</span>`).join('')}</div>`).join('')}</div><div class="gate-visuals">${Object.entries(run.slots).map(([key,s])=>`<div><h3>${key==='AM'?'早市':'午市'} · ${s.gate.pass?'啟動交易':'跳過整段'}</h3><p>前日 B/R：${s.previous.B} / ${s.previous.R} → 當日觀察 B/R：${s.current.B} / ${s.current.R}</p><p>${esc(s.gate.reason)}</p><small>${s.selected.map(v=>`${esc(v.symbol)} ${v.quantity} 股`).join(' · ')||'沒有候選股票'}</small></div>`).join('')}</div><h3>成交順序播放器</h3><p>每步是一筆成交，並非等距時間；只播放已完成模擬結果，不改變計算。</p><div class="actions"><button type="button" class="button secondary" id="fill-play">播放／暫停</button><label for="fill-step">成交進度</label><input type="range" id="fill-step" min="0" max="${Math.max(0,run.fills.length-1)}" value="0" ${run.fills.length?'':'disabled'}></div><div id="fill-card" aria-live="off"></div>`;
  step=0;const show=()=>{
   const f=run.fills[step];$('fill-step').value=step;
   if(!f){$('fill-card').textContent='此日沒有成交；請檢視上方篩選及交易開關。';return;}
   const time=new Intl.DateTimeFormat('zh-HK',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(f.time));
   const action={open_long:'開好倉',open_short:'開淡倉',close_reverse:'平倉準備反手',reverse_long:'反手開好倉',reverse_short:'反手開淡倉',slot_exit:'時段尾平倉'};
   $('fill-card').innerHTML=`<div class="fill-motion-card"><span>${step+1} / ${run.fills.length} 筆 · 紐約 ${time}</span><h3>${esc(f.symbol)} · ${esc(stockName(f.symbol))} · ${action[f.action]||esc(f.action)}</h3><div class="process-flow"><div><strong>${f.side==='buy'?'買入':'賣出'} ${f.quantity} 股</strong><span>模擬成交 ${money(f.price)}；成交金額 ${money(f.amount)}</span></div><b>→</b><div><strong>持倉 ${f.position} 股</strong><span>此筆佣金 ${money(f.fee)}；淨損益貢獻 ${money(f.netContribution)}</span></div></div></div>`;
  };
  $('fill-step').oninput=()=>{stop();step=Number($('fill-step').value);show();};
  $('fill-play').onclick=()=>{
   if(timer){stop();return;}if(!run.fills.length)return;
   if(paused){$('fill-card').textContent='動畫已暫停。可用上方滑桿逐筆查看，或按頁頂「恢復動畫」。';return;}
   if(step===run.fills.length-1)step=0;show();
   timer=setInterval(()=>{if(step>=run.fills.length-1){stop();return;}step++;show();},Math.max(160,Math.min(800,10000/run.fills.length)));
  };
  show();
 }
 function stop(){if(timer)clearInterval(timer);timer=null;}
 function applyMode(){document.documentElement.dataset.presentation=mode;document.documentElement.dataset.motion=paused?'paused':'playing';$('view-numbers').setAttribute('aria-pressed',String(mode==='numbers'));$('view-motion').setAttribute('aria-pressed',String(mode==='motion'));$('motion-pause').setAttribute('aria-pressed',String(paused));$('motion-pause').textContent=paused?'恢復動畫':'暫停動畫';if(mode==='numbers')stop();}
 $('view-numbers').onclick=()=>{mode='numbers';applyMode();};$('view-motion').onclick=()=>{mode='motion';refresh();};
 $('motion-pause').onclick=()=>{paused=!paused;if(paused)stop();applyMode();};
 $('motion-replay').onclick=()=>{if(paused)return;refresh();};
 $('motion-daily').onclick=e=>{const b=e.target.closest('[data-day]');if(b)onSelectDate(b.dataset.day);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 audit();applyMode();return {refresh,refreshDetail};
}
