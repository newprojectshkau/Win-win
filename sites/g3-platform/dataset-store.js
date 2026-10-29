const DATA_DB='winwin-private-market-data-v1';
function openDataDB(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(DATA_DB,1);
 request.onupgradeneeded=()=>request.result.createObjectStore('datasets');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function savePrivateDataset(dataset){
 const db=await openDataDB();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction('datasets','readwrite'),store=tx.objectStore('datasets');
  const query=store.get('catalog');
  query.onsuccess=()=>{
   const dates=dataset.instruments[0].sessions.map(s=>s.date);
   const entry={id:dataset.id,symbols:dataset.instruments.map(s=>s.symbol),first:dates[20]||null,last:dates.at(-1),sessions:dates.length};
   const catalog=Array.isArray(query.result)?query.result:[];
   store.put([...catalog.filter(d=>d.id!==dataset.id),entry],'catalog');
   store.put(dataset,'data:'+dataset.id);store.put(dataset,'active');
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
async function readPrivateData(key){
 const db=await openDataDB();
 try{return await new Promise((resolve,reject)=>{const request=db.transaction('datasets').objectStore('datasets').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
export async function loadPrivateDataset(){return readPrivateData('active');}
export async function listPrivateDatasets(){return (await readPrivateData('catalog'))||[];}
export async function loadSavedDataset(id){return readPrivateData('data:'+id);}
