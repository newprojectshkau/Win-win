const DATA_DB='winwin-private-market-data-v1';
function openDataDB(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(DATA_DB,1);
 request.onupgradeneeded=()=>request.result.createObjectStore('datasets');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function savePrivateDataset(dataset){
 const db=await openDataDB();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('datasets','readwrite');tx.objectStore('datasets').put(dataset,'active');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export async function loadPrivateDataset(){
 const db=await openDataDB();
 try{return await new Promise((resolve,reject)=>{const request=db.transaction('datasets').objectStore('datasets').get('active');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
