import {savePrivateDataset} from './dataset-store.js';
import {validateDataset} from './engine.js';
const status=document.getElementById('status'),download=document.getElementById('download'),useData=document.getElementById('use-data');
const encodedKey=location.hash.slice(1);
// The fragment is never sent in HTTP requests. Remove it from the current history entry.
history.replaceState(null,'',location.pathname+location.search);
async function load(){
 try{
  if(!/^[A-Za-z0-9_-]{43}$/.test(encodedKey))throw Error('請使用對話中提供的完整私人連結開啟此頁。');
  const bytes=Uint8Array.from(atob(encodedKey.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['decrypt']);
  const response=await fetch('./market-review.enc',{credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('下載暫未準備好，請稍後重新開啟完整連結。');
  const file=new Uint8Array(await response.arrayBuffer());
  if(file.length>10*1024**2||new TextDecoder().decode(file.slice(0,4))!=='WW01')throw Error('資料檔格式不符。');
  const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:file.slice(4,16),additionalData:new TextEncoder().encode('winwin-private-market-data-v1')},key,file.slice(16));
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const dataset=JSON.parse(raw);validateDataset(dataset);
  if(dataset.kind!=='imported')throw Error('不是預期的歷史資料。');
  download.disabled=false;useData.disabled=false;
  status.textContent='已準備好：真實歷史資料 JSON（約 5.6 MB）。請選擇以下其中一個按鈕。';
  download.onclick=()=>{
   const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Massive-real-data-2026-10-15-to-28.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status.textContent='已交給瀏覽器下載，請查看瀏覽器的下載清單。';
  };
  useData.onclick=async()=>{
   useData.disabled=true;
   try{await savePrivateDataset(dataset);location.assign('./simulator.html');}
   catch{status.textContent='瀏覽器不允許本機保存。請按「下載 JSON 到電腦」，再到模擬器手動匯入。';useData.disabled=false;}
  };
 }catch(error){status.textContent=error.name==='OperationError'?'無法解鎖資料，請重新使用對話中的完整連結。':error.message;}
}
load();
