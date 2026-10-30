const DATA_DB='winwin-private-market-data-v1';
function openDataDB(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(DATA_DB,1);
 request.onupgradeneeded=()=>request.result.createObjectStore('datasets');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function savePrivateDataset(dataset){
 // Keep large v2 bundles compact on disk; validation expands only in memory.
 const persisted=dataset.schemaVersion===2?{...dataset,instruments:dataset.instruments.map(i=>({...i,sessions:i.sessions.map(s=>{
  if(!s.bars)return s;
  const {bars,...rest}=s;
  return {...rest,startMs:Date.parse(bars[0].time),packedBars:bars.map(b=>[b.open,b.high,b.low,b.close,b.volume])};
 })}))}:dataset;
 const db=await openDataDB();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction('datasets','readwrite'),store=tx.objectStore('datasets');
  const query=store.get('catalog');
  query.onsuccess=()=>{
   const dates=dataset.instruments[0].sessions.map(s=>s.date);
   const entry={id:dataset.id,symbols:dataset.instruments.map(s=>s.symbol),first:dates[20]||null,last:dates.at(-1),sessions:dates.length};
   const catalog=Array.isArray(query.result)?query.result:[];
   store.put([...catalog.filter(d=>d.id!==dataset.id),entry],'catalog');
   store.put(persisted,'data:'+dataset.id);store.put({activeDatasetId:dataset.id},'active');
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
async function readPrivateData(key){
 const db=await openDataDB();
 try{return await new Promise((resolve,reject)=>{const request=db.transaction('datasets').objectStore('datasets').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
export async function loadPrivateDataset(){const value=await readPrivateData('active');return value?.activeDatasetId?readPrivateData('data:'+value.activeDatasetId):value;}
export async function listPrivateDatasets(){return (await readPrivateData('catalog'))||[];}
export async function loadSavedDataset(id){return readPrivateData('data:'+id);}
