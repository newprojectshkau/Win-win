export const ENGINE_VERSION = "0.2.0-review";
export const DEFAULT_CONFIG = Object.freeze({
  execution: "signal_close",
  lookback: 20,
  capMin: 2000000000,
  volumeMin: 10000000,
  rangeMin: 0.015,
  priceMin: 20,
  priceMax: 1000,
  candidates: 10,
  threshold: 0.005,
  mode: "fixed",
  k: 1,
  target: 1000,
  gateEnabled: true,
  equalPolicy: "skip",
  quantityTie: "lower",
  commission: 1,
  slippageBps: 5,
  h: 1,
});
export const SLOT = {
  AM: { label: "早市", start: 0, observeEnd: 30, end: 180 },
  PM: { label: "午市", start: 180, observeEnd: 210, end: 390 },
};
const UNIT = 10000;
const units = (p) => {
  const v = Math.round(p * UNIT);
  if (!Number.isSafeInteger(v) || v <= 0)
    throw Error("價格／金額超出可安全計算範圍");
  return v;
};
export function validateConfig(c) {
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
    !["fixed", "percentage"].includes(c.mode) ||
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
    if (mode === "fixed") {
      const brick = Math.max(1, Math.round(referenceUnits * threshold));
      steps = Math.floor(Math.abs(delta) / brick);
      if (steps > 20000) throw Error("單分鐘事件過多，請核對資料及門檻");
      anchor += d * steps * brick;
    } else {
      while (
        Math.abs(p - anchor) >= Math.max(1, Math.round(anchor * threshold))
      ) {
        const direction = p > anchor ? 1 : -1;
        if (direction !== d) break;
        anchor += direction * Math.max(1, Math.round(anchor * threshold));
        steps++;
        if (steps > 20000) throw Error("單分鐘事件過多，請核對資料及門檻");
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
export const ratio = (B, R) => (R === 0 ? null : B / R);
export function decideGate(
  previous,
  current,
  enabled = true,
  equalPolicy = "skip",
) {
  if (!enabled)
    return {
      pass: true,
      status: "disabled",
      reason: "交易開關已停用；仍須等各股首事件",
    };
  if (!previous.R || !current.R)
    return {
      pass: false,
      status: "undefined",
      reason: "組合 RR 分母為零，依 A14 跳過整段",
    };
  const diff = current.B * previous.R - previous.B * current.R;
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
      reason: "RR 相等，依暫定等號通過選項啟用",
    };
  return {
    pass: false,
    status: diff === 0 ? "equal_skip" : "below",
    reason:
      diff === 0 ? "RR 相等，依 A13 跳過整段" : "當日觀察 RR 較低，整段不交易",
  };
}
export function simulateSymbol({ symbol, bars, slot, quantity, config }) {
  const spec = SLOT[slot],
    initial = bars[spec.observeEnd - 1].close;
  const counted = countEvents(bars.slice(spec.observeEnd, spec.end - 1), {
    threshold: config.threshold,
    mode: config.mode,
    initial,
    reference: initial,
  });
  let position = 0,
    cash = 0,
    fees = 0,
    maxExposure = 0;
  const fills = [],
    transitions = [],
    holdEvents = [];
  function fill(side, qty, bar, action) {
    const reference = bar.close;
    const px =
      Math.round(reference * (1 + (side * config.slippageBps) / 10000) * UNIT) /
      UNIT;
    const fee = config.commission;
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
  for (const e of counted.events) {
    // The signal is known only at the completed minute's availableAt.
    // Execute at the following minute open; never use that minute's close/high/low.
    const next = config.execution === "next_open" ? bars.find(b => b.time === e.time || Date.parse(b.time) === Date.parse(e.time)) : null;
    if (config.execution === "next_open" && !next) throw Error("缺下一分鐘開市價，不能模擬成交");
    const bar = { close: next ? next.open : e.price, availableAt: e.time };
    if (position === 0) {
      fill(
        e.direction,
        quantity,
        bar,
        e.direction === 1 ? "open_long" : "open_short",
      );
      transitions.push({ ...e, action: "entry", position });
    } else if (Math.sign(position) === e.direction) {
      holdEvents.push({ ...e, position });
      transitions.push({ ...e, action: "hold", position });
    } else {
      const previous = position;
      fill(-Math.sign(previous), Math.abs(previous), bar, "close_reverse");
      fill(
        e.direction,
        quantity,
        bar,
        e.direction === 1 ? "reverse_long" : "reverse_short",
      );
      transitions.push({ ...e, action: "reverse", position });
    }
  }
  const exit = bars[spec.end - 1];
  if (position !== 0) {
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
    position,
    net: cash,
    fees,
    maxExposure,
    turnover: fills.reduce((s, f) => s + f.quantity * f.price, 0),
    status: fills.length ? "traded" : "flat_no_event",
    signalCount: counted.B,
    points: bars
      .slice(spec.observeEnd - 1, spec.end)
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
    time: `${p.hour}:${p.minute}`,
  };
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
        if (!Array.isArray(packed) || packed.length !== 390 || !Number.isFinite(session.startMs)) throw Error("壓縮分鐘格式無效");
        session.bars = packed.map((r, i) => {
          if (!Array.isArray(r) || r.length !== 5) throw Error("壓縮價量格式無效");
          return {time:new Date(session.startMs+i*60000).toISOString(),availableAt:new Date(session.startMs+(i+1)*60000).toISOString(),open:r[0],high:r[1],low:r[2],close:r[3],volume:r[4]};
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
        if (d !== null && (!d || ![d.close,d.high,d.low,d.volume].every(Number.isFinite) || d.low<=0 || d.high<d.low || d.close<d.low || d.close>d.high || d.volume<0)) throw Error("官方日線格式無效");
        if (session.previousClose !== null && (!Number.isFinite(session.previousClose) || session.previousClose<=0)) throw Error("前收市價無效");
        if (session.marketCap !== null) {
          const t=Date.parse(session.marketCapAvailableAt);
          if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(session.marketCapAvailableAt) || !Number.isFinite(t)) throw Error("市值可用時間無效");
          const at=nyTime(t);
          if(at.date>session.date || (at.date===session.date && at.time>"16:00")) throw Error("市值可用時間不可遲於該日收市");
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
      if (!Array.isArray(session.bars) || session.bars.length !== 390)
        throw Error(
          `${instrument.symbol} ${session.date} 缺完整 390 分鐘；不支援半日市／補值`,
        );
      const first = Date.parse(session.bars[0].time);
      if (!Number.isFinite(first)) throw Error("分鐘時間無效");
      const start = nyTime(first),
        end = nyTime(first + 390 * 60000);
      if (
        !Number.isFinite(first) ||
        start.date !== session.date ||
        start.time !== "09:30" ||
        end.date !== session.date ||
        end.time !== "16:00"
      )
        throw Error("分鐘線須覆蓋紐約正常交易日 09:30–16:00");
      if (session.marketCap !== null && (
        !/(?:Z|[+-]\d{2}:\d{2})$/.test(session.marketCapAvailableAt) ||
        !Number.isFinite(Date.parse(session.marketCapAvailableAt)) ||
        Date.parse(session.marketCapAvailableAt) > first + 390 * 60000
      ))
        throw Error("市值可用時間不可遲於該日收市");
      for (let i = 0; i < 390; i++) {
        const b = session.bars[i];
        if (
          !/(?:Z|[+-]\d{2}:\d{2})$/.test(b.time) ||
          !/(?:Z|[+-]\d{2}:\d{2})$/.test(b.availableAt)
        )
          throw Error("時間必須明確包含 UTC 或時區偏移");
        if (
          Date.parse(b.time) !== first + i * 60000 ||
          Date.parse(b.availableAt) !== first + (i + 1) * 60000
        )
          throw Error(
            `${instrument.symbol} 有分鐘時間缺漏／重複或可用時間不符 A05`,
          );
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
export function replayValidated(dataset, config) {
  const currentDate = dataset.instruments[0].sessions.at(-1).date;
  const screening = dataset.instruments.map((instrument) => {
    const previous = instrument.sessions.slice(0, -1);
    if (previous.length < config.lookback)
      throw Error(`回看資料不足：需要 ${config.lookback} 個已完成時段`);
    const history = previous.slice(-config.lookback),
      avg = (k) => history.reduce((sum, s) => sum + k(s), 0) / history.length;
    const modern = dataset.schemaVersion === 2;
    const dailyComplete = !modern || history.every(s => s.daily && s.previousClose > 0);
    const knownCaps = history.filter(s => Number.isFinite(s.marketCap) && s.marketCap > 0).length;
    // Nonnegative market caps: the known sum / full lookback is a lower bound,
    // never an imputation or an exact average when observations are missing.
    const cap = avg(s => s.marketCap ?? 0),
      volume = dailyComplete ? avg(s => modern ? s.daily.volume : s.bars.reduce((a,b)=>a+b.volume,0)) : null,
      range = dailyComplete ? avg(s => modern ? (s.daily.high-s.daily.low)/s.previousClose : (Math.max(...s.bars.map(b=>b.high))-Math.min(...s.bars.map(b=>b.low)))/s.previousClose) : null,
      price = dailyComplete ? avg(s => modern ? s.daily.close : s.bars.at(-1).close) : null;
    const checks = {
      cap: cap > config.capMin,
      volume: volume > config.volumeMin,
      range: range > config.rangeMin,
      price: price >= config.priceMin && price <= config.priceMax,
    };
    return {
      symbol: instrument.symbol,
      knownCaps,
      capBasis: knownCaps === history.length ? "exact_average" : "nonnegative_lower_bound",
      dataIncomplete: !dailyComplete || (knownCaps < history.length && cap <= config.capMin),
      dailyBasis: modern ? "official_daily" : "regular_minutes",
      cap,
      volume,
      range,
      price,
      checks,
      pass: dailyComplete && Object.values(checks).every(Boolean),
    };
  });
  const eligible = new Set(
    screening.filter((s) => s.pass).map((s) => s.symbol),
  );
  const slots = {};
  for (const [slot, spec] of Object.entries(SLOT)) {
    const missingPrevious = dataset.instruments.filter(i => eligible.has(i.symbol) && !i.sessions.at(-2).bars).map(i=>i.symbol);
    const ranked = dataset.instruments
      .filter((i) => eligible.has(i.symbol) && i.sessions.at(-2).bars)
      .map((i) => {
        const previous = i.sessions.at(-2);
        const c = countEvents(previous.bars.slice(spec.start, spec.end), {
          threshold: config.threshold,
          mode: config.mode,
        });
        const ref = dataset.schemaVersion===2 ? previous.daily.close : previous.bars.at(-1).close,
          q = nearestQuantity(ref, config.target, config.quantityTie);
        return {
          symbol: i.symbol,
          B: c.B,
          R: c.R,
          rr: c.B / (c.R + config.k),
          quantity: q,
          reference: ref,
          notional: q * ref,
          delta: q * ref - config.target,
        };
      })
      .sort(
        (a, b) =>
          b.B * (a.R + config.k) - a.B * (b.R + config.k) ||
          a.symbol.localeCompare(b.symbol, "en"),
      );
    const selected = ranked.slice(0, config.candidates),
      previous = { B: 0, R: 0 },
      current = { B: 0, R: 0 };
    const symbolResults = [];
    for (const row of selected) {
      previous.B += row.B;
      previous.R += row.R;
      const i = dataset.instruments.find((i) => i.symbol === row.symbol);
      const session = i.sessions.at(-1);
      if (!session.bars) continue;
      const c = countEvents(session.bars.slice(spec.start, spec.observeEnd), {
        threshold: config.threshold,
        mode: config.mode,
      });
      current.B += c.B;
      current.R += c.R;
    }
    const missingCurrent = selected.filter(row => !dataset.instruments.find(i=>i.symbol===row.symbol).sessions.at(-1).bars).map(row=>row.symbol);
    const blocked = [...missingPrevious, ...missingCurrent];
    const gate = blocked.length ? {pass:false,status:"data_blocked",reason:`缺完整分鐘，整段停止（不重組名單）：${blocked.join("、")}`} : selected.length
      ? decideGate(previous, current, config.gateEnabled, config.equalPolicy)
      : { pass: false, status: "no_candidates", reason: "篩選後沒有候選股票" };
    for (const row of selected) {
      const i = dataset.instruments.find((i) => i.symbol === row.symbol);
      symbolResults.push(
        gate.pass
          ? simulateSymbol({
              symbol: row.symbol,
              bars: i.sessions.at(-1).bars,
              slot,
              quantity: row.quantity,
              config,
            })
          : {
              symbol: row.symbol,
              slot,
              status: gate.status === "data_blocked" ? "skipped_missing_data" : "skipped_by_strategy",
              quantity: row.quantity,
              fills: [],
              transitions: [],
              points: [],
              net: 0,
              fees: 0,
              turnover: 0,
              reversals: 0,
              position: 0,
              reason: gate.reason,
            },
      );
    }
    slots[slot] = {
      ranked,
      selected,
      previous: { ...previous, rr: ratio(previous.B, previous.R) },
      current: { ...current, rr: ratio(current.B, current.R) },
      gate,
      symbols: symbolResults,
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
  return {
    engineVersion: ENGINE_VERSION,
    data: {
      id: dataset.id,
      kind: dataset.kind,
      description: dataset.description ?? "",
      date: currentDate,
      previousDate: dataset.instruments[0].sessions.at(-2).date,
      providerStatement: dataset.providerStatement ?? null,
    },
    config: structuredClone(config),
    screening,
    slots,
    fills,
    summary: {
      pool: screening.length,
      eligible: eligible.size,
      unassessed: screening.filter(s=>s.dataIncomplete).length,
      blockedSlots: Object.values(slots).filter(s=>s.gate.status === "data_blocked").length,
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
