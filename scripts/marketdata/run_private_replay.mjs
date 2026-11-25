import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_CONFIG,runReplay,fingerprint} from '../../sites/g3-platform/engine.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/marketdata/run_private_replay.mjs <private-dataset.json> <private-result.json>');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
for(const p of [input,output]){const actual=path.resolve(p);if(actual===root||actual.startsWith(root+path.sep))throw Error('Licensed input/output must be outside the public repository');}
const data=JSON.parse(fs.readFileSync(input,'utf8'));
const result=runReplay(data,{...DEFAULT_CONFIG});
result.dataHash=await fingerprint(data);result.configHash=await fingerprint(result.config);result.createdAt=new Date().toISOString();
result.scope='Real provider OHLCV under provisional assumptions; fixed research subset, provider-date historical-cap assumption; not unbiased stock selection, realistic fills or performance proof.';
fs.writeFileSync(output,JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify({date:result.data.date,instruments:result.summary.pool,eligible:result.summary.eligible,fillCount:result.summary.orders,residualInventory:result.summary.residual,AM:result.slots.AM.gate.status,PM:result.slots.PM.gate.status,output}));
