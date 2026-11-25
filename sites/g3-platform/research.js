import {prepareWindow} from './performance.js?v=g3-execution-grid';
import {DEFAULT_CONFIG, validateConfig, fingerprint, ENGINE_VERSION} from './engine.js?v=g3-execution-grid';

function parseValues(text, maxCount, min, max, name) {
  const parts = typeof text === 'string' ? text.split(',').map(v => v.trim()) : [];
  if (!parts.length || parts.length > maxCount || parts.some(v => !/^\d+(\.\d+)?$/.test(v)))
    throw Error(`${name}須輸入 1–${maxCount} 個逗號分隔數值。`);
  const values = [...new Set(parts.map(Number))];
  if (values.some(v => !Number.isFinite(v) || v < min || v > max))
    throw Error(`${name}須介乎 ${min} 至 ${max}。`);
  return values;
}

export function parseSlippageRates(text) {
  return parseValues(text, 12, 0, 1000, '單邊滑價（基點）');
}

export function parseEntryLimits(text) {
  return parseValues(text, 6, 0, 10, '追價上限（磚）');
}

export async function runResearch(dataset, config, {
  startDate, endDate, rates = [5, 10, 25, 50, 75, 100], limits = [0.25, 0.5, 1],
  onProgress = () => {},
} = {}) {
  validateConfig(config);
  const baseline = {...structuredClone(config), slippageBps:DEFAULT_CONFIG.slippageBps, entryChaseLimit:-1};
  const testedRates = [...new Set([baseline.slippageBps, ...parseSlippageRates(rates.join(','))])].sort((a,b) => a-b);
  const testedLimits = [-1, ...parseEntryLimits(limits.join(',')).sort((a,b) => a-b)];
  const replay = prepareWindow(dataset, {startDate, endDate, lookback:baseline.lookback});
  const total = testedRates.length * testedLimits.length;
  const rows = [];
  for (const slippageBps of testedRates) {
    let controlNet;
    for (const entryChaseLimit of testedLimits) {
      const scenario = {...baseline, slippageBps, entryChaseLimit};
      const {summary} = await replay(scenario);
      if (entryChaseLimit === -1) controlNet = summary.net;
      const isBaseline = slippageBps === baseline.slippageBps && entryChaseLimit === -1;
      rows.push({
        label:isBaseline ? 'baseline' : entryChaseLimit === -1 ? 'unprotected' : 'entry_limit',
        config:scenario, summary, netVsUnprotected:summary.net - controlNet,
      });
      onProgress(rows.length, total);
    }
  }
  return {
    type:'g3-execution-research', schemaVersion:2, engineVersion:ENGINE_VERSION,
    createdAt:new Date().toISOString(), dataHash:await fingerprint(dataset),
    configHash:await fingerprint({baseline, rates:testedRates, limits:testedLimits}),
    startDate, endDate, baseline, rates:testedRates, limits:testedLimits, rows,
  };
}
