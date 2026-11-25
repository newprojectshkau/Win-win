import {runValidatedWindow} from './performance.js?v=20261125-scenarios';
import {validateConfig,validateDataset,fingerprint,ENGINE_VERSION} from './engine.js?v=20261125-assumptions';

function parseValues(text, maxItems, min, max, message) {
  if (typeof text !== 'string') throw Error(message);
  const parts = text.split(/[,，]/).map(value => value.trim());
  if (parts.length > maxItems || parts.some(value => !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)))
    throw Error(message);
  const values = [...new Set(parts.map(Number))];
  if (values.some(value => value < min || value > max)) throw Error(message);
  return values;
}

export function parseSlippageRates(text) {
  return parseValues(text, 12, 0, 1000, '請輸入 1–12 個單邊滑價值（0–1000 bps），以逗號分隔。');
}

export function parseEntryLimits(text) {
  return parseValues(text, 6, 0, 10, '請輸入 1–6 個追價上限（0–10 磚），以逗號分隔。');
}

export async function runResearch(dataset, config, {
  startDate, endDate, rates = [5, 10, 25, 50, 75, 100],
  limits = [.25, .5, 1], design = 'separate', onProgress = () => {},
} = {}) {
  validateConfig(config);
  const baseline = {...structuredClone(config), entryChaseLimit: -1};
  rates = parseSlippageRates(rates.join(',')).filter(rate => rate !== baseline.slippageBps);
  limits = parseEntryLimits(limits.join(','));
  if (!['separate', 'matrix'].includes(design)) throw Error('情景比較方式無效。');

  const scenarios = [{label:'baseline', config:baseline}];
  for (const slippageBps of [baseline.slippageBps, ...rates]) {
    if (slippageBps !== baseline.slippageBps)
      scenarios.push({label:'slippage', config:{...baseline, slippageBps}});
    if (design === 'matrix' || slippageBps === baseline.slippageBps) {
      for (const entryChaseLimit of limits)
        scenarios.push({label:'entry_limit', config:{...baseline, slippageBps, entryChaseLimit}});
    }
  }
  validateDataset(dataset);
  const [dataHash, configHash] = await Promise.all([fingerprint(dataset), fingerprint(baseline)]);
  const rows = [];
  const unguarded = new Map();
  for (const [index, scenario] of scenarios.entries()) {
    const result = await runValidatedWindow(dataset, scenario.config, {startDate, endDate});
    const {entryChaseLimit, slippageBps} = scenario.config;
    const {summary} = result;
    if (entryChaseLimit < 0) unguarded.set(slippageBps, summary);
    const reference = unguarded.get(slippageBps);
    const original = rows[0]?.summary ?? summary;
    rows.push({
      ...scenario, summary,
      deltaFromBaseline: {
        net: summary.net - original.net,
        maxCloseDrawdown: summary.maxCloseDrawdown - original.maxCloseDrawdown,
      },
      deltaFromUnguardedAtSameSlippage: entryChaseLimit < 0 ? null : {
        net: summary.net - reference.net,
        maxCloseDrawdown: summary.maxCloseDrawdown - reference.maxCloseDrawdown,
      },
    });
    onProgress(index + 1, scenarios.length);
  }
  return {type:'g3-execution-research',schemaVersion:2,engineVersion:ENGINE_VERSION,
    createdAt:new Date().toISOString(),dataHash,configHash,startDate,endDate,baseline,
    design,rates:[baseline.slippageBps,...rates],limits,rows};
}
