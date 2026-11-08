import test from 'node:test';
import assert from 'node:assert/strict';
import {ReviewSync,reviewPayload} from '../review-sync.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const payload={reviews:{A01:{status:'accepted',comment:'HK 中文'}},general:'Team'};
test('network boundary only contains allowlisted review fields',()=>{
 assert.deepEqual(reviewPayload({...payload,runs:[1],apiKey:'secret',dataset:{},reviews:{...payload.reviews,A99:{comment:'x'}}}),payload);
});
test('offline, expired and conflict preserve recoverable pending drafts',async()=>{
 for(const status of [0,401,409,503]){
  const storage=memory();const states=[];const c=new ReviewSync('https://example.test',{storage,onStatus:s=>states.push(s),fetcher:async()=>{if(!status)throw Error('offline');return {ok:false,status,json:async()=>({error:'failure'})};}});
  c.session={name:'A'};c.record={id:'stable-id',revision:1};c.edit(payload);await assert.rejects(()=>c.save());assert.deepEqual(c.pending,payload);
  const restored=new ReviewSync('',{storage});assert.deepEqual(restored.pending,payload);assert.equal(restored.record.id,'stable-id');assert.notEqual(states.at(-1),'saved');
 }
});
test('edits typed during save survive response and refresh',async()=>{
 let finish;const storage=memory();const c=new ReviewSync('',{storage,fetcher:()=>new Promise(r=>finish=r)});c.session={};c.record={id:'one',revision:1};c.edit(payload);const saving=c.save();
 c.edit({...payload,general:'typed while saving'});finish({ok:true,json:async()=>({id:'one',revision:2})});await saving;
 assert.equal(c.pending.general,'typed while saving');assert.equal(c.record.revision,2);
 assert.equal(new ReviewSync('',{storage}).pending.general,'typed while saving');
});
test('successful save clears pending only after acknowledgement',async()=>{
 const c=new ReviewSync('',{storage:memory(),fetcher:async()=>({ok:true,json:async()=>({id:'one',revision:2})})});c.session={};c.record={id:'one',revision:1};c.edit(payload);await c.save();assert.equal(c.pending,null);
});
