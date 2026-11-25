import {validateFees,applyFeeSchedule} from './fees.js?v=20261125-assumptions';
export const ENGINE_VERSION = "0.4.2-review";
// Display-only company labels from cached Massive reference responses; not point-in-time universe evidence.
export const STOCK_NAMES = Object.freeze({"NVDA": "Nvidia Corp", "TSLA": "Tesla, Inc. Common Stock", "AMD": "Advanced Micro Devices", "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp", "AMZN": "Amazon.Com Inc", "APLD": "Applied Digital Corporation Common Stock", "AVGO": "Broadcom Inc. Common Stock", "BAC": "Bank of America Corporation", "BSX": "Boston Scientific Corp.", "CMCSA": "Comcast Corp", "CMG": "Chipotle Mexican Grill, Inc.", "CRWV": "CoreWeave, Inc. Class A Common Stock", "DRAM": "Roundhill Memory ETF", "EWZ": "iShares MSCI Brazil ETF", "GOOG": "Alphabet Inc. Class C Capital Stock", "GOOGL": "Alphabet Inc. Class A Common Stock", "HOOD": "Robinhood Markets, Inc. Class A Common Stock", "INTC": "Intel Corp", "IREN": "IREN Limited Ordinary Shares", "META": "Meta Platforms, Inc. Class A Common Stock", "MU": "Micron Technology, Inc.", "MUU": "Direxion Shares ETF Trust Direxion Daily MU Bull 2X ETF", "NFLX": "NetFlix Inc", "NOW": "SERVICENOW, INC.", "ORCL": "Oracle Corp", "PBR": "PETROLEO BRASILEIRO S.A.-PETROBRAS ADS (REP 1 COMMON SHARE)", "PFE": "Pfizer Inc.", "PLTR": "Palantir Technologies Inc. Class A Common Stock", "SKHY": "SK hynix Inc. American Depositary Shares", "SMCI": "Super Micro Computer, Inc. Common Stock", "SOXL": "Direxion Daily Semiconductor Bull 3X ETF", "SOXS": "Direxion Daily Semiconductor Bear 3X ETF", "SPCX": "Space Exploration Technologies Corp. Class A Common Stock", "SQQQ": "ProShares UltraPro Short QQQ", "T": "AT&T Inc.", "TQQQ": "ProShares  UltraPro QQQ", "VZ": "Verizon Communications", "XLE": "State Street Energy Select Sector SPDR ETF"});
export const stockName = symbol => STOCK_NAMES[symbol] || "全名未提供";
export const DEFAULT_CONFIG = Object.freeze({
  execution: "next_open",
  lookback: 20,
  capMin: 2000000000,
  marketCapPolicy: "auto",
  volumeMin: 10000000,
  rangeMin: 0.015,
  priceMin: 200,
  priceMax: 10000,
  candidates: 10,
  barSeconds: 0, // Auto prefers 30s when supported, otherwise the native interval.
  threshold: 0.005,
  mode: "percentage_simple",
  k: 1,
  target: 10000,
  gateEnabled: true,
  equalPolicy: "pass",
  quantityTie: "lower",
  commission: 1,
  slippageBps: 5,
  h: 1,
  entryChaseLimit: -1, // -1 disables this optional research rule; otherwise adverse bricks allowed.
});
export const SLOT = {
  AM: { label: "早市", start: 0, observeEnd: 30, end: 180 },
  PM: { label: "午市", start: 180, observeEnd: 210, end: 390 },
};
const UNIT = 10000;
const DAY_MINUTES = 390;
const INCOMPLETE_BAR = Symbol();
const isMissingBar = bar => !bar || bar[INCOMPLETE_BAR] === true;
const validInterval = seconds => Number.isInteger(seconds) && seconds > 0 && 1800 % seconds === 0;
export const BAR_INTERVALS = [20, 30, 60, 90, 120, 300];
export function resolveBarSeconds(dataset, config = {}) {
  const source = dataset.barSeconds ?? 60;
  const seconds = config.barSeconds || (30 % source === 0 ? 30 : source);
  if (!validInterval(source) || !validInterval(seconds) || seconds % source !== 0)
    throw Error("Bar 週期須對齊交易窗口，並且是原始資料週期的整數倍；次分鐘需要相應的真實行情。");
  return seconds;
}
const units = (p) => {
  const v = Math.round(p * UNIT);
  if (!Number.isSafeInteger(v) || v <= 0)
    throw Error("價格／金額超出可安全計算範圍");
  return v;
};
export function validateConfig(c) {
  validateFees(c);
  if (c.barSeconds !== undefined && c.barSeconds !== 0 && !validInterval(c.barSeconds))
    throw Error("Bar 秒數須可整除 30 分鐘。");
  if (!["auto", "complete", "research_lower_bound"].includes(c.marketCapPolicy ?? "auto"))
    throw Error("市值資料模式無效");
  if (c.entryChaseLimit !== undefined && (!Number.isFinite(c.entryChaseLimit) || c.entryChaseLimit < -1 || c.entryChaseLimit > 10)) throw Error("追價上限須為 -1（停用）或 0–10 磚");
  if (c.entryChaseLimit !== undefined && c.entryChaseLimit < 0 && c.entryChaseLimit !== -1) throw Error("追價上限無效");
  for (const k of [
    "lookback",
    "capMin",
    "volumeMin",
    "rangeMin",
    "priceMin",
    "priceMax",
    "candidates",
    "threshold",
    "k",
    "target",
    "commission",
    "slippageBps",
    "h",
  ])
    if (!Number.isFinite(c[k])) throw Error(`設定 ${k} 必須是有效數字`);
  if (!Number.isInteger(c.lookback) || c.lookback < 1 || c.lookback > 250)
    throw Error("回看日數須為 1–250 的整數");
  if (!Number.isInteger(c.candidates) || c.candidates < 1 || c.candidates > 100)
    throw Error("候選數須為 1–100 的整數");
  if (
    c.priceMin <= 0 ||
    c.priceMax < c.priceMin ||
    c.target <= 0 ||
    c.capMin < 0 ||
    c.volumeMin < 0 ||
    c.rangeMin < 0 ||
    c.rangeMin > 1
  )
    throw Error("篩選或配注數值範圍無效");
  if (c.threshold < 0.0001 || c.threshold > 0.2)
    throw Error("Renko 門檻須介乎 0.01% 至 20%");
  if (!Number.isInteger(c.k) || c.k < 1 || c.k > 100 || c.h !== 1)
    throw Error("k 須為 1–100 整數；此版只支援 h＝1");
  if (
    c.commission < 0 ||
    c.commission > 100 ||
    c.slippageBps < 0 ||
    c.slippageBps > 1000
  )
    throw Error("成本設定超出支援範圍");
  if (
    !["fixed", "percentage", "percentage_simple"].includes(c.mode) ||
    !["skip", "pass"].includes(c.equalPolicy) ||
    !["lower", "higher"].includes(c.quantityTie) ||
    typeof c.gateEnabled !== "boolean"
  )
    throw Error("模式或規則選項無效");
  if (!["signal_close", "next_open"].includes(c.execution ?? "signal_close")) throw Error("成交模式無效");
  return c;
}
export function countEvents(
  bars,
  { threshold = 0.005, mode = "fixed", initial, reference } = {},
) {
  if (!bars.length) return { B: 0, R: 0, events: [], anchor: initial ?? null };
  let anchor = units(initial ?? bars[0].open),
    referenceUnits = units(reference ?? initial ?? bars[0].open),
    previous = 0,
    B = 0,
    R = 0;
  const events = [];
  for (const bar of bars) {
    let p = units(bar.close),
      delta = p - anchor,
      d = delta > 0 ? 1 : -1,
      steps = 0;
    if (mode === "fixed" || mode === "percentage_simple") {
      const brick = Math.max(1, Math.round(referenceUnits * threshold));
      steps = Math.max(0, Math.floor((Math.abs(delta) - 1) / brick));
      if (steps > 20000) throw Error("單根 Bar 事件過多，請核對資料及門檻");
      anchor += d * steps * brick;
    } else {
      while (
        Math.abs(p - anchor) > Math.max(1, Math.round(anchor * threshold))
      ) {
        const direction = p > anchor ? 1 : -1;
        if (direction !== d) break;
        anchor += direction * Math.max(1, Math.round(anchor * threshold));
        steps++;
        if (steps > 20000) throw Error("單根 Bar 事件過多，請核對資料及門檻");
      }
    }
    if (steps) {
      if (previous && previous !== d) R++;
      B += steps;
      previous = d;
      events.push({
        time: bar.availableAt,
        direction: d,
        bricks: steps,
        anchor: anchor / UNIT,
        price: bar.close,
      });
    }
  }
  return { B, R, events, anchor: anchor / UNIT };
}
export function nearestQuantity(price, target, tie = "lower") {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(target) ||
    target <= 0
  )
    throw Error("股價及目標金額必須大於零");
  const p = units(price),
    t = units(target),
    lo = Math.max(1, Math.floor(t / p)),
    hi = Math.max(1, Math.ceil(t / p));
  const a = Math.abs(lo * p - t),
    b = Math.abs(hi * p - t);
  return a === b ? (tie === "higher" ? hi : lo) : a < b ? lo : hi;
}
export const ratio = (B, R) => B / (R + 1);
export function decideGate(
  previous,
  current,
  enabled = true,
  equalPolicy = "pass",
) {
  if (!enabled)
    return {
      pass: true,
      status: "disabled",
      reason: "交易開關已停用；仍須等各股首事件",
    };
  const diff = current.B * (previous.R + 1) - previous.B * (current.R + 1);
  if (diff > 0)
    return {
      pass: true,
      status: "passed",
      reason: "當日觀察 RR 大於前日完整對應時段",
    };
  if (diff === 0 && equalPolicy === "pass")
    return {
      pass: true,
      status: "equal_pass",
      reason: "RR 相等，依已確認等號政策通過",
    };
  return {
    pass: false,
    status: diff === 0 ? "equal_skip" : "below",
    reason:
      diff === 0 ? "RR 相等，依 A13 跳過整段" : "當日觀察 RR 較低，整段不交易",
  };
}
export function simulateSymbol({ symbol, bars, slot, quantity, config }) {
  const {start, end, observeEnd} = SLOT[slot];
  return simulateSlot({symbol, bars: bars.slice(start, end), slot, quantity, config, observationBars: observeEnd - start});
}
function simulateSlot({symbol, bars, slot, quantity, config, observationBars}) {
  const initial = bars[observationBars - 1].close;
  const firstGap = bars.findIndex(isMissingBar);
  const end = firstGap < 0 ? bars.length : firstGap;
  const counted = countEvents(bars.slice(observationBars, Math.min(end, bars.length - 1)), {
    threshold: config.threshold,
    mode: config.mode,
    initial,
    reference: initial,
  });
  let position = 0,
    cash = 0,
    fees = 0,
    maxExposure = 0;
  let entryPrice = 0, realizedNet = 0;
  const fills = [],
    transitions = [],
    holdEvents = [],
    rejectedEntries = [];
  let entryAttempts = 0, signalMovesOverBrick = 0, entrySlippagesOverBrick = 0;
  function modeledPrice(side, reference) { return Math.round(reference * (1 + side * config.slippageBps / 10000) * UNIT) / UNIT; }
  function openEntry(e, bar, action) {
    entryAttempts++;
    const price = modeledPrice(e.direction, bar.close);
    const brick = Math.max(1, Math.round((config.mode === "percentage" ? e.anchor : initial) * config.threshold * UNIT)) / UNIT;
    const signalMove = e.direction * (bar.close - e.price);
    const modeledSlippage = e.direction * (price - bar.close);
    if (signalMove > brick + 1e-9) signalMovesOverBrick++;
    if (modeledSlippage > brick + 1e-9) entrySlippagesOverBrick++;
    const adverse = Math.max(0, e.direction * (price - e.price));
    const chaseBricks = adverse / brick;
    if ((config.entryChaseLimit ?? -1) >= 0 && adverse > config.entryChaseLimit * brick + 1e-9) {
      rejectedEntries.push({time:e.time,direction:e.direction,signalPrice:e.price,reference:bar.close,modeledPrice:price,signalMove,modeledSlippage,brick,chaseBricks,limit:config.entryChaseLimit,reason:"entry_chase_limit"});
      transitions.push({...e,action:"entry_rejected",position:0});
      return false;
    }
    fill(e.direction, nearestQuantity(price, config.target, config.quantityTie), bar, action);
    return true;
  }
  function fill(side, qty, bar, action) {
    const reference = bar.close;
    const px = modeledPrice(side, reference);
    const fee = config.commission;
    const closedQuantity = position && Math.sign(position) !== side ? Math.min(qty, Math.abs(position)) : 0;
    const realizedGross = closedQuantity ? closedQuantity * (px - entryPrice) * Math.sign(position) : 0;
    const netContribution = realizedGross - fee;
    realizedNet += netContribution;
    if (!position || Math.sign(position) === side) entryPrice = (Math.abs(position)*entryPrice + qty*px)/(Math.abs(position)+qty);
    else if(qty > Math.abs(position)) entryPrice = px;
    cash -= side * qty * px + fee;
    fees += fee;
    position += side * qty;
    const f = {
      id: `${symbol}-${slot}-${fills.length + 1}`,
      symbol,
      slot,
      time: bar.availableAt,
      action,
      side: side === 1 ? "buy" : "sell",
      quantity: qty,
      name: stockName(symbol),
      amount: qty * px,
      closedQuantity,
      realizedGross,
      netContribution,
      cumulativeRealizedNet: realizedNet,
      reference: bar.close,
      price: px,
      fee,
      position,
      cash,
    };
    fills.push(f);
    maxExposure = Math.max(maxExposure, Math.abs(position * px));
    return f;
  }
  const opens = config.execution === "next_open"
    ? new Map(bars.slice(observationBars, end + Number(Boolean(bars[end]?.open))).map(bar => [Date.parse(bar.time), bar]))
    : null;
  for (const e of counted.events) {
    const next = opens?.get(Date.parse(e.time));
    if (opens && !next) break; // The next executable open is missing.
    const bar = { close: next ? next.open : e.price, availableAt: e.time };
    if (position === 0) {
      if (openEntry(e, bar, e.direction === 1 ? "open_long" : "open_short"))
        transitions.push({ ...e, action: "entry", position });
    } else if (Math.sign(position) === e.direction) {
      holdEvents.push({ ...e, position });
      transitions.push({ ...e, action: "hold", position });
    } else {
      const previous = position;
      fill(-Math.sign(previous), Math.abs(previous), bar, "close_reverse");
      if (openEntry(e, bar, e.direction === 1 ? "reverse_long" : "reverse_short"))
        transitions.push({ ...e, action: "reverse", position });
      else transitions.push({...e,action:"close_only",position:0});
    }
  }
  const exit = bars.at(-1);
  if (firstGap < 0 && position !== 0) {
    fill(-Math.sign(position), Math.abs(position), exit, "slot_exit");
    transitions.push({
      time: exit.availableAt,
      action: "exit",
      price: exit.close,
      position: 0,
    });
  }
  return {
    symbol,
    slot,
    initial,
    quantity,
    fills,
    transitions,
    holdEvents,
    rejectedEntries,
    entryAttempts,
    signalMovesOverBrick,
    entrySlippagesOverBrick,
    position,
    net: realizedNet,
    fees,
    maxExposure,
    turnover: fills.reduce((s, f) => s + f.quantity * f.price, 0),
    status: firstGap >= 0 ? "aborted_missing_data" : fills.length ? "traded" : rejectedEntries.length ? "flat_entry_rejected" : "flat_no_event",
    reason: firstGap >= 0 ? "交易窗口缺 Bar，該股停止重播；已有成交保留，未平倉損益未估值。" : undefined,
    signalCount: counted.B,
    points: bars
      .slice(observationBars - 1, end)
      .map((b) => ({ time: b.availableAt, price: b.close })),
    reversals: transitions.filter((t) => t.action === "reverse").length,
  };
}
const nyParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function nyTime(t) {
  const p = Object.fromEntries(
    nyParts
      .formatToParts(new Date(t))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second),
  };
}
const sessionOffset = timestamp => nyTime(timestamp).seconds - (9 * 60 + 30) * 60;
function slotBars(session, spec, sourceSeconds, targetSeconds) {
  const count = (spec.end - spec.start) * 60 / targetSeconds;
  if (!session.bars?.length) return Array(count).fill(null);
  const from = spec.start * 60 / sourceSeconds;
  const to = spec.end * 60 / sourceSeconds;
  let inputs;
  if (session.bars.length === DAY_MINUTES * 60 / sourceSeconds) {
    inputs = session.bars.slice(from, to);
  } else {
    inputs = Array(to - from).fill(null);
    const firstTime = Date.parse(session.bars[0].time);
    const firstIndex = sessionOffset(firstTime) / sourceSeconds;
    for (const bar of session.bars) {
      const index = firstIndex + (Date.parse(bar.time) - firstTime) / (sourceSeconds * 1000);
      if (index >= from && index < to) inputs[index - from] = bar;
    }
  }
  const size = targetSeconds / sourceSeconds;
  if (size === 1) return inputs;
  return Array.from({length: count}, (_, index) => {
    const group = inputs.slice(index * size, (index + 1) * size);
    if (group.some(isMissingBar)) {
      // A later missing source bar cannot take away the opening price already available.
      return group[0] ? {time:group[0].time, open:group[0].open, [INCOMPLETE_BAR]:true} : null;
    }
    return {
      time: group[0].time,
      availableAt: group.at(-1).availableAt,
      open: group[0].open,
      high: Math.max(...group.map(bar => bar.high)),
      low: Math.min(...group.map(bar => bar.low)),
      close: group.at(-1).close,
      volume: group.reduce((sum, bar) => sum + bar.volume, 0),
    };
  });
}
export function validateDataset(data) {
  if (
    !data ||
    ![1, 2].includes(data.schemaVersion) ||
    !["synthetic", "imported"].includes(data.kind) ||
    typeof data.id !== "string" ||
    !data.id.trim() ||
    !Array.isArray(data.instruments) ||
    !data.instruments.length ||
    data.instruments.length > 100
  )
    throw Error(
      "資料格式無效：需要 schemaVersion＝1 或 2、kind、id 及 1–100 隻 instruments",
    );
  const ids = new Set();
  const sourceSeconds = data.barSeconds ?? 60;
  const sourceInterval = sourceSeconds * 1000;
  const barsPerDay = DAY_MINUTES * 60 / sourceSeconds;
  resolveBarSeconds(data);
  if (data.marketCapCoverage !== undefined && !["complete", "research_lower_bound"].includes(data.marketCapCoverage))
    throw Error("市值覆蓋聲明無效");
  let template = null;
  for (const instrument of data.instruments) {
    if (
      !/^[A-Za-z0-9._-]{1,24}$/.test(instrument.symbol) ||
      ids.has(instrument.symbol)
    )
      throw Error("股票代號無效或重複");
    ids.add(instrument.symbol);
    if (
      !Array.isArray(instrument.sessions) ||
      instrument.sessions.length < 3 ||
      instrument.sessions.length > 252
    )
      throw Error(`${instrument.symbol} 須有 3–252 個時段`);
    let last = "";
    const dates = [];
    for (const session of instrument.sessions) {
      if (data.schemaVersion === 2 && session.packedBars) {
        const packed = session.packedBars;
        if (!Array.isArray(packed) || packed.length !== barsPerDay || !Number.isFinite(session.startMs)) throw Error("壓縮 Bar 格式無效");
        session.bars = packed.map((r, i) => {
          if (!Array.isArray(r) || r.length !== 5) throw Error("壓縮價量格式無效");
          return {time:new Date(session.startMs+i*sourceInterval).toISOString(),availableAt:new Date(session.startMs+(i+1)*sourceInterval).toISOString(),open:r[0],high:r[1],low:r[2],close:r[3],volume:r[4]};
        });
        delete session.packedBars;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date) || session.date <= last)
        throw Error("日期須唯一並由舊至新排列");
      last = session.date;
      dates.push(session.date);
      if (data.schemaVersion === 2) {
        if (session.marketCap !== null && (!Number.isFinite(session.marketCap) || session.marketCap <= 0)) throw Error("市值無效");
        const d = session.daily;
        if (d !== null && (!d || (d.open !== undefined && (!Number.isFinite(d.open) || d.open<=0 || d.open<d.low || d.open>d.high)) || ![d.close,d.high,d.low,d.volume].every(Number.isFinite) || d.low<=0 || d.high<d.low || d.close<d.low || d.close>d.high || d.volume<0)) throw Error("官方日線格式無效");
        if (session.previousClose !== null && (!Number.isFinite(session.previousClose) || session.previousClose<=0)) throw Error("前收市價無效");
        if (session.marketCap !== null) {
          const t=Date.parse(session.marketCapAvailableAt);
          if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(session.marketCapAvailableAt) || !Number.isFinite(t)) throw Error("市值可用時間無效");
          const at=nyTime(t);
          if(at.date>session.date || (at.date===session.date && at.seconds*1000+t%1000>16*3600000)) throw Error("市值可用時間不可遲於該日收市");
        }
        if (session.bars === null) continue; // Explicit missing session; never synthesize bars.
      }
      if (data.schemaVersion === 1 && (
        !Number.isFinite(session.marketCap) ||
        session.marketCap <= 0 ||
        !Number.isFinite(session.previousClose) ||
        session.previousClose <= 0
      ))
        throw Error(`${instrument.symbol} ${session.date} 缺市值或前收市價`);
      if (session.bars === null) continue;
      if (!Array.isArray(session.bars) || session.bars.length > barsPerDay ||
          (data.schemaVersion === 1 && session.bars.length !== barsPerDay))
        throw Error(
          `${instrument.symbol} ${session.date} Bar 數量無效；舊格式須有完整 390 分鐘的時段`,
        );
      if (!session.bars.length) continue;
      const first = Date.parse(session.bars[0].time);
      if (!Number.isFinite(first)) throw Error("分鐘時間無效");
      const start = nyTime(first);
      const offset = start.seconds - (9 * 60 + 30) * 60;
      const dayStart = first - offset * 1000;
      const dayEnd = dayStart + DAY_MINUTES * 60000;
      if (
        start.date !== session.date ||
        offset < 0 || offset % sourceSeconds !== 0 ||
        first % 1000 !== 0 ||
        (data.schemaVersion === 1 && offset !== 0)
      )
        throw Error("Bar 時間須對齊紐約正常交易時段 09:30–16:00");
      if (session.marketCap !== null && (
        !/(?:Z|[+-]\d{2}:\d{2})$/.test(session.marketCapAvailableAt) ||
        !Number.isFinite(Date.parse(session.marketCapAvailableAt)) ||
        Date.parse(session.marketCapAvailableAt) > dayEnd
      ))
        throw Error("市值可用時間不可遲於該日收市");
      let previousTime = -Infinity;
      for (const b of session.bars) {
        if (
          !/(?:Z|[+-]\d{2}:\d{2})$/.test(b.time) ||
          !/(?:Z|[+-]\d{2}:\d{2})$/.test(b.availableAt)
        )
          throw Error("時間必須明確包含 UTC 或時區偏移");
        const barTime = Date.parse(b.time);
        if (!Number.isFinite(barTime) || barTime <= previousTime || barTime < dayStart ||
            (barTime - dayStart) % sourceInterval !== 0 ||
            barTime + sourceInterval > dayEnd ||
            Date.parse(b.availableAt) !== barTime + sourceInterval)
          throw Error(
            `${instrument.symbol} 有 Bar 時間重複、錯位或可用時間不符 A05`,
          );
        previousTime = barTime;
        if (
          !["open", "high", "low", "close", "volume"].every((k) =>
            Number.isFinite(b[k]),
          ) ||
          Math.min(b.open, b.high, b.low, b.close) <= 0 ||
          b.volume < 0 ||
          b.high < Math.max(b.open, b.close) ||
          b.low > Math.min(b.open, b.close) ||
          b.low > b.high
        )
          throw Error(`${instrument.symbol} 有無效價量`);
      }
    }
    const signature = dates.join(",");
    if (template && template !== signature)
      throw Error("各股須有相同日期；缺資料不可重組名單");
    template = signature;
  }
  return data;
}
export function runReplay(dataset, config) {
  validateConfig(config);
  validateDataset(dataset);
  return replayValidated(dataset, config);
}
// Internal rolling-window entry: caller must validate the full source first.
// Window slicing preserves all validated sessions and cannot add future bars.
export function replayValidated(dataset, config, feeState = {}) {
  const sourceSeconds = dataset.barSeconds ?? 60;
  const barSeconds = resolveBarSeconds(dataset, config);
  const completeCap = (config.marketCapPolicy ?? "auto") === "auto"
    ? dataset.marketCapCoverage === "complete"
    : config.marketCapPolicy === "complete";
  const currentDate = dataset.instruments[0].sessions.at(-1).date;
  const screening = dataset.instruments.map((instrument) => {
    const previous = instrument.sessions.slice(0, -1);
    if (previous.length < config.lookback)
      throw Error(`回看資料不足：需要 ${config.lookback} 個已完成時段`);
    const history = previous.slice(-config.lookback),
      avg = (k) => history.reduce((sum, s) => sum + k(s), 0) / history.length;
    const modern = dataset.schemaVersion === 2;
    const opening = s => s.daily?.open ?? (s.bars?.length && sessionOffset(Date.parse(s.bars[0].time)) === 0 ? s.bars[0].open : null);
    const dailyComplete = history.every(s => (modern ? s.daily : s.bars?.length === DAY_MINUTES * 60 / sourceSeconds) && opening(s) > 0);
    const knownCaps = history.filter(s => Number.isFinite(s.marketCap) && s.marketCap > 0).length;
    const capMissing = knownCaps < history.length;
    const cap = completeCap && capMissing ? null : avg(s => s.marketCap ?? 0),
      volume = dailyComplete ? avg(s => modern ? s.daily.volume : s.bars.reduce((a,b)=>a+b.volume,0)) : null,
      range = dailyComplete ? avg(s => modern ? (s.daily.high-s.daily.low)/opening(s) : (Math.max(...s.bars.map(b=>b.high))-Math.min(...s.bars.map(b=>b.low)))/opening(s)) : null,
      price = dailyComplete ? avg(s => modern ? s.daily.close : s.bars.at(-1).close) : null;
    const checks = {
      cap: cap !== null && cap > config.capMin,
      volume: volume > config.volumeMin,
      range: range > config.rangeMin,
      price: price >= config.priceMin && price <= config.priceMax,
    };
    return {
      symbol: instrument.symbol,
      missingDailyDays: history.filter(s=>!(modern ? s.daily : s.bars) || !(opening(s)>0)).length,
      knownCaps,
      capBasis: !capMissing ? "exact_average" : completeCap ? "missing_required" : "nonnegative_lower_bound",
      dataIncomplete: !dailyComplete || (capMissing && !checks.cap),
      dailyBasis: modern ? "official_daily" : "regular_minutes",
      cap,
      volume,
      range,
      price,
      checks,
      pass: dailyComplete && Object.values(checks).every(Boolean),
    };
  });
  const eligible = dataset.instruments.filter((_, index) => screening[index].pass);
  const bySymbol = new Map(eligible.map(instrument => [instrument.symbol, instrument]));
  const slots = {};
  for (const [slot, spec] of Object.entries(SLOT)) {
    const observationBars = (spec.observeEnd - spec.start) * 60 / barSeconds;
    const missingPrevious = [];
    const ranked = eligible
      .flatMap((i) => {
        const previous = i.sessions.at(-2);
        const bars = slotBars(previous, spec, sourceSeconds, barSeconds);
        if (bars.some(isMissingBar)) {
          missingPrevious.push(i.symbol);
          return [];
        }
        const c = countEvents(bars, {
          threshold: config.threshold,
          mode: config.mode,
        });
        const ref = dataset.schemaVersion===2 ? previous.daily.close : previous.bars.at(-1).close,
          q = nearestQuantity(ref, config.target, config.quantityTie);
        return [{
          symbol: i.symbol,
          B: c.B,
          R: c.R,
          rr: c.B / (c.R + config.k),
          quantity: q,
          reference: ref,
          notional: q * ref,
          delta: q * ref - config.target,
        }];
      })
      .sort(
        (a, b) =>
          b.B * (a.R + config.k) - a.B * (b.R + config.k) ||
          a.symbol.localeCompare(b.symbol, "en"),
      );
    const cutoff = ranked[Math.min(config.candidates, ranked.length)-1];
    const selected = cutoff ? ranked.filter(row => row.B * (cutoff.R + config.k) >= cutoff.B * (row.R + config.k)) : [],
      previous = { B: 0, R: 0 },
      current = { B: 0, R: 0 };
    const currentBars = new Map();
    const missingCurrent = [];
    for (const row of selected) {
      const session = bySymbol.get(row.symbol).sessions.at(-1);
      const bars = slotBars(session, spec, sourceSeconds, barSeconds);
      const observed = bars.slice(0, observationBars);
      if (observed.some(isMissingBar)) {
        missingCurrent.push(row.symbol);
        continue;
      }
      currentBars.set(row.symbol, bars);
      previous.B += row.B;
      previous.R += row.R;
      const c = countEvents(observed, {
        threshold: config.threshold,
        mode: config.mode,
      });
      current.B += c.B;
      current.R += c.R;
    }
    const gate = currentBars.size
      ? decideGate(previous, current, config.gateEnabled, config.equalPolicy)
      : {pass:false,status:selected.length ? "data_blocked" : "no_candidates",reason:selected.length ? "所有已選股票缺資料，跳過時段" : "篩選後沒有候選股票"};
    const symbolResults = selected.map(row => {
      const bars = currentBars.get(row.symbol);
      return gate.pass && bars
          ? simulateSlot({
              symbol: row.symbol,
              bars,
              slot,
              quantity: row.quantity,
              config,
              observationBars,
            })
          : {
              symbol: row.symbol,
              slot,
              status: bars ? "skipped_by_strategy" : "skipped_missing_data",
              quantity: row.quantity,
              fills: [],
              transitions: [],
              points: [],
              net: 0,
              fees: 0,
              turnover: 0,
              reversals: 0,
              position: 0,
              reason: bars ? gate.reason : "觀察窗口缺 Bar，排除該股、不補選。",
            };
    });
    const abortedSymbols = symbolResults.filter(row => row.status === "aborted_missing_data").map(row => row.symbol);
    slots[slot] = {
      ranked,
      selected,
      excludedPrevious: missingPrevious,
      excludedCurrent: missingCurrent,
      comparisonSymbols: [...currentBars.keys()],
      previous: { ...previous, rr: ratio(previous.B, previous.R) },
      current: { ...current, rr: ratio(current.B, current.R) },
      gate,
      symbols: symbolResults,
      abortedSymbols,
      coverageStatus: selected.length && missingCurrent.length + abortedSymbols.length === selected.length
        ? "all_incomplete"
        : missingCurrent.length || abortedSymbols.length ? "partial" : "complete",
    };
  }
  const results = Object.values(slots).flatMap((s) => s.symbols),
    fills = results
      .flatMap((s) => s.fills)
      .sort(
        (a, b) =>
          a.time.localeCompare(b.time) ||
          a.symbol.localeCompare(b.symbol) ||
          Number(a.id.split("-").at(-1)) - Number(b.id.split("-").at(-1)),
      );
  applyFeeSchedule(results,fills,config,feeState,currentDate);
  return {
    engineVersion: ENGINE_VERSION,
    data: {
      id: dataset.id,
      kind: dataset.kind,
      description: dataset.description ?? "",
      date: currentDate,
      previousDate: dataset.instruments[0].sessions.at(-2).date,
      providerStatement: dataset.providerStatement ?? null,
      sourceBarSeconds: sourceSeconds,
      barSeconds,
      marketCapPolicy: completeCap ? "complete" : "research_lower_bound",
    },
    config: structuredClone(config),
    screening,
    slots,
    fills,
    summary: {
      pool: screening.length,
      eligible: eligible.length,
      unassessed: screening.filter(s=>s.dataIncomplete).length,
      blockedSlots: Object.values(slots).filter(s=>s.gate.status === "data_blocked").length,
      abortedStockSlots: Object.values(slots).reduce((sum, s) => sum + s.abortedSymbols.length, 0),
      entryAttempts: results.reduce((n,r)=>n+(r.entryAttempts||0),0),
      signalMovesOverBrick: results.reduce((n,r)=>n+(r.signalMovesOverBrick||0),0),
      entrySlippagesOverBrick: results.reduce((n,r)=>n+(r.entrySlippagesOverBrick||0),0),
      rejectedEntries: results.reduce((n,r)=>n+(r.rejectedEntries?.length||0),0),
      orders: fills.length,
      net: results.reduce((s, r) => s + r.net, 0),
      fees: results.reduce((s, r) => s + r.fees, 0),
      turnover: results.reduce((s, r) => s + r.turnover, 0),
      reversals: results.reduce((s, r) => s + r.reversals, 0),
      residual: results.reduce((s, r) => s + Math.abs(r.position), 0),
    },
    assumptionIds: Array.from(
      { length: 22 },
      (_, i) => `A${String(i + 1).padStart(2, "0")}`,
    ),
  };
}
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function fingerprint(value) {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
