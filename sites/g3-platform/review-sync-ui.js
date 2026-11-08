import {ReviewSync} from './review-sync.js?v=20261108-upgrade';
import {REVIEW_API_URL} from './review-sync-config.js?v=20261108-upgrade';
export function mountReviewSync({read,write}) {
  const host=document.createElement('section');host.className='panel sync-panel';host.setAttribute('aria-label','Demo 留言同步');
  document.querySelector('#main').before(host);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const messages={saving:'儲存中',saved:'已儲存',unsynced:'尚未同步',failed:'儲存失敗；本機內容保留',conflict:'版本衝突；未儲存內容保留，請另存新記錄或先匯出備份',expired:'登入已過期；未儲存內容保留',backup_failed:'本機備份失敗；請立即匯出備份'};
  let records=[],status='unsynced';
  const sync=new ReviewSync(REVIEW_API_URL,{onStatus:s=>{status=s;paintStatus();}});
  function paintStatus(){const node=host.querySelector('[data-sync-status]');if(node)node.textContent=messages[status]||status;}
  function render(){
    const logged=sync.session;
    host.innerHTML=`<div class="panel-head"><h2>Demo 留言同步</h2><span data-sync-status role="status" aria-live="polite"></span></div><div class="panel-body">
    <p>只保護留言 API；網站仍公開。姓名只是署名，未經身份驗證。同一 demo 空間的登入者可查看及修改團隊記錄。</p>
    ${!REVIEW_API_URL?'<div class="notice">後端尚未設定；登入及跨瀏覽器同步未啟用。本機留言與 JSON 備份仍可使用。</div>':logged?`<p data-no-translate>Demo: ${esc(logged.name)} · ${esc(new Date(logged.expiresAt*1000).toLocaleString())}</p><div class="actions"><button class="button secondary" data-sync="logout">登出</button><button class="button secondary" data-sync="refresh">重新讀取團隊記錄</button></div><label>團隊審閱記錄<select class="select-control" data-sync-record><option value="">選擇團隊記錄</option>${records.map(r=>`<option value="${esc(r.id)}" ${sync.record?.id===r.id?'selected':''} data-no-translate>${esc(r.author)} · ${esc(new Date(r.updated*1000).toLocaleString())} · ${esc(r.id.slice(0,8))} · v${r.revision}</option>`).join('')}</select></label><div class="actions row-gap"><button class="button primary" data-sync="save">儲存至目前記錄</button><button class="button secondary" data-sync="migrate">將本機留言另存為新團隊記錄</button><button class="button secondary" data-sync="latest">備份草稿並載入團隊最新版</button></div><p>選取記錄才會載入；登入不會搬移本機留言。另存新記錄不會覆蓋現有團隊內容。</p>`:`<form data-sync-login class="sync-login"><label>顯示姓名<input name="name" maxlength="80" required autocomplete="nickname"></label><label>共用 demo 存取碼<input name="code" type="password" maxlength="512" required autocomplete="off"></label><button class="button primary">登入 demo</button></form>`}
    <div class="actions row-gap"><button class="button secondary" data-sync="export">匯出尚未同步備份</button>${sync.pending?'<button class="button secondary" data-sync="restore">恢復尚未同步內容</button>':''}</div><p class="subtitle">只同步 A01–A22 審閱狀態、留言及整體意見。不傳送行情、API key 或交易紀錄。</p><p class="notice" role="alert" data-sync-error hidden></p></div>`;
    paintStatus();
  }
  function error(e){if(REVIEW_API_URL&&!sync.session&&!host.querySelector('[data-sync-login]'))render();const n=host.querySelector('[data-sync-error]');n.hidden=false;n.textContent=`${e.status||''} ${e.message}`;}
  function backup(){const data=sync.pending||read();const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:1,type:'winwin-g3-review',general:data.general,assumptions:Object.entries(data.reviews||{}).map(([id,review])=>({id,review}))},null,2)],{type:'application/json'}));a.href=url;a.download='g3-unsynced-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function refresh(){records=await sync.list();render();}
  host.addEventListener('submit',async e=>{if(!e.target.matches('[data-sync-login]'))return;e.preventDefault();const form=e.target;const name=form.elements.name.value,code=form.elements.code.value;form.elements.code.value='';try{await sync.login(name,code);await refresh();}catch(e){render();error(e);}});
  host.addEventListener('change',e=>{
    if(!e.target.matches('[data-sync-record]'))return;
    const selected=records.find(r=>r.id===e.target.value);if(!selected)return;
    if(sync.pending){error(Error('尚有未同步內容；請先儲存或另存新記錄。'));return;}
    if(!confirm('載入團隊記錄？目前本機留言會先保留一份備份。'))return;
    try{localStorage.setItem('g3-before-cloud-load',JSON.stringify(read()));sync.select(selected);write(selected.payload);status='saved';render();}catch(e){error(e);}
  });
  host.addEventListener('click',async e=>{
    const action=e.target.closest('[data-sync]')?.dataset.sync;if(!action)return;
    try{
      if(action==='export')return backup();
      if(action==='restore'){if(confirm('恢復尚未同步的本機內容？'))write(sync.pending);return;}
      if(action==='logout'){await sync.logout();render();return;}
      if(action==='refresh')return await refresh();
      if(action==='latest'){
        if(!sync.record)throw Error('Choose a team record first');
        if(!confirm('先匯出本機備份，再載入團隊最新版？'))return;
        backup();records=await sync.list();const latest=records.find(r=>r.id===sync.record.id);
        if(!latest)throw Error('Record not found');
        localStorage.setItem('g3-review-conflict-backup',JSON.stringify(sync.pending||read()));
        sync.pending=null;sync.record=latest;localStorage.removeItem(sync.key);write(latest.payload);status='saved';render();return;
      }
      if(action==='migrate'){
        if(!confirm('將目前本機留言另存為新團隊記錄？不會覆蓋已有記錄。'))return;
        sync.record=null;sync.edit(read());
      }
      if(action==='save'&&!sync.record){error(Error('請先選取記錄，或使用本機留言搬移按鈕。'));return;}
      if(['save','migrate'].includes(action)){
        if(sync.record&&!sync.pending)sync.edit(read());await sync.save();await refresh();
      }
    }catch(e){error(e);}
  });
  document.addEventListener('g3-review-edited',()=>{sync.edit(read());});
  window.addEventListener('beforeunload',e=>{if(sync.pending){e.preventDefault();e.returnValue='';}});
  render();if(REVIEW_API_URL)sync.restore().then(refresh).catch(e=>{if(e.status!==401)error(e);});
  return sync;
}
