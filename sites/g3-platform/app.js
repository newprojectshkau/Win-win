import {
  DEFAULT_CONFIG,
  ENGINE_VERSION,
  SLOT,
  createDemoDataset,
  validateConfig,
  runReplay,
  fingerprint,
  canonical,
} from "./engine.js";
import { ASSUMPTIONS, KNOWN } from "./assumptions.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const num = (n, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "未定義";
const money = (n) =>
  Number.isFinite(n) ? `${n < 0 ? "−" : ""}US$ ${num(Math.abs(n), 2)}` : "—";
const pct = (n) => num(n * 100, 2) + "%";
const icons = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  results: '<path d="M4 20V4M4 20h17M8 16v-5M13 16V7M18 16v-8"/>',
  replay: '<path d="M3 13l4-4 4 7 5-11 5 7"/>',
  assumptions:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  compare:
    '<rect x="3" y="5" width="7" height="15" rx="1"/><rect x="14" y="3" width="7" height="17" rx="1"/>',
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] ?? icons.overview}</svg>`;
const PAGES = {
  overview: "工作台",
  settings: "參數設定",
  results: "五階段結果",
  replay: "逐股重播",
  assumptions: "假設與留言",
  compare: "版本比較",
};
const STORAGE = "winwin-g3-review-v1";
let stored = {};
try {
  stored = JSON.parse(localStorage.getItem(STORAGE) || "{}");
} catch {}
let draft = { ...DEFAULT_CONFIG, ...stored.draft };
try {
  validateConfig(draft);
} catch {
  draft = { ...DEFAULT_CONFIG };
}
let state = {
  page: "overview",
  draft,
  runs: Array.isArray(stored.runs)
    ? stored.runs
        .filter(
          (r) =>
            r.engineVersion === ENGINE_VERSION &&
            r.config &&
            r.slots &&
            r.summary &&
            r.data,
        )
        .slice(0, 4)
    : [],
  reviews:
    stored.reviews && typeof stored.reviews === "object" ? stored.reviews : {},
  general: typeof stored.general === "string" ? stored.general : "",
  slot: "AM",
  symbol: "",
  filter: "all",
  stage: "selection",
  busy: false,
  error: "",
  persistWarning: false,
  compareA: "",
  compareB: "",
};
let dataset = createDemoDataset(),
  datasetHash = "";
const demo = dataset;
let build = {
  revision: "development",
  ref: "local",
  engineVersion: ENGINE_VERSION,
};
const run = () => state.runs[0];
function save() {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        draft: state.draft,
        runs: state.runs.slice(0, 4),
        reviews: state.reviews,
        general: state.general,
      }),
    );
    state.persistWarning = false;
  } catch {
    state.persistWarning = true;
    toast("本地儲存空間不足，請匯出審閱包備份。");
  }
}
let toastTimer;
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
}
const labelReview = (s) =>
  ({ unreviewed: "未審閱", accepted: "接受暫定", change: "要求修改" })[s] ??
  "未審閱";
const reviewState = (id) =>
  ["accepted", "change"].includes(state.reviews[id]?.status)
    ? state.reviews[id].status
    : "unreviewed";
const reviewed = () =>
  ASSUMPTIONS.filter((a) => reviewState(a.id) !== "unreviewed").length;
function time(t, zone = "America/New_York", full = false) {
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: zone,
    ...(full ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(t));
}
const configDirty = () =>
  run() && canonical(state.draft) !== canonical(run().config);
function head(title, subtitle, actions = "") {
  return `<div class="heading-row"><div><p class="eyebrow">G3 策略研究 ／ 介面審閱</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="actions">${actions}</div></div>`;
}
const runButton = () =>
  `<button class="button primary" data-action="run" ${state.busy ? "disabled" : ""}>${state.busy ? "驗證及重播中…" : "▶　執行重播"}</button>`;
function dataBar() {
  const r = run();
  return `<div class="data-bar"><div class="data-title"><span class="badge ${dataset.kind === "synthetic" ? "amber" : "neutral"}">${dataset.kind === "synthetic" ? "合成示例資料" : "自行匯入 · 未獨立驗證"}</span><strong>${esc(dataset.id)}</strong><span>${dataset.instruments.length} 隻股票 · ${dataset.instruments[0].sessions.length} 個時段</span></div><span>${r ? "目前結果：" + esc(r.data.date) : "尚未執行"}　<span class="badge data-tag">沒有實盤下單</span></span></div>`;
}
function warnings() {
  return `${state.persistWarning ? '<div class="alert-local">本地儲存不可用，請匯出審閱包備份。</div>' : ""}${state.error ? `<div class="notice error" role="alert">運行已中止：${esc(state.error)}。先前結果保留，並非這次成功結果。</div>` : ""}${configDirty() ? '<div class="pending-run">參數草稿已修改。下方仍顯示上一次的鎖定版本；請執行重播更新結果。</div>' : ""}${run() && run().dataHash !== datasetHash ? '<div class="pending-run">已切換資料集；下方仍是上一資料集的結果，請重新執行。</div>' : ""}`;
}
function stat(label, value, hint, ico = "overview") {
  return `<div class="stat"><div class="label">${label}<span class="stat-icon">${icon(ico)}</span></div><div class="number">${value}</div><div class="hint">${hint}</div></div>`;
}
function gateCard(key, s) {
  const good = s.gate.pass;
  return `<div class="gate-card ${good ? "" : "fail"}"><div class="gate-top"><div><strong>${SLOT[key].label}交易開關</strong><div class="gate-time">紐約 ${key === "AM" ? "09:30–10:00" : "12:30–13:00"} 觀察</div></div><span class="badge ${good ? "success" : "amber"}">${good ? "可監察入市" : "整段跳過"}</span></div><div class="ratio-row"><div class="ratio-metric"><small>前日完整時段 RR</small><b>${num(s.previous.rr, 2)}</b></div><span class="ratio-arrow">→</span><div class="ratio-metric"><small>當日 30 分鐘 RR</small><b>${num(s.current.rr, 2)}</b></div></div><div class="counts">前日 B ${s.previous.B} / R ${s.previous.R}　·　當日 B ${s.current.B} / R ${s.current.R}</div><p class="gate-reason">${esc(s.gate.reason)}</p></div>`;
}
function workflow(r) {
  return `<div class="workflow">${["股票池篩選", "分時段揀股", "配注及組合", "整段開關", "逐股交易"].map((t, i) => `${i ? '<span class="stage-link">→</span>' : ""}<div class="stage-item"><span class="stage-num">${i + 1}</span><strong>${t}</strong><small>${[r.summary.eligible + " 隻通過", "早／午各自排名", "鎖定整數股數", "整份名單判斷", "時段尾清倉"][i]}</small></div>`).join("")}</div>`;
}
function selectedTable(key, limit = 100) {
  const s = run().slots[key];
  return `<div class="table-wrap"><table><thead><tr><th>候選股票</th><th class="right">B / R</th><th class="right">個股 RR</th><th class="right">股數</th><th class="right">參考名義金額</th><th>本時段結果</th></tr></thead><tbody>${
    s.selected
      .slice(0, limit)
      .map((row, i) => {
        const result = s.symbols.find((x) => x.symbol === row.symbol);
        return `<tr><td class="symbol"><span class="rank">${String(i + 1).padStart(2, "0")}</span>${esc(row.symbol)}</td><td class="right">${row.B} / ${row.R}</td><td class="right">${num(row.rr, 3)}</td><td class="right">${row.quantity}</td><td class="right">${money(row.notional)}</td><td><span class="badge ${result.status === "traded" ? "success" : "neutral"}">${statusLabel(result.status)}</span></td></tr>`;
      })
      .join("") || '<tr><td colspan="6">沒有符合篩選條件的候選</td></tr>'
  }</tbody></table></div>`;
}
const statusLabel = (s) =>
  ({
    traded: "已完成模擬交易",
    flat_no_event: "沒有首事件 · 空倉",
    skipped_by_strategy: "整段開關跳過",
  })[s] ?? s;
const slotTabs = () =>
  `<div class="tabs" role="group" aria-label="時段"><button data-slot="AM" class="${state.slot === "AM" ? "active" : ""}">早市</button><button data-slot="PM" class="${state.slot === "PM" ? "active" : ""}">午市</button></div>`;
function overview() {
  const r = run();
  if (!r)
    return (
      head(
        "策略重播工作台",
        "設定已準備好。執行一次合成資料重播，即可查看五階段流程及每項暫定假設。",
        runButton(),
      ) +
      dataBar() +
      warnings() +
      `<section class="panel"><div class="empty"><strong>由可追溯的一次重播開始</strong><p>12 隻虛構股票、完整歷史窗口；計算在你的瀏覽器執行。</p><p>每次運行會鎖定參數、資料指紋及所採用假設。</p><br>${runButton()}</div></section>`
    );
  return (
    head(
      "策略重播工作台",
      "由前日揀股，到當日逐股決策。每一個結果，都有規則及資料可追溯。",
      `<button class="button secondary" data-action="import-data">${icon("settings")} 匯入資料</button>${runButton()}`,
    ) +
    dataBar() +
    warnings() +
    `<section class="stats" aria-label="本次重播摘要">${stat("股票池篩選", `${r.summary.eligible}<small>/ ${r.summary.pool} 隻</small>`, "通過四項條件，未額外加入過濾", "overview")}${stat("早／午市候選", `${r.slots.AM.selected.length}<small>/ ${r.slots.PM.selected.length} 隻</small>`, "兩份前日名單獨立計算，可有重複", "results")}${stat("模擬成交筆數", num(r.summary.orders), `${r.summary.reversals} 次反手 · 平倉及反向分開記錄`, "replay")}${stat("待審閱假設", `${ASSUMPTIONS.length - reviewed()}<small>/ ${ASSUMPTIONS.length} 項</small>`, `<strong>${reviewed()} 項已有審閱狀態</strong> · 可逐項留言`, "assumptions")}</section><div class="grid-two"><section class="panel"><div class="panel-head"><div><h2>五階段決策流程</h2><p class="detail">${esc(r.data.previousDate)} 前日準備 → ${esc(r.data.date)} 當日模擬</p></div><span class="badge success">鎖定版本已完成</span></div>${workflow(r)}<div class="gate-grid">${gateCard("AM", r.slots.AM)}${gateCard("PM", r.slots.PM)}</div></section><section class="panel"><div class="panel-head"><h2>本次審閱重點</h2><span class="count-label">${reviewed()} / ${ASSUMPTIONS.length} 已標記</span></div><div class="panel-body"><div class="mini-callout"><span class="callout-icon">◇</span><div><h3>暫定假設，集中一次過確認</h3><p>原始策略未改寫。此版先把未定細節列明，讓你試操作及留下修改意見。</p></div></div><ul class="assumption-preview">${[
      "A05",
      "A08",
      "A16",
    ]
      .map((id) => {
        const a = ASSUMPTIONS.find((a) => a.id === id);
        return `<li><span class="assumption-id">${id}</span><div><strong>${esc(a.title)}</strong><small>${labelReview(reviewState(id))} · 可在假設頁留下意見</small></div></li>`;
      })
      .join(
        "",
      )}</ul><a class="panel-link" href="#assumptions">前往假設與留言 <span>→</span></a></div></section></div><section class="panel row-gap"><div class="panel-head"><div><h2>候選名單與配注</h2><p class="detail">個股 RR＝B／(R＋${r.config.k})；股數以 ${money(r.config.target)} 為目標</p></div>${slotTabs()}</div>${selectedTable(state.slot, 5)}<div class="table-note">只列首五隻。配注用前日收市價；不代表實際成交金額。 <a href="#results">查看完整五階段結果 →</a></div></section><div class="notice row-gap">${r.data.kind === "synthetic" ? "<strong>這是合成資料示例。</strong> 所有股票、價量及結果均由公式生成，不能解讀為市場回測或盈利證據。" : "<strong>自行匯入資料。</strong> 系統只驗證格式及已聲明的時點；歷史股票池、資料授權及公司行動仍須由供應方核實。"}</div>`
  );
}
const FIELD_LABELS = {
  lookback: "回看時段數",
  capMin: "平均市值門檻",
  volumeMin: "平均成交股數門檻",
  rangeMin: "平均波幅門檻",
  priceMin: "平均股價下限",
  priceMax: "平均股價上限",
  candidates: "每時段候選數",
  threshold: "Renko 變動門檻",
  mode: "Renko 模式",
  k: "個股 RR 常數 k",
  target: "每股目標名義金額",
  gateEnabled: "整段交易開關",
  equalPolicy: "RR 相等時",
  quantityTie: "股數同距離時",
  commission: "每筆成交佣金",
  slippageBps: "單邊滑價",
  h: "反向確認 h",
};
const field = (
  k,
  {
    hint = "",
    step = "any",
    min = 0,
    max,
    scale = 1,
    suffix = "",
    options,
    disabled = false,
  } = {},
) =>
  `<div class="field"><label for="field-${k}">${FIELD_LABELS[k]}${suffix ? " · " + suffix : ""}</label>${options ? `<select id="field-${k}" name="${k}" ${disabled ? "disabled" : ""}>${options.map(([value, label]) => `<option value="${value}" ${String(state.draft[k]) === value ? "selected" : ""}>${label}</option>`).join("")}</select>` : `<input id="field-${k}" name="${k}" type="number" value="${state.draft[k] * scale}" step="${step}" min="${min}" ${max !== undefined ? 'max="' + max + '"' : ""} data-scale="${scale}" ${disabled ? "disabled" : ""} required>`}<small>${hint}</small></div>`;
function settings() {
  return (
    head(
      "參數設定",
      "保留已知策略，清楚標示暫定細節。設定草稿與已完成運行分開保存。",
      runButton(),
    ) +
    warnings() +
    `<div class="notice"><strong>審閱版設定。</strong> 改動 k、等號、模式或成本會影響結果；每次重播另存鎖定快照，不會覆寫 v3 文件。</div><form id="config-form"><section class="panel form-section"><div class="panel-head"><h2><span class="section-num">01</span>股票池篩選</h2><span class="badge neutral">原條件 + A01–A04 計法</span></div><div class="panel-body form-grid">${field("lookback", { step: 1, min: 1, max: 250, hint: "A01：以完整交易時段計；預設 20。" })}${field("capMin", { suffix: "美元", hint: "嚴格大於；預設 20 億美元。" })}${field("volumeMin", { suffix: "股", hint: "嚴格大於；預設每日平均 1,000 萬股。" })}${field("rangeMin", { suffix: "%", scale: 100, max: 100, step: 0.1, hint: "A03：每日高低差／前收市價，再取平均。" })}${field("priceMin", { suffix: "美元", min: 0.01, hint: "A02：採每日 close 平均；含端點。" })}${field("priceMax", { suffix: "美元", min: 0.01, hint: "預設 1,000 美元；不額外要求前收市價範圍。" })}</div></section><section class="panel form-section"><div class="panel-head"><h2><span class="section-num">02–03</span>Renko、揀股及配注</h2><span class="badge amber">A05–A12 暫定細節</span></div><div class="panel-body form-grid">${field("candidates", { step: 1, min: 1, max: 100, hint: "早／午各自排名；同分代號排序，不足保留實際數。" })}${field("threshold", { suffix: "%", scale: 100, min: 0.01, max: 20, step: 0.01, hint: "A07：含等號，價格精度 0.0001 美元。" })}${field(
      "mode",
      {
        options: [
          ["fixed", "固定美元門檻"],
          ["percentage", "百分比逐事件複利（暫定）"],
        ],
        hint: "A06／A10：每窗口重設，完整算法見假設頁。",
      },
    )}${field("k", { step: 1, min: 1, max: 100, hint: "v3 為 1；改其他值會標示為實驗變體。" })}${field("target", { suffix: "美元", min: 0.01, hint: "股數取正整數最接近金額，可略超目標。" })}${field(
      "quantityTie",
      {
        options: [
          ["lower", "同距離取較少股數"],
          ["higher", "同距離取較多股數"],
        ],
        hint: "A12：以前日 close 計；整段及反手不重算。",
      },
    )}</div></section><section class="panel form-section"><div class="panel-head"><h2><span class="section-num">04–05</span>開關、持倉及成本</h2><span class="badge amber">理想化模擬 · 未接券商</span></div><div class="panel-body"><label class="toggle-label"><input id="field-gateEnabled" name="gateEnabled" type="checkbox" ${state.draft.gateEnabled ? "checked" : ""}>啟用整段交易開關（停用後仍須等各股首事件）</label><div class="form-grid row-gap">${field(
      "equalPolicy",
      {
        options: [
          ["skip", "RR 相等：跳過整段（預設）"],
          ["pass", "RR 相等：通過（實驗選項）"],
        ],
        hint: "A13：無論此選項，零分母仍顯示未定義。",
      },
    )}${field("h", { disabled: true, hint: "固定 h＝1；h＝2／3 完整規則未定，未開放。" })}${field("commission", { suffix: "美元／筆", min: 0, max: 100, hint: "A18：每個 fill 計一次；反手是兩筆。" })}${field("slippageBps", { suffix: "基點／單邊", min: 0, max: 1000, hint: "5 基點＝0.05%；買價上調、賣價下調，不重複扣費。" })}</div></div></section><div class="notice success">固定紐約時間：早市觀察 09:30–10:00、監察至 12:30；午市觀察 12:30–13:00、監察至 16:00。此版不支援半日市或自訂時段。</div><div class="form-actions"><p class="settings-note">改動先存成草稿；只有重新執行才產生新結果。舊運行設定不會跟隨草稿改動。</p><button class="button secondary" type="button" data-action="reset-config">還原 v3 審閱預設</button><button class="button primary" type="submit">儲存設定草稿</button></div></form><section class="panel row-gap"><div class="panel-head"><h2>資料集</h2><span class="badge ${dataset.kind === "synthetic" ? "amber" : "neutral"}">${dataset.kind === "synthetic" ? "合成示例" : "自行匯入"}</span></div><div class="panel-body"><p class="subtitle">JSON 格式，最大 40 MB。所有資料在瀏覽器處理，不會上傳。匯入先驗證，失敗不會替換現有資料集。</p><div class="actions row-gap"><button class="button secondary" type="button" data-action="import-data">匯入資料 JSON</button><button class="button secondary" type="button" data-action="export-data">下載目前資料（含格式範本）</button><button class="button ghost" type="button" data-action="demo-data">還原合成示例</button></div><p class="subtitle row-gap">${esc(dataset.description)} 實際歷史資料須另行核實授權、日曆、股票池及公司行動；此版沒有即時行情。</p></div></section>`
  );
}
function results() {
  const r = run();
  if (!r) return noRun();
  const s = r.slots[state.slot];
  return (
    head(
      "五階段結果",
      "從篩選數值，到逐股持倉。每一層都可核對其輸入與輸出。",
      runButton(),
    ) +
    dataBar() +
    warnings() +
    `<section class="panel"><div class="panel-head"><div><h2>階段 ①｜股票池四項篩選</h2><p class="detail">${r.config.lookback} 個前日完整時段；所有數值按本次鎖定設定計算。</p></div><span class="badge success">${r.summary.eligible} / ${r.summary.pool} 通過</span></div><div class="table-wrap"><table><thead><tr><th>股票</th><th class="right">平均市值（美元）</th><th class="right">平均日成交股數</th><th class="right">平均波幅</th><th class="right">平均收市價</th><th>結果／不通過條件</th></tr></thead><tbody>${r.screening
      .map(
        (row) =>
          `<tr><td class="symbol">${esc(row.symbol)}</td><td class="right">${num(row.cap)}</td><td class="right">${num(row.volume)}</td><td class="right">${pct(row.range)}</td><td class="right">${num(row.price, 2)}</td><td><span class="badge ${row.pass ? "success" : "amber"}">${
            row.pass
              ? "通過"
              : Object.entries(row.checks)
                  .filter(([, v]) => !v)
                  .map(
                    ([k]) =>
                      ({
                        cap: "市值",
                        volume: "成交量",
                        range: "波幅",
                        price: "股價",
                      })[k],
                  )
                  .join("、")
          }</span></td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></section><section class="panel row-gap"><div class="panel-head"><div><h2>階段 ②–③｜揀股及配注</h2><p class="detail">按 B／(R＋${r.config.k}) 由高至低；同分依代號；不加入最低 B 過濾。</p></div>${slotTabs()}</div>${selectedTable(state.slot)}<div class="table-note">個股配注以 ${esc(r.data.previousDate)} 收市價作暫定參考，目標 ${money(r.config.target)}；實際成交名義金額可不同。</div></section><section class="panel row-gap"><div class="panel-head"><h2>階段 ④｜整段交易開關</h2><span class="count-label">保留原始 B／R，使用交叉相乘精確比較</span></div><div class="gate-grid row-gap">${gateCard("AM", r.slots.AM)}${gateCard("PM", r.slots.PM)}</div></section><section class="panel row-gap"><div class="panel-head"><h2>階段 ⑤｜逐股執行結果</h2><a href="#replay">查看分鐘圖及成交紀錄 →</a></div><div class="table-wrap"><table><thead><tr><th>股票</th><th>狀態</th><th class="right">成交筆數</th><th class="right">反手次數</th><th class="right">佣金</th><th class="right">模擬淨額*</th><th class="right">尾段持倉</th></tr></thead><tbody>${s.symbols.map((row) => `<tr><td class="symbol">${esc(row.symbol)}</td><td>${statusLabel(row.status)}</td><td class="right">${row.fills.length}</td><td class="right">${row.reversals}</td><td class="right">${money(row.fees)}</td><td class="right">${money(row.net)}</td><td class="right">${row.position}</td></tr>`).join("") || '<tr><td colspan="7">沒有候選股票</td></tr>'}</tbody></table></div><div class="table-note">*理想化成交及簡化成本下的賬本診斷，不是盈利或 G4 驗證。開關跳過、沒有首事件及資料錯誤會分開顯示。</div></section>${manifest(r)}`
  );
}
const ACTION_LABELS = {
  open_long: "首事件・開長倉",
  open_short: "首事件・開淡倉",
  close_reverse: "反向・先平倉",
  reverse_long: "反向・開長倉",
  reverse_short: "反向・開淡倉",
  slot_exit: "時段尾・清倉",
};
function priceChart(result) {
  const pts = result.points;
  if (pts.length < 2)
    return '<div class="empty">該時段未進入逐股交易監察；沒有成交圖。</div>';
  const width = 1000,
    height = 280,
    left = 55,
    right = 20,
    top = 20,
    bottom = 36,
    min = Math.min(...pts.map((p) => p.price)),
    max = Math.max(...pts.map((p) => p.price)),
    pad = (max - min) * 0.1 || 1,
    lo = min - pad,
    hi = max + pad;
  const x = (t) =>
      left +
      ((Date.parse(t) - Date.parse(pts[0].time)) /
        (Date.parse(pts.at(-1).time) - Date.parse(pts[0].time))) *
        (width - left - right),
    y = (p) => top + ((hi - p) / (hi - lo)) * (height - top - bottom);
  const path = pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(p.time).toFixed(1)},${y(p.price).toFixed(1)}`,
    )
    .join(" ");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(result.symbol)} 分鐘價格及模擬買賣標記；完整數值見下方表格">${Array.from(
    { length: 5 },
    (_, i) => {
      let p = lo + ((hi - lo) * i) / 4;
      return `<line class="chart-grid" x1="${left}" y1="${y(p)}" x2="${width - right}" y2="${y(p)}"/><text x="${left - 10}" y="${y(p) + 4}" text-anchor="end">${num(p, 1)}</text>`;
    },
  ).join(
    "",
  )}<path class="chart-line" d="${path}"/>${result.fills.map((f) => `<circle class="chart-marker ${f.side}" cx="${x(f.time)}" cy="${y(f.reference)}" r="4"><title>${time(f.time)} ${ACTION_LABELS[f.action]} ${f.quantity} 股 @ ${num(f.price, 4)}</title></circle>`).join("")}${[
    0, 0.25, 0.5, 0.75, 1,
  ]
    .map((p) => {
      const t = new Date(
        Date.parse(pts[0].time) +
          (Date.parse(pts.at(-1).time) - Date.parse(pts[0].time)) * p,
      );
      return `<text x="${x(t)}" y="${height - 10}" text-anchor="middle">${time(t)}</text>`;
    })
    .join(
      "",
    )}</svg><div class="chart-legend"><span>紐約時間 · 線為分鐘 close</span><span><i class="legend-dot"></i>模擬買入</span><span><i class="legend-dot sell"></i>模擬賣出</span><span>標記位置為參考價；成交含設定滑價</span></div>`;
}
function replay() {
  const r = run();
  if (!r) return noRun();
  const symbols = r.slots[state.slot].symbols;
  if (!symbols.some((s) => s.symbol === state.symbol))
    state.symbol = symbols[0]?.symbol ?? "";
  const result = symbols.find((s) => s.symbol === state.symbol);
  return (
    head(
      "逐股重播",
      "按分鐘查看訊號、平倉與反手。所有時間均在分鐘資料完成後才產生。",
      `<button class="button secondary" data-action="export-ledger">下載成交 CSV</button>`,
    ) +
    warnings() +
    `<div class="filter-row">${slotTabs()}<label for="symbol-select" class="screen-reader">選擇股票</label><select id="symbol-select" class="select-control" style="max-width:220px">${symbols.map((s) => `<option value="${s.symbol}" ${s.symbol === state.symbol ? "selected" : ""}>${s.symbol} · ${statusLabel(s.status)}</option>`).join("")}</select><span class="badge neutral">${esc(r.data.date)} · h＝1</span></div>${!result ? '<div class="panel empty">本時段沒有候選股票</div>' : `<section class="panel"><div class="panel-head"><div><h2>${esc(result.symbol)} · ${SLOT[state.slot].label}價格及決策</h2><p class="detail">${result.status === "skipped_by_strategy" ? esc(result.reason) : "初始價 " + money(result.initial) + " · 固定 " + result.quantity + " 股；同向事件只持有，不加注。"}</p></div><span class="badge ${result.status === "traded" ? "success" : "neutral"}">${statusLabel(result.status)}</span></div><div class="metric-strip"><div><small>模擬成交</small><strong>${result.fills.length} 筆</strong></div><div><small>反手</small><strong>${result.reversals} 次</strong></div><div><small>佣金</small><strong>${money(result.fees)}</strong></div><div><small>模擬淨額 · 非盈利驗證</small><strong>${money(result.net)}</strong></div><div><small>時段尾持倉</small><strong>${result.position} 股</strong></div></div><div class="panel-body">${priceChart(result)}</div></section><section class="panel row-gap"><div class="panel-head"><h2>逐筆成交紀錄</h2><span class="count-label">參考價與理想化成交價分開列明</span></div><div class="table-wrap"><table><thead><tr><th>紐約時間</th><th>香港日期／時間</th><th>動作</th><th class="right">股數</th><th class="right">參考價</th><th class="right">模擬成交價</th><th class="right">佣金</th><th class="right">成交後持倉</th></tr></thead><tbody>${result.fills.map((f) => `<tr><td>${time(f.time)}</td><td>${time(f.time, "Asia/Hong_Kong", true)}</td><td>${ACTION_LABELS[f.action]}</td><td class="right">${f.quantity}</td><td class="right">${num(f.reference, 4)}</td><td class="right">${num(f.price, 4)}</td><td class="right">${money(f.fee)}</td><td class="right">${f.position}</td></tr>`).join("") || `<tr><td colspan="8">${result.status === "flat_no_event" ? "沒有首個達標事件；整段維持空倉。" : "整段開關未通過；沒有產生訂單。"}</td></tr>`}</tbody></table></div></section>${result.holdEvents?.length ? `<div class="notice success row-gap">另有 ${result.holdEvents.length} 個同向持有事件：已記錄於匯出審閱包，沒有加注或額外收費。</div>` : ""}`}<div class="notice row-gap">此版用已知 close 加減滑價作即時理想化成交。沒有模擬券商延遲、部分成交、借貨或購買力；不能聲稱上述價格真實可成交。</div>`
  );
}
function assumptions() {
  let rows = ASSUMPTIONS.filter(
    (a) => state.filter === "all" || reviewState(a.id) === state.filter,
  );
  return (
    head(
      "假設與留言",
      "未有定論的地方先採明確假設。逐項標記或留言，審閱完可一次過匯出交回。",
      `<button class="button secondary" data-action="import-review">匯入審閱包</button><button class="button primary" data-action="export-review">匯出全部留言 ↗</button>`,
    ) +
    `<div class="notice"><strong>這是審閱記錄，不是策略批准。</strong>「接受暫定」只記錄你的本地意向，不會自動修改引擎或原始 v3。留言只存在此瀏覽器，請匯出備份。01c 對話尚未納入。</div><section class="panel"><div class="panel-head"><h2>已有來源支持的設定</h2><span class="badge success">沿用原意，不用重問</span></div><div class="panel-body"><ul class="known-list">${KNOWN.map((k) => `<li>${esc(k)}</li>`).join("")}</ul></div></section><div class="section-divider"><h2>暫定假設登記冊 <span class="count-label">${ASSUMPTIONS.length} 項</span></h2><span id="review-progress" class="count-label">${reviewed()} 項已標記</span></div><div class="filter-row" role="group" aria-label="按審閱狀態篩選">${[
      ["all", "全部"],
      ["unreviewed", "未審閱"],
      ["change", "要求修改"],
      ["accepted", "接受暫定"],
    ]
      .map(
        ([value, label]) =>
          `<button data-filter="${value}" class="${state.filter === value ? "active" : ""}">${label}</button>`,
      )
      .join(
        "",
      )}</div>${rows.map((a) => `<section class="assumption-card"><div><div class="review-top"><h3><span class="assumption-id">${a.id}</span>　${esc(a.title)}</h3><span class="badge amber">暫定假設</span></div><p class="choice">${esc(a.choice)}</p><p class="reason">依據／影響：${esc(a.reason)}</p></div><div class="review-controls"><label class="comment-label" for="status-${a.id}">你的審閱意見</label><select id="status-${a.id}" class="select-control" data-review-status="${a.id}">${["unreviewed", "accepted", "change"].map((s) => `<option value="${s}" ${reviewState(a.id) === s ? "selected" : ""}>${labelReview(s)}</option>`).join("")}</select><label class="screen-reader" for="comment-${a.id}">${a.id} 留言</label><textarea id="comment-${a.id}" class="review-comment" data-review-comment="${a.id}" maxlength="4000" placeholder="例如：改用前收市價；或請先展示另一種計法…">${esc(state.reviews[a.id]?.comment ?? "")}</textarea></div></section>`).join("") || '<div class="panel empty">此分類暫時沒有項目</div>'}<section class="panel row-gap"><div class="panel-head"><h2>整體介面及其他意見</h2></div><div class="panel-body"><label class="screen-reader" for="general-comment">整體意見</label><textarea id="general-comment" class="review-comment" rows="4" maxlength="12000" placeholder="例如：想先看組合風險；表格需要哪些欄位；你想如何比較兩個版本…">${esc(state.general)}</textarea><p class="subtitle row-gap">匯出檔會包括全部假設、留言、草稿、最多四次運行的鎖定設定及結果。原始匯入價量資料不會包含在審閱包；如需可另行下載。</p></div></section>`
  );
}
function manifest(r) {
  return `<section class="panel row-gap"><div class="panel-head"><h2>運行版本及追溯資料</h2><span class="badge ${r.config.k === 1 ? "neutral" : "amber"}">${r.config.k === 1 ? "v3 個股 k＝1" : "實驗：k 已更改"} · 暫定執行規則</span></div><div class="panel-body"><dl class="run-meta"><div><dt>運行 ID／完成時間</dt><dd>${esc(r.id)} · ${time(r.createdAt, "Asia/Hong_Kong", true)} 香港時間</dd></div><div><dt>引擎版本／假設版本</dt><dd>${ENGINE_VERSION} · A01–A22／v1</dd></div><div><dt>程式修訂</dt><dd class="mono">${esc(r.build?.revision ?? "較早的本地審閱運行")}</dd></div><div><dt>鎖定參數 SHA-256</dt><dd class="mono">${r.configHash}</dd></div><div><dt>資料 SHA-256</dt><dd class="mono">${r.dataHash}</dd></div></dl><p class="subtitle row-gap">原始參數文件及來源對照：<a href="https://github.com/newprojectshkau/Win-win/blob/g3-platform-review/model/parameters.json" target="_blank" rel="noopener">v3 參數</a> · <a href="https://github.com/newprojectshkau/Win-win/blob/g3-platform-review/docs/G3-checklist-01-source-audit-zh-HK.md" target="_blank" rel="noopener">原始資料核對</a>。運行指紋識別輸入，並不證明供應商資料正確。</p></div></section>`;
}
function compare() {
  const runs = state.runs;
  if (runs.length < 2)
    return (
      head("版本比較", "同一資料、不同設定的結果可以並排比較。", runButton()) +
      `<section class="panel"><div class="empty"><strong>再建立一個版本，便可比較</strong><p>前往參數設定，修改目標金額、門檻或交易開關，再執行重播。</p><p>前一次運行的設定及結果會保持不變；最多保留四次。</p><br><a class="button primary" href="#settings">前往參數設定 →</a></div></section>`
    );
  const a = runs.find((r) => r.id === state.compareA) ?? runs[1],
    b = runs.find((r) => r.id === state.compareB) ?? runs[0];
  const changes = Object.keys(DEFAULT_CONFIG).filter(
    (k) => a.config[k] !== b.config[k],
  );
  return (
    head(
      "版本比較",
      "保留每次運行的有效設定；比較參數改動如何傳遞至名單、開關及成交。",
      `<button class="button secondary" data-action="export-review">匯出比較所需資料</button>`,
    ) +
    `<div class="comparison-select">${[
      ["a", a],
      ["b", b],
    ]
      .map(
        ([key, r]) =>
          `<div class="field"><label for="compare-${key}">版本 ${key.toUpperCase()}</label><select id="compare-${key}">${runs.map((x) => `<option value="${esc(x.id)}" ${x.id === r.id ? "selected" : ""}>${esc(x.id)} · 目標 ${x.config.target} · 門檻 ${pct(x.config.threshold)}</option>`).join("")}</select></div>`,
      )
      .join(
        "",
      )}</div>${a.dataHash !== b.dataHash ? '<div class="notice">兩次運行的資料指紋不同，差異不一定由參數造成；不可直接比較策略效果。</div>' : '<div class="notice success">兩次運行使用相同資料指紋。成本、模式及其他假設的差異仍須一起審閱。</div>'}<section class="panel"><div class="panel-head"><h2>設定差異</h2><span class="count-label">${changes.length} 項改動</span></div><div class="table-wrap"><table><thead><tr><th>設定</th><th>版本 A</th><th>版本 B</th></tr></thead><tbody>${changes.map((k) => `<tr><td>${FIELD_LABELS[k]}</td><td>${esc(a.config[k])}</td><td>${esc(b.config[k])}</td></tr>`).join("") || '<tr><td colspan="3">設定相同；可用來核對重跑一致性。</td></tr>'}</tbody></table></div></section><section class="panel row-gap"><div class="panel-head"><h2>輸出差異</h2><span class="badge amber">診斷用途 · 不作優化建議</span></div><div class="table-wrap"><table><thead><tr><th>項目</th><th class="right">版本 A</th><th class="right">版本 B</th><th class="right">B − A</th></tr></thead><tbody>${[
      ["eligible", "通過篩選股票"],
      ["orders", "成交筆數"],
      ["reversals", "反手次數"],
      ["fees", "佣金總額"],
      ["net", "模擬淨額（非盈利驗證）"],
    ]
      .map(
        ([k, label]) =>
          `<tr><td>${label}</td><td class="right">${num(a.summary[k], k === "net" || k === "fees" ? 2 : 0)}</td><td class="right">${num(b.summary[k], k === "net" || k === "fees" ? 2 : 0)}</td><td class="right">${num(b.summary[k] - a.summary[k], k === "net" || k === "fees" ? 2 : 0)}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></section><div class="grid-two row-gap">${[
      ["A", a],
      ["B", b],
    ]
      .map(
        ([label, r]) =>
          `<section class="panel"><div class="panel-head"><h2>版本 ${label} 的交易開關</h2></div><div class="panel-body">${["AM", "PM"].map((slot) => `<p class="subtitle">${SLOT[slot].label}：${esc(r.slots[slot].gate.reason)} · ${r.slots[slot].selected.map((s) => esc(s.symbol)).join("、") || "無候選"}</p>`).join("<br>")}</div></section>`,
      )
      .join("")}</div>`
  );
}
function noRun() {
  return (
    head(
      "尚未有重播結果",
      "先執行一次重播，再查看完整結果及追溯紀錄。",
      runButton(),
    ) + warnings()
  );
}
function render() {
  const page = PAGES[state.page] ? state.page : "overview";
  $("#nav").innerHTML = Object.entries(PAGES)
    .map(
      ([key, label]) =>
        `<a href="#${key}" aria-label="${label}" class="${page === key ? "active" : ""}" ${page === key ? 'aria-current="page"' : ""}>${icon(key)}<span>${label}</span>${key === "assumptions" ? `<span class="nav-count">${ASSUMPTIONS.length - reviewed()}</span>` : ""}</a>`,
    )
    .join("");
  $("#nav").insertAdjacentHTML("beforeend", '<a href="./simulator.html" aria-label="期間績效模擬"><span>期間績效模擬 ↗</span></a>');
  $("#page-crumb").textContent = PAGES[page];
  $("#main").innerHTML =
    `<div class="page">${{ overview, settings, results, replay, assumptions, compare }[page]()}</div>`;
  document.querySelectorAll("#main .panel").forEach((panel, index) => {
    const heading = panel.querySelector(":scope > .panel-head h2");
    if (heading && !heading.querySelector(".section-num")) {
      const marker = document.createElement("span");
      marker.className = "section-num";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = String(index + 1).padStart(2, "0");
      heading.prepend(marker);
    }
  });
  document.title = `${PAGES[page]}｜Win-win G3 審閱平台`;
}
async function execute() {
  if (state.busy) return;
  state.busy = true;
  state.error = "";
  render();
  await new Promise((r) => setTimeout(r, 45));
  try {
    const config = structuredClone(state.draft);
    validateConfig(config);
    const result = runReplay(dataset, config);
    result.build = structuredClone(build);
    result.createdAt = new Date().toISOString();
    result.id = `R${String(Date.now()).slice(-8)}-${state.runs.length + 1}`;
    result.configHash = await fingerprint(config);
    result.dataHash = datasetHash || (await fingerprint(dataset));
    state.runs.unshift(result);
    state.runs = state.runs.slice(0, 4);
    state.compareA = "";
    state.compareB = "";
    save();
    toast("重播完成。已鎖定本次設定及資料指紋。");
  } catch (e) {
    state.error = e.message;
    toast("重播未完成；已保留先前結果。");
  } finally {
    state.busy = false;
    render();
  }
}
function download(filename, value, type = "application/json") {
  const b = new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type },
    ),
    u = URL.createObjectURL(b),
    a = document.createElement("a");
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}
function exportReview() {
  download(
    "winwin-g3-review-" + new Date().toISOString().slice(0, 10) + ".json",
    {
      schemaVersion: 1,
      type: "winwin-g3-review",
      engineVersion: ENGINE_VERSION,
      exportedAt: new Date().toISOString(),
      scope: "審閱意見及暫定假設，不代表已批准策略或市場回測",
      assumptions: ASSUMPTIONS.map((a) => ({
        ...a,
        review: {
          status: reviewState(a.id),
          comment: state.reviews[a.id]?.comment ?? "",
        },
      })),
      general: state.general,
      draft: state.draft,
      runs: state.runs,
    },
  );
  toast("已下載審閱包；可把檔案交回作集中修改。");
}
function readFormDraft() {
  const form = $("#config-form");
  if (!form) return;
  const next = { ...state.draft };
  for (const [k] of Object.entries(DEFAULT_CONFIG)) {
    const el = form.elements.namedItem(k);
    if (!el || el.disabled) continue;
    next[k] =
      el.type === "checkbox"
        ? el.checked
        : el.tagName === "SELECT"
          ? el.value
          : Number(el.value) / Number(el.dataset.scale || 1);
  }
  validateConfig(next);
  state.draft = next;
  save();
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action],[data-slot],[data-filter]");
  if (!el) return;
  if (el.dataset.slot) {
    state.slot = el.dataset.slot;
    state.symbol = "";
    render();
    return;
  }
  if (el.dataset.filter) {
    state.filter = el.dataset.filter;
    render();
    return;
  }
  switch (el.dataset.action) {
    case "run":
      try {
        readFormDraft();
        await execute();
      } catch (err) {
        toast(err.message);
      }
      break;
    case "export-review":
      exportReview();
      break;
    case "import-data":
      $("#dataset-input").click();
      break;
    case "import-review":
      $("#review-input").click();
      break;
    case "export-data":
      download("winwin-g3-" + dataset.id + ".json", dataset);
      toast("資料已下載，可作 JSON 格式範本。");
      break;
    case "demo-data":
      dataset = demo;
      datasetHash = await fingerprint(demo);
      state.error = "";
      render();
      toast("已還原合成資料。請重新執行。");
      break;
    case "reset-config":
      state.draft = { ...DEFAULT_CONFIG };
      save();
      render();
      toast("已還原草稿；已完成的運行不變。");
      break;
    case "export-ledger":
      if (run()) {
        const keys = [
          "id",
          "symbol",
          "slot",
          "time",
          "action",
          "side",
          "quantity",
          "reference",
          "price",
          "fee",
          "position",
          "cash",
        ];
        download(
          "winwin-g3-ledger.csv",
          "\uFEFF" +
            [
              keys.join(","),
              ...run().fills.map((f) =>
                keys.map((k) => JSON.stringify(f[k])).join(","),
              ),
            ].join("\r\n"),
          "text/csv;charset=utf-8",
        );
      }
      break;
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "config-form") {
    e.preventDefault();
    try {
      readFormDraft();
      render();
      toast("設定草稿已保存。重新執行才會更新結果。");
    } catch (err) {
      toast(err.message);
    }
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.reviewComment) {
    const id = el.dataset.reviewComment;
    state.reviews[id] = {
      status: reviewState(id),
      ...state.reviews[id],
      comment: el.value,
    };
    save();
  }
  if (el.id === "general-comment") {
    state.general = el.value;
    save();
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.reviewStatus) {
    const id = el.dataset.reviewStatus;
    state.reviews[id] = { ...state.reviews[id], status: el.value };
    save();
    $("#review-progress").textContent = `${reviewed()} 項已標記`;
    const count = $(".nav-count");
    if (count) count.textContent = ASSUMPTIONS.length - reviewed();
    toast("審閱狀態已保存在此瀏覽器。");
  }
  if (el.id === "symbol-select") {
    state.symbol = el.value;
    render();
  }
  if (el.id === "compare-a") {
    state.compareA = el.value;
    render();
  }
  if (el.id === "compare-b") {
    state.compareB = el.value;
    render();
  }
});
$("#dataset-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 40 * 1024 * 1024) throw Error("檔案超過 40 MB 上限");
    const data = JSON.parse(await file.text());
    const { validateDataset } = await import("./engine.js");
    validateDataset(data);
    if (data.kind === "synthetic" && data.id !== demo.id)
      throw Error("自訂資料請標記 kind 為 imported");
    dataset = data;
    datasetHash = await fingerprint(dataset);
    state.error = "";
    render();
    toast("資料驗證完成，請執行重播；供應商聲明仍須審閱。");
  } catch (err) {
    toast("匯入失敗：" + err.message);
  } finally {
    e.target.value = "";
  }
});
$("#review-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw Error("審閱包過大");
    const data = JSON.parse(await file.text());
    if (
      data.type !== "winwin-g3-review" ||
      data.schemaVersion !== 1 ||
      !Array.isArray(data.assumptions)
    )
      throw Error("不是有效審閱包");
    const next = { ...state.reviews };
    for (const a of data.assumptions) {
      if (
        ASSUMPTIONS.some((x) => x.id === a.id) &&
        ["unreviewed", "accepted", "change"].includes(a.review?.status) &&
        typeof a.review.comment === "string" &&
        a.review.comment.length <= 4000
      )
        next[a.id] = { status: a.review.status, comment: a.review.comment };
    }
    state.reviews = next;
    if (typeof data.general === "string" && data.general.length <= 12000)
      state.general = data.general;
    save();
    render();
    toast("已匯入留言及狀態；沒有替換引擎設定或運行結果。");
  } catch (err) {
    toast("匯入失敗：" + err.message);
  } finally {
    e.target.value = "";
  }
});
window.addEventListener("hashchange", () => {
  state.page = location.hash.slice(1) || "overview";
  render();
  window.scrollTo(0, 0);
});
async function start() {
  try {
    const response = await fetch("./build.json", { cache: "no-cache" });
    if (response.ok) build = await response.json();
  } catch {}
  state.page = location.hash.slice(1) || "overview";
  render();
  try {
    datasetHash = await fingerprint(dataset);
    if (!run()) {
      await execute();
    } else render();
  } catch (e) {
    state.error = "瀏覽器無法建立資料指紋：" + e.message;
    render();
  }
}
start();
