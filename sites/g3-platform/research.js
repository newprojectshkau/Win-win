import {runWindow} from './performance.js?v=20261125-comments';
import {validateConfig,fingerprint,ENGINE_VERSION} from './engine.js?v=20261125-comments';
export function parseSlippageRates(text) {
  if(typeof text!=='string')throw Error('Invalid slippage scenarios');
  const parts=text.split(',').map(v=>v.trim());
  if(!parts.length||parts.length>12||parts.some(v=>!/^\d+(\.\d+)?$/.test(v)))throw Error('Enter 1–12 comma-separated rates (0–1000 bps)');
  const rates=[...new Set(parts.map(Number))];
  if(rates.some(v=>!Number.isFinite(v)||v<0||v>1000))throw Error('Slippage must be 0–1000 bps');
  return rates;
}
export async function runResearch(dataset,config,{startDate,endDate,rates=[5,10,25,50,75,100],onProgress=()=>{}}={}) {
  validateConfig(config);rates=parseSlippageRates(rates.join(','));
  const frozen=structuredClone(config);
  const scenarios=[{label:'baseline',config:frozen},...rates.map(slippageBps=>({label:'slippage',config:{...frozen,slippageBps}})),...[.25,.5,1].map(entryChaseLimit=>({label:'entry_limit',config:{...frozen,entryChaseLimit}}))];
  const rows=[];
  for(const [i,scenario] of scenarios.entries()){
    // Each scenario has independent monthly fee state and receives the same frozen period.
    const result=await runWindow(dataset,scenario.config,{startDate,endDate});
    rows.push({label:scenario.label,config:scenario.config,summary:result.summary});
    onProgress(i+1,scenarios.length);
  }
  return {type:'g3-execution-research',engineVersion:ENGINE_VERSION,createdAt:new Date().toISOString(),dataHash:await fingerprint(dataset),configHash:await fingerprint(frozen),startDate,endDate,baseline:frozen,rows};
}
