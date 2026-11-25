import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_CONFIG,fingerprint} from '../../sites/g3-platform/engine.js';
import {runWindow} from '../../sites/g3-platform/performance.js';
const [input,output,startDate,endDate]=process.argv.slice(2);
if(!input||!output||!startDate||!endDate)throw Error('Usage: node run_window_replay.mjs <private-dataset> <private-result> <start-date> <end-date>');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
for(const p of [input,output]){const actual=path.resolve(p);if(actual===root||actual.startsWith(root+path.sep))throw Error('Licensed data and results must stay outside public repository');}
const data=JSON.parse(fs.readFileSync(input,'utf8'));
const config={...DEFAULT_CONFIG,...data.recommendedConfig};
const result=await runWindow(data,config,{startDate,endDate});
result.dataHash=await fingerprint(data);result.configHash=await fingerprint(config);
fs.writeFileSync(output,JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify({startDate,endDate,symbols:result.data.symbols,...result.summary,output}));
