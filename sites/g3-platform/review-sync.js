// Transport accepts an allowlisted review-only snapshot, never app state or datasets.
export function reviewPayload(value) {
  const reviews = {};
  for (let i=1;i<=22;i++) {
    const id=`A${String(i).padStart(2,'0')}`, v=value.reviews?.[id];
    if(v) reviews[id]={status:['accepted','change'].includes(v.status)?v.status:'unreviewed',comment:String(v.comment??'').slice(0,4000)};
  }
  return {reviews,general:String(value.general??'').slice(0,12000)};
}
export class ReviewSync {
  constructor(url,{fetcher=fetch,storage=localStorage,onStatus=()=>{}}={}) {
    this.url=url.replace(/\/$/,'');this.fetcher=(...args)=>fetcher(...args);this.storage=storage;this.onStatus=onStatus;
    this.key='g3-review-sync-draft-v1';this.pending=null;this.record=null;this.session=null;this.busy=false;this.generation=0;
    try{const v=JSON.parse(storage.getItem(this.key)||'null');if(v?.payload){this.pending=reviewPayload(v.payload);this.record=v.record;this.generation=1;}}catch{}
  }
  status(v){this.onStatus(v);}
  async request(path,method='GET',body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try {
      const r=await this.fetcher(this.url+'/api'+path,{method,credentials:'include',cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
      const data=await r.json();if(!r.ok){const e=Object.assign(Error(data.error||'Request failed'),{status:r.status,data});if(r.status===401)this.session=null;throw e;}return data;
    }finally{clearTimeout(timer);}
  }
  async login(name,code){this.session=await this.request('/login','POST',{name,code});return this.session;}
  async restore(){this.session=await this.request('/session');return this.session;}
  async logout(){await this.request('/logout','POST',{});this.session=null;}
  async list(){return (await this.request('/records')).records;}
  cache(){try{this.storage.setItem(this.key,JSON.stringify({payload:this.pending,record:this.record}));return true;}catch{this.status('backup_failed');return false;}}
  edit(value){this.pending=reviewPayload(value);this.generation++;const ok=this.cache();if(ok)this.status('unsynced');return ok;}
  select(record){if(this.pending)throw Error('Unsaved changes');this.record=record;}
  async save(){
    if(this.busy||!this.pending)return;
    if(!this.session){this.status('unsynced');return;}
    if(!this.record){this.record={id:crypto.randomUUID().replaceAll('-',''),revision:0};this.cache();}
    this.busy=true;const generation=this.generation,payload=structuredClone(this.pending);this.status('saving');
    try{
      const data=await this.request('/records/'+this.record.id,'PUT',{revision:this.record.revision,payload});
      this.record=data;
      if(generation===this.generation){this.pending=null;try{this.storage.removeItem(this.key);}catch{}this.status('saved');}
      else{this.cache();this.status('unsynced');}
      return data;
    }catch(e){this.status(e.status===409?'conflict':e.status===401?'expired':'failed');throw e;}
    finally{this.busy=false;}
  }
}
